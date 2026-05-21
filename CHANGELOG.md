# Changelog

All notable changes to this project will be documented in this file.

## [1.0.4] (2adc06a) - 2026-05-22

### Added
- **Melos Workspace Support**: Automatically detects Melos configurations (`melos.yaml` or root `pubspec.yaml` with a `melos` key) to parse and display Melos scripts in a dedicated collapsible `"Melos Scripts"` group.
- **Pin Packages**: Enables pinning active packages to the top of the package list for quick controls. The pinned state is stored and persisted across VS Code restarts using `workspaceState`.
- **Stop All Tasks**: Added a "Stop All" action on the sidebar title bar to terminate all running watch/build tasks and active Melos scripts simultaneously.
- **Melos Scripts Running Status**: Tracks execution of Melos scripts and shows an active spinner icon on running items.

### Fixed
- **Lỗi thực thi script Melos**: Sửa lỗi `zsh:1: command not found: melos` bằng cách chạy lệnh Melos qua Dart SDK wrapper (`dart run melos run <scriptName>`).
- **Tích hợp FVM cho Melos**: Tự động phát hiện cấu hình FVM và thêm tiền tố `fvm` khi chạy các tác vụ Melos.
- **Cấu hình launch.json**: Cập nhật tệp `.vscode/launch.json` để chạy gỡ lỗi (debug) trực tiếp với dự án `arrow-app`.

### Changed Files
| File Name | Description |
| :--- | :--- |
| [package.json](file:///Users/g1-huong.pham-dev/Documents/Docs/vs_build_runner_ext/package.json) | Đăng ký các lệnh mới (`stopAll`, `pinPackage`, `unpinPackage`, `runMelosScript`), cấu hình menu ngữ cảnh/tiêu đề và tăng phiên bản lên `1.0.4`. |
| [.vscode/launch.json](file:///Users/g1-huong.pham-dev/Documents/Docs/vs_build_runner_ext/.vscode/launch.json) | Cấu hình đối số chạy gỡ lỗi trực tiếp trong thư mục dự án `arrow-app`. |
| [src/extension.ts](file:///Users/g1-huong.pham-dev/Documents/Docs/vs_build_runner_ext/src/extension.ts) | Nhập và đăng ký các hàm callback để ghim/bỏ ghim, dừng tất cả các tác vụ và thực thi các tập lệnh Melos. |
| [src/tasks.ts](file:///Users/g1-huong.pham-dev/Documents/Docs/vs_build_runner_ext/src/tasks.ts) | Trích xuất hàm dùng chung `detectFvm`, cập nhật lệnh chạy Melos bằng `dart run melos run`, tích hợp FVM prefix và mở rộng định nghĩa tác vụ. |
| [src/tree-view.ts](file:///Users/g1-huong.pham-dev/Documents/Docs/vs_build_runner_ext/src/tree-view.ts) | Phân tích cú pháp tập lệnh Melos, nhóm thư mục, quản lý trạng thái ghim và cập nhật biểu tượng trạng thái chạy. |

---

## [1.0.3] - 2026-05-21

### Added
- **Build Current File**: Added command `smart_build_runner.buildCurrentFile` to compile only the active Dart file using `build_runner`'s `--build-filter` flag.
- **Context Menus & Actions**: Integrated the "Build Current File" action into the editor title actions (top-right button), editor context menu (right-click), explorer context menu (right-click on `.dart` files), and VS Code Command Palette.
- **Keyboard Shortcuts**: Assigned default hotkeys for "Build Current File":
  - **macOS**: `Cmd + Option + B`
  - **Windows/Linux**: `Ctrl + Alt + B`
  - Restricted the keys to run only when editing a Dart file (`editorLangId == dart`).
- **Toast Notifications**: Added VS Code toast notifications for build task events (success message for one-shot tasks, error message for failed tasks).
- **Interactive Quick Actions**: Integrated action buttons in the error popups:
  - **"Show Terminal"** to focus the failed task's terminal output.
  - **"Retry"** to rerun the failed task.
- **Task Re-run Memory**: Implemented a `lastRunConfig` cache to preserve exact arguments for retry execution.
- **Manual Stop Suppression**: Added `stoppedDeliberately` logic to skip error popups when tasks are manually stopped by the user.
- **Visual Guides**: Added high-resolution screenshots showing the extension interface in action in the `README.md`.

### Changed Files
| File Name | Description |
| :--- | :--- |
| [package.json](file:///Users/g1-huong.pham-dev/Documents/Docs/vs_build_runner_ext/package.json) | Register `smart_build_runner.buildCurrentFile` command, configure keybindings, editor context/title, explorer context, and command palette. Bump version to `1.0.3`. |
| [src/tasks.ts](file:///Users/g1-huong.pham-dev/Documents/Docs/vs_build_runner_ext/src/tasks.ts) | Track manually stopped tasks, record running parameters, and implement `retryTask`, `findPackageRoot`, and `buildCurrentFile` execution. |
| [src/tree-view.ts](file:///Users/g1-huong.pham-dev/Documents/Docs/vs_build_runner_ext/src/tree-view.ts) | Handle task exit codes, show success/error alerts, and execute actions when buttons are clicked. |
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
