# Smart Flutter Build Runner

**Smart Flutter Build Runner** is a premium, lightweight, and modern VS Code extension designed to simplify Dart and Flutter code-generation tasks (`build_runner`). It provides a dedicated sidebar view with live status indicators, quick command trigger buttons, instant file-level compilation, and automatic FVM detection.

---

## ⚡ Key Features

- 📂 **Auto-detect Packages**: Scans your workspace for any package containing `pubspec.yaml` with `build_runner` configured (perfect for monorepos or multi-package workspaces).
- 🚀 **Dynamic Status Indicators**: Real-time animated icons showing if a package task is `idle`, `building` (blue spinning loader), `watching` (green broadcasting status), or `failed` (red warning icon).
- ⚡ **Build Current File**: Compile only the active Dart file using `--build-filter` to save massive amounts of time (triggered via editor title button, context menus, or hotkeys).
- 🔔 **Toast Notifications & Actions**: Displays toast alerts upon completion:
  - **Success Toast**: Shown for one-shot builds.
  - **Interactive Failure Toast**: Shows error warnings with **"Show Terminal"** (focuses console) and **"Retry"** (re-runs task) buttons.
- ⚙️ **Smart FVM Auto-detection**: Automatically checks if a package uses FVM (checks for local `.fvm` folder) and prefixes command runs with `fvm`, falling back gracefully to global configurations.
- 🧹 **Quick Clean Commands**: Easily run `clean` or combined `clean && build` commands from the sidebar.

---

## ⌨️ Keyboard Shortcuts

Speed up your workflow using default hotkeys when editing any Dart file:

| Action | macOS | Windows / Linux |
| :--- | :--- | :--- |
| **Build Current File** | `Cmd + Option + B` | `Ctrl + Alt + B` |

---

---

## 📸 Visual Guides

Here is how the extension looks in action:

<table>
  <tr>
    <td width="50%" align="center" valign="top">
      <b>1. Sidebar Panel & Status Icons</b><br/>
      <img src="https://raw.githubusercontent.com/HadesPTIT/smart-flutter-build-runner/develop/static/sidebar.png" alt="Sidebar View" width="90%"/>
    </td>
    <td width="50%" align="center" valign="top">
      <b>2. Editor Title Action (Zap Button)</b><br/>
      <img src="https://raw.githubusercontent.com/HadesPTIT/smart-flutter-build-runner/develop/static/editor_action.png" alt="Editor Action" width="90%"/>
    </td>
  </tr>
  <tr>
    <td width="50%" align="center" valign="top">
      <b>3. Editor Context Menu</b><br/>
      <img src="https://raw.githubusercontent.com/HadesPTIT/smart-flutter-build-runner/develop/static/context_menu.png" alt="Context Menu" width="90%"/>
    </td>
    <td width="50%" align="center" valign="top">
      <b>4. Build Toast Notification</b><br/>
      <img src="https://raw.githubusercontent.com/HadesPTIT/smart-flutter-build-runner/develop/static/notification.png" alt="Build Toast" width="90%"/>
    </td>
  </tr>
</table>

---

## ⚙️ Extension Settings

This extension contributes the following settings:

*   `smart_build_runner.fvm`: Force using FVM globally for all packages (boolean, default: `false`).
*   `smart_build_runner.excludes`: Glob patterns to exclude specific directories from workspace scans (array of strings, default: `[]`).
*   `smart_build_runner.args`: Additional arguments appended to build and watch tasks (string, default: `"--delete-conflicting-outputs"`).

---

## 📦 Installation & Setup

1. Open your VS Code editor.
2. Search for **Smart Flutter Build Runner** in the Extension marketplace and install it.
3. Once installed, if your workspace contains Flutter/Dart projects with `build_runner` in their `pubspec.yaml`, the **BUILD RUNNER** panel will automatically appear in the Explorer sidebar view.

---

## 🤝 Credits & Feedback

*   Inspired by the original [vscode-build-runner](https://github.com/xiankq/vscode-build-runner) by [xiankq](https://github.com/xiankq).
*   Developed with ❤️ by **hadesptit**. Feel free to open issues or pull requests on [GitHub](https://github.com/HadesPTIT/smart-flutter-build-runner).

