@echo off
REM 🎮 Memex Racing - Easy Start Script for Windows
REM This script makes it easy to deploy and play the game

echo ===================================
echo 🎮 Memex Racing - Serverless Multiplayer
echo ===================================
echo.

REM Check if node is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed. Please install Node.js first.
    echo    Visit: https://nodejs.org
    pause
    exit /b 1
)

REM Check if this is first run
if not exist ".env" (
    echo 🔧 First time setup detected...
    echo.
    
    REM Run setup
    call npm run deploy:setup
    
    echo.
    echo ⚠️  Please configure your .env file with:
    echo    - Ably API key (get from ably.com)
    echo    - JWT secret (generate a 32+ character string)
    echo.
    echo Then run this script again!
    pause
    exit /b 0
)

REM Check if already deployed
if exist ".vercel\project.json" (
    echo ✅ Project already deployed!
    echo.
    
    echo Options:
    echo 1) Open game in browser
    echo 2) Deploy new version
    echo 3) View logs
    echo 4) Exit
    echo.
    
    set /p choice="Choose an option (1-4): "
    
    if "%choice%"=="1" (
        echo 🌐 Opening game...
        for /f "tokens=2 delims=:" %%a in ('vercel ls 2^>nul ^| findstr "https:"') do (
            start %%a
            goto :end
        )
    )
    
    if "%choice%"=="2" (
        echo 🚀 Deploying new version...
        call npm run deploy:vercel:prod
        goto :end
    )
    
    if "%choice%"=="3" (
        echo 📊 Viewing logs...
        vercel logs
        pause
        goto :end
    )
    
    if "%choice%"=="4" (
        echo 👋 Goodbye!
        exit /b 0
    )
) else (
    echo 🚀 Deploying game for the first time...
    echo.
    
    REM Install dependencies if needed
    if not exist "node_modules" (
        echo 📦 Installing dependencies...
        call npm install
    )
    
    REM Build for serverless
    echo 🔨 Building game...
    call npm run build:serverless
    
    REM Deploy
    echo 🚀 Deploying to Vercel...
    call npm run deploy:vercel:prod
    
    echo.
    echo ✅ Deployment complete!
    echo 🎮 Your game is now live and ready for multiplayer!
)

:end
echo.
echo 🎯 Next steps:
echo    - Share your game URL with friends
echo    - Create rooms and play together
echo    - Check Vercel dashboard for analytics
echo.
pause