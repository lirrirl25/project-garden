@echo off
setlocal
cd /d "%~dp0"
call node_modules\.bin\electron.cmd .
