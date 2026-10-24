// Regresja zadań poziomu 2 na rzeczywistych modelach, bez GPU i dodatkowych zależności.
// node tools/test_poziomu02.mjs
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as THREE from "../strona/gra/js/vendor/three.module.min.js";
import { DaneW3d, Scena3d } from "../strona/gra/js/w3d.js";

const events = {};
globalThis.addEventListener = (n, fn) => { events[n] = fn; };
globalThis.Element = class {};
globalThis.localStorage = { getItem: () => null, setItem() {} };
const { uruchomPoziom } = await import("../strona/gra/js/poziom02.js");
const { przechwytujKlawisze } = await import("../strona/gra/js/silnik.js");
const katalog = new URL("../strona/gra/dane/02/", import.meta.url);
const obsada = JSON.parse(await readFile(new URL("obsada.json", katalog)));
const modele = new Map();
for (const m of obsada.filter((m) => m.typ === "shockwave3d")) {
  const [json, bin] = await Promise.all([readFile(new URL(m.plik + ".json", katalog)), readFile(new URL(m.plik + ".bin", katalog))]);
  const d = new DaneW3d(JSON.parse(json), bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength));
  d.tekstura = () => null;
  modele.set(m.nazwa.toLowerCase(), new Scena3d(d));
}
const konce = [];
const gra = {
  milliSeconds: 0, tempo: 30, aktorzy: [], timery: [], nakladki: [], scena: new THREE.Scene(),
  member: (n) => modele.get(n.toLowerCase()), bitmapa: (n) => String(n),
  addOverlay(obraz, x, y) { this.nakladki.push({ obraz, loc: [x, y], blend: 100 }); },
  overlay(i) { return this.nakladki[i - 1]; },
  dodajAktora(a) { this.aktorzy.push(a); }, timeout(ms, fn) { this.timery.push(fn); },
  ustawSwiat(s, k) { this.swiat3d = s; this.kamera = k; this.scena.add(s.swiat); },
};
const { G, punkty } = uruchomPoziom(gra, (co) => konce.push(co));
const Z = gra.member("ziemia");
function granice(n) {
  const o = Z.model(n);
  o.updateWorldMatrix(true, true);
  o.traverse((c) => { if (c.isSkinnedMesh) c.computeBoundingBox(); });
  return new THREE.Box3().setFromObject(o);
}
// Skrzydła i okucia muszą być wycentrowane nad bryłą blokującą otwór.
// Absolutna pozycja korzenia przesuwała całą bramę o ~137 w bok i ~84 w górę.
const drzwi = granice("brama_drzwi_mur"), otwor = granice("drzwi_bramy_zebatki_kolizja_mur ");
assert.ok(Math.abs(drzwi.getCenter(new THREE.Vector3()).x - otwor.getCenter(new THREE.Vector3()).x) < 2,
  "Drzwi wyjściowe muszą być wycentrowane w otworze bramy");
assert.ok(Math.abs(drzwi.min.z - otwor.min.z) < 2, "Dół drzwi musi pasować do progu");
function sprawdzLancuchy() {
  for (const [lancuch, korba] of [["LAANCUCHPRAWY", "Group04"], ["LANCUCHLEWY", "Group05"]]) {
    const l = granice(lancuch), k = granice(korba);
    assert.ok(Math.abs(l.max.z - k.max.z) < 10, `${lancuch}: łańcuch musi przechodzić przez koło na szczycie słupa`);
    assert.ok(l.intersectsBox(k), `${lancuch}: łańcuch musi trafiać w koło także w poziomie`);
  }
}
sprawdzLancuchy();
const pozycjeLancuchow = ["LAANCUCHPRAWY", "LANCUCHLEWY"].map((n) => [n, Z.model(n).position.clone()]);
function przenies(p) {
  Z.model("master").position.copy(p);
  Z.model("mesiek").position.copy(p).z += 35;
}
function klawisz(code, tak) {
  events[tak ? "keydown" : "keyup"]({ code, preventDefault() {} });
}
function klatka() {
  gra.milliSeconds += 1000 / 30;
  for (const fn of gra.timery) fn();
  for (const a of gra.aktorzy) a.stepFrame?.();
  gra.exitFrame();
  gra.swiat3d.aktualizuj(1 / 30);
}
assert.equal(G.coins_refs.length, 25);
assert.equal(G.carrots_refs.length, 8);
for (let i = 0; i < 20; i++) klatka();
assert.ok(Number.isFinite(gra.kamera.position.z));
assert.ok(gra.kamera.position.z - Z.model("master").position.z > 120, "Kamera musi patrzeć znad Kubusia także na płaskim gruncie");
assert.ok(Math.abs(Z.model("master").position.z) < 10, "Kubuś musi stać na ziemi po starcie");
przechwytujKlawisze(true);
const startY = Z.model("master").position.y;
klawisz("ArrowUp", true);
for (let i = 0; i < 20; i++) { klatka(); sprawdzLancuchy(); }
klawisz("ArrowUp", false);
assert.ok(Z.model("master").position.y > startY + 150, "Krata nie może blokować wyjścia ze startu");
for (let i = 0; i < 20; i++) { klatka(); sprawdzLancuchy(); }
assert.ok(new THREE.Box3().setFromObject(Z.model("krata")).min.z < 20, "Krata opuszcza się po przejściu");
sprawdzLancuchy();
przenies(Z.model("ph_otwieranie_bramy_03").position);
for (let i = 0; i < 100; i++) { klatka(); sprawdzLancuchy(); }
assert.ok(new THREE.Box3().setFromObject(Z.model("krata")).min.z > 100, "Krata podnosi się przy znaczniku otwierania");
assert.ok(new THREE.Box3().setFromObject(Z.model("kratownica_brama_kolizja_mur ")).min.z > 100, "Kolizja musi podnosić się z kratą");
sprawdzLancuchy();
for (let cykl = 0; cykl < 3; cykl++) {
  przenies(Z.model("ph_zamykanie_bramy_03").position);
  for (let i = 0; i < 20; i++) { klatka(); sprawdzLancuchy(); }
  przenies(Z.model("ph_otwieranie_bramy_03").position);
  for (let i = 0; i < 100; i++) { klatka(); sprawdzLancuchy(); }
  for (const [n, p] of pozycjeLancuchow) {
    assert.ok(Z.model(n).position.distanceTo(p) < 1e-8, `${n}: kolejne cykle bramy nie mogą przesuwać mocowania łańcucha`);
  }
}
assert.equal(G.haveHandleRepaired, 0);
przenies(punkty.mechanizm); G.action = 1; gra.exitFrame();
assert.equal(G.allInserted, 0, "Montaż wymaga wszystkich naprawionych części");
G.action = 0;

// Zbieranie używa tego samego kroku co sterowanie, z prawdziwymi pozycjami przedmiotów.
for (const p of G.coins_positions.map((p) => p.clone())) { przenies(p.clone().add(new THREE.Vector3(0, 0, -35))); klatka(); }
assert.equal(G.coin_number, 25);
assert.ok(G.coins_refs.every((n) => !Z.model(n)));
for (const [n, flaga] of [["zebatka1", "haveRack1"], ["zebatka2", "haveRack2"], ["dzwignia", "haveHandle"]]) {
  przenies(punkty[n]); gra.exitFrame();
  assert.equal(G[flaga], 1); assert.equal(Z.model(n), undefined);
}
przechwytujKlawisze(true);
przenies(punkty.kowal);
klawisz("ControlLeft", true); klatka(); klawisz("ControlLeft", false);
przenies(punkty.start); // Naprawa kończy się także po odejściu od kowala.
for (let i = 0; i < 280; i++) {
  klatka();
  const kowal = Z.model("kowal");
  for (const nazwa of ["narzedzia", "narzedzie2"]) {
    const narzedzie = Z.model(nazwa);
    for (const reka of ["bip01 l hand", "bip01 r hand"]) {
      const szK = kowal.userData.szkielet, szN = narzedzie.userData.szkielet;
      const dlon = szK.kosci[szK.indeks.get(reka)].getWorldPosition(new THREE.Vector3());
      const uchwyt = szN.kosci[szN.indeks.get(reka)].getWorldPosition(new THREE.Vector3());
      assert.ok(dlon.distanceTo(uchwyt) < 0.1,
        `${nazwa}: animacja dźwigni musi pozostać przy dłoni kowala w klatce ${i}`);
    }
  }
}
assert.equal(G.haveHandleRepaired, 1);
assert.equal(gra.overlay(9).obraz, "dzwigniaprosta");
assert.equal(G.gateOpened, false);
przenies(punkty.koniec); gra.exitFrame();
assert.ok(!konce.includes("wygrana"), "Przed naprawą mechanizmu nie można wygrać");
przenies(punkty.mechanizm); klawisz("ControlLeft", true); klatka();
assert.equal(G.allInserted, 1);
przenies(punkty.dzwigniaBrama); klatka(); klawisz("ControlLeft", false);
assert.equal(G.gateOpened, true);
assert.equal(Z.model("drzwi_bramy_zebatki_kolizja_mur "), undefined);
przenies(punkty.koniec); gra.exitFrame();
assert.deepEqual(konce, ["wygrana"]);
gra.koniec = false; G.lives = 3; G.energy = 100; G.gateOpened = false;
// Prawdziwe pochylnie kolizji schodów po obu stronach wejścia. Wcześniej
// wysokość cyklicznie rosła o ~21 i opadała o ~4 mimo ciągłego biegu pod górę.
przechwytujKlawisze(true);
for (const x of [300, 700]) {
  przenies(new THREE.Vector3(x, 1100, 0)); G.speed = 0; G.car_rotation = -90;
  klawisz("ArrowUp", true);
  let z = Z.model("master").position.z;
  for (let i = 0; i < 40; i++) {
    klatka();
    const nastepneZ = Z.model("master").position.z;
    assert.ok(nastepneZ - z > -0.05, `Schody x=${x}: wejście nie może powodować opadania postaci`);
    assert.ok(nastepneZ - z < 12, `Schody x=${x}: wysokość nie może skakać o kilka kroków naraz`);
    z = nastepneZ;
  }
  assert.ok(z > 230 && Z.model("master").position.y <= 760, "Kubuś musi wejść płynnie na platformę");
  G.car_rotation = 90;
  for (let i = 0; i < 40; i++) {
    klatka();
    const nastepneZ = Z.model("master").position.z;
    assert.ok(nastepneZ - z < 0.05, `Schody x=${x}: zejście nie może podbijać postaci`);
    assert.ok(nastepneZ - z > -12, `Schody x=${x}: zejście nie może urywać wysokości`);
    z = nastepneZ;
  }
  klawisz("ArrowUp", false); G.speed = 0;
  assert.ok(Math.abs(z) < 1, "Kubuś musi zejść z platformy na dziedziniec");
}
przenies(new THREE.Vector3(700, 1100, 0)); G.speed = 0;
klawisz("Space", true); klatka(); klawisz("Space", false);
let szczytSkoku = 0;
for (let i = 0; i < 90; i++) {
  klatka(); szczytSkoku = Math.max(szczytSkoku, Z.model("master").position.z);
}
assert.ok(szczytSkoku > 30, "Stabilizacja podłoża nie może blokować skoku");
assert.ok(Math.abs(Z.model("master").position.z) < 1, "Po skoku Kubuś musi wrócić na ziemię");
// Pierwszy jeździec szarżuje w stronę domu. Po zmianie położenia celu powinien
// obrócić się od ściany i rozpocząć następne szarże, także po zatrzymaniu blisko celu.
const jezdziec = Z.modele().find((o) => o.name.startsWith("kon_rycerz") && !o.name.endsWith("proxy") && !o.name.endsWith("drugi"));
const aktorJezdzca = gra.aktorzy.find((a) => a.model === jezdziec);
const zapis = [jezdziec, Z.model(jezdziec.name + "drugi"), Z.model(jezdziec.name + "proxy")]
  .map((o) => [o, o.position.clone(), o.quaternion.clone()]);
const domJezdzca = jezdziec.position.clone();
function szarza(cel, klatki = 120) {
  Z.model("master").position.copy(cel);
  for (let i = 0; i < klatki; i++) {
    gra.milliSeconds += 1000 / 30;
    aktorJezdzca.stepFrame(); Z.aktualizuj(1 / 30);
  }
}
szarza(domJezdzca.clone().add(new THREE.Vector3(500, 0, 0)));
const przyScianie = jezdziec.position.clone();
assert.ok(przyScianie.distanceTo(domJezdzca) > 150, "Pierwsza szarża musi przesuwać jeźdźca");
szarza(domJezdzca.clone().add(new THREE.Vector3(-200, 0, 0)));
assert.ok(jezdziec.position.x < przyScianie.x - 200, "Jeździec musi wznowić szarżę w nowym kierunku po trafieniu na budynek");
const poDrugiej = jezdziec.position.clone();
szarza(domJezdzca.clone().add(new THREE.Vector3(0, -400, 0)));
assert.ok(jezdziec.position.distanceTo(poDrugiej) > 150, "Jeździec musi podejmować kolejne szarże");
for (const [o, p, q] of zapis) {
  o.position.copy(p); o.quaternion.copy(q);
  const bp = o.userData.bonesPlayer;
  while (bp?.playList.length) bp.removeLast();
}
G.obrazenia = 0; G.speed = 0; G.car_rotation = 90; przenies(punkty.start);
// Szarża zachowuje kierunek po uniku; następna próba może obrać nowy cel.
function uspokojJezdzca() {
  szarza(punkty.start, 90);
  for (const [o, p, q] of zapis) {
    o.position.copy(p); o.quaternion.copy(q);
    const bp = o.userData.bonesPlayer;
    while (bp?.playList.length) bp.removeLast();
  }
  G.obrazenia = 0;
}
uspokojJezdzca();
const dalekiCel = domJezdzca.clone().add(new THREE.Vector3(-500, 0, 0));
szarza(dalekiCel, 20);
assert.equal(aktorJezdzca.stan, "szarza");
const kierunek = jezdziec.quaternion.clone(), przedUnikiem = jezdziec.position.clone();
szarza(dalekiCel.clone().add(new THREE.Vector3(0, 250, 0)), 20);
assert.ok(jezdziec.quaternion.angleTo(kierunek) < 1e-6, "Jeździec nie może śledzić uniku skrętem w trakcie szarży");
assert.ok(jezdziec.position.distanceTo(przedUnikiem) > 100);
assert.equal(G.obrazenia, 0, "Zejście z linii szarży musi chronić przed trafieniem");

// Gracz przy budynku może przejść obok konia bez skakania; miękka kolizja
// przeciwnika nie może przy tym zasłaniać rzeczywistych ścian w promieniach.
uspokojJezdzca();
jezdziec.position.copy(przyScianie);
przenies(przyScianie.clone().add(new THREE.Vector3(150, 0, -70)));
G.energy = 100; G.car_rotation = 180; G.speed = 0;
aktorJezdzca.stepFrame();
const wyjscieSpodSciany = Z.model("master").position.x;
klawisz("ArrowUp", true);
for (let i = 0; i < 24; i++) klatka();
klawisz("ArrowUp", false); G.speed = 0;
assert.ok(Z.model("master").position.x < wyjscieSpodSciany - 180,
  "Kubuś musi móc odejść od budynku obok konia bez skoku");
assert.ok(G.energy >= 95, "Jedna próba szarży może trafić najwyżej raz");
przenies(przyScianie.clone().add(new THREE.Vector3(150, 0, -70)));
G.car_rotation = 0;
const przedMurem = Z.model("master").position.x;
klawisz("ArrowUp", true);
for (let i = 0; i < 12; i++) klatka();
klawisz("ArrowUp", false); G.speed = 0;
assert.ok(Z.model("master").position.x - przedMurem < 20,
  "Przepuszczający koń nie może wyłączać kolizji z budynkiem");

// Obrażenia wymagają przygotowania i widocznej animacji szarży.
function doprowadzDoTrafienia() {
  uspokojJezdzca();
  const p = domJezdzca.clone().add(new THREE.Vector3(-70, 0, -70));
  const energia = G.energy, zycia = G.lives;
  let galop = 0;
  for (let i = 0; i < 75; i++) {
    gra.milliSeconds += 1000 / 30;
    przenies(p); G.speed = 10;
    aktorJezdzca.stepFrame();
    if (aktorJezdzca.stan === "szarza") galop++;
    gra.timery[0](); Z.aktualizuj(1 / 30);
    assert.ok(Z.model("master").position.distanceTo(p) <= 11, "Trafienie nie może teleportować Kubusia");
    if (G.energy !== energia || G.lives !== zycia) {
      assert.ok(galop >= 6, "Obrażenia muszą być poprzedzone animacją galopu");
      assert.equal(aktorJezdzca.stan, "odpoczynek");
      assert.equal(Z.model(jezdziec.name + "proxy").userData.przepuszczaGracza, true);
      return;
    }
  }
  assert.fail("Szarża powinna trafić stojącego na jej linii Kubusia");
}
G.energy = 100; G.lives = 3;
doprowadzDoTrafienia();
assert.equal(G.energy, 95);
assert.equal(G.lives, 3);
assert.equal(Z.model("mesiek").userData.bonesPlayer.playList[0].name, "kubus_hit");
for (let i = 0; i < 10; i++) {
  gra.milliSeconds += 1000 / 30;
  aktorJezdzca.stepFrame(); gra.timery[0](); Z.aktualizuj(1 / 30);
}
assert.equal(G.energy, 95, "Odpoczywający rycerz nie może zadawać obrażeń kontaktem");
G.energy = 5; G.lives = 2; doprowadzDoTrafienia();
assert.equal(G.lives, 1);
assert.equal(G.energy, 100);
G.energy = 5; doprowadzDoTrafienia();
assert.equal(gra.koniec, true);
assert.deepEqual(konce, ["wygrana", "przegrana"]);
console.log("OK: poziom 2 — start, 25 dukatów, dwie zębatki, dźwignia, naprawa Ctrl, montaż, otwarcie bramy i wygrana.");
console.log("OK: ruch — wejście i zejście po obu schodach bez drżenia, skok i trzy szarże jeźdźca ze wznowieniem przy budynku.");
console.log("OK: trafienia jeźdźca — energia zamiast teleportacji, obrażenia podczas biegu, widoczna szarża, unik, wyjście spod ściany i utrata życia dopiero przy zerowej energii.");
