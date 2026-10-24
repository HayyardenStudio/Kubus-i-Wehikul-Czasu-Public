#!/bin/sh
# Składa stronę na GitHub Pages w katalogu podanym jako argument (domyślnie _site).
# Treść strony leży w strona/, obrazki są brane z miejsc, w których już są w repozytorium.
set -eu
cd "$(dirname "$0")/.."
cel="${1:-_site}"
rm -rf "$cel"
mkdir -p "$cel/zrzuty"
cp strona/index.html strona/styl.css strona/logo.jpg "$cel/"
cp -r strona/graj "$cel/graj"
cp -r strona/gra "$cel/gra"
cp docs/zrzuty/*.jpg docs/zrzuty/*.png "$cel/zrzuty/"
cp launcher/res/kubus.ico "$cel/favicon.ico"
touch "$cel/.nojekyll"
echo "Strona gotowa w $cel"
