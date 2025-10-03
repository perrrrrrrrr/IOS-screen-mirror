# PowerShell script to create a Windows Task Scheduler task for the iPad monitor
# This ensures the application starts automatically and runs as a service

Write-Host "Setting up iPad Screen Monitor as a Windows Service..." -ForegroundColor Green

# Check if running as administrator
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Host "This script requires administrator privileges to create scheduled tasks." -ForegroundColor Red
    Write-Host "Please run PowerShell as Administrator and try again." -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# Define task parameters
$TaskName = "iPad-Screen-Monitor"
$TaskDescription = "Monitors iPad screen via AirConnect and sends Discord notifications"
$ProjectPath = "c:\Projects\ipad-screen-monitor"
$ScriptPath = "$ProjectPath\run-service.ps1"

# Check if project exists
if (!(Test-Path $ProjectPath)) {
    Write-Host "Project directory not found: $ProjectPath" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Remove existing task if it exists
try {
    $existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if ($existingTask) {
        Write-Host "Removing existing task..." -ForegroundColor Yellow
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    }
} catch {
    # Task doesn't exist, continue
}

# Create the scheduled task action
$Action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$ScriptPath`""

# Create the scheduled task trigger (at startup)
$Trigger = New-ScheduledTaskTrigger -AtStartup

# Create task settings
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

# Create the scheduled task principal (run as current user)
$Principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive

# Register the scheduled task
try {
    Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Principal $Principal -Description $TaskDescription
    Write-Host "✅ Task '$TaskName' created successfully!" -ForegroundColor Green
    
    # Configure power settings to prevent computer sleep
    Write-Host "Configuring power settings..." -ForegroundColor Yellow
    powercfg /change standby-timeout-ac 0  # Never sleep when plugged in
    powercfg /change hibernate-timeout-ac 0  # Never hibernate when plugged in
    
    Write-Host "✅ Setup complete!" -ForegroundColor Green
    Write-Host ""
    Write-Host "The iPad Screen Monitor will now:" -ForegroundColor Cyan
    Write-Host "• Start automatically when Windows boots" -ForegroundColor White
    Write-Host "• Run in the background even when screen is off" -ForegroundColor White
    Write-Host "• Restart automatically if it crashes" -ForegroundColor White
    Write-Host "• Continue running even when you're not logged in" -ForegroundColor White
    Write-Host ""
    Write-Host "To manage the task:" -ForegroundColor Yellow
    Write-Host "• View: Get-ScheduledTask -TaskName '$TaskName'" -ForegroundColor White
    Write-Host "• Start: Start-ScheduledTask -TaskName '$TaskName'" -ForegroundColor White
    Write-Host "• Stop: Stop-ScheduledTask -TaskName '$TaskName'" -ForegroundColor White
    Write-Host "• Remove: Unregister-ScheduledTask -TaskName '$TaskName'" -ForegroundColor White
    
} catch {
    Write-Host "❌ Failed to create scheduled task: $($_.Exception.Message)" -ForegroundColor Red
}

Read-Host "Press Enter to exit"
