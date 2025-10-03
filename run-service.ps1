# PowerShell script to run the iPad monitor as a background service
# This keeps the application running even when the screen is off

Write-Host "Starting iPad Screen Monitor Service..." -ForegroundColor Green

# Set power management to prevent sleep
Write-Host "Configuring power settings..." -ForegroundColor Yellow
powercfg /change standby-timeout-ac 0
powercfg /change monitor-timeout-ac 30  # Monitor can turn off after 30 minutes

# Navigate to project directory
Set-Location "c:\Projects\ipad-screen-monitor"

# Install dependencies if needed
if (!(Test-Path "node_modules")) {
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    npm install
}

# Build the project
Write-Host "Building project..." -ForegroundColor Yellow
npm run build

# Function to start the application with restart capability
function Start-MonitorApp {
    while ($true) {
        try {
            Write-Host "Starting iPad Screen Monitor..." -ForegroundColor Green
            Write-Host "Press Ctrl+C to stop the service" -ForegroundColor Cyan
            
            # Start the application
            node dist/main.js
            
        } catch {
            Write-Host "Application crashed: $($_.Exception.Message)" -ForegroundColor Red
            Write-Host "Restarting in 10 seconds..." -ForegroundColor Yellow
            Start-Sleep -Seconds 10
        }
        
        # If we get here, the application exited normally or crashed
        Write-Host "Application stopped. Restarting in 5 seconds..." -ForegroundColor Yellow
        Start-Sleep -Seconds 5
    }
}

# Start the monitoring loop
Start-MonitorApp
