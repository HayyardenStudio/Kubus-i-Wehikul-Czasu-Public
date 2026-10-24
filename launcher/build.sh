#!/bin/sh
# Buduje launcher Kubus.exe (32-bit, bez zależności) kompilatorem MinGW-w64.
#   Ubuntu/Debian: sudo apt install gcc-mingw-w64-i686
# Użycie: launcher/build.sh [plik_wyjściowy] [wersja]
# Domyślnie: pelna_wersja/Kubus.exe, wersja z pliku WERSJA w katalogu głównym.
set -eu
cd "$(dirname "$0")"
OUT=${1:-../pelna_wersja/Kubus.exe}
VER=${2:-$(cat ../WERSJA)}
CROSS=${CROSS:-i686-w64-mingw32-}

# "1.2" -> "1,2,0,0" dla VERSIONINFO
NUM=$(echo "$VER" | awk -F. '{printf "%d,%d,%d,0", $1, $2, $3}')

${CROSS}windres -DWERSJA_NUM="$NUM" -DWERSJA_STR="\\\"$VER\\\"" kubus.rc -O coff -o kubus_res.o
${CROSS}gcc -std=c99 -O2 -Wall -Wextra -Wno-missing-field-initializers -municode -mwindows -s \
    -DWERSJA="L\"$VER\"" -DUNICODE -D_UNICODE -D_WIN32_WINNT=0x0601 \
    kubus_launcher.c kubus_res.o -o "$OUT" \
    -lcomctl32 -lshell32 -lole32 -loleaut32 -luuid -lgdi32 -luser32 \
    -static-libgcc
rm -f kubus_res.o
echo "Zbudowano: $OUT ($VER)"
