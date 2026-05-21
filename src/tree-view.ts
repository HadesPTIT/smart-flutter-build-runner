import * as vsc from 'vscode';
import { readYaml } from './read-yaml';
import { scanWorkspace } from './scan-workspace';
import * as path from 'node:path';
import * as yaml from 'yaml';
import { BuildRunnerTaskDefinition, activeExecutions, stoppedDeliberately, showTerminal, retryTask } from './tasks';

const GLOB_PATTERN = '**/pubspec.yaml';
const PUBSPEC_YAML_REGEX = /pubspec\.yaml$/;
const LEADING_SLASH_REGEX = /^\//;

const textDecoder = new TextDecoder();

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
    public isPinned: boolean = false,
  ) {
    super(isPinned ? `📌 ${title}` : title, vsc.TreeItemCollapsibleState.None);
    this.updateState();
  }

  updateState() {
    // 1. Set Context Value for inline menus (matches file-idle, file-watching, etc.)
    this.contextValue = this.isPinned ? `file-${this.status}-pinned` : `file-${this.status}`;

    // 2. Set Description
    const statusText = this.status === 'watching' ? '(watching...) • ' :
      this.status === 'building' ? '(building...) • ' :
        this.status === 'failed' ? '(failed) • ' : '';
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

    // Update label to reflect pin status dynamically if pin changes
    this.label = this.isPinned ? `📌 ${this.title}` : this.title;

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

export class MelosScriptTreeItem extends vsc.TreeItem {
  public status: 'idle' | 'running' = 'idle';

  constructor(
    public readonly scriptName: string,
    public readonly runCommand: string,
    public readonly workspaceFolder: vsc.WorkspaceFolder,
    public readonly descriptionText?: string,
  ) {
    super(scriptName, vsc.TreeItemCollapsibleState.None);
    this.contextValue = 'melos-script';
    this.updateState();
  }

  updateState() {
    if (this.status === 'running') {
      this.iconPath = new vsc.ThemeIcon('loading~spin', new vsc.ThemeColor('charts.blue'));
      this.description = `(running...) • ${this.descriptionText || this.runCommand}`;
    } else {
      this.iconPath = new vsc.ThemeIcon('play');
      this.description = this.descriptionText || this.runCommand;
    }
    this.tooltip = `Melos Script: ${this.scriptName}\nCommand: ${this.runCommand}`;
    this.command = {
      title: 'Run Melos Script',
      command: 'smart_build_runner.runMelosScript',
      arguments: [this],
    };
  }
}

export class GroupTreeItem extends vsc.TreeItem {
  constructor(
    public readonly label: string,
    public readonly children: (MelosScriptTreeItem | ProjectTreeItem)[],
  ) {
    super(label, vsc.TreeItemCollapsibleState.Expanded);
    this.contextValue = 'group-item';
  }
}

export type BuildRunnerTreeItem = GroupTreeItem | MelosScriptTreeItem | ProjectTreeItem;

class TreeProvider implements vsc.TreeDataProvider<BuildRunnerTreeItem> {
  private readonly onDidChangeTreeDataEmitter = new vsc.EventEmitter<BuildRunnerTreeItem | undefined | void>();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  private items: ProjectTreeItem[] = [];
  private melosScripts: MelosScriptTreeItem[] = [];
  private isMelosWorkspace = false;
  private groupItems: GroupTreeItem[] = [];
  private statuses = new Map<string, PackageStatus>();

  refresh(): void {
    this.onDidChangeTreeDataEmitter.fire();
  }

  setItems(items: ProjectTreeItem[], melosScripts: MelosScriptTreeItem[], isMelosWorkspace: boolean): void {
    this.items = items;
    this.melosScripts = melosScripts;
    this.isMelosWorkspace = isMelosWorkspace;

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

    if (isMelosWorkspace) {
      const scriptGroup = new GroupTreeItem('Melos Scripts', melosScripts);
      const packagesGroup = new GroupTreeItem('Packages', items);
      this.groupItems = [scriptGroup, packagesGroup];
    } else {
      this.groupItems = [];
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

  setMelosScriptStatus(packagePath: string, status: 'idle' | 'running'): void {
    const item = this.melosScripts.find(i => `melos-script:${i.workspaceFolder.uri.fsPath}:${i.scriptName}` === packagePath);
    if (item) {
      item.status = status;
      item.updateState();
      this.onDidChangeTreeDataEmitter.fire(item);
    }
  }

  getTreeItem(element: BuildRunnerTreeItem): vsc.TreeItem {
    return element;
  }

  getChildren(element?: BuildRunnerTreeItem): BuildRunnerTreeItem[] {
    if (!element) {
      if (this.isMelosWorkspace) {
        return this.groupItems;
      }
      return this.items;
    }
    if (element instanceof GroupTreeItem) {
      return element.children;
    }
    return [];
  }
}

let treeViewDisposable: vsc.Disposable | undefined;
let watcher: vsc.FileSystemWatcher | undefined;
let extensionContext: vsc.ExtensionContext | undefined;
export const provider = new TreeProvider();
const yamlCache = new Map<string, FileCacheEntry>();
const loadRequestController = new LatestRequestController();

export function getPinnedPackages(): string[] {
  if (!extensionContext) return [];
  return extensionContext.workspaceState.get<string[]>('pinnedPackages', []);
}

export function pinPackage(packagePath: string) {
  if (!extensionContext) return;
  const pinned = getPinnedPackages();
  if (!pinned.includes(packagePath)) {
    pinned.push(packagePath);
    extensionContext.workspaceState.update('pinnedPackages', pinned);
    triggerTreeDataLoad();
  }
}

export function unpinPackage(packagePath: string) {
  if (!extensionContext) return;
  const pinned = getPinnedPackages();
  const index = pinned.indexOf(packagePath);
  if (index !== -1) {
    pinned.splice(index, 1);
    extensionContext.workspaceState.update('pinnedPackages', pinned);
    triggerTreeDataLoad();
  }
}

function triggerTreeDataLoad(): void {
  void loadTreeData().catch((error) => {
    console.error('Failed to load build_runner tree data.', error);
  });
}

export function registerTreeView(context: vsc.ExtensionContext): void {
  extensionContext = context;
  treeViewDisposable = vsc.window.registerTreeDataProvider('smart_build_runner_view', provider);
  context.subscriptions.push({ dispose: () => treeViewDisposable?.dispose() });

  // Listen to Task events to update state reactively
  context.subscriptions.push(
    vsc.tasks.onDidStartTask((e) => {
      const def = e.execution.task.definition as BuildRunnerTaskDefinition;
      if (def && def.type === 'smart_build_runner') {
        const packagePath = def.packagePath;
        const taskType = def.taskType;
        stoppedDeliberately.delete(packagePath);
        if (taskType === 'melos') {
          provider.setMelosScriptStatus(packagePath, 'running');
        } else if (taskType === 'watch') {
          provider.setStatus(packagePath, 'watching');
        } else {
          provider.setStatus(packagePath, 'building');
        }
      }
    }),
    vsc.tasks.onDidEndTaskProcess(async (e) => {
      const def = e.execution.task.definition as BuildRunnerTaskDefinition;
      if (def && def.type === 'smart_build_runner') {
        const packagePath = def.packagePath;
        const taskType = def.taskType;

        // Clean up from active executions
        activeExecutions.delete(packagePath);

        const taskName = e.execution.task.name;

        if (taskType === 'melos') {
          provider.setMelosScriptStatus(packagePath, 'idle');
          if (e.exitCode !== undefined && e.exitCode !== 0) {
            if (stoppedDeliberately.has(packagePath)) {
              stoppedDeliberately.delete(packagePath);
            } else {
              vsc.window.showErrorMessage(`Melos script failed: "${taskName}"`);
            }
          } else {
            vsc.window.showInformationMessage(`Melos script succeeded: "${taskName}"`);
          }
          return;
        }

        if (e.exitCode !== undefined && e.exitCode !== 0) {
          if (taskType === 'watch') {
            provider.setStatus(packagePath, 'idle');
          } else {
            provider.setStatus(packagePath, 'failed');
          }

          if (stoppedDeliberately.has(packagePath)) {
            stoppedDeliberately.delete(packagePath);
          } else {
            const choice = await vsc.window.showErrorMessage(
              `Build failed: "${taskName}" in package: ${path.basename(packagePath)}`,
              'Show Terminal',
              'Retry'
            );
            if (choice === 'Show Terminal') {
              showTerminal(packagePath);
            } else if (choice === 'Retry') {
              retryTask(packagePath);
            }
          }
        } else {
          provider.setStatus(packagePath, 'idle');
          if (taskType !== 'watch') {
            vsc.window.showInformationMessage(
              `Build succeeded: "${taskName}" in package: ${path.basename(packagePath)}`
            );
          }
        }
      }
    })
  );

  watcher = vsc.workspace.createFileSystemWatcher(GLOB_PATTERN);
  context.subscriptions.push(watcher);

  // Watch for melos.yaml changes as well
  const melosWatcher = vsc.workspace.createFileSystemWatcher('**/melos.yaml');
  context.subscriptions.push(melosWatcher);

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

  melosWatcher.onDidCreate(debouncedLoad);
  melosWatcher.onDidChange(debouncedLoad);
  melosWatcher.onDidDelete(debouncedLoad);

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

interface MelosScript {
  name: string;
  run: string;
  description?: string;
}

function parseMelosScripts(config: any): MelosScript[] {
  if (!config || typeof config !== 'object') {
    return [];
  }
  const scriptsConfig = config.scripts;
  if (!scriptsConfig || typeof scriptsConfig !== 'object') {
    return [];
  }
  const scripts: MelosScript[] = [];
  for (const [name, val] of Object.entries(scriptsConfig)) {
    if (typeof val === 'string') {
      scripts.push({ name, run: val });
    } else if (val && typeof val === 'object') {
      const run = (val as any).run;
      if (typeof run === 'string') {
        scripts.push({
          name,
          run,
          description: typeof (val as any).description === 'string' ? (val as any).description : undefined,
        });
      }
    }
  }
  return scripts;
}

async function loadTreeData(): Promise<void> {
  const requestId = loadRequestController.beginRequest();
  const results = await scanWorkspace(GLOB_PATTERN);

  const pinnedPackages = getPinnedPackages();
  let isMelosWorkspace = false;
  const melosScripts: MelosScriptTreeItem[] = [];

  // Detect Melos in any workspace folder
  const workspaces = vsc.workspace.workspaceFolders ?? [];
  for (const workspace of workspaces) {
    let scripts: MelosScript[] = [];
    let foundMelosConfig = false;

    // 1. Try melos.yaml
    const melosYamlUri = vsc.Uri.joinPath(workspace.uri, 'melos.yaml');
    try {
      const bytes = await vsc.workspace.fs.readFile(melosYamlUri);
      const parsed = yaml.parse(textDecoder.decode(bytes));
      if (parsed && typeof parsed === 'object') {
        foundMelosConfig = true;
        scripts = parseMelosScripts(parsed);
      }
    } catch {
      // 2. Try pubspec.yaml at root
      const pubspecUri = vsc.Uri.joinPath(workspace.uri, 'pubspec.yaml');
      try {
        const bytes = await vsc.workspace.fs.readFile(pubspecUri);
        const parsed = yaml.parse(textDecoder.decode(bytes));
        if (parsed && typeof parsed === 'object' && parsed.melos) {
          foundMelosConfig = true;
          scripts = parseMelosScripts(parsed.melos);
        }
      } catch {
        // ignore
      }
    }

    if (foundMelosConfig) {
      isMelosWorkspace = true;
      for (const script of scripts) {
        melosScripts.push(
          new MelosScriptTreeItem(script.name, script.run, workspace, script.description)
        );
      }
    }
  }

  // Sort Melos scripts by name
  melosScripts.sort((a, b) => a.scriptName.localeCompare(b.scriptName));

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
        const isPinned = pinnedPackages.includes(packagePath);

        return new ProjectTreeItem(
          displayName,
          uri,
          packagePath,
          relative,
          isDartWorkspace,
          initialStatus,
          isPinned,
        );
      }),
    );

    const items = pubspecs.filter((item): item is ProjectTreeItem => item !== null);

    // Sort packages: pinned first, then by title
    items.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return a.title.localeCompare(b.title);
    });

    workspaceItems.set(workspace.name, items);
  }

  const sortedWorkspaceNames = Array.from(workspaceItems.keys()).sort((a, b) => a.localeCompare(b));
  const items: ProjectTreeItem[] = [];
  for (const workspaceName of sortedWorkspaceNames) {
    items.push(...workspaceItems.get(workspaceName)!);
  }

  if (!loadRequestController.isLatestRequest(requestId))
    return;

  provider.setItems(items, melosScripts, isMelosWorkspace);

  const hasItems = items.length > 0 || melosScripts.length > 0;
  await vsc.commands.executeCommand('setContext', 'smartBuildRunner.hasItems', hasItems);
  provider.refresh();
}
