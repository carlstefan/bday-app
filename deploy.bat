@echo off
echo === Pushing to GitHub ===
cd /d "C:\CS Claude Dev\Bday app"
git push origin bday-app
if %ERRORLEVEL% neq 0 (
    echo ERROR: git push failed. Check your credentials and try again.
    pause
    exit /b 1
)

echo.
echo === Deploying to production VPS ===
ssh -i "%USERPROFILE%\.ssh\id_ed25519" administrator@85.190.99.39 "cd /app && git pull && docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.prod up -d --build"
if %ERRORLEVEL% neq 0 (
    echo ERROR: Deployment failed. Check SSH connectivity and try again.
    pause
    exit /b 1
)

echo.
echo === Done! Pushed to GitHub and deployed to https://cs.grotter.net ===
pause
