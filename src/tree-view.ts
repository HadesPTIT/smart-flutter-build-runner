import * as vsc from 'vscode';
import { readYaml } from './read-yaml';
import { scanWorkspace } from './scan-workspace';
import { BuildRunnerTaskDefinition } from './tasks';

const GLOB_PATTERN = '**/pubspec.yaml';
const PUBSPEC_YAML_REGEX = /pubspec\.yaml$/;
const LEADING_SLASH_REGEX = /^\//;

export type PackageStatus = 'idle' | 'building' | 'watching' | 'failed';

interface PubspecYaml {
  name?: unknown;
  dependencies?: Record<string, unknown>;
  dev_dependencies?: Record<string, unknown>;
  workspace?: unknown[];
}

interface FileCacheEntry {
  mtime: number;
  pubspec: PubspecYaml | null;
}

export class LatestRequestController {
  private latestRequestId = 0;

  beginRequest(): number {
    this.latestRequestId += 1;
    return this.latestRequestId;
  }

  isLatestRequest(requestId: number): boolean {
    return requestId === this.latestRequestId;
  }
}

export class ProjectTreeItem extends vsc.TreeItem {
  constructor(
    readonly title: string,
    readonly resourceUri: vsc.Uri,
    readonly packagePath: string,
    readonly relativePath: string,
    readonly isWorkspace: boolean = false,
    public status: PackageStatus = 'idle',
  ) {
    super(title, vsc.TreeItemCollapsibleState.None);
    this.updateState();
  }

  updateState() {
    // 1. Set Context Value for inline menus (matches file-idle, file-watching, etc.)
    this.contextValue = `file-${this.status}`;

    // 2. Set Description
    const statusText = this.status === 'watching' ? '(watching...) • ' :
                       this.status === 'building' ? '(building...) • ' :
                       this.status === 'failed'   ? '(failed) • ' : '';
    this.description = `${statusText}${this.relativePath || '.'}`;

    // 3. Set Icon
    if (this.status === 'watching') {
      this.iconPath = new vsc.ThemeIcon('broadcast', new vsc.ThemeColor('charts.green'));
    } else if (this.status === 'building') {
      this.iconPath = new vsc.ThemeIcon('loading~spin', new vsc.ThemeColor('charts.blue'));
    } else if (this.status === 'failed') {
      this.iconPath = new vsc.ThemeIcon('warning', new vsc.ThemeColor('charts.red'));
    } else {
      this.iconPath = new vsc.ThemeIcon('package');
    }

    // 4. Tooltip
    this.tooltip = `${this.title}\nPath: ${this.packagePath}\nStatus: ${this.status}`;

    // 5. Command to open pubspec.yaml on click
    this.command = {
      title: 'Open pubspec.yaml',
      command: 'vscode.open',
      arguments: [this.resourceUri],
    };
  }
}

class TreeProvider implements vsc.TreeDataProvider<ProjectTreeItem> {
  private readonly onDidChangeTreeDataEmitter = new vsc.EventEmitter<ProjectTreeItem | undefined | void>();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  private items: ProjectTreeItem[] = [];
  private statuses = new Map<string, PackageStatus>();

  refresh(): void {
    this.onDidChangeTreeDataEmitter.fire();
  }

  setItems(items: ProjectTreeItem[]): void {
    this.items = items;
    // Keep statuses map in sync for found packages
    for (const item of items) {
      if (!this.statuses.has(item.packagePath)) {
        this.statuses.set(item.packagePath, 'idle');
      } else {
        // Restore previous status
        item.status = this.statuses.get(item.packagePath)!;
        item.updateState();
      }
    }
  }

  setStatus(packagePath: string, status: PackageStatus): void {
    this.statuses.set(packagePath, status);
    const item = this.items.find(i => i.packagePath === packagePath);
    if (item) {
      item.status = status;
      item.updateState();
      this.onDidChangeTreeDataEmitter.fire(item); // Refresh just this item
    } else {
      this.refresh();
    }
  }

  getStatus(packagePath: string): PackageStatus {
    return this.statuses.get(packagePath) || 'idle';
  }

  getTreeItem(element: ProjectTreeItem): ProjectTreeItem {
    return element;
  }

  getChildren(): ProjectTreeItem[] {
    return this.items;
  }
}

let treeViewDisposable: vsc.Disposable | undefined;
let watcher: vsc.FileSystemWatcher | undefined;
export const provider = new TreeProvider();
const yamlCache = new Map<string, FileCacheEntry>();
const loadRequestController = new LatestRequestController();

function triggerTreeDataLoad(): void {
  void loadTreeData().catch((error) => {
    console.error('Failed to load build_runner tree data.', error);
  });
}

export function registerTreeView(context: vsc.ExtensionContext): void {
  treeViewDisposable = vsc.window.registerTreeDataProvider('smart_build_runner_view', provider);
  context.subscriptions.push({ dispose: () => treeViewDisposable?.dispose() });

  // Listen to Task events to update state reactively
  context.subscriptions.push(
    vsc.tasks.onDidStartTask((e) => {
      const def = e.execution.task.definition as BuildRunnerTaskDefinition;
      if (def && def.type === 'smart_build_runner') {
        const packagePath = def.packagePath;
        const taskType = def.taskType;
        if (taskType === 'watch') {
          provider.setStatus(packagePath, 'watching');
        } else {
          provider.setStatus(packagePath, 'building');
        }
      }
    }),
    vsc.tasks.onDidEndTaskProcess((e) => {
      const def = e.execution.task.definition as BuildRunnerTaskDefinition;
      if (def && def.type === 'smart_build_runner') {
        const packagePath = def.packagePath;
        const taskType = def.taskType;
        if (e.exitCode !== undefined && e.exitCode !== 0) {
          if (taskType === 'watch') {
            provider.setStatus(packagePath, 'idle');
          } else {
            provider.setStatus(packagePath, 'failed');
          }
        } else {
          provider.setStatus(packagePath, 'idle');
        }
      }
    })
  );

  watcher = vsc.workspace.createFileSystemWatcher(GLOB_PATTERN);
  context.subscriptions.push(watcher);

  let debounceTimer: NodeJS.Timeout | undefined;
  const debouncedLoad = () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      triggerTreeDataLoad();
    }, 300);
  };
  watcher.onDidCreate(debouncedLoad);
  watcher.onDidChange(debouncedLoad);
  watcher.onDidDelete(debouncedLoad);

  context.subscriptions.push({ dispose: () => clearTimeout(debounceTimer) });

  triggerTreeDataLoad();
}

export function refreshTreeView(): void {
  yamlCache.clear();
  triggerTreeDataLoad();
}

async function readYamlWithCache(uri: vsc.Uri, requestId: number): Promise<PubspecYaml | null> {
  const key = uri.toString();
  try {
    const stat = await vsc.workspace.fs.stat(uri);
    const cached = yamlCache.get(key);
    if (cached && cached.mtime === stat.mtime) {
      return cached.pubspec;
    }
    const pubspec = await readYaml(uri) as PubspecYaml | null;

    if (loadRequestController.isLatestRequest(requestId)) {
      yamlCache.set(key, { mtime: stat.mtime, pubspec });
    }

    return pubspec;
  }
  catch {
    if (loadRequestController.isLatestRequest(requestId)) {
      yamlCache.delete(key);
    }
    return null;
  }
}

async function loadTreeData(): Promise<void> {
  const requestId = loadRequestController.beginRequest();
  const results = await scanWorkspace(GLOB_PATTERN);

  const workspaceItems = new Map<string, ProjectTreeItem[]>();
  for (const { workspace, fileUris } of results) {
    const pubspecs = await Promise.all(
      fileUris.map(async (uri) => {
        const pubspec = await readYamlWithCache(uri, requestId);
        const deps = pubspec?.dependencies ?? {};
        const devDeps = pubspec?.dev_dependencies ?? {};
        if (!('build_runner' in deps) && !('build_runner' in devDeps))
          return null;

        const packagePath = uri.fsPath.endsWith('.yaml') || uri.fsPath.endsWith('.yml')
          ? vsc.Uri.joinPath(uri, '..').fsPath
          : uri.fsPath;

        const relative = uri.fsPath
          .replace(workspace.uri.fsPath, '')
          .replace(PUBSPEC_YAML_REGEX, '')
          .replace(LEADING_SLASH_REGEX, '');

        const packageName = (typeof pubspec?.name === 'string') ? pubspec.name : 'unknown_name';
        const isDartWorkspace = Array.isArray(pubspec?.workspace);
        const displayName = isDartWorkspace ? `${packageName} (workspace)` : packageName;

        const initialStatus = provider.getStatus(packagePath);

        return new ProjectTreeItem(
          displayName,
          uri,
          packagePath,
          relative,
          isDartWorkspace,
          initialStatus,
        );
      }),
    );

    const items = pubspecs.filter((item): item is ProjectTreeItem => item !== null);
    items.sort((a, b) => a.title.localeCompare(b.title));
    workspaceItems.set(workspace.name, items);
  }

  const sortedWorkspaceNames = Array.from(workspaceItems.keys()).sort((a, b) => a.localeCompare(b));
  const items: ProjectTreeItem[] = [];
  for (const workspaceName of sortedWorkspaceNames) {
    items.push(...workspaceItems.get(workspaceName)!);
  }

  if (!loadRequestController.isLatestRequest(requestId))
    return;

  provider.setItems(items);

  const hasItems = items.length > 0;
  await vsc.commands.executeCommand('setContext', 'smartBuildRunner.hasItems', hasItems);
  provider.refresh();
}
