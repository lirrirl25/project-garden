[CmdletBinding()]
param(
    [switch]$InstallPrerequisites,
    [switch]$SkipDependencies,
    [switch]$SkipPlugin,
    [switch]$NoShortcut,
    [switch]$NoLaunch,
    [string]$CodexPath,
    [ValidateSet('Keep','On','Off')][string]$AutoStart = 'Keep'
)
$ErrorActionPreference = 'Stop'
$gardenRoot = $PSScriptRoot
if ([Environment]::OSVersion.Platform -ne 'Win32NT') { throw 'This installer currently supports Windows only.' }

function Invoke-Checked {
    param([string]$Executable, [string[]]$Arguments)
    & $Executable @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Executable failed with exit code $LASTEXITCODE. Installation is incomplete." }
}

$node = Get-Command node.exe -ErrorAction SilentlyContinue
if ((!$node -or [version]((& $node.Source --version).TrimStart('v')) -lt [version]'22.12.0') -and $InstallPrerequisites) {
    $winget = Get-Command winget.exe -ErrorAction SilentlyContinue
    if (!$winget) { throw 'Install Node.js 22.12+ LTS from https://nodejs.org/ and rerun install.ps1.' }
    Invoke-Checked $winget.Source @('install','--id','OpenJS.NodeJS.LTS','--exact','--source','winget','--silent','--accept-package-agreements','--accept-source-agreements')
    $nodeCandidate = Join-Path $env:ProgramFiles 'nodejs\node.exe'
    if (Test-Path -LiteralPath $nodeCandidate) { $node = Get-Item -LiteralPath $nodeCandidate | ForEach-Object { [pscustomobject]@{ Source=$_.FullName } } }
}
if (!$node -or [version]((& $node.Source --version).TrimStart('v')) -lt [version]'22.12.0') { throw 'Node.js 22.12+ is required. Rerun with -InstallPrerequisites or install Node.js LTS.' }
$npmPath = Join-Path (Split-Path $node.Source -Parent) 'npm.cmd'
if (!(Test-Path -LiteralPath $npmPath)) { throw 'npm.cmd was not found next to Node.js. Repair the Node.js LTS installation.' }
$env:Path = (Split-Path $node.Source -Parent) + ';' + $env:Path

if (!$SkipPlugin) {
    if (!$CodexPath) {
        $codexCommand = Get-Command codex.exe,codex.cmd -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($codexCommand) { $CodexPath = $codexCommand.Source }
        else {
            $bundled = Join-Path $env:LOCALAPPDATA 'OpenAI\Codex\bin'
            if (Test-Path -LiteralPath $bundled) {
                $CodexPath = Get-ChildItem -Path (Join-Path $bundled '*\codex.exe') -File | Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 1 -ExpandProperty FullName
            }
        }
    }
    if (!$CodexPath -or !(Test-Path -LiteralPath $CodexPath)) { throw 'Install/open Codex desktop first, or pass -CodexPath to its CLI. Use -SkipPlugin only for a standalone garden.' }
    Invoke-Checked $CodexPath @('plugin','add','--help')
}

Push-Location -LiteralPath $gardenRoot
try {
    if (!$SkipDependencies) { Invoke-Checked $npmPath @('ci','--no-audit','--no-fund') }
    Invoke-Checked $node.Source @('node_modules/electron/install.js')
    Invoke-Checked $node.Source @('scripts/check.cjs')
    Invoke-Checked $node.Source @('scripts/configure-plugin.cjs')
    if (!$SkipPlugin) {
        Invoke-Checked $CodexPath @('plugin','marketplace','add',$gardenRoot,'--json')
        Invoke-Checked $CodexPath @('plugin','add','project-garden-bridge@project-garden','--json')
        Invoke-Checked $CodexPath @('plugin','list','--marketplace','project-garden','--json')
    }
    if (!$NoShortcut) {
        $desktopDirectory = [Environment]::GetFolderPath('Desktop')
        $shortcutFile = Join-Path $desktopDirectory 'Project Garden.lnk'
        $shell = New-Object -ComObject WScript.Shell
        $shortcut = $shell.CreateShortcut($shortcutFile)
        $expected = Join-Path $gardenRoot 'node_modules\electron\dist\electron.exe'
        if ((Test-Path -LiteralPath $shortcutFile) -and $shortcut.TargetPath -ne $expected) { throw 'A Project Garden desktop shortcut points to another installation. Use -NoShortcut to preserve it, or review that installation before replacing it.' }
        $shortcut.TargetPath = $expected
        $shortcut.Arguments = '"' + $gardenRoot + '"'
        $shortcut.WorkingDirectory = $gardenRoot
        $shortcut.IconLocation = Join-Path $gardenRoot 'assets\garden-app-icon-v1.ico'
        $shortcut.Save()
    }
    if ($AutoStart -eq 'On') { & (Join-Path $gardenRoot 'integration\setup-codex-companion.ps1') }
    if ($AutoStart -eq 'Off') { & (Join-Path $gardenRoot 'integration\setup-codex-companion.ps1') -Disable }
    if (!$NoLaunch) { Start-Process -FilePath (Join-Path $gardenRoot 'node_modules\electron\dist\electron.exe') -ArgumentList ('"' + $gardenRoot + '"') -WorkingDirectory $gardenRoot -WindowStyle Normal }
    Write-Output 'Project Garden installed. Open a new Codex task to load the sync plugin. Settings in the garden can enable or disable launch with Codex.'
} finally { Pop-Location }
