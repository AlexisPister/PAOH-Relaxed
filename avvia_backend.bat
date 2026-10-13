@echo off
rem avvia il backend sulla porta 5005
cd /d "%~dp0backend"
set "CONDAENV=%USERPROFILE%\miniconda3\envs\paoh-relaxed"
if not exist "%CONDAENV%\python.exe" set "CONDAENV=%USERPROFILE%\anaconda3\envs\paoh-relaxed"
if exist "%CONDAENV%\python.exe" goto conda
call .venv\Scripts\activate
pip install -q -r requirements.txt
python app.py
goto fine
:conda
set "PATH=%CONDAENV%;%CONDAENV%\Library\bin;%CONDAENV%\Scripts;%PATH%"
"%CONDAENV%\python.exe" -m pip install -q lxml
"%CONDAENV%\python.exe" app.py
:fine
pause
