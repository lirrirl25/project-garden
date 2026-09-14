param([switch]$Disable, [switch]$Status)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'codex-companion.ps1') -LibraryOnly
$watcher = Join-Path $PSScriptRoot 'codex-companion.ps1'
$startup = [Environment]::GetFolderPath('Startup')
$shortcutPath = Join-Path $startup 'Project Garden - Codex Companion.lnk'
$powershellExe = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$arguments = '-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + $watcher + '"'
$shell = New-Object -ComObject WScript.Shell
$exists = Test-Path -LiteralPath $shortcutPath
if ($exists) {
    $existing = $shell.CreateShortcut($shortcutPath)
    if ($existing.Arguments -ne $arguments -or $existing.TargetPath -ne $powershellExe) {
        throw 'A different shortcut already uses the companion name; left unchanged.'
    }
}
if ($Status) {
    $handle = $null
    $running = [System.Threading.Mutex]::TryOpenExisting((Get-CompanionName), [ref]$handle)
    if ($handle) { $handle.Dispose() }
    [pscustomobject]@{ Enabled = $exists; Running = $running; Shortcut = $shortcutPath } | ConvertTo-Json -Compress
    exit 0
}
if ($Disable) {
    $stop = $null
    if ([System.Threading.EventWaitHandle]::TryOpenExisting(((Get-CompanionName) + '-Stop'), [ref]$stop)) {
        $null = $stop.Set()
        $stop.Dispose()
    }
    # Only the exact, ownership-checked companion shortcut is removed.
    if ($exists) { Remove-Item -LiteralPath $shortcutPath }
    Write-Output 'Codex companion disabled. Project Garden and its data are unchanged.'
    exit 0
}
if (!(Test-Path -LiteralPath (Join-Path (Split-Path $PSScriptRoot -Parent) 'node_modules\electron\dist\electron.exe'))) {
    throw 'Project Garden is not installed at the expected location.'
}
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $powershellExe
$shortcut.Arguments = $arguments
$shortcut.WorkingDirectory = Split-Path $PSScriptRoot -Parent
$shortcut.WindowStyle = 7
$shortcut.Description = 'Open Project Garden once when the Codex desktop window starts. Local only.'
$shortcut.Save()
# Reload an existing watcher when reconfiguring, without touching either app.
$oldStop = $null
if ([System.Threading.EventWaitHandle]::TryOpenExisting(((Get-CompanionName) + '-Stop'), [ref]$oldStop)) {
    $null = $oldStop.Set()
    $oldStop.Dispose()
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        $oldMutex = $null
        if (![System.Threading.Mutex]::TryOpenExisting((Get-CompanionName), [ref]$oldMutex)) { break }
        $oldMutex.Dispose()
        Start-Sleep -Milliseconds 100
    }
}
Start-Process -FilePath $powershellExe -ArgumentList $arguments -WindowStyle Hidden
Write-Output 'Codex companion enabled for this Windows user and started now.'
