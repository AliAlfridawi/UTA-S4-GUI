# PowerShell script to create a desktop shortcut for S4 Simulation GUI
# Run with: powershell -ExecutionPolicy Bypass -File create-shortcut.ps1

param(
    [string]$ShortcutName = "S4 Simulation GUI",
    [switch]$StartMenu
)

$ErrorActionPreference = "Stop"

# Get paths
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$TargetPath = Join-Path $ScriptDir "start.bat"
$IconPath = Join-Path $ScriptDir "icon.ico"
$DesktopPath = [Environment]::GetFolderPath("Desktop")
$StartMenuPath = [Environment]::GetFolderPath("StartMenu")

# Validate start.bat exists
if (-not (Test-Path $TargetPath)) {
    Write-Error "start.bat not found at: $TargetPath"
    exit 1
}

# Create shortcut function
function New-Shortcut {
    param(
        [string]$ShortcutPath,
        [string]$TargetPath,
        [string]$WorkingDirectory,
        [string]$IconLocation,
        [string]$Description
    )
    
    $WScriptShell = New-Object -ComObject WScript.Shell
    $Shortcut = $WScriptShell.CreateShortcut($ShortcutPath)
    $Shortcut.TargetPath = $TargetPath
    $Shortcut.WorkingDirectory = $WorkingDirectory
    $Shortcut.Description = $Description
    $Shortcut.WindowStyle = 7  # Minimized
    
    # Set icon if available, otherwise use default
    if (Test-Path $IconLocation) {
        $Shortcut.IconLocation = $IconLocation
    }
    
    $Shortcut.Save()
    
    Write-Host "Shortcut created: $ShortcutPath" -ForegroundColor Green
}

# Create desktop shortcut
$DesktopShortcut = Join-Path $DesktopPath "$ShortcutName.lnk"
New-Shortcut `
    -ShortcutPath $DesktopShortcut `
    -TargetPath $TargetPath `
    -WorkingDirectory $ScriptDir `
    -IconLocation $IconPath `
    -Description "Launch S4 Photonic Crystal Simulation GUI"

# Optionally create Start Menu shortcut
if ($StartMenu) {
    $StartMenuFolder = Join-Path $StartMenuPath "Programs\S4 Simulation"
    if (-not (Test-Path $StartMenuFolder)) {
        New-Item -ItemType Directory -Path $StartMenuFolder -Force | Out-Null
    }
    
    $StartMenuShortcut = Join-Path $StartMenuFolder "$ShortcutName.lnk"
    New-Shortcut `
        -ShortcutPath $StartMenuShortcut `
        -TargetPath $TargetPath `
        -WorkingDirectory $ScriptDir `
        -IconLocation $IconPath `
        -Description "Launch S4 Photonic Crystal Simulation GUI"
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Desktop shortcut created successfully!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "You can now launch the S4 Simulation GUI from your desktop."
Write-Host ""

# Pause to show results
Read-Host "Press Enter to close"
