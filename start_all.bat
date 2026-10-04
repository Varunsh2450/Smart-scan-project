@echo off
echo =====================================================================
echo  STARTING ELECTRONIC WARFARE SMART SCAN SIMULATION FULL-STACK SYSTEM
echo =====================================================================
echo.

echo 1. Starting Python ML Service (FastAPI) on port 5000...
start "EW Python ML Service" cmd /k "cd /d d:\SIH TRY\ml-service && python main.py"

timeout /t 2 /nobreak >nul 2>&1 || ping -n 3 127.0.0.1 >nul

echo 2. Starting Spring Boot Backend on port 8080...
start "EW Spring Boot Backend" cmd /k "cd /d d:\SIH TRY\backend && java -jar target\ew-simulation-backend-1.0.0.jar"

timeout /t 4 /nobreak >nul 2>&1 || ping -n 5 127.0.0.1 >nul

echo 3. Starting React Tactical Dashboard on port 3000...
start "EW React Dashboard" cmd /k "cd /d d:\SIH TRY\frontend && npm run dev"

echo.
echo All services launched!
echo - React Tactical Dashboard: http://localhost:3000
echo - Spring Boot Backend:      http://localhost:8080
echo - Python ML Service:         http://localhost:5000
echo =====================================================================
