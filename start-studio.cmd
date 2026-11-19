@echo off
rem Starts Labelina at http://localhost:8000 and opens it in the browser.
rem Close this window to stop the studio.
cd /d "%~dp0"
start "" http://localhost:8000
python -m http.server 8000 --bind 127.0.0.1
