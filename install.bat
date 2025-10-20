@echo off
echo ========================================
echo Network Link Map Monitor - Installation
echo ========================================
echo.

echo [1/3] Installing root dependencies...
call npm install
echo.

echo [2/3] Installing frontend dependencies...
cd frontend
call npm install
cd ..
echo.

echo [3/3] Installing backend dependencies...
cd backend
call npm install
cd ..
echo.

echo ========================================
echo Installation Complete!
echo ========================================
echo.
echo To start the application, run:
echo   npm run dev
echo.
echo Frontend will be available at: http://localhost:4000
echo Backend API will be available at: http://localhost:5000/api
echo.
pause



