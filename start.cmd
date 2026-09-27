@echo off
cd /d "%~dp0"
uv run --locked python app\server.py %*
