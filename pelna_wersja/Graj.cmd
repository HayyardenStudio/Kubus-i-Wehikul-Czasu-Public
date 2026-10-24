@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"
title Kubuś i Wehikuł Czasu - pełna wersja

rem ---------------------------------------------------------------------------
rem  Uruchamia poprawione poziomy (*.dcr) w odtwarzaczu Flashpoint SPR
rem  (Shockwave Projector Redirector) z Adobe Shockwave Player 12.
rem    Graj.cmd          - menu wyboru poziomu, pełny ekran
rem    Graj.cmd okno     - to samo, ale w oknie 640x480
rem    Graj.cmd 5        - od razu poziom 5 (można łączyć: Graj.cmd 5 okno)
rem ---------------------------------------------------------------------------

set "PLAYER=SPRS.exe"
set "NR="
for %%A in (%*) do (
    if /i "%%~A"=="okno" (set "PLAYER=SPR.exe") else set "NR=%%~A"
)

call :check_shockwave
if errorlevel 1 goto :end

if defined NR goto :run

:menu
cls
echo.
echo   KUBUŚ I WEHIKUŁ CZASU - pełna wersja (11 poziomów)
echo   ================================================
echo.
echo     1  Droga do zamku               7  Komnata szoguna
echo     2  Duży dziedziniec             8  Hol świątyni
echo     3  Mały dziedziniec             9  Trzy próby
echo     4  Zamek króla Artura          10  Hol laboratorium
echo     5  Dziedziniec pałacu szoguna  11  Pokój badań
echo     6  Pałac szoguna
echo.
echo   Sterowanie: strzałki - ruch, spacja - skok, Esc - menu wyjścia,
echo   + / - (także na klawiaturze numerycznej) - szybkość gry.
echo   Po ukończeniu poziomu "Gram dalej" od razu wczytuje następny.
echo.
set "NR=1"
set /p "NR=  Od którego poziomu zacząć? [1]: "

:run
set "FILE="
set "N=0"
set /a "N=NR" 2>nul
if %N% LSS 1 goto :wrong_number
if %N% GTR 11 goto :wrong_number
set "NN=0%N%"
set "NN=%NN:~-2%"
for %%F in (%NN%_*.dcr) do set "FILE=%%~nxF"
if not defined FILE goto :no_file
echo.
echo   Uruchamiam: %FILE%   (wyjście: Esc ^> Tak, albo Alt+F4)
start "" /wait "%PLAYER%" "%FILE%"
goto :end

:wrong_number
echo.
echo   Podaj numer poziomu od 1 do 11.
timeout /t 2 >nul
goto :menu

:no_file
echo.
echo   Nie znaleziono pliku poziomu %NN%_*.dcr w folderze "%~dp0".
goto :pause_end

rem ---------------------------------------------------------------------------
:check_shockwave
call :has_shockwave
if not errorlevel 1 exit /b 0
echo.
echo   Do pełnej wersji potrzebny jest Adobe Shockwave Player 12
echo   (zawiera wtyczki Shockwave 3D i Flash, których używają poziomy).
set "MSI="
if exist "%~dp0sw_lic_full_installer.msi" set "MSI=%~dp0sw_lic_full_installer.msi"
set "ARCHIVE=%~dp0..\kubus-i-wehiku-czasu-pl-pelna-wersja-demo-winnie-and-the-time-machine-full-version-demo.w\Kubus - Wehiku Czasu Pełna Wersja"
if not defined MSI if exist "%ARCHIVE%\sw_lic_full_installer.msi" set "MSI=%ARCHIVE%\sw_lic_full_installer.msi"
if defined MSI goto :install_shockwave
echo.
echo   Nie znalazłem instalatora sw_lic_full_installer.msi.
echo   Skopiuj go do tego folderu albo zainstaluj Shockwave 12 ręcznie
echo   i uruchom Graj.cmd ponownie.
goto :pause_fail

:install_shockwave
echo.
choice /c TN /m "  Zainstalować teraz z dołączonego pliku sw_lic_full_installer.msi"
if errorlevel 2 goto :pause_fail
msiexec /i "%MSI%"
call :has_shockwave
if not errorlevel 1 exit /b 0
echo.
echo   Shockwave 12 nadal nie jest zainstalowany.
:pause_fail
pause
exit /b 1

:has_shockwave
if exist "%SystemRoot%\SysWOW64\Adobe\Shockwave 12\dirapi.dll" exit /b 0
if exist "%SystemRoot%\System32\Adobe\Shockwave 12\dirapi.dll" exit /b 0
exit /b 1

:pause_end
pause
:end
endlocal
