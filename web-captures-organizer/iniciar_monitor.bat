@echo off
echo ========================================
echo Web Captures Organizer - Monitor
echo ========================================
echo.
echo Iniciando monitor automatico...
echo.
cd /d "%~dp0"
python auto_monitor.py
pause
