import * as path from 'node:path';
import * as vsc from 'vscode';
import { readYaml } from './read-yaml';

interface PubspecYaml {
  name?: unknown;
  dependencies?: Record<string, unknown>;
  dev_dependencies?: Record<string, unknown>;
}

export interface TaskConfig {
  packagePath: string;
  uri: vsc.Uri;
  title: string;
  taskType: 'watch' | 'build' | 'clean' | 'cleanBuild' | 'buildFile' | 'melos';
  isWorkspace: boolean;
  fileUri?: vsc.Uri;
  scriptName?: string;
}

// Track manually stopped packages to suppress false error popups
export const stoppedDeliberately = new Set<string>();

// Track the parameters of the last run for retry support
export const lastRunConfig = new Map<string, TaskConfig>();

// Map to track active executions by package path
export const activeExecutions = new Map<string, vsc.TaskExecution>();

export interface BuildRunnerTaskDefinition extends vsc.TaskDefinition {
  type: 'smart_build_runner';
  packagePath: string;
  taskType: 'watch' | 'build' | 'clean' | 'cleanBuild' | 'buildFile' | 'melos';
  scriptName?: string;
}

async function detectFvm(startDir: string): Promise<boolean> {
  const globalFvm = vsc.workspace.getConfiguration().get('smart_build_runner.fvm', false);
  if (globalFvm) {
    return true;
  }
  let currentDir = startDir;
  while (currentDir) {
    try {
      const fvmUri = vsc.Uri.file(path.join(currentDir, '.fvm'));
      const stat = await vsc.workspace.fs.stat(fvmUri);
      if (stat.type === vsc.FileType.Directory) {
        return true;
      }
    } catch {
      // ignore
    }
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
  }
  return false;
}

export async function createTask(
  packagePath: string,
  uri: vsc.Uri,
  title: string,
  type: 'watch' | 'build' | 'clean' | 'cleanBuild',
  isWorkspace: boolean = false,
) {
  const cwd = uri.fsPath.endsWith('.yaml') || uri.fsPath.endsWith('.yml')
    ? vsc.Uri.joinPath(uri, '..').fsPath
    : uri.fsPath;

  // Smart FVM detection: check if global setting is true OR any parent folder contains .fvm
  const useFvm = await detectFvm(cwd);
  const fvmPrefix = useFvm ? 'fvm ' : '';
  const args = vsc.workspace.getConfiguration().get('smart_build_runner.args', '--delete-conflicting-outputs');
  const workspaceArg = isWorkspace ? ' --workspace' : '';

  let command = '';
  if (type === 'cleanBuild') {
    command = `${fvmPrefix}dart run build_runner clean && ${fvmPrefix}dart run build_runner build ${args}${workspaceArg}`;
  } else if (type === 'clean') {
    command = `${fvmPrefix}dart run build_runner clean`;
  } else {
    command = `${fvmPrefix}dart run build_runner ${type} ${args}${workspaceArg}`;
  }

  const pubspec = await readYaml(uri) as PubspecYaml | null;
  const name = (typeof pubspec?.name === 'string') ? pubspec.name : title;
  const taskLabel = `${type}: ${name}${isWorkspace ? ' (workspace)' : ''}`;

  const definition: BuildRunnerTaskDefinition = {
    type: 'smart_build_runner',
    packagePath,
    taskType: type,
  };

  const task = new vsc.Task(
    definition,
    vsc.TaskScope.Workspace,
    taskLabel,
    'smart_build_runner',
    new vsc.ShellExecution(command, { cwd }),
  );

  task.presentationOptions = {
    reveal: vsc.TaskRevealKind.Always,
    panel: vsc.TaskPanelKind.Shared,
    clear: false,
    close: false,
    showReuseMessage: false,
    focus: true,
  };

  try {
    const execution = await vsc.tasks.executeTask(task);
    activeExecutions.set(packagePath, execution);
    lastRunConfig.set(packagePath, {
      packagePath,
      uri,
      title,
      taskType: type,
      isWorkspace,
    });
    return execution;
  } catch (err: any) {
    vsc.window.showErrorMessage(`Failed to start task '${taskLabel}': ${err.message}`);
    return null;
  }
}

export function stopTask(packagePath: string) {
  stoppedDeliberately.add(packagePath);
  const execution = activeExecutions.get(packagePath);
  if (execution) {
    try {
      execution.terminate();
      activeExecutions.delete(packagePath);
    } catch {
      // ignore
    }
  }

  // Fallback: search all active task executions
  const executions = vsc.tasks.taskExecutions;
  for (const exec of executions) {
    const def = exec.task.definition as BuildRunnerTaskDefinition;
    if (def.type === 'smart_build_runner' && def.packagePath === packagePath) {
      try {
        exec.terminate();
      } catch {
        // ignore
      }
    }
  }
}

export function stopAllTasks() {
  for (const [packagePath, execution] of activeExecutions.entries()) {
    stoppedDeliberately.add(packagePath);
    try {
      execution.terminate();
    } catch {
      // ignore
    }
  }
  activeExecutions.clear();

  const executions = vsc.tasks.taskExecutions;
  for (const exec of executions) {
    const def = exec.task.definition as BuildRunnerTaskDefinition;
    if (def.type === 'smart_build_runner') {
      if (def.packagePath) {
        stoppedDeliberately.add(def.packagePath);
      }
      try {
        exec.terminate();
      } catch {
        // ignore
      }
    }
  }
}

export function showTerminal(packagePath: string) {
  // Find terminal matching the package path by looking at running task executions
  const execution = activeExecutions.get(packagePath);
  const taskLabel = execution?.task.name;

  if (taskLabel) {
    const terminal = vsc.window.terminals.find(t =>
      t.name.toLowerCase().includes(taskLabel.toLowerCase())
    );
    if (terminal) {
      terminal.show(false);
      return;
    }
  }

  // Fallback: search for any terminal name containing smart_build_runner
  const fallbackTerminal = vsc.window.terminals.find(t =>
    t.name.toLowerCase().includes('smart_build_runner')
  );
  if (fallbackTerminal) {
    fallbackTerminal.show(false);
  } else {
    vsc.window.showInformationMessage('Terminal for this task was not found.');
  }
}

export async function findPackageRoot(startDir: string): Promise<{ packagePath: string; pubspecUri: vsc.Uri } | null> {
  let currentDir = startDir;
  while (currentDir) {
    const pubspecUri = vsc.Uri.file(path.join(currentDir, 'pubspec.yaml'));
    try {
      const stat = await vsc.workspace.fs.stat(pubspecUri);
      if (stat.type === vsc.FileType.File) {
        return {
          packagePath: currentDir,
          pubspecUri,
        };
      }
    } catch {
      // ignore
    }
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
  }
  return null;
}

export async function buildCurrentFile(uri?: vsc.Uri) {
  let targetUri = uri;
  if (!targetUri) {
    targetUri = vsc.window.activeTextEditor?.document.uri;
  }
  if (!targetUri || !targetUri.fsPath.endsWith('.dart')) {
    vsc.window.showErrorMessage('This command can only be run on a Dart (.dart) file.');
    return;
  }

  const filePath = targetUri.fsPath;
  const startDir = path.dirname(filePath);
  const packageRootInfo = await findPackageRoot(startDir);
  if (!packageRootInfo) {
    vsc.window.showErrorMessage('Could not find pubspec.yaml for the current file.');
    return;
  }

  const { packagePath, pubspecUri } = packageRootInfo;

  // Calculate relative path with forward slashes
  const relativePath = path.relative(packagePath, filePath).replace(/\\/g, '/');
  const filterPattern = relativePath.replace(/\.dart$/, '.*');

  // Check if build_runner is present in package pubspec
  const pubspec = await readYaml(pubspecUri) as PubspecYaml | null;
  const deps = pubspec?.dependencies ?? {};
  const devDeps = pubspec?.dev_dependencies ?? {};
  const hasBuildRunner = ('build_runner' in deps) || ('build_runner' in devDeps);

  if (!hasBuildRunner) {
    // Soft check: check if there's a workspace-level pubspec.yaml with build_runner
    let foundInWorkspace = false;
    const parentRoot = await findPackageRoot(path.dirname(packagePath));
    if (parentRoot) {
      const parentPubspec = await readYaml(parentRoot.pubspecUri) as PubspecYaml | null;
      const parentDeps = parentPubspec?.dependencies ?? {};
      const parentDevDeps = parentPubspec?.dev_dependencies ?? {};
      if (('build_runner' in parentDeps) || ('build_runner' in parentDevDeps)) {
        foundInWorkspace = true;
      }
    }

    if (!foundInWorkspace) {
      const choice = await vsc.window.showWarningMessage(
        `build_runner dependency was not detected in this package ('${pubspec?.name || path.basename(packagePath)}').`,
        'Run Anyway',
        'Cancel'
      );
      if (choice !== 'Run Anyway') {
        return;
      }
    }
  }

  // Detect FVM (FVM check starts from packagePath)
  const useFvm = await detectFvm(packagePath);
  const fvmPrefix = useFvm ? 'fvm ' : '';
  const command = `${fvmPrefix}dart run build_runner build --delete-conflicting-outputs --build-filter="${filterPattern}"`;

  const fileName = path.basename(filePath);
  const taskLabel = `build file: ${fileName}`;

  const definition: BuildRunnerTaskDefinition = {
    type: 'smart_build_runner',
    packagePath,
    taskType: 'build',
  };

  const task = new vsc.Task(
    definition,
    vsc.TaskScope.Workspace,
    taskLabel,
    'smart_build_runner',
    new vsc.ShellExecution(command, { cwd: packagePath }),
  );

  task.presentationOptions = {
    reveal: vsc.TaskRevealKind.Always,
    panel: vsc.TaskPanelKind.Shared,
    clear: false,
    close: false,
    showReuseMessage: false,
    focus: true,
  };

  try {
    const execution = await vsc.tasks.executeTask(task);
    activeExecutions.set(packagePath, execution);
    lastRunConfig.set(packagePath, {
      packagePath,
      uri: pubspecUri,
      title: (typeof pubspec?.name === 'string') ? pubspec.name : path.basename(packagePath),
      taskType: 'buildFile',
      isWorkspace: false,
      fileUri: targetUri,
    });
    return execution;
  } catch (err: any) {
    vsc.window.showErrorMessage(`Failed to start task '${taskLabel}': ${err.message}`);
    return null;
  }
}

export async function retryTask(packagePath: string) {
  const config = lastRunConfig.get(packagePath);
  if (!config) {
    vsc.window.showErrorMessage(`No previous build configuration found for ${packagePath}.`);
    return;
  }

  if (config.taskType === 'buildFile') {
    return buildCurrentFile(config.fileUri);
  } else if (config.taskType === 'melos' && config.scriptName) {
    const workspaceFolder = vsc.workspace.getWorkspaceFolder(config.uri);
    if (workspaceFolder) {
      return createMelosTask(workspaceFolder, config.scriptName);
    }
  } else {
    return createTask(config.packagePath, config.uri, config.title, config.taskType as any, config.isWorkspace);
  }
}

export async function createMelosTask(
  workspaceFolder: vsc.WorkspaceFolder,
  scriptName: string,
) {
  const cwd = workspaceFolder.uri.fsPath;
  const useFvm = await detectFvm(cwd);
  const fvmPrefix = useFvm ? 'fvm ' : '';
  const command = `${fvmPrefix}dart run melos run ${scriptName}`;
  const taskLabel = `${fvmPrefix}melos run ${scriptName}`;
  const packagePath = `melos-script:${cwd}:${scriptName}`;

  const definition: BuildRunnerTaskDefinition = {
    type: 'smart_build_runner',
    packagePath,
    taskType: 'melos',
    scriptName,
  };

  const task = new vsc.Task(
    definition,
    workspaceFolder,
    taskLabel,
    'smart_build_runner',
    new vsc.ShellExecution(command, { cwd }),
  );

  task.presentationOptions = {
    reveal: vsc.TaskRevealKind.Always,
    panel: vsc.TaskPanelKind.Shared,
    clear: false,
    close: false,
    showReuseMessage: false,
    focus: true,
  };

  try {
    const execution = await vsc.tasks.executeTask(task);
    activeExecutions.set(packagePath, execution);
    lastRunConfig.set(packagePath, {
      packagePath,
      uri: workspaceFolder.uri,
      title: scriptName,
      taskType: 'melos',
      isWorkspace: true,
      fileUri: workspaceFolder.uri,
      scriptName,
    });
    return execution;
  } catch (err: any) {
    vsc.window.showErrorMessage(`Failed to start Melos script '${scriptName}': ${err.message}`);
    return null;
  }
}

