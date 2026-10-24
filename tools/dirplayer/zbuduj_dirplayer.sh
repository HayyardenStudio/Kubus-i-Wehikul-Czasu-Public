#!/bin/sh
# Buduje odtwarzacz do wersji przeglądarkowej (strona/graj/dirplayer):
#   - DirPlayer (emulator Shockwave, GPL-3.0) z łatką dirplayer-kubus.patch,
#   - Ruffle (emulator Flasha, MIT/Apache-2.0) w wersji, której używa DirPlayer.
#
# Wymaga: git, Node.js 22, Rust (rustup) z celem wasm32-unknown-unknown, wasm-pack.
# Użycie: tools/dirplayer/zbuduj_dirplayer.sh [katalog roboczy, domyślnie /tmp/dirplayer-build]
set -eu

DIRPLAYER_COMMIT=68376fbb4494a6bbad4c70081ecdcb99814a74c9   # igorlira/dirplayer-rs, 0.8.1
RUFFLE_COMMIT=79d1ca0f45d79e28c3a0658bbc6b8430d26ef308      # chameleonxxl/ruffle, submoduł DirPlayera
BINARYEN_VERSION=123
WASM_OPT_FEATURES="--enable-bulk-memory --enable-reference-types --enable-nontrapping-float-to-int --enable-sign-ext --enable-mutable-globals --enable-multivalue --enable-simd"

repo="$(cd "$(dirname "$0")/../.." && pwd)"
praca="${1:-/tmp/dirplayer-build}"
cel="$repo/strona/graj/dirplayer"
mkdir -p "$praca"
cd "$praca"

# wasm-opt z npm (wasm-pack nie zawsze potrafi pobrać binaryen z GitHuba)
if [ ! -x binaryen/node_modules/.bin/wasm-opt ]; then
  mkdir -p binaryen
  (cd binaryen && npm init -y >/dev/null && npm install --no-audit --no-fund "binaryen@$BINARYEN_VERSION")
fi
wasm_opt="$praca/binaryen/node_modules/.bin/wasm-opt"

pobierz() {  # pobierz URL KATALOG COMMIT
  if [ ! -d "$2/.git" ]; then
    git init -q "$2"
    git -C "$2" remote add origin "$1"
  fi
  git -C "$2" fetch -q --depth 1 origin "$3"
  git -C "$2" checkout -q --force FETCH_HEAD
  git -C "$2" clean -qfdx -e node_modules -e target
}

pobierz https://github.com/igorlira/dirplayer-rs.git dirplayer-rs "$DIRPLAYER_COMMIT"
pobierz https://github.com/chameleonxxl/ruffle.git dirplayer-rs/ruffle "$RUFFLE_COMMIT"
git -C dirplayer-rs apply "$repo/tools/dirplayer/dirplayer-kubus.patch"

# DirPlayer: VM w Rust -> WASM, potem polyfill (jeden plik .js z wbudowanym WASM)
(cd dirplayer-rs/vm-rust && wasm-pack build --target web --no-opt)
"$wasm_opt" -O4 $WASM_OPT_FEATURES dirplayer-rs/vm-rust/pkg/vm_rust_bg.wasm -o dirplayer-rs/vm-rust/pkg/vm_rust_bg.wasm
(cd dirplayer-rs && npm ci --no-audit --no-fund && npx vite build -c vite.config.polyfill.js)

# Ruffle (wasm-bindgen w tej samej wersji, którą zainstalował wasm-pack)
wasm_bindgen_dir="$(dirname "$(find "$HOME/.cache/.wasm-pack" -name wasm-bindgen -type f | head -1)")"
(cd dirplayer-rs/ruffle/web && PATH="$wasm_bindgen_dir:$PATH" npm ci --no-audit --no-fund \
  && PATH="$wasm_bindgen_dir:$PATH" npm run build --workspace=ruffle-core \
  && npm run build --workspace=ruffle-selfhosted)

rm -rf "$cel"
mkdir -p "$cel/ruffle"
cp dirplayer-rs/dist-polyfill/dirplayer-polyfill.js "$cel/"
cp dirplayer-rs/LICENSE "$cel/LICENSE-dirplayer.txt"
r=dirplayer-rs/ruffle/web/packages/selfhosted/dist
cp "$r"/dirplayer_ruffle.js "$cel/ruffle/"
for w in "$r"/*.wasm; do
  "$wasm_opt" -O $WASM_OPT_FEATURES "$w" -o "$cel/ruffle/$(basename "$w")"
done
cp "$r"/LICENSE_MIT "$cel/ruffle/LICENSE_MIT.txt"
cp "$r"/LICENSE_APACHE "$cel/ruffle/LICENSE_APACHE.txt"
echo "Gotowe: $cel"
ls -la "$cel" "$cel/ruffle"
