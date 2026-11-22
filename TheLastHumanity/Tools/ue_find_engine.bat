@echo off
rem ------------------------------------------------------------------
rem  Sucht eine installierte Unreal Engine 5 (5.4 bis 5.7).
rem  Ergebnis: Variable UE_ROOT (und UE_VERSION). Exitcode 1 = nicht gefunden.
rem  Eigene Installation erzwingen:  set UE_ROOT=D:\Pfad\zu\UE_5.5
rem ------------------------------------------------------------------
if not defined UE_ROOT goto :Suchen
if exist "%UE_ROOT%\Engine\Build\BatchFiles\RunUAT.bat" exit /b 0
echo [WARNUNG] UE_ROOT ist gesetzt, enthaelt aber keine Unreal Engine: "%UE_ROOT%"
set "UE_ROOT="
:Suchen
for %%V in (5.7 5.6 5.5 5.4) do (
    for /f "tokens=2,*" %%A in ('reg query "HKLM\SOFTWARE\EpicGames\Unreal Engine\%%V" /v InstalledDirectory 2^>nul ^| find "InstalledDirectory"') do (
        if exist "%%B\Engine\Build\BatchFiles\RunUAT.bat" (
            set "UE_ROOT=%%B"
            set "UE_VERSION=%%V"
            exit /b 0
        )
    )
    if exist "C:\Program Files\Epic Games\UE_%%V\Engine\Build\BatchFiles\RunUAT.bat" (
        set "UE_ROOT=C:\Program Files\Epic Games\UE_%%V"
        set "UE_VERSION=%%V"
        exit /b 0
    )
)
echo.
echo [FEHLER] Keine Unreal Engine 5.4 bis 5.7 gefunden.
echo   1. Epic Games Launcher installieren: https://store.epicgames.com/download
echo   2. Im Launcher: Unreal Engine ^> Bibliothek ^> Engine-Version 5.4 oder neuer installieren.
echo   3. Dieses Skript erneut starten.
echo   (Bei abweichendem Installationsort vorher: set UE_ROOT=D:\Pfad\zu\UE_5.x)
exit /b 1
