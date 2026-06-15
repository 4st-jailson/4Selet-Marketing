@echo off
REM ============================================================
REM  Painel 4Selet - inicializador resiliente (Windows / VPS)
REM  - Garante dependencias instaladas (node_modules)
REM  - Sobe o servidor e REINICIA automaticamente se cair
REM  Uso: dar duplo clique, ou registrar numa Tarefa Agendada
REM       (logon/startup) apontando para este arquivo.
REM ============================================================

cd /d "%~dp0"
title Painel 4Selet (interface)

where node >nul 2>nul
if errorlevel 1 (
  echo [ERRO] Node.js nao encontrado no PATH. Instale o Node 24+ e tente de novo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [setup] Instalando dependencias pela primeira vez...
  call npm install
)

:loop
echo.
echo [%date% %time%] Iniciando o Painel 4Selet...
node server.js
echo.
echo [%date% %time%] O painel encerrou (codigo %errorlevel%). Reiniciando em 3s... (Ctrl+C para parar)
timeout /t 3 /nobreak >nul
goto loop
