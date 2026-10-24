#!/bin/sh
# Buduje dane nowej wersji przeglądarkowej (strona/gra/dane/NN) z plików poziomów w pelna_wersja/.
#   - bitmapy, dźwięki i lista obsady: tools/kubus_zasoby.py,
#   - sceny 3D: tools/w3d_eksport (Rust, parser W3D z DirPlayera z łatką dirplayer-kubus.patch).
#
# Wymaga: git, Python 3 z Pillow, Rust (cargo).
# Użycie: tools/zbuduj_port.sh [poziom ...] [--praca KATALOG]
#   poziom to nazwa pliku bez .dcr, domyślnie 01_droga_do_zamku
set -eu

DIRPLAYER_COMMIT=68376fbb4494a6bbad4c70081ecdcb99814a74c9   # ten sam co w tools/dirplayer/zbuduj_dirplayer.sh

repo="$(cd "$(dirname "$0")/.." && pwd)"
praca=/tmp/kubus-port-build
poziomy=""
while [ $# -gt 0 ]; do
  case "$1" in
    --praca) praca="$2"; shift 2 ;;
    *) poziomy="$poziomy $1"; shift ;;
  esac
done
[ -n "$poziomy" ] || poziomy=01_droga_do_zamku
mkdir -p "$praca"

# DirPlayer w przypiętej wersji, z łatką (bez niej parser wywraca się na szkieletach postaci)
d="$praca/dirplayer-rs"
if [ ! -d "$d/.git" ]; then
  git init -q "$d"
  git -C "$d" remote add origin https://github.com/igorlira/dirplayer-rs.git
fi
if [ "$(git -C "$d" rev-parse HEAD 2>/dev/null)" != "$DIRPLAYER_COMMIT" ]; then
  git -C "$d" fetch -q --depth 1 origin "$DIRPLAYER_COMMIT"
  git -C "$d" checkout -q --force FETCH_HEAD
fi
git -C "$d" checkout -q -- .
git -C "$d" apply "$repo/tools/dirplayer/dirplayer-kubus.patch"
ln -sfn "$d" "$repo/tools/w3d_eksport/dirplayer-rs"
# ostrzeżenia z kodu DirPlayera nic tu nie mówią
RUSTFLAGS="${RUSTFLAGS:--Awarnings}" CARGO_TARGET_DIR="$praca/target" cargo build --release --quiet --manifest-path "$repo/tools/w3d_eksport/Cargo.toml"
eksport="$praca/target/release/w3d_eksport"

for poziom in $poziomy; do
  nr="$(echo "$poziom" | cut -c1-2)"
  zasoby="$praca/zasoby/$nr"
  cel="$repo/strona/gra/dane/$nr"
  rm -rf "$zasoby" "$cel"
  python3 "$repo/tools/kubus_zasoby.py" "$repo/pelna_wersja/$poziom.dcr" "$zasoby"
  mkdir -p "$cel/modele"
  for w in "$zasoby"/w3d/*.w3d; do
    "$eksport" "$w" "$cel/modele/$(basename "$w" .w3d)"
  done
  cp -r "$zasoby/bitmapy" "$zasoby/dzwieki" "$cel/"
  if [ "$nr" = 11 ]; then
    python3 "$repo/tools/eksport_zakonczenia.py" "$zasoby/flash/e_kolejnyetap.swf" "$cel/zakonczenie.svg"
  fi
  # lista obsady dla gry: sceny 3D wskazują na wynik eksportu, Flasha port nie używa
  python3 - "$zasoby/obsada.json" "$cel/obsada.json" <<'EOF'
import json, sys
obsada = json.load(open(sys.argv[1], encoding="utf-8"))
for m in obsada:
    if m["typ"] == "shockwave3d" and "plik" in m:
        m["plik"] = "modele/" + m["nazwa"]
    if m["typ"] == "flash":
        m.pop("plik", None)
json.dump(obsada, open(sys.argv[2], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
EOF
  echo "Gotowe: $cel ($(du -sh "$cel" | cut -f1))"
done
