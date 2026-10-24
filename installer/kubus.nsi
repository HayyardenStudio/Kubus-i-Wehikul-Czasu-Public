; Instalator "Kubuś i Wehikuł Czasu" - edycja fanowska.
; Budowany przez tools/zbuduj_wydanie.sh (NSIS 3, makensis), np.:
;   makensis -DWERSJA=1.0 -DSRC="dist/Kubus i Wehikul Czasu" -DOUT=dist/instalator.exe installer/kubus.nsi
; SRC to przygotowany folder gry: Kubus.exe, README.txt, dane\, demo\.

Unicode true
SetCompressor /SOLID lzma

!include MUI2.nsh
!include LogicLib.nsh
!include FileFunc.nsh

!ifndef WERSJA
  !define WERSJA "dev"
!endif
!ifndef SRC
  !error "Podaj -DSRC=<folder z przygotowanymi plikami gry>"
!endif
!ifndef WERSJA_NUM
  !define WERSJA_NUM "0.0.0.0"
!endif
!ifndef OUT
  !define OUT "Kubus-i-Wehikul-Czasu-${WERSJA}-instalator.exe"
!endif

!define NAZWA "Kubuś i Wehikuł Czasu"
!define KLUCZ_ODINSTALUJ "Software\Microsoft\Windows\CurrentVersion\Uninstall\KubusIWehikulCzasu"
!define KLUCZ_GRY "Software\Kubus i Wehikul Czasu"
!define REPO "https://github.com/Hayyarden/Kubus-i-Wehikul-Czasu-Edycja-fanowska"
!define MSI "sw_lic_full_installer.msi"

Name "${NAZWA}"
Caption "${NAZWA} – instalacja"
OutFile "${OUT}"
; Ścieżka bez polskich znaków - dawne programy Directora nie zawsze sobie z nimi radzą.
InstallDir "$PROGRAMFILES32\Kubus i Wehikul Czasu"
InstallDirRegKey HKLM "${KLUCZ_GRY}" "Folder"
RequestExecutionLevel admin
BrandingText "${NAZWA} – edycja fanowska ${WERSJA}"
ShowInstDetails show
ShowUninstDetails show

VIProductVersion "${WERSJA_NUM}"
VIAddVersionKey /LANG=1045 "ProductName" "Kubus i Wehikul Czasu (edycja fanowska)"
VIAddVersionKey /LANG=1045 "FileDescription" "Instalator gry Kubus i Wehikul Czasu"
VIAddVersionKey /LANG=1045 "FileVersion" "${WERSJA}"
VIAddVersionKey /LANG=1045 "ProductVersion" "${WERSJA}"
VIAddVersionKey /LANG=1045 "Comments" "${REPO}"
VIAddVersionKey /LANG=1045 "LegalCopyright" "Gra: MGD Sp. z o.o. / VERUM.COM. Edycja fanowska, niekomercyjna."

; --------------------------------------------------------------------------
; Wygląd
; --------------------------------------------------------------------------
!define MUI_ICON "..\launcher\res\kubus.ico"
!define MUI_UNICON "..\launcher\res\kubus.ico"
!define MUI_WELCOMEFINISHPAGE_BITMAP "welcome.bmp"
!define MUI_UNWELCOMEFINISHPAGE_BITMAP "welcome.bmp"
!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_RIGHT
!define MUI_HEADERIMAGE_BITMAP "header.bmp"
!define MUI_HEADERIMAGE_UNBITMAP "header.bmp"
!define MUI_ABORTWARNING
!define MUI_COMPONENTSPAGE_SMALLDESC

!define MUI_WELCOMEPAGE_TITLE "${NAZWA}$\r$\nedycja fanowska ${WERSJA}"
!define MUI_WELCOMEPAGE_TEXT "Ten program zainstaluje pełną wersję gry (11 poziomów) poprawioną tak, żeby działała na Windowsie 10 i 11:$\r$\n$\r$\n  • stałe tempo gry i regulacja klawiszami + / −$\r$\n  • obraz powiększony na cały ekran$\r$\n  • działające przechodzenie między poziomami$\r$\n  • poprawki błędów z oryginału$\r$\n$\r$\nDo gry potrzebny jest Adobe Shockwave Player 12 – instalator może go od razu doinstalować.$\r$\n$\r$\nKliknij Dalej, aby kontynuować."
!insertmacro MUI_PAGE_WELCOME
!define MUI_PAGE_HEADER_TEXT "Informacja o wydaniu"
!define MUI_PAGE_HEADER_SUBTEXT "Przeczytaj przed instalacją."
!define MUI_LICENSEPAGE_TEXT_TOP "Przeczytaj, czym jest to wydanie."
!define MUI_LICENSEPAGE_BUTTON "&Rozumiem"
!define MUI_LICENSEPAGE_TEXT_BOTTOM "To nieoficjalne, niekomercyjne wydanie fanowskie. Kliknij Rozumiem, aby kontynuować."
!insertmacro MUI_PAGE_LICENSE "informacja.txt"
!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_RUN
!define MUI_FINISHPAGE_RUN_TEXT "Uruchom grę"
!define MUI_FINISHPAGE_RUN_FUNCTION UruchomGre
!define MUI_FINISHPAGE_SHOWREADME "$INSTDIR\README.txt"
!define MUI_FINISHPAGE_SHOWREADME_TEXT "Pokaż instrukcję"
!define MUI_FINISHPAGE_SHOWREADME_NOTCHECKED
!define MUI_FINISHPAGE_LINK "Strona projektu na GitHubie"
!define MUI_FINISHPAGE_LINK_LOCATION "${REPO}"
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "Polish"

; --------------------------------------------------------------------------
; Shockwave 12: 32-bitowy instalator widzi SysWOW64 jako $SYSDIR
; --------------------------------------------------------------------------
!macro JestShockwave wynik
  StrCpy ${wynik} 0
  ${If} ${FileExists} "$SYSDIR\Adobe\Shockwave 12\dirapi.dll"
    StrCpy ${wynik} 1
  ${EndIf}
!macroend

; --------------------------------------------------------------------------
; Sekcje
; --------------------------------------------------------------------------
Section "Gra – pełna wersja (11 poziomów)" SecGra
  SectionIn RO
  SetOutPath "$INSTDIR"
  File "${SRC}\Kubus.exe"
  File "${SRC}\README.txt"
  Delete "$INSTDIR\CZYTAJ_MNIE.txt"   ; nazwa z wersji 1.0
  SetOutPath "$INSTDIR\dane"
  File /r "${SRC}\dane\*.*"

  SetOutPath "$INSTDIR"
  WriteUninstaller "$INSTDIR\Odinstaluj.exe"

  SetShellVarContext all
  CreateDirectory "$SMPROGRAMS\${NAZWA}"
  CreateShortcut "$SMPROGRAMS\${NAZWA}\${NAZWA}.lnk" "$INSTDIR\Kubus.exe" "" "$INSTDIR\Kubus.exe" 0
  CreateShortcut "$SMPROGRAMS\${NAZWA}\Instrukcja.lnk" "$INSTDIR\README.txt"
  CreateShortcut "$SMPROGRAMS\${NAZWA}\Odinstaluj.lnk" "$INSTDIR\Odinstaluj.exe"

  WriteRegStr HKLM "${KLUCZ_GRY}" "Folder" "$INSTDIR"
  WriteRegStr HKLM "${KLUCZ_ODINSTALUJ}" "DisplayName" "${NAZWA} (edycja fanowska)"
  WriteRegStr HKLM "${KLUCZ_ODINSTALUJ}" "DisplayVersion" "${WERSJA}"
  WriteRegStr HKLM "${KLUCZ_ODINSTALUJ}" "DisplayIcon" "$INSTDIR\Kubus.exe"
  WriteRegStr HKLM "${KLUCZ_ODINSTALUJ}" "Publisher" "Edycja fanowska (oryginał: MGD / VERUM.COM)"
  WriteRegStr HKLM "${KLUCZ_ODINSTALUJ}" "URLInfoAbout" "${REPO}"
  WriteRegStr HKLM "${KLUCZ_ODINSTALUJ}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKLM "${KLUCZ_ODINSTALUJ}" "UninstallString" '"$INSTDIR\Odinstaluj.exe"'
  WriteRegStr HKLM "${KLUCZ_ODINSTALUJ}" "QuietUninstallString" '"$INSTDIR\Odinstaluj.exe" /S'
  WriteRegDWORD HKLM "${KLUCZ_ODINSTALUJ}" "NoModify" 1
  WriteRegDWORD HKLM "${KLUCZ_ODINSTALUJ}" "NoRepair" 1
SectionEnd

Section "Adobe Shockwave Player 12.3" SecShockwave
  !insertmacro JestShockwave $0
  ${If} $0 == 1
    DetailPrint "Adobe Shockwave Player 12 jest już zainstalowany."
    Return
  ${EndIf}
  DetailPrint "Instaluję Adobe Shockwave Player 12.3…"
  ExecWait '"$SYSDIR\msiexec.exe" /i "$INSTDIR\dane\${MSI}" /passive /norestart' $1
  !insertmacro JestShockwave $0
  ${If} $0 != 1
    MessageBox MB_ICONEXCLAMATION|MB_OK "Nie udało się zainstalować Adobe Shockwave Player 12 (kod $1).$\r$\n$\r$\nMożesz spróbować później przyciskiem „Zainstaluj Shockwave 12” w oknie gry."
  ${EndIf}
SectionEnd

Section "Wersja z płyty (demo, 1 poziom)" SecDemo
  SetOutPath "$INSTDIR\demo"
  File "${SRC}\demo\Kuba.exe"
SectionEnd

Section "Skrót na pulpicie" SecPulpit
  SetShellVarContext all
  CreateShortcut "$DESKTOP\${NAZWA}.lnk" "$INSTDIR\Kubus.exe" "" "$INSTDIR\Kubus.exe" 0
SectionEnd

Section "-Rozmiar"
  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  IntFmt $0 "0x%08X" $0
  WriteRegDWORD HKLM "${KLUCZ_ODINSTALUJ}" "EstimatedSize" "$0"
SectionEnd

!insertmacro MUI_FUNCTION_DESCRIPTION_BEGIN
  !insertmacro MUI_DESCRIPTION_TEXT ${SecGra} "Launcher, 11 poprawionych poziomów i odtwarzacz Flashpoint SPR."
  !insertmacro MUI_DESCRIPTION_TEXT ${SecShockwave} "Wymagany przez pełną wersję. Oficjalny instalator Adobe (wtyczki Shockwave 3D i Flash)."
  !insertmacro MUI_DESCRIPTION_TEXT ${SecDemo} "Poprawiona wersja z płyty CD: jeden poziom, działa bez Shockwave Playera."
  !insertmacro MUI_DESCRIPTION_TEXT ${SecPulpit} "Ikona gry na pulpicie."
!insertmacro MUI_FUNCTION_DESCRIPTION_END

Function .onInit
  !insertmacro JestShockwave $0
  ${If} $0 == 1
    SectionSetText ${SecShockwave} "Adobe Shockwave Player 12 (już zainstalowany)"
    SectionSetFlags ${SecShockwave} ${SF_RO}
  ${EndIf}
FunctionEnd

; Gra startuje bez uprawnień administratora (przez Eksploratora), żeby ustawienia
; trafiły do profilu zwykłego użytkownika.
Function UruchomGre
  Exec '"$WINDIR\explorer.exe" "$INSTDIR\Kubus.exe"'
FunctionEnd

; --------------------------------------------------------------------------
; Odinstalowanie (Shockwave Player zostaje - mogą go używać inne gry)
; --------------------------------------------------------------------------
Section "Uninstall"
  SetShellVarContext all
  Delete "$DESKTOP\${NAZWA}.lnk"
  RMDir /r "$SMPROGRAMS\${NAZWA}"

  Delete "$INSTDIR\Kubus.exe"
  Delete "$INSTDIR\README.txt"
  Delete "$INSTDIR\CZYTAJ_MNIE.txt"
  Delete "$INSTDIR\Odinstaluj.exe"
  RMDir /r "$INSTDIR\dane"
  RMDir /r "$INSTDIR\demo"
  RMDir "$INSTDIR"

  SetShellVarContext current
  RMDir /r "$APPDATA\Kubus i Wehikul Czasu"
  ; postęp i szybkość zapisane przez grę (pliki ustawień Shockwave)
  Delete "$PROFILE\AppData\LocalLow\Adobe\Director 12\SPR\Prefs\Kubus*.txt"
  Delete "$PROFILE\AppData\LocalLow\Adobe\Director 12\SPRS\Prefs\Kubus*.txt"

  DeleteRegKey HKLM "${KLUCZ_ODINSTALUJ}"
  DeleteRegKey HKLM "${KLUCZ_GRY}"
SectionEnd
