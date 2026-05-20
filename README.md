# Smart Flutter Build Runner

**Smart Flutter Build Runner** is a premium, lightweight, and modern VS Code extension designed to simplify Dart and Flutter code-generation tasks (`build_runner`). It provides a dedicated sidebar view with live status indicators, quick command trigger buttons, and automatic FVM detection.

---

## Features

- ⚡ **Auto-detect Packages**: Automatically scans your workspace for any package containing `pubspec.yaml` with `build_runner` configured.
- 🚀 **Dynamic Status Indicators**: Real-time animated icons showing if a package task is `idle`, `building` (blue spinning loader), `watching` (green broadcasting status), or `failed` (red warning icon).
- 🛠️ **Inline Action Buttons**: Play, stop, clean, and focus terminal buttons directly on hover in the explorer sidebar tree view.
- 📦 **Monorepo & Workspace Support**: Works seamlessly in large-scale multi-package monorepos and Dart workspace projects.
- ⚙️ **Smart FVM Auto-detection**: Automatically checks if a package is using FVM (by looking for a local `.fvm` folder) and runs commands through `fvm dart run build_runner ...` instead of global Dart, fallback-configured to global settings.
- 🧹 **Quick Clean Commands**: Easily run `clean` or combined `clean && build` commands from the sidebar.

---

## Extension Settings

This extension contributes the following settings:

*   `smart_build_runner.fvm`: Force using FVM globally for all packages (boolean, default: `false`).
*   `smart_build_runner.excludes`: Glob patterns to exclude specific directories from workspace scans (array of strings, default: `[]`).
*   `smart_build_runner.args`: Additional arguments appended to build and watch tasks (string, default: `"--delete-conflicting-outputs"`).

---

## Installation & Setup

1. Open your VS Code editor.
2. Search for **Smart Flutter Build Runner** in the Extension marketplace and install it.
3. Once installed, if your workspace contains Flutter/Dart projects with `build_runner` in their `pubspec.yaml`, the **BUILD RUNNER** panel will automatically appear in the Explorer sidebar view.

---

## Credits & Acknowledgements

This extension is inspired by the original [vscode-build-runner](https://github.com/xiankq/vscode-build-runner) by [xiankq](https://github.com/xiankq).

---

## Feedback & Contributions

Feel free to open issues or pull requests on the repository. Developed with ❤️ by **hadesptit**.
