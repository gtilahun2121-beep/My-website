@echo off
REM QalNet System Verification Script

echo.
echo ========================================================================
echo              QalNet System Verification
echo ========================================================================
echo.

setlocal enabledelayedexpansion
set passed=0
set failed=0

REM Check Node.js
echo 1. Checking Prerequisites...
for /f "tokens=*" %%i in ('node --version 2^>nul') do set nodeVersion=%%i
if not defined nodeVersion (
    echo   Node.js: NOT FOUND - ERROR
    set /a failed+=1
) else (
    echo   Node.js: %nodeVersion% - OK
    set /a passed+=1
)

REM Check npm
for /f "tokens=*" %%i in ('npm --version 2^>nul') do set npmVersion=%%i
if not defined npmVersion (
    echo   npm: NOT FOUND - ERROR
    set /a failed+=1
) else (
    echo   npm: %npmVersion% - OK
    set /a passed+=1
)

REM Check node_modules
if exist "node_modules" (
    echo   Dependencies: OK - Installed
    set /a passed+=1
) else (
    echo   Dependencies: MISSING
    set /a failed+=1
)

echo.
echo 2. Checking Build Artifacts...

REM Backend build
if exist "apps\backend\dist\apps\backend\src\main.js" (
    echo   Backend Build: OK - Found
    set /a passed+=1
) else (
    echo   Backend Build: MISSING
    set /a failed+=1
)

REM Frontend build
if exist "apps\web\.next" (
    echo   Frontend Build: OK - Found
    set /a passed+=1
) else (
    echo   Frontend Build: MISSING
    set /a failed+=1
)

echo.
echo 3. Checking Configuration...

REM Backend .env
if exist "apps\backend\.env" (
    echo   Backend .env: OK - Found
    set /a passed+=1
) else (
    echo   Backend .env: MISSING
    set /a failed+=1
)

REM Frontend .env.local
if exist "apps\web\.env.local" (
    echo   Frontend .env: OK - Found
    set /a passed+=1
) else (
    echo   Frontend .env: MISSING
    set /a failed+=1
)

echo.
echo 4. Checking Database Files...

REM Schema file
if exist "apps\backend\database\schema.sql" (
    echo   Schema File: OK - Found
    set /a passed+=1
) else (
    echo   Schema File: MISSING
    set /a failed+=1
)

REM Migrations directory
if exist "apps\backend\database\migrations" (
    echo   Migrations: OK - Found
    set /a passed+=1
) else (
    echo   Migrations: MISSING
    set /a failed+=1
)

echo.
echo 5. Checking Documentation...

if exist "README.md" (
    echo   README.md: OK
    set /a passed+=1
)

if exist "SETUP_GUIDE.md" (
    echo   SETUP_GUIDE.md: OK
    set /a passed+=1
)

if exist "SYSTEM_STATUS.md" (
    echo   SYSTEM_STATUS.md: OK
    set /a passed+=1
)

if exist "FILE_STRUCTURE.md" (
    echo   FILE_STRUCTURE.md: OK
    set /a passed+=1
)

echo.
echo ========================================================================
echo                         Summary
echo ========================================================================
echo.

echo   Passed: %passed%
echo   Failed: %failed%
set /a total=%passed%+%failed%
echo   Total:  %total%

REM Calculate percentage
if %total% GTR 0 (
    set /a percentage=(%passed%*100)/%total%
) else (
    set percentage=0
)

echo   Score:  %percentage%^%
echo.

if %percentage% GEQ 90 (
    echo. OK - System is ready for deployment
    echo.
    echo Next steps:
    echo   1. Start the system: scripts\startup.ps1
    echo   2. Or run dev mode:  npm run dev
) else (
    echo. WARNING - Some components need attention
    echo.
    echo Actions:
    echo   1. Review SETUP_GUIDE.md
    echo   2. Run: npm install
    echo   3. Run: npm run build
)

echo.
pause
