@echo off
setlocal
cd /d "%~dp0"
title TECMOV RMA
where npm >nul 2>&1
if errorlevel 1 (
 echo Instala Node.js LTS desde https://nodejs.org/ antes de continuar.
 pause
 exit /b 1
)
if not exist "node_modules\electron" (
 echo Preparando aplicacion por primera vez...
 call npm install
 if errorlevel 1 (
   echo No se pudieron instalar las dependencias.
   pause
   exit /b 1
 )
)
call npm start
if errorlevel 1 pause
