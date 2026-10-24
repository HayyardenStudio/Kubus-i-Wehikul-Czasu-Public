// Zadania pałacu szoguna na rzeczywistych modelach, bez GPU i dodatkowych zależności.
// node tools/test_poziomu06.mjs
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as THREE from "../strona/gra/js/vendor/three.module.min.js";
import { DaneW3d, Scena3d } from "../strona/gra/js/w3d.js";

const events = {};
globalThis.addEventListener = (n, fn) => { events[n] = fn; };
globalThis.Element = class {};
globalThis.localStorage = { getItem: () => null, setItem() {} };
const { uruchomPoziom } = await import("../strona/gra/js/poziom06.js");
const { przechwytujKlawisze } = await import("../strona/gra/js/silnik.js");
const katalog = new URL("../strona/gra/dane/06/", import.meta.url);
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
const { G, punkty, drzwi, skrzynie, brama, patrole, player, promienie } = uruchomPoziom(gra, (co) => konce.push(co));
const Z = gra.member("ziemia");
function przenies(p) { player.reset(p, 90); }
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

assert.equal(drzwi.length, 30); assert.equal(skrzynie.length, 11);
assert.deepEqual(patrole.map((r) => r.trasa.length), [6, 6, 6, 6, 8, 6]);
klatki(30);
assert.ok(Math.abs(Z.model("master").position.z + 0.051) < 1);
const y = Z.model("master").position.y;
klawisz("ArrowUp", true); klatki(15); klawisz("ArrowUp", false);
assert.ok(Z.model("master").position.y > y + 100);
przenies(punkty.start); klawisz("Space", true); klatki(); klawisz("Space", false);
let szczyt = -Infinity;
for (let i = 0; i < 80; i++) { klatki(); szczyt = Math.max(szczyt, Z.model("master").position.z); }
assert.ok(szczyt > 30); assert.ok(Math.abs(Z.model("master").position.z + 0.051) < 1);
klawisz("Escape", true); klatki(); klawisz("Escape", false); assert.equal(konce.pop(), "menu");
klawisz("Equal", true); klatki(3); klawisz("Equal", false); assert.equal(gra.tempo, 35);
klawisz("Minus", true); klatki(3); klawisz("Minus", false); assert.equal(gra.tempo, 30);

// Wyjście bez obu przedmiotów i Ctrl z daleka nie kończą etapu ani nie otwierają skrzyń.
przenies(punkty.koniec); ctrl(); assert.deepEqual(konce, []);
assert.ok(skrzynie.every((s) => !s.opened)); assert.ok(drzwi.every((d) => !d.opened));
assert.ok(brama.every((o) => o.userData.keyframePlayer.czas === 0));

// Pełne patrole, szybkość 4 jednostek/klatkę, bryły kolizji i położenie siatki.
przenies(new THREE.Vector3(10000, 10000, 0));
const odwiedzone = patrole.map(() => new Set());
for (let i = 0; i < 2200; i++) {
  const przed = patrole.map((r) => r.model.position.clone()); klatki();
  patrole.forEach((r, j) => {
    odwiedzone[j].add(r.waypoint);
    assert.ok(Math.abs(r.model.position.distanceTo(przed[j]) - 4) < 0.001);
    assert.ok(Math.abs(r.proxy.position.z - r.model.position.z + r.wysokosc) < 0.001);
    if (i > 30 && i % 12 === 0) {
      const bone = (n) => r.model.userData.szkielet.kosci.find((b) => b.name === n).getWorldPosition(new THREE.Vector3());
      const twarz = bone("JAW").sub(bone("Head")); twarz.z = 0;
      const ruch = r.model.position.clone().sub(przed[j]); ruch.z = 0;
      assert.ok(twarz.normalize().dot(ruch.normalize()) > 0.25, r.model.name + ": kierunek twarzy");
    }
  });
}
assert.deepEqual(odwiedzone.map((s) => s.size), patrole.map((r) => r.trasa.length));
function graniceSiatki(o) {
  Z.swiat.updateMatrixWorld(true);
  o.traverse((c) => { if (c.isSkinnedMesh) { c.skeleton.update(); c.computeBoundingBox(); } });
  return new THREE.Box3().setFromObject(o);
}
const r = patrole[0], bp = r.model.userData.bonesPlayer;
for (const anim of ["gejsza_walk", "gejsza_attack1", "gejsza_attack2"]) {
  while (bp.playList.length) bp.removeLast(); bp.queue(anim); bp.blend = null;
  for (let i = 0; i < 90; i++) {
    bp.aktualizuj(1 / 30);
    const dol = graniceSiatki(r.model).min.z;
    assert.ok(dol > -7 && dol < 12, `${anim}: stopy ${dol}`);
  }
}
while (bp.playList.length) bp.removeLast();

// Każde skrzydło przesuwa się tylko raz; kolizja jedzie razem z drzwiami.
for (const i of [0, 4, 8, 12, 19, 29]) {
  const d = drzwi[i], box = new THREE.Box3().setFromObject(d.proxy);
  const axis = box.max.x - box.min.x < box.max.y - box.min.y ? "x" : "y";
  const p = d.pozycja.clone(); p[axis] += 120; p.z = -0.051;
  przenies(p); G.car_rotation = axis === "x" ? 180 : 270;
  klawisz("ArrowUp", true); klatki(30); klawisz("ArrowUp", false); G.speed = 0;
  assert.ok(Z.model("master").position[axis] > d.pozycja[axis], "Zamknięte drzwi blokują bieg");
  ctrl(); klatki(90);
  klawisz("ArrowUp", true); klatki(40); klawisz("ArrowUp", false); G.speed = 0;
  assert.ok(Z.model("master").position[axis] < d.pozycja[axis] - 100, d.model.name + ": przejście po otwarciu");
}
przenies(punkty.start); ctrl();
for (const d of drzwi) {
  przenies(d.pozycja); ctrl(); klatki(90);
  assert.ok(d.opened, d.model.name);
  assert.ok(d.model.position.distanceTo(d.baza) > 50, d.model.name + ": ruch");
  assert.ok(d.proxy.position.distanceTo(d.model.position) < 0.001);
  const koniec = d.model.position.clone(); ctrl(); klatki(30);
  assert.ok(d.model.position.distanceTo(koniec) < 0.001, "Drzwi nie wracają");
}
const puste = skrzynie.filter((s) => !/luk|kolczan/.test(s.model.name));
for (const s of puste) {
  przenies(s.pozycja); ctrl(); klatki(60);
  assert.ok(s.opened); assert.ok(!G.haveLuk && !G.haveKolczan);
  assert.equal(gra.overlay(4).obraz, "k04_palac_szoguna");
}
function zbierz(flaga, punkt, wieko, obraz) {
  przenies(punkt); ctrl();
  assert.ok(skrzynie.find((s) => s.model.name === wieko).opened);
  assert.equal(G[flaga], false, "Przedmiot czeka na animację otwarcia");
  przenies(punkty.start); klatki(60);
  assert.equal(G[flaga], false, "Otwarta skrzynia wymaga podejścia po przedmiot");
  przenies(punkt); klatki(3); assert.equal(G[flaga], true);
  assert.equal(gra.overlay(2).obraz, obraz); assert.deepEqual(gra.overlay(2).loc, [280, 12]);
}
const odwrotnie = process.argv.includes("--odwrotnie");
if (odwrotnie) zbierz("haveKolczan", punkty.kolczan, "skrzynia_kolczan_wieko", "image_kolczan");
else zbierz("haveLuk", punkty.luk, "skrzynia_luk_wieko", "image_luk");
assert.equal(Z.model(odwrotnie ? "strzaly" : "luk"), undefined);
przenies(punkty.koniec); klatki(3); assert.deepEqual(konce, []);
assert.ok(brama.every((o) => o.userData.keyframePlayer.czas === 0));
if (odwrotnie) zbierz("haveLuk", punkty.luk, "skrzynia_luk_wieko", "image_lukikolczan");
else zbierz("haveKolczan", punkty.kolczan, "skrzynia_kolczan_wieko", "image_lukikolczan");
assert.equal(Z.model("strzaly"), undefined);
assert.ok(brama.every((o) => o.userData.keyframePlayer.czas > 0));
const czasy = brama.map((o) => o.userData.keyframePlayer.czas);
ctrl(); klatki(90); assert.ok(G.haveLuk && G.haveKolczan);
brama.forEach((o, i) => assert.ok(o.userData.keyframePlayer.czas >= czasy[i]));
przenies(punkty.koniec); klatki(3); assert.deepEqual(konce, ["wygrana"]);

// Każda gejsza zatrzymuje patrol i odbiera energię. Ostatnie życie kończy rozgrywkę raz.
gra.koniec = false;
for (const r of patrole) {
  przenies(r.model.position.clone().add(new THREE.Vector3(0, 0, -r.wysokosc)));
  G.energy = 100;
  for (let i = 0; i < 240 && G.energy === 100; i++) klatki();
  assert.ok(G.energy < 100, r.model.name + ": obrażenia");
}
G.energy = 5; G.lives = 1;
przenies(r.model.position.clone().add(new THREE.Vector3(0, 0, -r.wysokosc)));
for (let i = 0; i < 300 && !gra.koniec; i++) klatki();
assert.equal(G.lives, 0); assert.equal(konce.at(-1), "przegrana");
klatki(30); assert.equal(G.lives, 0);
console.log("OK: poziom 6 — ruch, skok, tempo, pauza, sześć patroli, animacje gejsz, 30 drzwi i kolizje, 11 skrzyń, łuk, kołczan, HUD, brama, wygrana i obrażenia.");

