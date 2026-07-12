@echo off
echo ========================================
echo Stopping CodeSage Servers...
echo ========================================

:: Kill processes that were started with the specific window titles
taskkill /FI "WINDOWTITLE eq CodeSage Backend*" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq CodeSage Frontend*" /T /F >nul 2>&1

:: Fallback: Kill processes holding the specific ports (3001 and 5173)
FOR /F "tokens=5" %%T IN ('netstat -a -n -o ^| findstr :3001') DO (
    TaskKill.exe /F /PID %%T >nul 2>&1
)
FOR /F "tokens=5" %%T IN ('netstat -a -n -o ^| findstr :5173') DO (
    TaskKill.exe /F /PID %%T >nul 2>&1
)

echo.
echo Servers have been successfully stopped!
echo ========================================
pause
