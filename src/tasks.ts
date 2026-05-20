import * as path from 'node:path';
import * as vsc from 'vscode';
import { readYaml } from './read-yaml';

// Map to track active executions by package path
export const activeExecutions = new Map<string, vsc.TaskExecution>();

export interface BuildRunnerTaskDefinition extends vsc.TaskDefinition {
  type: 'smart_build_runner';
  packagePath: string;
  taskType: 'watch' | 'build' | 'clean' | 'cleanBuild';
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
  const globalFvm = vsc.workspace.getConfiguration().get('smart_build_runner.fvm', false);
  let useFvm = globalFvm;
  if (!useFvm) {
    let currentDir = cwd;
    while (currentDir) {
      try {
        const fvmUri = vsc.Uri.file(path.join(currentDir, '.fvm'));
        const stat = await vsc.workspace.fs.stat(fvmUri);
        if (stat.type === vsc.FileType.Directory) {
          useFvm = true;
          break;
        }
      } catch {
        // .fvm directory not found in this folder
      }
      const parentDir = path.dirname(currentDir);
      if (parentDir === currentDir) {
        break;
      }
      currentDir = parentDir;
    }
  }

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

  const pubspec = await readYaml(uri);
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
    return execution;
  } catch (err: any) {
    vsc.window.showErrorMessage(`Failed to start task '${taskLabel}': ${err.message}`);
    return null;
  }
}

export function stopTask(packagePath: string) {
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
