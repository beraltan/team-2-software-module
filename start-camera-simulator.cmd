@echo off
cd /d "%~dp0"
".venv\Scripts\python.exe" tools\camera_simulator.py --port COM5
pause
