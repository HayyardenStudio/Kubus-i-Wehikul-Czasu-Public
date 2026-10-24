// Zadania zamku na rzeczywistych modelach, bez GPU i dodatkowych zależności.
// node tools/test_poziomu04.mjs
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as THREE from "../strona/gra/js/vendor/three.module.min.js";
import { DaneW3d, Scena3d } from "../strona/gra/js/w3d.js";

const events = {};
globalThis.addEventListener = (n, fn) => { events[n] = fn; };
globalThis.Element = class {};
globalThis.localStorage = { getItem: () => null, setItem() {} };
const { uruchomPoziom } = await import("../strona/gra/js/poziom04.js");
const { przechwytujKlawisze } = await import("../strona/gra/js/silnik.js");
const katalog = new URL("../strona/gra/dane/04/", import.meta.url);
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
const { G, punkty, skrzynie, kraty } = uruchomPoziom(gra, (co) => konce.push(co));
const Z = gra.member("ziemia");
function przenies(p) {
  Z.model("master").position.copy(p);
  Z.model("mesiek").position.copy(p).z += 35;
  G.speed = 0;
}
function klawisz(code, tak) { events[tak ? "keydown" : "keyup"]({ code, preventDefault() {} }); }
function klatki(n = 1) {
  for (let i = 0; i < n; i++) {
    gra.milliSeconds += 1000 / gra.tempo;
    for (const fn of gra.timery) fn();
    for (const a of gra.aktorzy) a.stepFrame?.();
    gra.exitFrame(); Z.aktualizuj(1 / gra.tempo);
  }
}
function ctrl() { klawisz("ControlLeft", true); klatki(3); klawisz("ControlLeft", false); klatki(3); }
przechwytujKlawisze(true);
assert.equal(skrzynie.length, 11);
assert.equal(kraty.length, 3);
assert.equal(gra.aktorzy.length, 5);
klatki(30);
assert.ok(Math.abs(Z.model("master").position.z) < 5);
assert.equal(gra.overlay(4).obraz, "k01_komnaty");
const y = Z.model("master").position.y;
klawisz("ArrowUp", true); klatki(15); klawisz("ArrowUp", false);
assert.ok(Z.model("master").position.y > y + 100);
przenies(punkty.start);
klawisz("Space", true); klatki(); klawisz("Space", false);
let szczyt = 0;
for (let i = 0; i < 80; i++) { klatki(); szczyt = Math.max(szczyt, Z.model("master").position.z); }
assert.ok(szczyt > 30); assert.ok(Math.abs(Z.model("master").position.z) < 5);
klawisz("Escape", true); klatki(); klawisz("Escape", false); assert.equal(konce.pop(), "menu");
klawisz("Equal", true); klatki(3); klawisz("Equal", false); klatki(); assert.equal(gra.tempo, 35);
klawisz("Minus", true); klatki(); klawisz("Minus", false); klatki(); assert.equal(gra.tempo, 30);
// Oba zakręcające ciągi schodów prowadzą na piętra. Przy progu biblioteki
// skok pozwala przekroczyć pionową krawędź sufitu obecną w oryginalnej kolizji.
for (const [p, obrot, n, minZ] of [
  [[170, 300, 1], 0, 35, 145], [[550, 430, 160], 90, 30, 300],
  [[-730, 440, 310], 90, 38, 480], [[-690, 890, 490], 0, 23, 570],
]) {
  przenies(new THREE.Vector3(...p)); klatki(10); G.car_rotation = obrot;
  klawisz("ArrowUp", true); klatki(n); klawisz("ArrowUp", false); G.speed = 0;
  assert.ok(Z.model("master").position.z > minZ,
    `Wejście po schodach z ${p} nie może być zablokowane: ${Z.model("master").position.toArray()}`);
}
klawisz("ArrowUp", true); klawisz("Space", true); klatki(3); klawisz("Space", false);
klatki(18); klawisz("ArrowUp", false); G.speed = 0;
assert.ok(Z.model("master").position.x > -400 && Z.model("master").position.z > 610);
przenies(punkty.start); klatki(6);
// Ctrl działa wyłącznie obok skrzyni. Puste skrzynie nie przyznają kielicha.
ctrl(); assert.ok(skrzynie.every((s) => !s.opened));
const pusta = skrzynie.find((s) => s.model.name === "parter_skrzynia_01_wieko");
przenies(pusta.pozycja); klatki(3); assert.equal(pusta.opened, false);
ctrl(); assert.equal(pusta.opened, true); klatki(65);
assert.equal(G.haveGraal, false); assert.equal(gra.overlay(4).obraz, "k02_komnaty");
// Automatyczne kraty unoszą się, wracają i mogą uruchomić się ponownie.
for (const k of kraty) {
  przenies(k.pozycja); klatki(3); assert.equal(k.opened, true);
  const start = k.model.position.clone(); klatki(15);
  assert.ok(k.model.position.z > start.z + 100);
  const proxy = Z.model(k.model.name.replace("_krata_anim", "_krata").replace(/^/, "kolizja_") + "_mur");
  assert.ok(Math.abs(proxy.position.z - k.model.position.z) < 10, "Kolizja podąża za kratą");
  przenies(punkty.start); klatki(65);
  assert.ok(k.model.position.distanceTo(k.pozycja) < 0.01);
  przenies(k.pozycja); klatki(3); assert.equal(k.opened, true);
}
// Dźwignia otwiera kratę na 5,4 s, potem zamyka; kilka cykli nie przesuwa mocowania.
const mala = Z.model("parter_krata_02"), bazaKraty = mala.position.clone();
for (let cykl = 0; cykl < 3; cykl++) {
  przenies(punkty.dzwignia); ctrl(); klatki(25);
  assert.ok(mala.position.z > bazaKraty.z + 150);
  assert.equal(mala.userData.keyframePlayer.playing, false);
  przenies(punkty.start); klatki(180);
  assert.ok(mala.position.distanceTo(bazaKraty) < 1, "Krata wraca na miejsce");
}
// Duchy przechodzą pełne trasy w pętli, nie tylko pierwszy odcinek.
const duchy = gra.aktorzy.filter((a) => a.model.name.startsWith("duch"));
const podlogaBiblioteki = new THREE.Box3().setFromObject(Z.model("1pietro_sufit_podloze")).max.z;
function sprawdzWysokoscDuchow() {
  // updateMatrixWorld aktualizuje również bindMatrixInverse SkinnedMesh,
  // tak jak przy renderowaniu; updateWorldMatrix nie wykonuje tego kroku.
  Z.swiat.updateMatrixWorld(true);
  for (const { model } of duchy) {
    model.traverse((c) => { if (c.isSkinnedMesh) { c.skeleton.update(); c.computeBoundingBox(); } });
    const dol = new THREE.Box3().setFromObject(model).min.z;
    assert.ok(dol > podlogaBiblioteki + 5,
      `${model.name}: dół siatki ${dol} musi lewitować nad podłogą ${podlogaBiblioteki}`);
    assert.equal(Z.model(model.name + "proxy").position.z, model.position.z);
  }
}
const odwiedzone = duchy.map(() => new Set());
przenies(punkty.start);
for (let i = 0; i < 2400; i++) {
  klatki(); duchy.forEach((d, j) => odwiedzone[j].add(d.waypoint));
  if (i < 120 || i % 10 === 0) sprawdzWysokoscDuchow();
}
assert.deepEqual(odwiedzone.map((s) => s.size), [12, 11, 9, 8]);
// Zły król uruchamia zapadnię, a odejście od tronu przywraca podparcie.
przenies(punkty.krol.clone().add(new THREE.Vector3(0, 120, -20)));
let otwarta = false;
for (let i = 0; i < 450 && !otwarta; i++) { klatki(); otwarta = !Z.model("kolizja_1pietro_zapadnia01_podloze").parent; }
assert.ok(otwarta, "Bez kielicha król otwiera zapadnię");
przenies(punkty.start); klatki(300);
assert.ok(Z.model("kolizja_1pietro_zapadnia01_podloze").parent);
// Właściwa skrzynia przyznaje kielich dopiero po 1,5 s otwierania i tylko raz.
const prawdziwa = skrzynie.find((s) => s.model.name === "2pietro_skrzynia_05_podloze_mur_wieko");
przenies(prawdziwa.pozycja); klatki(6); assert.equal(G.haveGraal, false);
ctrl(); klatki(20); assert.equal(G.haveGraal, false);
klatki(35); assert.equal(G.haveGraal, true); assert.equal(Z.model("graal"), undefined);
assert.equal(gra.overlay(2).loc[1], 12);
// Przed rozmową z królem wejście w punkt końca nie kończy gry.
przenies(punkty.koniec); klatki(6); assert.deepEqual(konce, []);
przenies(punkty.krol.clone().add(new THREE.Vector3(0, 120, -20)));
for (let i = 0; i < 450 && !G.wasHappy; i++) klatki();
assert.equal(G.wasHappy, true);
assert.equal(gra.overlay(2).loc[1], -112);
assert.equal(Z.model("kolizja_1pietro_kotara_box01_mur").parent, null);
klatki(90);
assert.equal(Z.model("KOTARA1").userData.bonesPlayer.playList.length, 0);
przenies(punkty.koniec); klatki(3); assert.deepEqual(konce, ["wygrana"]);
// Duch zadaje 5 energii; utrata ostatniego życia kończy grę tylko raz.
gra.koniec = false;
const duch = duchy[0];
przenies(duch.model.position.clone().add(new THREE.Vector3(80, 0, 0)));
G.energy = 100;
for (let i = 0; i < 180 && G.energy === 100; i++) { klatki(); sprawdzWysokoscDuchow(); }
assert.equal(G.energy, 95); assert.equal(G.lives, 3);
// Pełna animacja ataku i przejście z powrotem do chodu też mieszczą się nad podłogą.
przenies(punkty.start);
for (let i = 0; i < 180; i++) { klatki(); sprawdzWysokoscDuchow(); }
przenies(duch.model.position.clone().add(new THREE.Vector3(80, 0, 0)));
G.energy = 5; G.lives = 1;
for (let i = 0; i < 180 && !gra.koniec; i++) klatki();
assert.equal(G.lives, 0); assert.deepEqual(konce, ["wygrana", "przegrana"]);
klatki(60); assert.equal(G.lives, 0);
console.log("OK: poziom 4 — ruch, skok, pauza, tempo, 11 skrzyń, 3 kraty i kolizje, dźwignia, pełne patrole duchów, zapadnia, kielich, król, kotary, wygrana i obrażenia.");
