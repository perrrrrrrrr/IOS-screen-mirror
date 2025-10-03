@echo off
title iPad Screen Monitor Service
echo Starting iPad Screen Monitor Service...

:: Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo Error: Node.js is not installed or not in PATH
    pause
    exit /b 1
)

:: Navigate to project directory
cd /d "c:\Projects\ipad-screen-monitor"

:: Install dependencies if needed
if not exist "node_modules" (
    echo Installing dependencies...
    npm install
)

:: Build the project
echo Building project...
npm run build

:: Start the application with restart loop
:restart
echo.
echo Starting iPad Screen Monitor...
echo Press Ctrl+C to stop the service
echo.

:: Run the application
node dist/main.js

:: If we get here, the application stopped
echo.
echo Application stopped. Restarting in 5 seconds...
echo Press Ctrl+C to cancel restart
timeout /t 5 /nobreak >nul
goto restart
