@echo off
setlocal

echo Installing backend dependencies...
pushd "%~dp0backend" || exit /b 1
npm install
if errorlevel 1 (
  echo Backend install failed. Aborting.
  popd
  exit /b %errorlevel%
)
popd

echo Installing frontend dependencies...
pushd "%~dp0frontend" || exit /b 1
npm install
if errorlevel 1 (
  echo Frontend install failed. Aborting.
  popd
  exit /b %errorlevel%
)
popd

echo All dependencies installed.
endlocal
