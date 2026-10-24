# Kubuś i Wehikuł Czasu – informacje dla twórców

## Struktura repozytorium

| Ścieżka | Zawartość |
|---|---|
| `pelna_wersja/` | Poprawione poziomy `.dcr`, odtwarzacz SPR, `Kubus.exe` (launcher) i `Graj.cmd` |
| `poprawka/` | Poprawiony `Kuba.exe` z płyty CD (wersja demo, 1 poziom) |
| `launcher/` | Kod launchera (C, Win32) i jego grafiki |
| `installer/` | Skrypt instalatora NSIS i jego grafiki |
| `tools/kubus_dcr_patch.py` | Patcher poziomów pełnej wersji (Python 3, bez zależności) |
| `tools/kubus_patch.py` | Patcher `Kuba.exe` z płyty |
| `tools/zbuduj_wydanie.sh` | Buduje ZIP i instalator do `dist/` |
| `strona/` | Strona gry na GitHub Pages (`tools/zbuduj_strone.sh`) |
| `strona/gra/` | Wszystkie 11 poziomów w przeglądarce na three.js, z wyeksportowanymi zasobami gry |
| `strona/graj/` | Przekierowanie ze starego adresu do `strona/gra/` |
| `tools/w3d_eksport/` | Eksporter scen W3D używany przez `tools/zbuduj_port.sh` |
| `tools/dirplayer/` | Łatka parsera W3D potrzebna eksporterowi oraz archiwalne narzędzia emulatora |
| `docs/` | Instrukcja dla graczy (`README.txt`), opis wydania, zrzuty ekranu, ten plik |
| `Kubus3D/` | Oryginalna instalacja z płyty CD (niezmieniona) |
| `kubus-i-wehiku-czasu-…/` | Oryginalne archiwum z Internet Archive: niezmienione poziomy, instalator Shockwave 12.3, warianty SPR, zdjęcia płyty |

## Porównanie z oryginałem

Porównanie kamery i mgły z oryginałem, z parami kadrów i pomiarami:
[`porownanie_kamery.md`](porownanie_kamery.md). Raport opisuje izolowane próby;
nie wprowadza zmian w ustawieniach wcześniejszych poziomów.

## Budowanie

Wszystko buduje się na Linuksie (albo w WSL):

```sh
sudo apt install gcc-mingw-w64-i686 nsis zip

launcher/build.sh              # tylko launcher -> pelna_wersja/Kubus.exe
tools/zbuduj_wydanie.sh        # launcher + dist/*.zip + dist/*-instalator.exe
tools/zbuduj_wydanie.sh 1.1    # to samo z inną wersją (domyślnie z pliku WERSJA)
```

Poziomy i `Kuba.exe` generuje się z oryginałów patcherami:

```sh
python tools/kubus_dcr_patch.py "<folder z oryginalnymi .dcr>" pelna_wersja --fps 30
python tools/kubus_patch.py Kubus3D/Kuba.exe poprawka/Kuba.exe --fps 30
```

## Nowe wydanie na GitHubie

Workflow [`.github/workflows/wydanie.yml`](../.github/workflows/wydanie.yml) buduje paczki na
GitHub Actions:

```sh
echo 1.1 > WERSJA            # opcjonalnie, numer i tak bierze się z tagu
git tag v1.1                 # albo bez "v": git tag 1.1
git push origin v1.1
```

Po kilku minutach w zakładce **Releases** pojawi się szkic wydania (draft) z instalatorem i ZIP-em.
Wystarczy go przejrzeć i kliknąć **Publish**. Ręczne uruchomienie (Actions → Wydanie → Run workflow)
na gałęzi wrzuca pliki tylko do artefaktów, a uruchomione na tagu (pole „Use workflow from” →
Tags) tworzy też szkic wydania.

Archiwów **Source code (zip / tar.gz)** nie da się usunąć z wydania – GitHub dodaje je zawsze.
Pliki techniczne (`.gitignore`, `.gitattributes`, `.github`) są z nich wyłączone w `.gitattributes`.
