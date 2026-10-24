# Nowa wersja przeglądarkowa (three.js)

Strona [`strona/gra/`](../../strona/gra/) zawiera wszystkie 11 poziomów odtworzonych od nowa, bez emulatora Shockwave.
Modele, tekstury, animacje, bitmapy i dźwięki pochodzą z plików
`pelna_wersja/01_droga_do_zamku.dcr`, `02_duzy_dziedziniec.dcr`, `03_maly_dziedziniec.dcr`, `04_zamek_krola_artura.dcr`, `05_dziedziniec_palacu_szoguna.dcr`, `06_palac_szoguna.dcr`, `07_komnata_szoguna.dcr`, `08_hol_swiatyni.dcr`, `09_trzy_proby.dcr`, `10_hol_laboratorium.dcr` i `11_pokoj_badan.dcr`, a skrypty Lingo (zdekompilowane
[ProjectorRays](https://github.com/ProjectorRays/ProjectorRays)) są przepisane na JavaScript.

## Dlaczego nie emulator

W [DirPlayerze](../dirplayer/README.md) poziom się uruchamia, ale nie da się w niego grać. Przyczyny
widać w zdekompilowanych skryptach:

- **Kubuś odlatuje po kilku skokach.** Promień do podłoża jest wołany jako
  `modelsUnderRay(punkt, kierunek, #detailed)`, czyli z `#detailed` na miejscu liczby modeli. DirPlayer
  w tej formie zwraca same modele, bez pól `#model` i `#isectPosition`, z których skrypt czyta wysokość
  podłoża. Skok tylko dodaje wysokość, a opadanie zależy od znalezionego podłoża, więc każdy skok
  podnosi Kubusia wyżej.
- **Kubuś chodzi bokiem.** Postaci to bipedy z 3ds Max: siatka ma przód w -Y, a korzeń szkieletu
  (`Bip01`) jest obrócony o -90°. Shockwave liczy ruch korzenia względem jego pozy spoczynkowej, więc
  przód modelu wychodzi w +X (tak zakłada logika gry: `translate(10, 0, 0)`, kamera w `(-280, 0, 50)`).
  DirPlayer bierze obrót korzenia wprost.
- DirPlayer nie przenosi przesunięcia korzenia z animacji chodu na model, a od tego zależy
  podchodzenie przeciwników do Kubusia. Do tego 6 z 11 poziomów ma w nim czarny obraz.

## Jak to działa

| Plik | Co robi |
|---|---|
| [`tools/kubus_zasoby.py`](../kubus_zasoby.py) | wyciąga z `.dcr` bitmapy (PNG z kanałem alfa), dźwięki (MP3), sceny 3D (surowe W3D) i listę obsady |
| `tools/w3d_eksport/` | zamienia scenę W3D na `NAZWA.json` + `NAZWA.bin`: węzły, siatki, shadery, tekstury, szkielety i animacje. Parser to moduł W3D z DirPlayera |
| [`tools/zbuduj_port.sh`](../zbuduj_port.sh) | wszystko naraz: pobiera DirPlayera, buduje eksporter i zapisuje dane do `strona/gra/dane/NN/` |
| `strona/gra/js/w3d.js` | scena Shockwave 3D na three.js: grupy świata, `modelsUnderRay` (tylko ściany, w które promień wchodzi, także w modelach niewidocznych), `cloneModelFromCastmember`, `bonesPlayer`, `keyframePlayer`, oświetlenie jak w Directorze |
| `strona/gra/js/silnik.js` | pętla gry w tempie filmu (30 kl./s, klawisze `+`/`-`), `keyPressed` z kodami klawiszy Directora, kanały dźwięku, nakładki HUD, transformacje w stylu Lingo |
| `strona/gra/js/poziom01.js` | skrypty poziomu 1 przepisane jeden do jednego: Kubuś, gęsi, rycerze, czarodziej, tratwa, komunikaty, miecz i most |
| `strona/gra/js/postacie.js` | wspólne sterowanie Kubusiem, kamera, zbieranie dukatów i marchewek oraz zachowanie rycerzy |
| `strona/gra/js/poziom02.js` | Duży dziedziniec: kowal, naprawa dźwigni za 25 dukatów, dwie zębatki, mechanizm bramy, krata i jeźdźcy |
| `strona/gra/js/poziom03.js` | Mały dziedziniec: dzwon, cztery patrole małych rycerzy, sześciu czarnych rycerzy i drzwi zamku |
| `strona/gra/js/poziom05.js` | Dziedziniec pałacu szoguna: 50 kryształów, 21 przesuwanych drzwi, 6 samurajów, mistrz kung-fu w piwnicy, smok i brama pałacu |
| `strona/gra/js/poziom04.js` | Zamek króla Artura: 11 skrzyń, kielich, cztery duchy, rycerz, kraty, dźwignia, król, zapadnia i portal za kotarami |
| `strona/gra/js/poziom06.js` | Pałac szoguna: 30 drzwi, 11 skrzyń, sześć gejsz, łuk, kołczan i drzwi do komnaty szoguna |
| `strona/gra/js/poziom07.js` | Komnata szoguna: 20 strzał, ośmiu ninja, osiem drzwi, cztery wysuwane schody, szogun, szkatułka, Oko Smoka i portal |
| `strona/gra/js/poziom08.js` | Hol świątyni: 16 pochodni, kapłan, siedem węży na trasach, 16 pułapek strzelających i dwie pary drzwi |
| `strona/gra/js/poziom09.js` | Trzy próby: trzy kamienie i moce, pięć demonów, puma, książę, zwierciadło, królowa, Amulet Słońca i portal |
| `strona/gra/js/poziom10.js` | Hol laboratorium: 35 ogniw energetycznych, konsola, osiem automatycznych drzwi, trzy pająki i trzy raptory |
| `strona/gra/js/poziom11.js` | Pokój badań: trzy artefakty i schowki, komputer, wynalazca, dziesięć patroli i finał gry |

Dane w `strona/gra/dane/01/`–`11/` są w repozytorium, więc strona nie potrzebuje kroku budowania.
Po zmianie eksportera albo ekstraktora odtwarza się je poleceniem:

```sh
tools/zbuduj_port.sh                      # poziom 1
tools/zbuduj_port.sh 02_duzy_dziedziniec  # poziom 2
tools/zbuduj_port.sh 03_maly_dziedziniec  # poziom 3
tools/zbuduj_port.sh 04_zamek_krola_artura # poziom 4
tools/zbuduj_port.sh 05_dziedziniec_palacu_szoguna # poziom 5
tools/zbuduj_port.sh 06_palac_szoguna # poziom 6
tools/zbuduj_port.sh 07_komnata_szoguna # poziom 7
tools/zbuduj_port.sh 08_hol_swiatyni # poziom 8
tools/zbuduj_port.sh 09_trzy_proby # poziom 9
tools/zbuduj_port.sh 10_hol_laboratorium # poziom 10
tools/zbuduj_port.sh 11_pokoj_badan # poziom 11
```

Wymaga Pythona 3 z Pillow, Rusta (cargo) i gita. Eksporter korzysta z kodu DirPlayera (GPL-3.0),
więc sam też jest na tej licencji. three.js (`strona/gra/js/vendor/`, wersja 0.170.0) jest na licencji MIT.

## Odstępstwa od oryginału i poprawki parsera

- **Wagi kości** w siatkach CLOD to 14-bitowe ułamki (0–16383 = 0–1). DirPlayer mnożył je przez
  współczynnik kolorów (1/512), więc prawie każda waga wychodziła 1, a barki i kołnierze postaci
  sterczały w szpic. Poprawka jest w `tools/dirplayer/dirplayer-kubus.patch`.
- **Przezroczystość tekstur W3D:** eksporter skleja kontynuacje RGB i alfa. `w3d.js` odczytuje
  maskę zlib za obrazem JPEG i składa RGBA przed wysłaniem tekstury do GPU. Dzięki temu kwiaty
  w rabatkach i herby na drzwiach nie mają białych prostokątów; nie trzeba zmieniać assetów.
- **Położenie kwiatów przy domach:** macierze W3D ze skosem są zachowywane w całości,
  także przy przenoszeniu modeli do grup i klonowaniu. Rozkład na pozycję/obrót/skalę gubił
  skos i przesuwał niektóre kwiaty o kilkadziesiąt jednostek względem skrzynek pod oknami.
  Test na 201 modelach sceny: `node tools/test_transformacji.mjs`.
- **Oświetlenie materiałów:** kolor ambient jest stosowany w rozwiniętym fragmencie shadera
  three.js, emisja jest mnożona przez teksturę i dodawana tylko raz, przed ograniczeniem sumy.
  Usuwa to rozjaśnienie domów, gęsi i beczek. Materiały dwustronne zachowują tę samą poprawkę.
  Tekstura zastępująca całkowicie czarny materiał (oczy w budzie) jest wyświetlana bez oświetlenia.
- **Grubi rycerze:** pozycja bazowa Z=-103,5 zamiast -90 dopasowuje stopy do drogi (Z≈-126).
  W sprawdzonych klatkach chodu prześwit zmalał z około 13,5 do ±0,3 jednostki.
- **Pościg rycerzy:** obrót do celu jest poziomy, a przeniesienie ruchu korzenia zeruje Z także
  po obrocie modelu, więc kroki nie podnoszą postaci. Chód działa w pętli przerywanej atakiem,
  przeszkodą lub opuszczeniem strefy. Czas klipów zaczyna się od ich pierwszej klatki (oryginalny
  chód miał przesunięcie 0,27–0,30 s), a autoBlend korzysta z sekund zamiast liczby klatek obrazu.
  Test regresji na danych gry: `node tools/test_animacji.mjs` (bez dodatkowych zależności).
- **Animacje kości z pliku** (podskakująca marchewka, opuszczany most) Shockwave podpina sam;
  w porcie robi to `poziom01.js`.
- **Marchewki:** pierwsza poza jest stosowana od razu. Początek modelu jest ustawiony co najmniej
  12 jednostek ponad terenem, aby dolna faza animacji (około -9,6) nie zanurzała przedmiotu w ziemi.
  Zapisane punkty zbierania uwzględniają tę samą poprawkę.
- **Czarodziej:** podłoże jest mierzone we właściwym miejscu postaci, a wysokość modelu uwzględnia
  położenie stóp w animacjach stania i lotu. Zbliżenie gracza przerywa pętlę lotu i włącza stanie;
  zaklęcie i nadanie czaru siły działają jak wcześniej.
- **Most zwodzony w spoczynku:** przed zatrzymaniem odtwarzacza stosowana jest pierwsza klatka
  animacji, bez autoBlend. Poza wiązania siatki jest niższa i pozostawiona bez tej aktualizacji
  nie pasuje do otworu bramy. Zawias, transformacja modelu i dalsza animacja pozostają z danych W3D.
- **Tratwa** jest przebudowana pod grywalność: kolizja jedzie razem z widoczną tratwą (w oryginale
  obie dostają osobne `translate`), tratwa czeka chwilę przy brzegu i wyspie zamiast stawać przy
  Kubusiu, na pokład wchodzi się jak na stopień, a Kubuś stoi na jego powierzchni.
- **Pełny ekran:** obraz 3D, HUD i menu mieszczą się we wspólnym prostokącie 4:3 wyśrodkowanym
  na czarnym tle. Szerokie ekrany dostają pasy po bokach, a pionowe — na górze i na dole.

## Stan

Selektor jest nad oknem gry i domyślnie pokazuje tylko odblokowane etapy (na początku pierwszy).
Wygrana zapisuje numer następnego odblokowanego poziomu w `localStorage` pod kluczem
`kubus-postep`; restart i porażka nie zmieniają zapisu. Checkbox „Pokaż nieodblokowane poziomy”
pozwala odsłonić i uruchomić pozostałe etapy. Po wejściu na stronę checkbox jest wyłączony,
a bezpośredni adres zamkniętego poziomu wybiera pierwszy etap, dopóki gracz nie odsłoni listy.
Gdy zapis przeglądarki jest niedostępny lub nieprawidłowy, menu nadal działa z pierwszym poziomem.

Poziom 2 ma wybór na ekranie startowym i bezpośredni adres `gra/?poziom=2`; wygrana poziomu 1
udostępnia przycisk przejścia do poziomu 2. Ponowne uruchomienie przeładowuje stronę, dzięki czemu
nie pozostają pętle animacji ani kanały audio poprzedniej rozgrywki. Poziom 3 jest dostępny przez `gra/?poziom=3` i po ukończeniu poziomu 2.
Poziom 4 jest dostępny przez `gra/?poziom=4` i po ukończeniu poziomu 3.
Poziom 5 jest dostępny przez `gra/?poziom=5` i po ukończeniu poziomu 4.
Poziom 6 jest dostępny przez `gra/?poziom=6` i po ukończeniu poziomu 5.
Poziom 7 jest dostępny przez `gra/?poziom=7` i po ukończeniu poziomu 6.
Poziom 8 jest dostępny przez `gra/?poziom=8` i po ukończeniu poziomu 7.
Poziom 9 jest dostępny przez `gra/?poziom=9` i po ukończeniu poziomu 8.
Poziom 10 jest dostępny przez `gra/?poziom=10` i po ukończeniu poziomu 9.
Poziom 11 jest dostępny przez `gra/?poziom=11` i po ukończeniu poziomu 10.
Ukończenie finału zapisuje postęp `12`; selektor nadal pokazuje 11 etapów.

W Holu świątyni Ctrl zapala pochodnie z bliska, po zatrzymaniu Kubusia.
Każda z 16 pochodni nalicza się raz; ogień odtwarza 14 oryginalnych bitmap
i obraca się w stronę kamery. Po komplecie trzeba wrócić do kapłana, który
otwiera boczne drzwi pod posągiem. Podejście do końcowej bramy otwiera oba
skrzydła i pozwala ukończyć etap. Wygrana wymaga wykonania zadania, także
przy przeniesieniu postaci za zamknięte drzwi z konsoli.

Siedem węży chodzi po oryginalnych trasach z szybkością 2 jednostek na klatkę;
każdy ma własny stan patrolu zamiast wspólnej flagi `readyAnimate` z Lingo.
W pobliżu Kubusia wąż zatrzymuje się, obraca do niego i wybiera jeden z dwóch
ataków. Każdy z klipów ataku trwa około 0,5–0,53 s; pozostanie w zasięgu
pozwala na kolejne ciosy bez dodatkowej przerwy (trzy ciosy odbierają 15 energii).
Bryły kolizji węży zachowują oryginalny obrót i skalę W3D, a ich podstawa jest
10 jednostek pod znacznikiem. Zerowanie transformacji obracało bryły pod podłogę
i pozwalało przebiegać przez węże. Bieg na wprost zatrzymuje się na bryle;
ominięcie skokiem po skosie pozostaje możliwe. Szesnaście strzał porusza się po dwóch punktach z szybkością 15 jednostek
na klatkę; koniec trasy albo trafienie odsyła strzałę do wyrzutni. Cios lub
strzała odbiera 5 energii także podczas biegu. Korzeń węża jest 78 jednostek
nad znacznikiem zamiast 60 (siatka zapadała się w podłogę), kapłana 45,3 zamiast
60 (stopy spoczywają na widocznym schodzie, którego siatka jest około 6,7 jednostki
poniżej powierzchni kolizji); proxy stoją przy podłożu. Kamera ma FOV 60°,
odległość 180, wysokość 75 i cel +40, przy przeszkodzie wysokość 150 i cel +70.
Mgła pozostaje wykładnicza, z zasięgiem 4000 jak w Lingo.

`node tools/test_poziomu08.mjs` sprawdza ruch, skok, pauzę, tempo, całe trasy
węży, położenie siatek względem podłogi, blokadę biegu przez węża, skok bokiem,
serie trzech ciosów dla obu animacji ataku, powtarzane salwy strzał, obrażenia,
wszystkie pochodnie z podłogi, licznik, kapłana, kolizje zamkniętych drzwi,
oba boczne wejścia pod posąg, bieg przez bramę do wygranej i ostatnie życie.
W Chrome sprawdzono start, rendering, sterowanie, zadanie, restart, zapis
postępu i przejście 7 → 8 bez błędów HTTP/JS. Test zadań przenosi gracza
między interakcjami; pełne przejście od startu samą klawiaturą wymaga jeszcze
ręcznego sprawdzenia.

Komnata szoguna korzysta z trzech reflektorów W3D (`Fspot01`–`Fspot03`),
bez światła kierunkowego. Port odtwarza ich pozycje i kierunki, półkąt 89,75°,
stałe tłumienie oraz twardy brzeg stożka (SPOTDECAY wyłączone w oryginale).
Pominięcie reflektorów zostawiało czarne schody i ciemne wnętrze: te materiały
mają zerowy ambient. Tekstury pozostają oryginalne, w tym czerwone drewno schodów.
Animowany portal również korzysta z oświetlenia sali zamiast dodatkowej emisji.
Porównanie ze screenem oryginału ujawniło także zbyt odległą, wysoką kamerę i mgłę
wykładniczą zamiast liniowej. Poziom 7 ma FOV 60°, odległość 180 i wysokość 75
z celem 40 ponad podłożem; przy ścianie wysokość rośnie do 150. Cel przy ścianie
ograniczono do 70 zamiast 140 z Lingo, aby głowa i stopy pozostały w kadrze przy
wejściu. Liniowa mgła zaczyna się dopiero od 2700 i kończy na 3000 jednostek.
Pozostałe poziomy zachowują wcześniejsze ustawienia kamery i mgły.

W Komnacie szoguna trzeba zebrać 20 strzał. Komplet otwiera osiem drzwi,
wysuwa cztery pary schodów i usuwa kolizję wokół podestu. Ctrl pozwala otwierać
poszczególne drzwi wcześniej; osobna flaga schodów zapobiega blokadzie z Lingo.
Szogun przyjmuje łuk po 2,4 s animacji, dopiero po zebraniu wszystkich strzał.
Następnie Ctrl otwiera szkatułkę, a nagrodę można odebrać z bliska po zakończeniu
animacji wieka (około 1,33 s). Usuwa to błąd Lingo, które sprawdzało czas równy zero
i pozwalało zabrać Oko Smoka z zamkniętej szkatułki. Oko uruchamia animowany portal,
który kończy etap. Ośmiu ninja ściga Kubusia w promieniu 500 jednostek od znacznika
z szybkością 4 jednostek na klatkę; atak wybiera jedną z pięciu animacji.

`node tools/test_poziomu07.mjs` sprawdza na rzeczywistych danych W3D zbieranie każdej
strzały tylko raz, osiem drzwi, cztery wejścia po schodach, pościg ninja i ściany,
pięć ataków, obrażenia, wysokość siatek, przekazanie łuku, szkatułkę, HUD, portal,
wygraną i utratę ostatniego życia. W Chrome sprawdzono ruch, skok, pauzę,
całe zadanie, restart, zapis postępu i przejście 6 → 7 bez błędów HTTP/JS.
Test zadań przenosi gracza między interakcjami; pełne przejście samą klawiaturą
wymaga jeszcze ręcznego sprawdzenia. Korzeń ninja ma +42 zamiast +55 względem
znacznika, szoguna +54 zamiast +70, a proxy szoguna stoi na podeście.

W Pałacu szoguna Ctrl otwiera 30 przesuwanych drzwi i 11 skrzyń. Łuk i kołczan
trzeba odebrać z dwóch właściwych skrzyń po ponad 1,2 s animacji otwierania.
Można je zbierać w dowolnej kolejności; oba przedmioty pojawiają się w HUD,
a komplet otwiera drzwi do komnaty szoguna. Wyjście bez kompletu nie kończy etapu.
Sześć gejsz patroluje oryginalne trasy (6, 6, 6, 6, 8 i 6 punktów) z szybkością
4 jednostek na klatkę. Korzeń ustawiono 55 jednostek nad znacznikiem zamiast 65,
żeby dół siatki w chodzie i obu atakach pozostawał przy podłodze; proxy stoi
na podłożu. Drzwi można otworzyć pierwszym Ctrl, także przy zatrzymanej animacji
w czasie zero (warunek Lingo `currentTime <> 0` uniemożliwiał pierwsze użycie).

`node tools/test_poziomu06.mjs` i wariant `--odwrotnie` sprawdzają obie kolejności
zbierania przedmiotów, brak odbioru z daleka i przed zakończeniem animacji,
wszystkie skrzynie i drzwi, bieg przez sześć przejść w obu osiach, pełne patrole,
kierunek twarzy, wysokość siatki w chodzie i atakach, obrażenia, HUD, wygraną,
utratę ostatniego życia, ruch, skok, tempo i pauzę. Podgląd w przeglądarce
potwierdza start poziomu, rendering bez błędów, ruch i menu pauzy.
Pełne przejście od startu do wyjścia samą klawiaturą wymaga ręcznego sprawdzenia;
test zadań przenosi postać w pobliże interakcji.

Na Dziedzińcu pałacu szoguna trzeba zebrać 50 kryształów i podejść do smoka.
Smok bez kompletu kryształów atakuje, a po zebraniu wszystkich odtwarza lot i otwiera
oba skrzydła bramy. Ctrl otwiera 21 przesuwanych drzwi; pięć drzwi oznaczonych `off`
pozostaje zamkniętych. Sześciu samurajów i mistrz kung-fu patrolują oryginalne trasy
z szybkością 4 jednostek na klatkę. Mistrz kung-fu pozostaje w piwnicy pod dziedzińcem.
Wysokość korzeni samurajów (28,5) i kung-fu (42) dopasowano do stóp w animacjach;
kolizje stoją na podłożu. Przód siatek samurajów i kung-fu jest w -Y;
obrót i przesunięcie patrolu uwzględniają tę samą oś, również podczas ataku.
Smok odtwarza korzeń `Hips` w układzie modelu (`absoluteRoot`), dzięki czemu
rozmowa i animacja stania nie podnoszą go o 48 jednostek nad taras. Właściwy
lot po zebraniu kryształów zachowuje ruch ze źródłowej animacji.
Kamera ma odległość 180 jednostek, żeby przy starcie nie
wchodzić w bramę wejściową. Proxy przesuwanych drzwi kopiują pozycje skrzydeł jak
w Lingo — dwa proxy w pliku startują około 145 jednostek obok swoich drzwi.
Port pozwala otworzyć drzwi od pierwszego naciśnięcia Ctrl (Lingo wymagało czasu
animacji różnego od zera mimo zatrzymania jej na początku), a wygrana wymaga
wcześniejszej reakcji smoka, oprócz samego wejścia w punkt końca etapu.

`node tools/test_poziomu05.mjs` sprawdza ruch, skok, pauzę i tempo, wszystkie trasy,
położenie stóp w chodzie i ataku, zwrot głów zgodny z kierunkiem patrolu,
wysokość siatki smoka przy rozmowie, ataku i locie, 21 drzwi, przejścia przez sześć otworów w obu osiach,
kolizje, zbieranie każdego z 50 kryształów tylko raz, licznik, smoka, bramę, wygraną
i utratę ostatniego życia. W Chrome sprawdzono wczytywanie bez błędów HTTP/JS,
klawiaturę, Ctrl, zadania, ekran wygranej, zapis postępu, restart i przejście 4 → 5.
Przy sprawdzaniu zadań w przeglądarce przenoszono gracza z konsoli; pełne przejście
od startu do wyjścia samą klawiaturą wymaga jeszcze ręcznego sprawdzenia.

W Zamku króla Artura Ctrl otwiera skrzynie i uruchamia dźwignię kraty na około 5,4 s.
Trzy pozostałe ruchome kraty otwierają się po podejściu i wracają po oryginalnym cyklu;
ich kolizje zachowują początkowe przesunięcie względem siatek. Cztery duchy patrolują
trasy `w1_duch`–`w4_duch`, a gruby rycerz pilnuje parteru. Duchy mają pozycję bazową
podniesioną o 40 jednostek:
dół animowanej siatki podczas chodu sięga około 32,5 jednostki poniżej znacznika.
Poprawka zostawia około 10 jednostek prześwitu nad podłogą biblioteki i zapobiega
przebijaniu sufitu sali tronowej. Test sprawdza granice siatki podczas patroli,
ataku i przejścia z powrotem do chodu oraz wysokość brył kolizji.
Właściwa skrzynia daje kielich
po ponad 1,5 s otwierania. Król bez kielicha uruchamia zapadnię; po jego przyniesieniu
odsuwa kotary po 3,7 s animacji. Portal kończy grę dopiero po tej reakcji króla
(dodatkowy warunek względem Lingo, które sprawdza tylko odległość od wyjścia).
Mechanizmy używają ruchu kości względem pozy wiązania bez przenoszenia go na model.
Lustro wyświetla w pętli trzy oryginalne bitmapy. Dźwignia odtwarza fragmenty
0–650 ms i 700–1330 ms; odliczanie obejmuje tylko aktywną grę.

`node tools/test_poziomu04.mjs` sprawdza na danych W3D ruch, skok, schody na oba piętra,
puste i właściwą skrzynię, ponowne otwieranie krat, trzy cykle dźwigni, kolizje krat,
pełne patrole duchów, zapadnię, przekazanie kielicha, kotary, wygraną i utratę życia.
W Chrome sprawdzono wczytanie wszystkich zasobów, ruch i skok klawiaturą, pauzę,
otwarcie właściwej skrzyni przez Ctrl, reakcję króla, animację portalu, wygraną,
restart oraz przejście z poziomu 3. W teście przeglądarkowym pozycje przy zadaniach
ustawiano z konsoli; pełne przejście od wejścia do portalu samą klawiaturą
wymaga jeszcze ręcznego sprawdzenia.

Na Małym dziedzińcu Ctrl uruchamia dzwon i otwiera drzwi. Czterej mali rycerze przechodzą
oryginalne trasy `w1`–`w4`; dzwon milknie przy ósmym punkcie, a ponowne uruchomienie jest
możliwe po zakończeniu wszystkich patroli. Mali rycerze odbierają 5 energii za cios.
Cios czarnego rycerza po 0,5 s animacji odbiera życie i odsyła na start; resetuje także
rycerzy, dzwon oraz drzwi. Rozpoczęty cios trafia po 500 ms także po oddaleniu ponad 150 jednostek, jak w Lingo.
Drzwi odtwarzają oryginalną animację węzła i kończą etap po ponad sekundzie, jeśli gracz
pozostaje obok nich. Nie ma dukatów ani wymogu zebrania monet.
Flagi używają `bonesPlayer.absoluteRoot`, a dzwon ruchu względem pozy wiązania
z wyłączonym `extractRootMotion`. Absolutny korzeń dzwonu unosił go około 125 jednostek
nad belki. Test poziomu porównuje górę jego siatki z belką poprzeczną podczas 120 klatek
kołysania i sprawdza, że model nie odpływa od mocowania.
`node tools/test_ruchu03.mjs` sprawdza sześć przerw w murach w obu kierunkach oraz ciągłe
trasy z trzema skokami po obu stronach zamku. Łuk zachowuje wysokość wybicia nad przerwą,
nie zatrzymuje biegu przed dalszą platformą i sprawdza lądowanie w całym pionowym kroku.
Kamera śledzi wysokość wybicia zamiast gruntu pod przerwą. Wyższe podłoże podtrzymuje
krótkie skoki z beczek na daszek zgodnie z Lingo. Osobny pełny łuk wybicia z dachów koszar
ma wysokość 130 jednostek i trwa 34 klatki logiki; eliminuje jednoczesne znoszenie
wznoszenia przez opadanie. Pozwala to przejść z północno-wschodniego daszku na wschodni
chodnik, za przerwą 185–240 jednostek i około 100 jednostek wyżej. Profil jest wybierany
przez podparcie `kolizja_koszary_podloze_mur`; skoki z ziemi, beczek i chodnika muru
zachowują dotychczasowy przebieg. Nie zmienia się sterowanie poziomami 1–2.
Test przechodzi sekwencję ziemia → dolne beczki → górna beczka → daszek, sprawdza trzy
wysokości krawędzi daszku i 15 miejsc wybicia z NE daszku na wschodnią galerię. Sprawdza
lądowanie po odczekaniu i wznowienie biegu po chodniku, a także brak skrótu z ziemi.
Test mierzy też chód czarnego
rycerza względem przesunięcia z W3D (około 396 jednostek w 2 s), ciągłość kolejnych cykli,
dokończenie kroku po oddaleniu gracza oraz przejście z chodu prosto do ciosu. Przekroczenie
400 jednostek albo opuszczenie strefy 800 nie przerywa rozpoczętego kroku; następna decyzja
zapada na granicy cyklu, bez powtarzanego restartowania animacji. Strażnicy startują na
dolnym dziedzińcu, także tam, gdzie nad ich znacznikiem biegnie chodnik muru.

`node tools/test_poziomu03.mjs` sprawdza rzeczywiste modele: ruch i skok, zasięg Ctrl, pełne
trasy patroli i ich ponowienie, marchewki, cios małego rycerza, resety po ciosie czarnego,
otwieranie drzwi, wygraną i utratę ostatniego życia. Start i wygląd poziomu sprawdzono
w przeglądarce; pełne przejście klawiaturą od startu do wyjścia wymaga ręcznego sprawdzenia.

Test `node tools/test_poziomu02.mjs` korzysta z rzeczywistych modeli: sprawdza start i przejście pod
kratą, zbieranie 25 dukatów i części, wymagania montażu, Ctrl u kowala, naprawę po odejściu od
kowala, otwarcie wyjścia, wygraną i obrażenia od jeźdźców. Trafienie odejmuje 5 punktów energii
także podczas biegu, najwyżej raz na szarżę, bez teleportacji. Bezczynny koń nie zadaje obrażeń.
Szarżę poprzedza 0,3 s przygotowania, następnie jeździec biegnie po prostej przez 1,6 s,
bez korygowania kierunku za graczem. Po trafieniu albo przeszkodzie odpoczywa przez sekundę;
po chybionej szarży przez 0,6 s. Obrażenia wymagają co najmniej 0,2 s widocznej animacji galopu.
Bezczynny koń, przerwa i bliski kontakt przepuszczają gracza, zachowując kolizje z budynkami. Życie jest
odejmowane dopiero po wyczerpaniu energii; utrata ostatniego życia kończy grę.
Kontroluje także dopasowanie drzwi do progu oraz ułożenie obu łańcuchów przy kołach na słupach
w każdej klatce zamykania i otwierania, w tym trzy powtórzone cykle bez przesunięcia mocowań.
Ruch sprawdzany jest na obu pochylniach kolizji schodów: wysokość przy wejściu nie może opadać,
a przy zejściu podskakiwać. Podparcie jest próbkowane w miejscu następnego kroku (10 jednostek),
bez ponownego ściągania postaci do poprzedniego punktu. Pochyła powierzchnia schodów nie blokuje
biegu jak pionowa ściana. Test sprawdza także skok i lądowanie oraz trzy kolejne szarże jeźdźca:
po zatrzymaniu przed budynkiem jeździec najpierw obraca się ku nowemu celowi, następnie bada
przeszkody. Animacja bezczynności ma zablokowany korzeń, więc nie przesuwa konnego w bok.
Testy obejmują także brak skrętu po uniku, bezpieczny kontakt w przerwie, wyjście spod ściany
bez skoku oraz zachowanie kolizji z samą ścianą. Kamera śledzi podłoże na wysokości 130 jednostek
(170 przy przeszkodzie), celuje 50 jednostek nad stopami i wraca za gracza po odsunięciu od muru.
W Chrome sprawdzone są start obu poziomów, bieg, skok, pauza, przejście z wygranej poziomu 1
do poziomu 2 oraz restart poziomu 2. W teście ekranów końca stan ukończenia był wymuszany;
pełne przejście poziomu 2 od startu do wyjścia bez pomocy konsoli wymaga jeszcze ręcznego sprawdzenia.
Tylko siatka kraty poziomu 2 korzysta z `bonesPlayer.absoluteRoot`: jej klatki są w układzie modelu.
Łańcuchy, korby, drzwi wyjściowe i ich mechanizm odtwarzają ruch względem pozy wiązania.
Dzięki temu łańcuchy przechodzą przez koła na szczytach słupów, a skrzydła pasują do otworu bramy.
Mechanizmy wyłączają `extractRootMotion`: ruch korzenia pozostaje w szkielecie i nie przesuwa
modelu po każdej kolejnej animacji zamknięcia lub otwarcia, jak dzieje się przy chodzie postaci.
Bryła kolizji kraty śledzi aktualne
granice animowanej siatki. Naprawa trwa 8,7 s aktywnej gry i kończy się również po odejściu od kowala.
Obie wersje dźwigni podczas naprawy korzystają z tego samego położenia, obrotu i skali co kowal.
Ich własne szkielety odtwarzają wspólny klip `kowal_cutscene`; dodatkowe przesunięcie i zerowanie
obrotu powodowały lewitowanie przedmiotu. Test porównuje położenia dłoni obu szkieletów w każdej
klatce naprawy, również po podmianie na prostą dźwignię po 5,33 s.

Przeniesiona jest cała logika poziomu 1. Sprawdzone w przeglądarce (Chromium): bieg i obroty,
wielokrotne skoki (Kubuś wraca na ziemię), zbieranie dukatów, gęsi idące do Kubusia i atakujące,
obrażenia od rycerzy i stracha na wróble, miecz po zebraniu 50 dukatów i czaru siły, opuszczenie
mostu i ekran wygranej, menu `Esc`. Nie było jeszcze pełnego przejścia poziomu od startu do mostu
ani testu na słabszym komputerze. Menu `Esc` i ekrany końca są w HTML zamiast oryginalnych
animacji Flash.


## Poziom 9 — Trzy próby

Zasoby pochodzą z `09_trzy_proby.dcr`: 35 scen W3D, 62 bitmapy i 22 dźwięki.
Po rozmowie z kapłanem otwierają się trzy bramy. Kamienie Gwiazd, Ognia i Przodków
można zbierać w dowolnej kolejności. Komplet i powrót do kapłana otwierają drzwi księcia.
Ctrl umieszcza właściwy kamień w każdym z trzech ołtarzy. Po uruchomieniu wszystkich
mocy znikają książę i kapłan; Ctrl zabiera zwierciadło i ustawia je na cokole u królowej.
Podejście do królowej wysuwa planetarium. Amulet można odebrać dopiero po trzech
sekundach animacji; jego pozycja jest odczytywana z poruszającego się modelu.
Amulet uruchamia animowany portal, a wejście do niego kończy etap i zapisuje postęp 10.

Usunięte są dwie luki oryginalnego Lingo: włożenie kamienia wymaga jego zebrania,
a nagroda czeka na wysunięcie podestu. Kolizja drzwi prób podąża za animowaną płytą;
kolizje sześcioczęściowych drzwi znikają po 2,8 s. Lawa odsyła na `start2_ph`, a po
zebraniu kamienia ognia na `start4_ph`; smoła odsyła na `start3_ph`, bez odbierania życia.
Pułapki sprawdzają najbliższe podłoże, dzięki czemu nie działają przez bezpieczny chodnik.
Skok ma siłę 25 zamiast 20 stosowanych we wcześniejszych etapach, zgodnie z Lingo.
Pozostałe poziomy zachowują swoje parametry.

Pięć demonów patroluje trasy 4, 4, 8, 8 i 8 punktów z prędkością 1,5 jednostki na klatkę.
Każdy ma własny stan patrolu.
Korzeń demonów jest ustawiony 55 jednostek nad zmierzonym podłożem, zamiast 80
nad znacznikiem (znaczniki są 5–9 jednostek ponad podłogą). Stopy pozostają przy
posadzce w obu chodach i obu atakach; bryła kolizji przesuwa się razem z modelem.
Próg osiągnięcia punktu patrolu zachowuje oryginalną wysokość, aby opuszczenie
siatki nie zmieniało trasy. Test obejmuje wszystkie pięć demonów i cztery animacje.
Puma ściga gracza w strefie 500 jednostek od startu z prędkością 6; ściany blokują pościg.
Demon, puma i książę odbierają po 25 energii na
animację ataku, również podczas biegu gracza. Puma zachowuje pionową animację korzenia;
wysokość jej grupy to +75 zamiast +38, aby nie zapadała się w podłogę. Królowa ma +45
zamiast +60. Kamera: FOV 60°, odległość 180, wysokość 75, cel +40; przy przeszkodzie
wysokość 150 i cel +70. Mgła wykładnicza ma zasięg 4000.

Lawa (`Group01`) odtwarza w pętli wbudowaną animację kości z W3D, z ruchem
korzenia liczonym względem pozy wiązania i bez przenoszenia ruchu na cały model.
Pierwsza klatka jest stosowana od razu. Bez tego siatka zostawała przesunięta
o około 1769 jednostek i podniesiona o 109: zasłaniała chodniki, a część komnaty
odsłaniała niebieskie tło. Test sprawdza pokrycie całej komnaty i pulsowanie
powierzchni przez ponad dwie pętle animacji.

W czterech framugach księcia (`KsiazeFramuga`) poprawiono przypisania tekstur:
siatka belki używa `futryna_belka`, a wewnętrzny bok `futryna_in02`, zamiast
odwrotnych przypisań zapisanych w W3D. Boki podestów komnaty Słońca (druga
siatka `slonce_podloga`) dostały istniejący materiał `ornament_slonca`.
To uzupełnienie materiału `ornament01SG`, który w źródle nie ma tekstury i ma
zerowy kolor rozproszony; port wyświetlał te powierzchnie jako czarne pasy.
Górne powierzchnie podestów zachowują `posadzka01a`. Test weryfikuje materiały
wszystkich dwunastu siatek framug i obu siatek podłogi.

`node tools/test_poziomu09.mjs` i wariant `--odwrotnie` sprawdzają cały ciąg zadań
na danych W3D, obie kolejności kamieni, HUD, wyjście bez amuletu, opóźnienia kolizji,
pełne patrole, obrażenia każdego wroga, powroty z lawy i smoły, bezpieczny chodnik,
ruch, skok, pauzę, tempo i ostatnie życie. W przeglądarce sprawdzono rendering,
pełne zadanie, zapis postępu i przejście 8 → 9. Test zadania przenosi gracza pomiędzy
interakcjami; pełne przejście od startu samą klawiaturą wymaga ręcznego sprawdzenia.


## Poziom 10 — Hol laboratorium

Zasoby z `10_hol_laboratorium.dcr`: 22 sceny W3D, 55 bitmap i 15 dźwięków,
łącznie około 6,3 MB. Etap używa oryginalnych modeli, tekstur, animacji,
muzyki `muza`, dźwięków i komunikatów `K01`–`K03_hol_labolatorium`.

Trzeba zebrać 35 ogniw energetycznych i z bliska uruchomić konsolę klawiszem
Ctrl. Konsola otwiera trzy części drzwi pokoju badań; bryła kolizji znika
po pierwszej sekundzie animacji, jak w Lingo. Wygrana wymaga uruchomienia
konsoli oraz otwartej bramy. Osiem pozostałych drzwi otwiera się automatycznie
po podejściu. Wejście z windy na próg siódmej śluzy wymaga skoku; ósma
prowadzi z podwyższonej galerii do niższego magazynu.

Trzy mechaniczne pająki patrolują trasy o 5, 6 i 6 punktach z szybkością
5 jednostek na klatkę; trzy raptory — 5, 5 i 2 punkty z szybkością 3,5.
Każdy ma własny stan patrolu i wybiera jeden z trzech ataków. Cios odbiera
5 energii raz na animację, również w biegu. Pająk ma korzeń +64 zamiast +60,
a raptor +76 zamiast +80 względem znacznika. Korzeń `Hips` raptora jest
odtwarzany w układzie modelu: odejmowanie pozy wiązania podnosiło stopy
nad podłogę o 32,7 jednostki. Położenie brył kolizji zachowuje wysokości
z Lingo niezależnie od korekty siatek.

Kamera ma FOV 60°, odległość 180, wysokość 75 i cel +40 (przy ścianie
150 i +70), near 8 i wykładniczą mgłę do 4000. Oświetlenie uwzględnia cztery
oryginalne światła punktowe Omni ze stałym tłumieniem 1/2, włączone dla
poziomu 10. Ryby w akwarium i unoszący się statek odtwarzają animacje W3D.

`node tools/test_poziomu10.mjs` oraz wariant `--odwrotnie` sprawdzają ruch,
skok, menu, tempo, kompletne patrole, wszystkie ataki, wysokość stóp,
przejścia przez osiem drzwi, zamkniętą i otwartą bramę końcową, zbieranie
każdego ogniwa z podłoża tylko raz, licznik, konsolę, wygraną i ostatnie życie.
Test zadań przenosi postać między interakcjami; pełne przejście od początku
samą klawiaturą pozostaje do ręcznego sprawdzenia.

W podglądzie Chromium sprawdzono start, rendering, klawiaturę, pauzę, całe zadanie, zapis postępu
11, przejście 9 → 10 i restart po porażce bez błędów JS ani brakujących zasobów.
Test przeglądarkowy zadania również przenosi postać między interakcjami.


Poprawka kolizji stosów w poziomie 10: dodatkowe promienie przy stopach są
liczone po pionowym kroku skoku/opadania, przed ruchem poziomym. Dotyczą tylko
brył skrzyń. Promienie na wysokości +40, policzone przed opadaniem, omijały
bok wyższej skrzynki i wpuszczały postać pod jej górną powierzchnię.
Test obejmuje 15 skoków na wysoki stos: trzy położenia w poprzek skrzynki
i pięć opóźnień rozpoczęcia biegu. Poprawne skoki lądują na wysokości 356,4,
a spóźnione zatrzymują się obok stosu.

Błękit za bramą pokoju badań jest widocznym tłem sceny, a nie brakującą
teksturą portalu. Dane poziomu 10 kończą geometrię przy wyjściu; samo wnętrze
pokoju badań należy do poziomu 11. Skrypt Lingo tworzy cztery tekstury
`portal01`–`portal04`, ale nie przypisuje ich do żadnego modelu w tym etapie.

Te same 15 przypadków skoku sprawdzono również w podglądzie Chromium na
rzeczywistej scenie: poprawne lądowanie na szczycie i blokada spóźnionego skoku.

## Poziom 11 — Pokój badań

Ctrl umieszcza Ekskalibur, Oko Smoka i Amulet Słońca w odpowiednich schowkach
w dowolnej kolejności. Każdy przedmiot znika z HUD i pojawia się w scenie,
a schowek odtwarza jednorazową animację zamykania. Komplet uruchamia komputer,
pięć bitmap słupa energii i zatrzymuje czterech wojowników. Powrót do wynalazcy
uruchamia animację radości (około 3,43 s), po której gra pokazuje finał.
Finał wyświetla oryginalną planszę `e_kolejnyetap.swf` z ilustracją Kubusia
i robotów oraz tekstem o ocaleniu Miasta Przyszłości i powrocie do naszych
czasów. `tools/eksport_zakonczenia.py` zamienia jej wektory, gradienty i glify
na `dane/11/zakonczenie.svg`; `tools/zbuduj_port.sh` uruchamia eksport dla
poziomu 11. Plansza ładuje się wraz z etapem i zachowuje proporcje 4:3.
Przyciski pozwalają wrócić na stronę gry lub ponownie uruchomić poziom.
Warunek zakończenia nie zależy od licznika wcześniejszych rozmów z Lingo;
bez kompletu artefaktów rozmowa nie kończy gry.

Trzy chrabąszcze, trzy szperacze i czterech wojowników patroluje oryginalne
trasy z szybkościami 3, 5 i 3,5 jednostki na klatkę. Każdy ma własny stan
patrolu. Atak odbiera 5 energii także podczas biegu. Modele używają korzenia
Hips w układzie modelu; wysokości chrabąszcza, szperacza, wojownika i wynalazcy
wynoszą odpowiednio 66, 58, 70 i 53 ponad znacznikiem, zamiast 80/60 z Lingo.
Dwa wejścia otwierają się automatycznie z odległości 300 jednostek.
Kolizja zamkniętej powłoki tunelu ma odwróconą kolejność wierzchołków,
aby promienie od środka trafiały w podłogę i wewnętrzne ściany.
Kamera i mgła mają profil poziomu 10; światło pochodzi także z czterech Omni W3D.

`node tools/test_poziomu11.mjs` i wariant `--odwrotnie` sprawdzają ruch,
skok, tempo, pauzę, wszystkie patrole i klipy ataku, obrażenia, wysokości
siatek, oba wejścia, bieg przez cały tunel, schowki, HUD, komputer, pięć klatek
energii, zatrzymanie wojowników, finał po animacji i utratę ostatniego życia.
W przeglądarce sprawdzono rendering, całe zadanie, zapis ukończenia `12`,
przejście 10 → 11, porażkę i restart bez błędów JS. Test zadania przenosi
gracza między interakcjami; pełne przejście od startu samą klawiaturą
pozostaje do ręcznego sprawdzenia.
