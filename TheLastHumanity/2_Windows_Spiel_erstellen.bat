@echo off
setlocal
title THE LAST HUMANITY - Windows-Version erstellen
cd /d "%~dp0"
set "PROJECT=%~dp0TheLastHumanity.uproject"
set "OUT=%~dp0Build\Windows"

echo ==================================================================
echo  THE LAST HUMANITY - spielbare Windows-Version (.exe) erstellen
echo  Dauer beim ersten Mal: ca. 15 bis 60 Minuten.
echo ==================================================================
call "%~dp0Tools\ue_find_engine.bat" || goto :Ende
echo Unreal Engine gefunden: %UE_ROOT%
echo.

echo [1/2] Kompiliere Editor-Modul (wird zum Kochen der Inhalte benoetigt) ...
call "%UE_ROOT%\Engine\Build\BatchFiles\Build.bat" TheLastHumanityEditor Win64 Development -Project="%PROJECT%" -WaitMutex -FromMsBuild
if errorlevel 1 goto :BuildFehler

echo.
echo [2/2] Baue, koche und verpacke das Spiel ...
call "%UE_ROOT%\Engine\Build\BatchFiles\RunUAT.bat" BuildCookRun -project="%PROJECT%" -platform=Win64 -clientconfig=Development -build -cook -stage -pak -archive -archivedirectory="%OUT%" -noP4 -utf8output
if errorlevel 1 goto :BuildFehler

set "EXE=%OUT%\Windows\TheLastHumanity.exe"
if not exist "%EXE%" set "EXE=%OUT%\WindowsNoEditor\TheLastHumanity.exe"
if exist "%EXE%" goto :Gefunden
echo [WARNUNG] Erstellung gemeldet, aber TheLastHumanity.exe nicht gefunden. Ordner: "%OUT%"
start "" explorer "%OUT%"
goto :Ende

:Gefunden

echo.
echo ==================================================================
echo  FERTIG!  Das Spiel liegt hier:
echo  %EXE%
echo  Den ganzen Ordner kannst du auf jeden Windows-PC kopieren.
echo ==================================================================
choice /c JN /m "Spiel jetzt starten"
if errorlevel 2 goto :Ordner
start "" "%EXE%"
goto :Ende
:Ordner
start "" explorer /select,"%EXE%"
goto :Ende

:BuildFehler
echo.
echo [FEHLER] Die Erstellung ist fehlgeschlagen.
echo  - Ist Visual Studio 2022 mit "Spieleentwicklung mit C++" installiert?
echo  - Protokolle: "%APPDATA%\Unreal Engine\AutomationTool\Logs"
echo  - Bitte die Fehlermeldungen oben kopieren und an die Entwicklung schicken.

:Ende
echo.
pause
