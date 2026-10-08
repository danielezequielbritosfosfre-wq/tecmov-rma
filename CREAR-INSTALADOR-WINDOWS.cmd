@echo off
setlocal
cd /d "%~dp0"
title TECMOV RMA - Crear instalador para Windows
where node >nul 2>&1
if errorlevel 1 (
 echo.
 echo FALTA NODE.JS EN ESTE EQUIPO.
 echo Instala Node.js LTS desde https://nodejs.org/
 echo Despues vuelve a abrir este archivo.
 echo.
 pause
 exit /b 1
)
where npm >nul 2>&1
if errorlevel 1 (
 echo No se encontro npm. Reinstala Node.js LTS.
 pause
 exit /b 1
)
echo Instalando dependencias de TECMOV RMA...
call npm install
if errorlevel 1 goto failed
echo.
echo Generando instalador para Windows...
call npm run dist:win
if errorlevel 1 goto failed
echo.
echo Instalador generado. Abriendo carpeta dist...
start "" "%~dp0dist"
pause
exit /b 0
:failed
echo.
echo NO SE PUDO CREAR EL INSTALADOR.
echo Revisa los errores anteriores. Se necesita conexion a Internet.
pause
exit /b 1
