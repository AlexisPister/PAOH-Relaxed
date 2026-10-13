@echo off
rem avvia il frontend: aprire http://localhost:3001
cd /d "%~dp0DynBipGraphVis"
call npm run dev
pause
