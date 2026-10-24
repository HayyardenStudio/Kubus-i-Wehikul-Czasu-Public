# DirPlayer: parser W3D i archiwalny emulator

Strona korzysta teraz wyłącznie z [wersji na three.js](../../strona/gra/).
Pliki emulatora, Ruffle i przeglądarkowy poziom `.dcr` zostały usunięte ze strony,
a `strona/graj/index.html` przekierowuje do `strona/gra/`.

Łatka [`dirplayer-kubus.patch`](dirplayer-kubus.patch) pozostaje potrzebna:
[`tools/zbuduj_port.sh`](../zbuduj_port.sh) nakłada ją na parser W3D przy budowaniu
[eksportera zasobów](../w3d_eksport/README.md). DirPlayer nie jest uruchamiany w przeglądarce.

Poniżej znajduje się archiwalny opis emulatora. Skrypt `zbuduj_dirplayer.sh` służy
wyłącznie do odtworzenia dawnej wersji; nie jest częścią budowania strony.

## Dawna wersja przeglądarkowa

Strona `strona/graj/` uruchamiała poziom 1 w przeglądarce. Odtwarzaczem był
[DirPlayer](https://github.com/igorlira/dirplayer-rs), emulator Shockwave napisany w Rust/WebAssembly.
Elementy Flash w grze (menu pod `Esc`, ekran końca poziomu) obsługuje
[Ruffle](https://github.com/chameleonxxl/ruffle/tree/dirplayer-integration) w wersji, której używa DirPlayer.

Gotowe pliki znajdowały się w `strona/graj/dirplayer/`:

| Plik | Skąd | Licencja |
|---|---|---|
| `dirplayer-polyfill.js` | DirPlayer `68376fb` (0.8.1) z łatką [`dirplayer-kubus.patch`](dirplayer-kubus.patch) | GPL-3.0 (`LICENSE-dirplayer.txt`) |
| `ruffle/` | Ruffle `79d1ca0` (gałąź `dirplayer-integration`) | MIT / Apache-2.0 |

## Łatka `dirplayer-kubus.patch`

Dwie zmiany:

**Szkielety modeli 3D** (`vm-rust/src/director/chunks/w3d/parser.rs`). Bez tej poprawki DirPlayer
kończy się błędem (`index out of bounds` w `skeleton.rs`) przy wczytywaniu modeli 3D z gry.
Kości w szkieletach zrobionych w 3ds Max (Character Studio) mają ograniczenia obrotu stawów. Dla każdej osi, w której ograniczenie jest jednocześnie „aktywne” (bity
`0x2/0x4/0x8` atrybutów kości) i „limitowane” (`0x10/0x20/0x40`), po atrybutach zapisana jest
para liczb min/max. DirPlayer jej nie pomijał, więc od pierwszej takiej kości czytał resztę
szkieletu przesuniętą. Reguła pasuje do wszystkich kości ze wszystkich 11 poziomów.

**Dopasowanie obrazu do ramki** (`src/views/Stage/index.tsx`, `polyfill/src/standalone.tsx`).
Atrybut `data-fit-stage` na tagu `<script>` polyfilla skaluje obraz 640×480 do rozmiaru ramki
na stronie (i do pełnego ekranu). Bez tego DirPlayer pokazuje grę w skali 1:1. Skalowanie
w CSS (`transform`) rozjechałoby kliknięcia myszą, bo DirPlayer przelicza je według własnej skali.

## Budowanie

```sh
tools/dirplayer/zbuduj_dirplayer.sh            # wynik trafia do strona/graj/dirplayer/
```

Wymaga Node.js 22, Rusta z celem `wasm32-unknown-unknown` i `wasm-pack`. Skrypt sam pobiera
źródła w przypiętych wersjach, nakłada łatkę i optymalizuje WASM (`wasm-opt` z pakietu npm `binaryen`).
Pełne budowanie trwa około pół godziny.

Plik poziomu `strona/graj/01_droga_do_zamku.dcr` to wariant przeglądarkowy z patchera:

```sh
python tools/kubus_dcr_patch.py "<folder z oryginalnymi .dcr>" <katalog> --fps 30 --web
```

Różni się od `pelna_wersja/01_droga_do_zamku.dcr` tylko tym, że „Gram dalej”, „Zakończ” i „Tak”
nie wczytują następnego pliku ani nie zamykają gry. Zamiast tego wołają funkcję strony
`kubusWyjscie()`, bo w przeglądarce jest tylko ten jeden poziom.

## Stan dawnego emulatora

Poziom 1 działa: grafika 3D, napisy, sterowanie, menu `Esc`. Poziomy 2, 6, 10 i 11 też się
uruchamiają, ale nie były sprawdzane dokładniej. Na poziomach 3, 4, 5, 7, 8 i 9 obraz zostaje czarny:
logika gry działa, ale renderer WebGL DirPlayera nic nie rysuje. Przyczyna nie jest jeszcze znana.
