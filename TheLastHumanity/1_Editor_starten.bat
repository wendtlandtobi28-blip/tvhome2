@echo off
setlocal
title THE LAST HUMANITY - Editor starten
cd /d "%~dp0"
set "PROJECT=%~dp0TheLastHumanity.uproject"

echo ==================================================================
echo  THE LAST HUMANITY - Projekt kompilieren und Unreal Editor starten
echo ==================================================================
call "%~dp0Tools\ue_find_engine.bat" || goto :Ende
echo Unreal Engine gefunden: %UE_ROOT%
echo.
echo Kompiliere den C++-Code (beim ersten Mal einige Minuten) ...
call "%UE_ROOT%\Engine\Build\BatchFiles\Build.bat" TheLastHumanityEditor Win64 Development -Project="%PROJECT%" -WaitMutex -FromMsBuild
if errorlevel 1 goto :BuildFehler

echo.
echo Starte den Editor. Dort auf "Play" klicken (Menue im Editor mit P statt Esc).
start "" "%UE_ROOT%\Engine\Binaries\Win64\UnrealEditor.exe" "%PROJECT%"
goto :Ende

:BuildFehler
echo.
echo [FEHLER] Das Kompilieren ist fehlgeschlagen.
echo  - Ist Visual Studio 2022 mit "Spieleentwicklung mit C++" installiert?
echo  - Bitte die Fehlermeldungen oben kopieren (oder Datei
echo    "%LOCALAPPDATA%\UnrealBuildTool\Log.txt") und an die Entwicklung schicken.

:Ende
echo.
pause
