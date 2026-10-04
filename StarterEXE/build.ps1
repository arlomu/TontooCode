# Builds StarterEXE/dist/TontooCode.exe (the name shown in Task Manager).
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

python -m PyInstaller `
    --noconfirm `
    --clean `
    --onefile `
    --windowed `
    --name TontooCode `
    --icon "$root\assets\icon.png" `
    --add-data "$root\assets\icon.png;assets" `
    --hidden-import PIL.Image `
    --distpath "$root\dist" `
    --workpath "$root\build" `
    --specpath "$root" `
    "$root\main.py"

Write-Output "Built $root\dist\TontooCode.exe"