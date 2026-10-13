@echo off
rem installa tutto quello che serve (da fare una volta sola)
cd /d "%~dp0"
cd dynbipgraph-js && call npm i
cd ..\paths-js && call npm i
cd ..\DynBipGraphVis && call npm i
cd ..\backend
if not exist .venv python -m venv .venv
call .venv\Scripts\activate
pip install -r requirements.txt
echo.
echo installazione finita
pause
