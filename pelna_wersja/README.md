# Kubuś i Wehikuł Czasu – pełna wersja (11 poziomów)

To są poziomy dawnej gry z kubus.pl, poprawione tak, żeby dało się w nie grać offline
na współczesnym Windowsie. Odtwarza je *Flashpoint Shockwave Projector Redirector*
(SPR, licencja MIT – `SPR_LICENSE.txt`) z **Adobe Shockwave Player 12**.

## Uruchamianie

Najprościej: uruchom **`Kubus.exe`** (launcher z listą poziomów, podglądem i ustawieniami).
Sam sprawdzi, czy jest Shockwave Player 12, i w razie potrzeby go zainstaluje. Gotowy
instalator i wersja ZIP są w wydaniach projektu – patrz `README.md` w katalogu głównym.

Zapasowo działa też skrypt `Graj.cmd`:

1. Skopiuj cały folder `pelna_wersja` na dysk.
2. Uruchom **`Graj.cmd`**.
   * Przy pierwszym uruchomieniu skrypt sprawdzi, czy masz Shockwave Player 12.
     Jeśli nie, zaproponuje instalację z `sw_lic_full_installer.msi`. Szuka go w tym
     folderze albo w oryginalnym folderze pełnej wersji z repozytorium. Możesz też
     sam skopiować ten plik obok `Graj.cmd`.
3. Wybierz poziom (1–11). Gra startuje na pełnym ekranie.

Inne sposoby uruchamiania:

* `Graj.cmd okno` – gra w oknie 640×480,
* `Graj.cmd 5` – od razu poziom 5 (można łączyć: `Graj.cmd 5 okno`).

Sterowanie:

* strzałki – ruch,
* spacja – skok,
* `Esc` – ekran wyjścia (Tak/Nie),
* `+` / `-` (także na klawiaturze numerycznej) – szybkość gry.

Tempo startuje od wartości ustawionej w launcherze (domyślnie 30 kl./s), a zmienione
klawiszami przechodzi na kolejne poziomy.

Gra i launcher wymieniają dane przez pliki ustawień Shockwave (`setPref`/`getPref`).
Odtwarzacz trzyma je w `%USERPROFILE%\AppData\LocalLow\Adobe\Director 12\SPR\Prefs`
(dla `SPRS.exe` w folderze `SPRS`):

* `KubusTempo.txt` – tempo startowe. Zapisuje je launcher przed startem gry, a gra po każdej
  zmianie klawiszami `+`/`-`. Bez tego pliku gra startuje z tempem wbudowanym w poziomy (30).
* `KubusPostep.txt` – najwyższy odblokowany poziom (12 = cała gra ukończona). Zapisuje go gra
  po ukończeniu poziomu: „Gram dalej” albo „Zakończ” na ekranie końca poziomu. Wartość tylko
  rośnie, więc ponowne przejście wcześniejszego poziomu jej nie cofa.
Awaryjnie grę zamyka `Alt+F4`.

## Co zostało poprawione w plikach poziomów

| Problem | Przyczyna | Poprawka |
|---|---|---|
| Wszystko działa kilka razy za szybko | Ruch postaci jest liczony na klatkę, a poziomy mają tempo 150–200 kl./s | Stałe tempo 30 kl./s i regulacja klawiszami +/- |
| Po ukończeniu poziomu „Gram dalej” nic nie robił, a „Zakończ” próbował otworzyć stronę | Przyciski wołały `gotoNetPage("zapisz_graj.php?nr=N")`, czyli stronę kubus.pl, która już nie istnieje | „Gram dalej” wczytuje następny poziom. „Zakończ” i „Tak” na ekranie `Esc` zamykają grę |
| Postęp zapisywał serwer kubus.pl | Ta sama strona dostawała liczbę ukończonych poziomów (`nr=N`) | Ukończenie poziomu jest zapisywane przez `setPref` w pliku `KubusPostep.txt` (najwyższy odblokowany poziom), który czyta launcher |
| Malutki obraz | – | `SPRS.exe` rozciąga obraz 4:3 na cały główny ekran (to wbudowana funkcja SPR) |
| Poziom 1: przy mieczu Ekskalibur zostawał napis „Oto Twoja nagroda – czar siły!”, a miecza nie dało się wziąć, mimo 50 dukatów | Napis pojawiał się w odległości 250 od czarodzieja, a zaklęcie ruszało dopiero przy 150. Czar siły (`have_power`) był zapisywany tylko wtedy, gdy Kubuś stał przy czarodzieju w chwili, gdy animacja zaklęcia przekroczyła 5,5 s. Jeśli to się nie udało, czaru nie dało się już zdobyć | Zaklęcie rusza w tej samej odległości co napis, a czar jest nadawany 5,5 s po zaklęciu, mierzone zegarem, bez względu na to, gdzie stoi Kubuś |

Pliki poziomów zostały wygenerowane z oryginałów (z folderu z archiwum) poleceniem:

```
python tools/kubus_dcr_patch.py "<folder z oryginalnymi .dcr>" pelna_wersja --fps 30
```

W `SPR` zmieniłem tylko jedno: `proxy.txt` = `0`. Oryginalnie SPR ładuje gry przez
serwer proxy Flashpointa (port 22500), którego tu nie ma, więc kończyło się to czarnym
ekranem. Użyty jest wariant SPR z folderu `PJ12`, przeznaczony do Shockwave 12.
`SPR.exe` z głównego folderu pełnej wersji wymaga Shockwave 11 i dlatego pokazywał
czarny ekran.

## Jeśli coś nie działa

* **Czarny ekran albo brak 3D na kartach NVIDIA** – SPR ma przełącznik
  `--bugfixShockwave3DBadDriverList` (poprawka listy „złych sterowników” Shockwave 3D).
  W launcherze to opcja „Obejście Shockwave 3D”. W `Graj.cmd` dopisz go
  w linii `start "" /wait "%PLAYER%" "%FILE%"` na końcu.
  Pod Wine ten przełącznik dawał czarny ekran, dlatego nie jest włączony domyślnie.
* **Problemy z grafiką 3D na Windows 10/11** – drugi przełącznik SPR, `--noDirectX7`,
  przestawia Shockwave 3D z DirectX 7 na DirectX 9 albo OpenGL. W launcherze to opcja
  „DirectX 9 / OpenGL zamiast DirectX 7”, w `Graj.cmd` dopisuje się go w tym samym miejscu.

## Jak to było sprawdzane

Pod Wine z zainstalowanym Shockwave 12.3 (z dołączonego `.msi`):
* każdy z 11 poprawionych poziomów uruchamia się na pełnym ekranie,
* `Graj.cmd` poprawnie obsługuje menu, numer poziomu, tryb `okno` i błędny numer,
* tempo trzyma wartość wbudowaną w pliki,
* `+` i `-` zmieniają tempo, a zmiana przechodzi na kolejny poziom,
* „Gram dalej” wczytuje następny poziom (sprawdzone 1 → 2),
* „Zakończ” i „Tak” zamykają grę.

Na prawdziwym Windowsie całość nie była jeszcze testowana.
