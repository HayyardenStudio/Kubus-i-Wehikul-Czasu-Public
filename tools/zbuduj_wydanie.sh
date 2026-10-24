#!/bin/sh
# Buduje paczki do udostępnienia:
#   dist/Kubus-i-Wehikul-Czasu-<wersja>.zip            - wersja przenośna (rozpakuj i graj)
#   dist/Kubus-i-Wehikul-Czasu-<wersja>-instalator.exe - instalator Windows (NSIS)
#
# Wymaga: gcc-mingw-w64-i686, nsis, zip  (Ubuntu/Debian: sudo apt install gcc-mingw-w64-i686 nsis zip)
# Użycie: tools/zbuduj_wydanie.sh [wersja]   (domyślnie z pliku WERSJA)
set -eu
ROOT=$(cd "$(dirname "$0")/.." && pwd)
VER=${1:-$(cat "$ROOT/WERSJA")}
DIST="$ROOT/dist"
NAME="Kubus i Wehikul Czasu"
STAGE="$DIST/$NAME"
ARCHIWUM="$ROOT/kubus-i-wehiku-czasu-pl-pelna-wersja-demo-winnie-and-the-time-machine-full-version-demo.w/Kubus - Wehiku Czasu Pełna Wersja"
BASE="Kubus-i-Wehikul-Czasu-$VER"

rm -rf "$STAGE" "$DIST/$BASE.zip" "$DIST/$BASE-instalator.exe"
mkdir -p "$STAGE/dane" "$STAGE/demo"

# 1. Launcher
"$ROOT/launcher/build.sh" "$STAGE/Kubus.exe" "$VER"

# 2. Pliki gry
cd "$ROOT/pelna_wersja"
cp ./*.dcr SPR.exe SPRS.exe msvcr100.dll port.txt proxy.txt SPR_LICENSE.txt Graj.cmd "$STAGE/dane/"
cp "$ARCHIWUM/sw_lic_full_installer.msi" "$STAGE/dane/"
cp "$ROOT/poprawka/Kuba.exe" "$STAGE/demo/"
# instrukcja dla Notatnika: UTF-8 z BOM i końce linii CRLF
printf '\357\273\277' > "$STAGE/README.txt"
sed 's/$/\r/' "$ROOT/docs/README.txt" >> "$STAGE/README.txt"

# 3. ZIP
cd "$DIST"
zip -q -r -9 -X "$BASE.zip" "$NAME"

# 4. Instalator
NUM=$(echo "$VER" | awk -F. '{printf "%d.%d.%d.0", $1, $2, $3}')
makensis -V2 -DWERSJA="$VER" -DWERSJA_NUM="$NUM" -DSRC="$STAGE" -DOUT="$DIST/$BASE-instalator.exe" \
    "$ROOT/installer/kubus.nsi"

echo
ls -lh "$DIST/$BASE.zip" "$DIST/$BASE-instalator.exe"
