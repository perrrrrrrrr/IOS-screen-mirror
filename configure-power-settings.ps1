# Configure Windows Power Settings for iPad Screen Monitor
# Run this as Administrator

Write-Host "🔧 Configuring power settings for continuous monitoring..."

# Prevent computer from sleeping when plugged in (AC power)
powercfg /change standby-timeout-ac 0
Write-Host "✅ Computer will never sleep when plugged in"

# Prevent monitors from turning off when plugged in
powercfg /change monitor-timeout-ac 0
Write-Host "✅ Monitors will never turn off when plugged in"

# For battery power (if applicable) - set longer timeouts
powercfg /change standby-timeout-dc 120  # 2 hours
powercfg /change monitor-timeout-dc 60   # 1 hour
Write-Host "✅ Battery timeouts set to 2hrs sleep, 1hr monitor"

# Prevent USB devices from being suspended (keeps AirConnect devices active)
powercfg /change usb-timeout-ac 0
Write-Host "✅ USB devices will stay active"

# Show current settings
Write-Host "`n📊 Current Power Settings:"
powercfg /query SCHEME_CURRENT SUB_VIDEO VIDEOIDLE
powercfg /query SCHEME_CURRENT SUB_SLEEP STANDBYIDLE

Write-Host "`n🎯 Power settings optimized for 24/7 monitoring!"
Write-Host "💡 Your monitors and computer will stay awake when plugged in."
Write-Host "⚠️  Make sure your computer is plugged into AC power!"

# Optional: Disable screensaver as well
Write-Host "`n🖥️  Consider also disabling screensaver in Windows Settings > Personalization > Lock screen"
