@echo off
rem Fork: run the locally built app (with the MCP server) without packaging.
rem Close the installed Langbai NovelAI Studio first: both share the same user data.
setlocal
cd /d "%~dp0"
if not exist "dist-electron\electron\bootstrap.js" (
  echo Building...
  call npm run build || (pause & exit /b 1)
)
start "" "%~dp0node_modules\electron\dist\electron.exe" "%~dp0."
exit /b 0
