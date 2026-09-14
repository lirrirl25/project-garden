param([switch]$LibraryOnly)

# Local window/process metadata only. No Codex files, conversations or network.
function Get-CodexWindowKey {
    param([object[]]$Processes)
    $keys = @($Processes | Where-Object {
        $_.MainWindowHandle -ne 0 -and
        $_.Path -match '\\WindowsApps\\OpenAI\.Codex_[^\\]+\\app\\ChatGPT\.exe$'
    } | ForEach-Object { [string]$_.Id } | Sort-Object)
    return ($keys -join ',')
}

function Test-GardenProcess {
    param([object]$Process, [string]$GardenExe, [int]$SessionId)
    # Electron can own a visible BrowserWindow while Get-Process still reports
    # MainWindowHandle = 0. The executable path and logon session are the
    # stable identity; requiring a Win32 main-window handle caused the watcher
    # to mistake a healthy garden for a stopped one during Codex startup.
    return $Process.SessionId -eq $SessionId -and $Process.Path -eq $GardenExe
}

function New-CompanionState {
    return @{ PreviousKey = ''; LastAttempt = [datetime]::MinValue }
}

function Test-CompanionLaunch {
    param([hashtable]$State, [string]$WindowKey, [bool]$GardenRunning, [datetime]$Now)
    $opened = $WindowKey -ne '' -and $WindowKey -ne $State.PreviousKey
    $State.PreviousKey = $WindowKey
    # Never fight a deliberate garden close, or repeatedly retry a crash.
    if (!$opened -or $GardenRunning -or ($Now - $State.LastAttempt).TotalSeconds -lt 60) { return $false }
    $State.LastAttempt = $Now
    return $true
}

function Get-CompanionName {
    return 'Local\ProjectGardenCodexCompanion-' + [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
}

if ($LibraryOnly) { return }

$ErrorActionPreference = 'Stop'
$gardenRoot = Split-Path $PSScriptRoot -Parent
$gardenExe = Join-Path $gardenRoot 'node_modules\electron\dist\electron.exe'
if (!(Test-Path -LiteralPath $gardenExe)) { throw 'Project Garden Electron runtime is missing.' }
$created = $false
$name = Get-CompanionName
$mutex = [System.Threading.Mutex]::new($true, $name, [ref]$created)
if (!$created) { $mutex.Dispose(); exit 0 }
$stop = [System.Threading.EventWaitHandle]::new($false, [System.Threading.EventResetMode]::ManualReset, ($name + '-Stop'))
$currentSession = [System.Diagnostics.Process]::GetCurrentProcess().SessionId
$watchState = New-CompanionState
try {
    do {
        try {
            $codex = @(Get-Process -Name ChatGPT -ErrorAction SilentlyContinue | Where-Object { $_.SessionId -eq $currentSession })
            $key = Get-CodexWindowKey -Processes $codex
            $garden = @(Get-Process -Name electron -ErrorAction SilentlyContinue | Where-Object { Test-GardenProcess -Process $_ -GardenExe $gardenExe -SessionId $currentSession })
            if (Test-CompanionLaunch -State $watchState -WindowKey $key -GardenRunning ($garden.Count -gt 0) -Now ([datetime]::UtcNow)) {
                # This is the visible interactive app the user asked to open;
                # only the PowerShell watcher runs hidden.
                Start-Process -FilePath $gardenExe -ArgumentList ('"' + $gardenRoot + '" --codex-autostart') -WorkingDirectory $gardenRoot -WindowStyle Normal
            }
        } catch {
            # An inaccessible/exiting process should not stop future detection.
            Write-Warning $_.Exception.Message
        }
    } while (!$stop.WaitOne(3000))
} finally {
    $stop.Dispose()
    $mutex.ReleaseMutex()
    $mutex.Dispose()
}
