@echo off
REM Script to commit and push Docker deployment files to GitHub (Windows)

echo =========================================
echo Map-Ping GitHub Upload Script
echo =========================================
echo.

REM Check if git is initialized
if not exist ".git" (
    echo Error: Not a git repository!
    echo Please run: git init
    exit /b 1
)

REM Show current status
echo Current git status:
git status
echo.

REM Ask for confirmation
set /p confirm="Do you want to commit and push these changes? (y/n): "
if /i not "%confirm%"=="y" (
    echo Aborted.
    exit /b 0
)

REM Stage all files
echo Staging files...
git add .

REM Commit with message
echo Creating commit...
git commit -m "Add Docker deployment configuration and GitHub Actions workflows

- Add multi-stage Dockerfile for optimized production builds
- Add docker-compose.yml for easy deployment
- Add Docker documentation (DOCKER_README.md)
- Add comprehensive deployment guide (DEPLOYMENT.md)
- Add GitHub Actions for automated Docker builds and testing
- Update .gitignore for Docker files"

REM Check if remote exists
git remote | findstr /C:"origin" >nul
if errorlevel 1 (
    echo.
    echo No remote 'origin' found!
    echo Please add a remote repository:
    echo   git remote add origin https://github.com/YOUR_USERNAME/map-ping.git
    exit /b 1
)

REM Push to GitHub
echo.
echo Pushing to GitHub...
git push origin main

REM Check if push was successful
if %errorlevel% equ 0 (
    echo.
    echo =========================================
    echo Successfully pushed to GitHub!
    echo =========================================
    echo.
    echo Next steps:
    echo 1. Visit your repository on GitHub
    echo 2. Check the Actions tab to see automated builds
    echo 3. Pull your Docker image: docker pull ghcr.io/YOUR_USERNAME/map-ping:latest
    echo.
) else (
    echo.
    echo =========================================
    echo Push failed!
    echo =========================================
    echo.
    echo Possible issues:
    echo 1. Authentication required - check your credentials
    echo 2. Remote repository doesn't exist
    echo 3. Network connectivity issues
    echo.
    echo For help, see GITHUB_UPLOAD_GUIDE.md
)

pause

