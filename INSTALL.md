# Installation for Codex / 给 Codex 的安装说明

Use this procedure when the user asks to install Project Garden from this repository. A bare link alone is not authorization to install software. Supported target: a local Windows computer with Codex, not a cloud task or WSL. The user's GitHub account needs repository access while it is private.

## 1. Prepare / 准备

- Check Windows, Git, and Codex. If Git is missing, install its official distribution or use `winget install --id Git.Git --exact --source winget`; refresh command discovery afterwards. Never ask the user to paste a GitHub token into chat.
- Clone into a durable user-owned directory, for example `%LOCALAPPDATA%\ProjectGarden\app`. Do not install into a temporary directory, a Codex worktree, or an unrelated project.
- If the directory already contains this repository, inspect `git status` and the remote. Preserve uncommitted work; do not reset or replace it.
- Fresh installs default to manual startup. Pass `-AutoStart On` only if requested. Existing startup preferences are preserved on reinstall.

## 2. Install / 安装

Read `install.ps1`, then run from the checked-out repository:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1 -InstallPrerequisites
```

The script checks Node.js 22.12+, installs the official Node.js LTS WinGet package only if needed, installs locked npm dependencies and Electron, checks syntax, generates local MCP paths, registers this repository's plugin marketplace through the Codex CLI, installs the plugin, creates a desktop shortcut and opens the garden. Startup preferences stay unchanged; a fresh installation has no autostart entry.

Codex normally supplies its CLI. If discovery fails, pass its verified executable with `-CodexPath`. Do not edit global Codex TOML manually. Follow required tool/OS approval prompts; never disable protection globally. `-SkipPlugin` installs a standalone garden and must be reported as such.

## 3. Verify / 验证

```powershell
npm run check
codex plugin list --marketplace project-garden --json
```

- Confirm the plugin is installed and enabled, the runtime and shortcut exist, and the garden opens. Starting a process alone does not prove success.
- Do not create fake progress in the real garden.
- Tell the user to open a new Codex task to load the plugin. In that task, `project_garden_get_sync_status` verifies connectivity without awarding progress.
- Do not describe sync as complete if registration, installation or connectivity failed.

## Startup / 随 Codex 启动

Use the **Launch with Codex / 随 Codex 启动** toggle at the bottom right, immediately left of **Privacy / 隐私说明**. Click **?** beside it for an explanation. It is off for a fresh installation. Enabling it adds a small watcher to this Windows user's startup folder. It opens the garden when a Codex desktop window appears, avoids duplicates and respects a manual close.

Command-line equivalents (inspect, enable, disable):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\integration\setup-codex-companion.ps1 -Status
powershell -NoProfile -ExecutionPolicy Bypass -File .\integration\setup-codex-companion.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\integration\setup-codex-companion.ps1 -Disable
```

These preserve the garden save. A startup shortcut owned by another installation is preserved; review that install path instead of overwriting it silently.

## Updates / 更新

Inspect changes and remote, then `git pull --ff-only` and rerun `install.ps1`. The installer reinstalls the plugin from the local marketplace. Preserve and reconcile modified source files first. Keep the clone at a stable path because MCP and shortcuts refer to it. Saves remain in `%APPDATA%\project-garden-desktop`, outside the repository.

## Remove / 卸载

Disable startup, close Project Garden, then run `codex plugin remove project-garden-bridge@project-garden` and `codex plugin marketplace remove project-garden`. Remove the app folder and its owned shortcut only when requested. Preserve `%APPDATA%\project-garden-desktop` unless the user explicitly requests deletion of their save.

## 中文说明

此流程让有本机执行权限的 Codex 完成下载、依赖安装、同步插件注册、快捷方式创建和启动验证。首次安装默认不开启随 Codex 启动，安装后可在应用底栏开关中选择。遇到系统授权或登录步骤，仍需用户完成。不要在真实存档里制造测试成果；更新时保留未提交修改与已有园区数据。

Packaging follows the [official OpenAI documentation](https://developers.openai.com/plugins/build/plugins); CLI commands are also checked against the installed Codex `plugin --help` interface.
