@echo off
chcp 65001 >nul
title Editor Viral
cd /d "%~dp0"
set "NODE=%ProgramFiles%\nodejs\node.exe"
if not exist "%NODE%" set "NODE=node"
start "" /b cmd /c "timeout /t 2 /nobreak >nul & start "" http://localhost:3210"
"%NODE%" servidor.js
echo.
echo O Editor Viral desligou. Se foi um erro, veja a pasta logs.
pause
