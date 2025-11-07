@echo off
REM Map-Ping v2.0 - Comprehensive Test Script (Windows)
REM Tests all Phase 1 components

echo ========================================
echo Map-Ping v2.0 - Test Suite
echo Task 1.6: Testing ^& Validation
echo ========================================
echo.

REM Check if backend is running
echo Checking if backend is running...
curl -s http://localhost:5000/api/health >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Backend is running
) else (
    echo [WARN] Backend not running. Please start it first:
    echo   cd backend ^&^& npm start
    echo.
    pause
    exit /b 1
)

REM Check if Redis is running
echo Checking if Redis is running...
docker ps | findstr map-ping-redis >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Redis is running
) else (
    echo [WARN] Redis not detected (may affect some tests)
    echo   Start Redis: docker-compose up -d redis
)

echo.
echo Running Test Suite...
echo ========================================
cd backend
node tests\test-suite.js
cd ..

echo.
echo Running Performance Tests...
echo ========================================
cd backend
node tests\performance-test.js
cd ..

echo.
echo Running WebSocket Tests...
echo ========================================
cd backend
node tests\test-websocket.js
cd ..

echo.
echo Running Redis Fallback Tests...
echo ========================================
cd backend
node tests\test-redis-fallback.js
cd ..

echo.
echo ========================================
echo Test Suite Complete
echo ========================================
echo.
echo Manual Testing Checklist:
echo   [ ] Test with 100+ devices configuration
echo   [ ] Monitor CPU usage (should be ^<15%%^)
echo   [ ] Monitor memory usage (should be ^<200MB^)
echo   [ ] Test WebSocket reconnection
echo   [ ] Test Redis fallback (stop Redis temporarily)
echo   [ ] Verify batch writes are committed
echo   [ ] Test circuit breaker with failing devices
echo.
pause


