# Mouse Coordinate Helper Tool
# Run this script and hover your mouse over the boost badge to get exact coordinates

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

Write-Host "🎯 Mouse Coordinate Tracker" -ForegroundColor Green
Write-Host "Hover your mouse over the '18% Boost' badge and press ENTER to capture coordinates" -ForegroundColor Yellow
Write-Host "Press Ctrl+C to exit" -ForegroundColor Red
Write-Host ""

while($true) {
    $pos = [System.Windows.Forms.Cursor]::Position
    Write-Host "Current Position: X=$($pos.X), Y=$($pos.Y) - Press ENTER to capture, Ctrl+C to exit" -NoNewline
    
    # Check if Enter key is pressed
    if ([Console]::KeyAvailable) {
        $key = [Console]::ReadKey($true)
        if ($key.Key -eq "Enter") {
            Write-Host ""
            Write-Host "📍 CAPTURED COORDINATES:" -ForegroundColor Green
            Write-Host "X: $($pos.X)" -ForegroundColor Cyan
            Write-Host "Y: $($pos.Y)" -ForegroundColor Cyan
            Write-Host ""
            Write-Host "For CROP_AREA, use these coordinates:" -ForegroundColor Yellow
            Write-Host "x: $($pos.X)," -ForegroundColor White
            Write-Host "y: $($pos.Y)," -ForegroundColor White
            Write-Host ""
        }
    }
    
    Write-Host "`r" -NoNewline
    Start-Sleep -Milliseconds 100
}
