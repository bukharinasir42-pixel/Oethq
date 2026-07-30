@echo off
setlocal EnableDelayedExpansion

rem Resolve repo root relative to this script by hopping up one level
set "SCRIPT_DIR=%~dp0"
pushd "%SCRIPT_DIR%\.." || (
  echo Failed to resolve repo root from "%SCRIPT_DIR%"
  exit /b 1
)
set "REPO_ROOT=%CD%"
echo Repo root resolved to: "!REPO_ROOT!"

echo Backend HTTP: Express on API_PORT (default 4000). From backend: npm run start:dev
echo Starting backend and frontend in separate terminals...
call :start_service "backend" "npm run start:dev" "oet-lms-backend" || goto :fail
call :start_service "frontend" "npm run dev" "oet-lms-frontend" || goto :fail

popd
echo Backend and frontend started in new terminals.
exit /b 0

:start_service
set "SERVICE_NAME=%~1"
set "SERVICE_CMD=%~2"
set "SERVICE_TITLE=%~3"
set "SERVICE_DIR=!REPO_ROOT!\%SERVICE_NAME%"

if not exist "!SERVICE_DIR!\" (
  echo Missing folder: "!SERVICE_DIR!"
  exit /b 1
)

pushd "!SERVICE_DIR!" || (
  echo Failed to enter "!SERVICE_DIR!"
  exit /b 1
)
echo Starting !SERVICE_NAME! (dev) in "!SERVICE_DIR!"...
start "!SERVICE_TITLE!" cmd /k "cd /d ""!SERVICE_DIR!"" && !SERVICE_CMD!"
popd
exit /b 0

:fail
popd
exit /b 1
