# Kubuś i Wehikuł Czasu – poprawka dla współczesnego Windowsa

`Kuba.exe` w tym folderze to poprawiona wersja `Kubus3D/Kuba.exe` (wersja z płyty,
poziom „Droga do zamku”).

## Instalacja

1. W folderze z zainstalowaną grą (np. `J:\Old games\Kubus i wehikul czasu\Kubus3D`)
   zmień nazwę oryginalnego `Kuba.exe` na `Kuba_oryginal.exe`.
2. Skopiuj tam ten `Kuba.exe`.
3. **Wyłącz tryb zgodności** (Właściwości → Zgodność) dla `Kuba.exe` i `menu.exe`,
   w tym opcje „Tryb ograniczonych kolorów” i „Uruchom w rozdzielczości 640x480”.
   Poprawiona wersja ich nie potrzebuje.
4. Uruchamiaj grę jak dawniej (`menu.exe` → „Graj”) albo bezpośrednio `Kuba.exe`.

## Co zostało zmienione

| Problem | Przyczyna | Poprawka |
|---|---|---|
| Główny monitor przełączał się na 640×480, a gra lądowała na drugim ekranie | W filmie był element *StarSoft DisplayMode Xtra*, który przy starcie przełączał główny monitor w 640×480 przez DirectDraw (w trybie wyłączności) | Ten element jest wyłączony, więc rozdzielczość nie jest już zmieniana |
| Kubuś biega i obraca się kilka razy za szybko | Gra przesuwa postać o stałą wartość **na klatkę** (10 jednostek, obrót o 5°), a tempo filmu to 78 kl./s. Dawne komputery go nie osiągały, współczesne tak | Tempo jest ustawione na stałe 30 kl./s |
| Obraz 640×480 był malutki | – | Scena jest powiększana do największego prostokąta 4:3 na monitorze, na którym jest gra. Grafika 3D renderuje się w pełnej rozdzielczości, a mysz działa poprawnie |
| Przy skoku na wyższą platformę Kubuś „wybijał się drugi raz” | Błąd oryginalnej gry: w trakcie skoku wysokość to „podłoże pod postacią + łuk skoku”, więc nad wyższą platformą cały łuk przeskakiwał na nowe podłoże | Łuk jest liczony od wysokości, z której Kubuś się wybił, a na platformie ląduje, gdy łuk zejdzie do jej poziomu. Na płaskim terenie i przy zeskoku w dół skok działa jak w oryginale |

### Regulacja szybkości w trakcie gry

* `+` (albo `=`, albo `+` na klawiaturze numerycznej) przyspiesza grę o 5 kl./s,
* `-` (albo `-` na klawiaturze numerycznej) zwalnia ją o 5 kl./s.

Zakres to 10–80 kl./s. Przy każdym uruchomieniu gra startuje od 30.

Pozostałe klawisze się nie zmieniły: strzałki służą do chodzenia, spacja do skoku,
a `Esc` otwiera ekran wyjścia.

## Własny wariant (opcjonalnie)

Patcher `tools/kubus_patch.py` wymaga tylko Pythona 3 i nie zmienia oryginalnego pliku:

```
python tools/kubus_patch.py Kubus3D/Kuba.exe Kuba_moj.exe --fps 25 --scale integer
```

* `--fps N` ustawia tempo startowe (10–80). `0` zostawia oryginalne tempo i wyłącza klawisze +/-.
* `--scale fit` (domyślnie) dopasowuje obraz 4:3 do ekranu.
* `--scale integer` powiększa obraz tylko o całkowitą wielokrotność (np. 1280×960).
* `--scale none` wyłącza powiększanie.
* `--bez-poprawki-skoku` zostawia oryginalny skok.

## Jak to było sprawdzane

Gra działa pod Wine na wirtualnym ekranie (1920×1080, 1280×1024 i 3840×2160):
* nie ma wywołania zmiany trybu ekranu,
* tempo trzyma 30 kl./s (oryginał chodził ~45 przy renderowaniu programowym),
* klawisze +/- zmieniają tempo,
* strzałki, `Esc` i przyciski „Tak”/„Nie” działają.

Poprawka skoku była sprawdzana tylko na płaskim terenie (skok w miejscu i w biegu działa
jak w oryginale). Lądowania na platformie nie dało się odtworzyć w teście, więc daj znać,
czy problem zniknął.

Pełna wersja (11 poziomów) jest w folderze `pelna_wersja` – patrz tamtejsze `README.md`.
