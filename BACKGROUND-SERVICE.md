# iPad Screen Monitor - Background Service Guide

## Will it run when my screen is off?

**YES!** Your iPad Screen Monitor will continue running in the background when you turn your computer screen off. Here's what you need to know:

## 🟢 What Will Continue Working:
- ✅ The Node.js application process
- ✅ AirConnect receiving iPad screen data
- ✅ Text detection and analysis
- ✅ Discord notifications
- ✅ Image cleanup and management

## 🟡 Potential Issues to Consider:
- ⚠️ **Computer Sleep**: If your computer goes to sleep, everything stops
- ⚠️ **AirConnect GUI**: Some GUI applications pause when display turns off
- ⚠️ **Network**: WiFi might disconnect in power-saving mode
- ⚠️ **Crashes**: Application won't restart automatically without proper setup

## 🚀 Recommended Setup Options:

### Option 1: Simple Background Running
```bash
npm run service
```
- Runs with auto-restart on crash
- Configures power settings
- Works until you restart computer

### Option 2: Windows Service (Recommended)
```bash
# Run as Administrator:
powershell -ExecutionPolicy Bypass -File setup-service.ps1
```
- Starts automatically on boot
- Runs even when not logged in
- Survives computer restarts
- Auto-restarts on crashes

### Option 3: Manual with Power Settings
```bash
# Prevent computer sleep:
powercfg /change standby-timeout-ac 0
powercfg /change monitor-timeout-ac 30

# Then run normally:
npm run dev
```

## 🔧 Power Management Settings:

The service scripts automatically configure:
- **AC Power**: Never sleep when plugged in
- **Monitor**: Can turn off after 30 minutes (saves power)
- **USB**: Maintain power to devices
- **Network**: Keep WiFi active

## 📱 AirConnect Considerations:

Make sure AirConnect is configured to:
- Run as a service or background process
- Not depend on user session
- Continue receiving when display is off

## 🔍 Monitoring the Service:

Check if it's running:
```powershell
# Check scheduled task
Get-ScheduledTask -TaskName "iPad-Screen-Monitor"

# Check running processes
Get-Process -Name "node" | Where-Object {$_.MainWindowTitle -like "*iPad*"}
```

## 🛑 Stopping the Service:

```powershell
# Stop scheduled task
Stop-ScheduledTask -TaskName "iPad-Screen-Monitor"

# Or remove completely
Unregister-ScheduledTask -TaskName "iPad-Screen-Monitor"
```

## 💡 Tips for Reliable Operation:

1. **Use a dedicated computer/laptop** for monitoring
2. **Keep it plugged in** to avoid battery issues
3. **Use ethernet instead of WiFi** if possible
4. **Test thoroughly** before relying on it
5. **Check Discord notifications** periodically

## 🔧 Troubleshooting:

If notifications stop:
1. Check if AirConnect is still receiving iPad data
2. Verify network connectivity
3. Check Discord bot token validity
4. Look for error messages in the console
5. Restart the service

The image cleanup feature ensures you won't run out of disk space from accumulated screenshots!
