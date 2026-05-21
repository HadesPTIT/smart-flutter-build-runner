# Changelog

All notable changes to this project will be documented in this file.

## [1.0.4] (1cdd517) - 2026-05-21

### Added
- **Toast Notifications**: Added VS Code toast notifications for build task events (success message for one-shot tasks, error message for failed tasks).
- **Interactive Quick Actions**: Integrated action buttons in the error popups:
  - **"Show Terminal"** to focus the failed task's terminal output.
  - **"Retry"** to rerun the failed task.
- **Task Re-run Memory**: Implemented a `lastRunConfig` cache to preserve exact arguments for retry execution.
- **Manual Stop Suppression**: Added `stoppedDeliberately` logic to skip error popups when tasks are manually stopped by the user.

### Changed Files
| File Name | Description |
| :--- | :--- |
| [package.json](file:///Users/g1-huong.pham-dev/Documents/Docs/vs_build_runner_ext/package.json) | Bump version to `1.0.4`. |
| [src/tasks.ts](file:///Users/g1-huong.pham-dev/Documents/Docs/vs_build_runner_ext/src/tasks.ts) | Track manually stopped tasks, record running parameters, and implement `retryTask`. |
| [src/tree-view.ts](file:///Users/g1-huong.pham-dev/Documents/Docs/vs_build_runner_ext/src/tree-view.ts) | Handle task exit codes, show success/error alerts, and execute actions when buttons are clicked. |

---

## [1.0.3] (f0f6b96) - 2026-05-21

### Added
- **Build Current File**: Added a new command `smart_build_runner.buildCurrentFile` to compile only the active Dart file using `build_runner`'s `--build-filter` flag.
- **Context Menus & Actions**: Integrated the "Build Current File" action into the editor title actions (top-right button), editor context menu (right-click), explorer context menu (right-click on `.dart` files), and VS Code Command Palette.
- **Workspace Fallback & Warning**: Implemented a warning confirmation when `build_runner` dependency is not found in the package or parent workspace root.

### Changed Files
| File Name | Description |
| :--- | :--- |
| [package.json](file:///Users/g1-huong.pham-dev/Documents/Docs/vs_build_runner_ext/package.json) | Register `smart_build_runner.buildCurrentFile` command, configure it for editor context/title, explorer context, and command palette. Bump version to `1.0.3`. |
| [src/tasks.ts](file:///Users/g1-huong.pham-dev/Documents/Docs/vs_build_runner_ext/src/tasks.ts) | Implement `findPackageRoot` recursive helper and `buildCurrentFile` task execution. |
| [src/extension.ts](file:///Users/g1-huong.pham-dev/Documents/Docs/vs_build_runner_ext/src/extension.ts) | Register command `smart_build_runner.buildCurrentFile`. |

---

## [1.0.2] (f579a16) - 2026-05-20

### Fixed
- **Task Cleanup**: Cleaned up completed tasks from `activeExecutions` in [tree-view.ts](file:///Users/g1-huong.pham-dev/Documents/Docs/vs_build_runner_ext/src/tree-view.ts) to resolve a bug where finished tasks stayed in memory, preventing users from re-triggering builds due to the warning "A build_runner task is already running".
- **Packaging Exclusions**: Added `.agents/**` to [.vscodeignore](file:///Users/g1-huong.pham-dev/Documents/Docs/vs_build_runner_ext/.vscodeignore) to prevent AI-related files from being bundled, reducing the packaged VSIX size.

### Changed Files
| File Name | Description |
| :--- | :--- |
| [tree-view.ts](file:///Users/g1-huong.pham-dev/Documents/Docs/vs_build_runner_ext/src/tree-view.ts) | Import `activeExecutions` and delete the finished package task from the executions map. |
| [.vscodeignore](file:///Users/g1-huong.pham-dev/Documents/Docs/vs_build_runner_ext/.vscodeignore) | Exclude `.agents/**` files. |
| [package.json](file:///Users/g1-huong.pham-dev/Documents/Docs/vs_build_runner_ext/package.json) | Bump version to `1.0.2`. |

---

## [1.0.1] - 2026-05-20

### Fixed
- **FVM Monorepo Root Detection**: Updated FVM path checking in [tasks.ts](file:///Users/g1-huong.pham-dev/Documents/Docs/vs_build_runner_ext/src/tasks.ts) to traverse up parent directories recursively. This allows the extension to detect the workspace-level `.fvm` folder from sub-packages in monorepo structures (e.g., Melos).

### Changed Files
| File Name | Description |
| :--- | :--- |
| [tasks.ts](file:///Users/g1-huong.pham-dev/Documents/Docs/vs_build_runner_ext/src/tasks.ts) | Implement recursive FVM path detection up to root. |
| [package.json](file:///Users/g1-huong.pham-dev/Documents/Docs/vs_build_runner_ext/package.json) | Bump version to `1.0.1`. |

---

## [1.0.0] - 2026-05-20

### Added
- **Initial Release**: Initial version of Smart Flutter Build Runner VS Code extension.
  - Active status indicators (idle, building, watching, failed).
  - Quick controls inline menu and sidebar tree-view for easy access to `build_runner` tasks.
  - Automated FVM command prefixing.
