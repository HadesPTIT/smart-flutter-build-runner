import * as vsc from 'vscode';
import { ProjectTreeItem, refreshTreeView, registerTreeView } from './tree-view';
import { createTask, stopTask, showTerminal, buildCurrentFile } from './tasks';

export async function activate(context: vsc.ExtensionContext) {
  context.subscriptions.push(
    // 1. Build Command
    vsc.commands.registerCommand(
      'smart_build_runner.build',
      (item: ProjectTreeItem) => createTask(item.packagePath, item.resourceUri, item.title, 'build', item.isWorkspace),
    ),

    // 2. Watch Command
    vsc.commands.registerCommand(
      'smart_build_runner.watch',
      (item: ProjectTreeItem) => createTask(item.packagePath, item.resourceUri, item.title, 'watch', item.isWorkspace),
    ),

    // 3. Clean Command
    vsc.commands.registerCommand(
      'smart_build_runner.clean',
      (item: ProjectTreeItem) => createTask(item.packagePath, item.resourceUri, item.title, 'clean', item.isWorkspace),
    ),

    // 4. Clean & Build Command
    vsc.commands.registerCommand(
      'smart_build_runner.cleanBuild',
      (item: ProjectTreeItem) => createTask(item.packagePath, item.resourceUri, item.title, 'cleanBuild', item.isWorkspace),
    ),

    // 5. Stop Command
    vsc.commands.registerCommand(
      'smart_build_runner.stop',
      (item: ProjectTreeItem) => stopTask(item.packagePath),
    ),

    // 6. Show Terminal Command
    vsc.commands.registerCommand(
      'smart_build_runner.showTerminal',
      (item: ProjectTreeItem) => showTerminal(item.packagePath),
    ),

    // 7. Refresh Tree View Command
    vsc.commands.registerCommand(
      'smart_build_runner.refresh',
      () => refreshTreeView(),
    ),

    // 8. Build Current File Command
    vsc.commands.registerCommand(
      'smart_build_runner.buildCurrentFile',
      (uri?: vsc.Uri) => buildCurrentFile(uri),
    ),
  );

  // Initialize and register Tree View and task state listeners
  registerTreeView(context);
}

export function deactivate() {}
