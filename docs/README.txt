KUBUŚ I WEHIKUŁ CZASU – edycja fanowska
========================================

Polska przygodowa gra 3D z Kubusiem. Kubuś podróżuje wehikułem czasu
przez 11 poziomów w czterech światach: Zamek króla Artura, Kraina
samurajów, Świątynia słońca i Miasto przyszłości.

To wydanie zbiera całą grę w jednym miejscu i poprawia ją tak, żeby
działała na Windowsie 10 i 11.


JAK ZACZĄĆ
----------

1. Uruchom Kubus.exe (albo skrót „Kubuś i Wehikuł Czasu”).
2. Jeśli launcher pokaże „Brak Adobe Shockwave Player 12”, kliknij
   „Zainstaluj Shockwave 12” i przejdź przez instalator. Wystarczy
   raz. (Instalator gry robi to sam, jeśli zaznaczysz tę opcję.)
3. Wybierz poziom i kliknij „Graj!”.

Po ukończeniu poziomu przycisk „Gram dalej” od razu wczytuje następny.
Gra zapamiętuje ukończone poziomy, a launcher pokazuje tylko te, do
których już dotarłeś – żeby nie zdradzać, co będzie dalej. Zaznacz
„Pokaż wszystkie”, jeśli chcesz zobaczyć (i wybrać) każdy poziom.


STEROWANIE
----------

  Strzałki ............ ruch
  Spacja .............. skok
  + / -  .............. szybsza / wolniejsza gra (co 5 kl./s, od 10 do 80)
  Esc ................. ekran wyjścia (Tak / Nie)
  Alt+F4 .............. awaryjne zamknięcie

Gra startuje z szybkością ustawioną w launcherze (domyślnie 30 klatek
na sekundę). Zmienione klawiszami + / - tempo przechodzi na kolejne
poziomy, a launcher je zapamiętuje.


USTAWIENIA W LAUNCHERZE
-----------------------

* Pełny ekran (lub okno 640×480) – obraz 4:3 rozciągnięty na cały
  główny monitor. Bez zaznaczenia gra działa w oknie.
* DirectX 9 / OpenGL zamiast DirectX 7 – zaznacz, jeśli obraz 3D jest
  zepsuty, migocze albo brakuje modeli.
* Obejście Shockwave 3D – zaznacz, jeśli zamiast gry widać czarny ekran
  (zdarza się na kartach NVIDIA).
* Szybkość gry – tempo w klatkach na sekundę (10–80, strzałki co 5).

Ustawienia launchera są zapisywane w
%APPDATA%\Kubus i Wehikul Czasu\ustawienia.ini, a postęp i szybkość gry
w %USERPROFILE%\AppData\LocalLow\Adobe\Director 12\SPR (i SPRS)\Prefs.


WERSJA Z PŁYTY
--------------

Przycisk „Wersja z płyty (demo, 1 poziom)” uruchamia poprawioną wersję
z płyty CD (poziom „Droga do zamku”). Nie potrzebuje Shockwave Playera,
więc przydaje się, gdy pełna wersja nie chce ruszyć.


GDY COŚ NIE DZIAŁA
------------------

* Czarny ekran – zaznacz w launcherze „Obejście Shockwave 3D”, a jeśli
  to nie pomoże, także „DirectX 9 / OpenGL zamiast DirectX 7”.
* Gra działa za szybko lub za wolno – zmień „Szybkość gry” w launcherze
  albo użyj klawiszy + i - w trakcie gry.
* Windows ostrzega przed nieznanym programem (SmartScreen) – pliki nie są
  podpisane cyfrowo. Kliknij „Więcej informacji” → „Uruchom mimo to”.
* Nie włączaj trybu zgodności dla Kubus.exe ani plików gry – nie jest
  potrzebny.
* W folderze dane jest też Graj.cmd – zapasowy sposób uruchamiania bez
  launchera (menu w oknie konsoli).


CO ZOSTAŁO POPRAWIONE
---------------------

* Stałe tempo gry. Ruch postaci jest liczony na klatkę, a poziomy miały
  tempo 150–200 kl./s, więc na nowym komputerze wszystko pędziło.
* Przejścia między poziomami i zapis postępów. „Gram dalej” i „Zakończ”
  odwoływały się do nieistniejącej już strony kubus.pl.
* Obraz powiększony na cały ekran zamiast malutkiego okna 640×480.
* Poziom 1: czarodziej zawsze daje czar siły, więc da się wziąć miecz
  Ekskalibur (w oryginale czasem się to blokowało).
* Wersja z płyty: nie zmienia już rozdzielczości monitora, ma stałe
  tempo, a skok na wyższą platformę nie „wybija się” drugi raz.


INFORMACJA
----------

To nieoficjalne, niekomercyjne wydanie fanowskie. Prawa do gry, postaci
i znaków należą do ich właścicieli (na okładce: © MGD Sp. z o.o., projekt
i wykonanie VERUM.COM). Projekt nie jest z nimi związany. Wydanie jest
darmowe – nie wolno go sprzedawać.

Dołączone programy innych autorów:
* Flashpoint Shockwave Projector Redirector (SPR), Anthony Kleine –
  licencja MIT (dane\SPR_LICENSE.txt),
* Adobe Shockwave Player 12.3 – oficjalny, niezmieniony instalator Adobe.

Strona projektu, kod źródłowy i zgłaszanie błędów:
https://github.com/Hayyarden/Kubus-i-Wehikul-Czasu-Edycja-fanowska
