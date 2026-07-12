@echo off
echo ========================================
echo Starting CodeSage...
echo ========================================

echo Starting Backend Server (Port 3001)...
start "CodeSage Backend" cmd /c "cd server && npm install && npm run dev"

echo Starting Frontend Server (Port 5173)...
start "CodeSage Frontend" cmd /c "npm install && npm run dev"

echo.
echo Both servers are starting up in separate windows!
echo To stop them, run kill.bat
echo ========================================
pause
