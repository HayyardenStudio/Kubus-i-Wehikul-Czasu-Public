// Regresja zadań poziomu 3 na rzeczywistych modelach, bez GPU i dodatkowych zależności.
// node tools/test_poziomu03.mjs
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as THREE from "../strona/gra/js/vendor/three.module.min.js";
import { DaneW3d, Scena3d } from "../strona/gra/js/w3d.js";

const events = {};
globalThis.addEventListener = (n, fn) => { events[n] = fn; };
globalThis.Element = class {};
globalThis.localStorage = { getItem: () => null, setItem() {} };
const { uruchomPoziom } = await import("../strona/gra/js/poziom03.js");
const { przechwytujKlawisze } = await import("../strona/gra/js/silnik.js");
const katalog = new URL("../strona/gra/dane/03/", import.meta.url);
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
const czarneStarty = gra.aktorzy.filter((a) => a.model.name.startsWith("rycerz_czarny"))
  .map((a) => [a, a.model.position.clone()]);
// Pierwsza klatka wbudowanych animacji musi zachować mocowania w scenie.
for (const n of ["FLAGA1", "FLAGA2"]) {
  const sz = Z.model(n).userData.szkielet;
  assert.ok(sz.kosci[0].position.distanceTo(new THREE.Vector3(...sz.def.bones[0].dir)) < 1e-5,
    `${n}: animacja nie może przesunąć mocowania względem pozy wiązania`);
}

// Mocowanie dzwonu musi pasować do belek, także w każdej fazie kołysania.
const belki = new THREE.Box3().setFromObject(Z.model("dzwon1"));
const dzwon = Z.model("dzwon2"), dzwonBP = dzwon.userData.bonesPlayer;
const polozenieDzwonu = dzwon.position.clone();
dzwonBP.play();
for (let i = 0; i < 120; i++) {
  dzwonBP.aktualizuj(1 / 30);
  dzwon.updateWorldMatrix(true, true);
  dzwon.traverse((c) => { if (c.isSkinnedMesh) c.computeBoundingBox(); });
  const b = new THREE.Box3().setFromObject(dzwon);
  assert.ok(Math.abs(b.max.z - belki.max.z) < 20, "Góra dzwonu musi pozostawać przy belce poprzecznej");
  assert.ok(Math.abs(b.getCenter(new THREE.Vector3()).y - belki.getCenter(new THREE.Vector3()).y) < 30,
    "Dzwon nie może odsunąć się od belek w poziomie");
  assert.ok(dzwon.position.distanceTo(polozenieDzwonu) < 1e-8, "Kołysanie nie może przesuwać całego modelu");
}
dzwonBP.czas = 0; dzwonBP.aktualizuj(0); dzwonBP.pause();

function przenies(p) {
  Z.model("master").position.copy(p);
  Z.model("mesiek").position.copy(p).z += 35;
}
function klawisz(code, tak) { events[tak ? "keydown" : "keyup"]({ code, preventDefault() {} }); }
function klatka() {
  gra.milliSeconds += 1000 / gra.tempo;
  for (const fn of gra.timery) fn();
  for (const a of gra.aktorzy) a.stepFrame?.();
  gra.exitFrame(); Z.aktualizuj(1 / gra.tempo);
}
przechwytujKlawisze(true);
assert.equal(G.carrots_refs.length, 2);
assert.equal(gra.aktorzy.length, 10);
for (let i = 0; i < 30; i++) klatka();
assert.ok(Math.abs(Z.model("master").position.z) < 5, "Kubuś musi stać na ziemi");
assert.ok(Number.isFinite(gra.kamera.position.z));
assert.ok(gra.kamera.position.z > 120);
assert.equal(gra.overlay(3).obraz, "K01_maly_dziedziniec");
const startY = Z.model("master").position.y;
klawisz("ArrowUp", true);
for (let i = 0; i < 15; i++) klatka();
klawisz("ArrowUp", false); G.speed = 0;
assert.ok(Z.model("master").position.y > startY + 100, "Ruch od startu nie może być zablokowany");
przenies(punkty.start);
klawisz("Space", true); klatka(); klawisz("Space", false);
let szczyt = 0;
for (let i = 0; i < 80; i++) { klatka(); szczyt = Math.max(szczyt, Z.model("master").position.z); }
assert.ok(szczyt > 30);
assert.ok(Math.abs(Z.model("master").position.z) < 5);
// Pauza oraz regulacja tempa korzystają z tej samej klawiatury co pozostałe poziomy.
klawisz("Escape", true); klatka(); klawisz("Escape", false);
assert.equal(konce.pop(), "menu");
klawisz("Equal", true); klatka(); klatka(); klawisz("Equal", false); klatka();
assert.equal(gra.tempo, 35, "Trzymanie plusa nie może dodawać tempa co klatkę");
klawisz("Minus", true); klatka(); klawisz("Minus", false); klatka();
assert.equal(gra.tempo, 30);
// Ctrl działa tylko w zasięgu. Bez niego dzwon nie rusza.
klawisz("ControlLeft", true); klatka(); klawisz("ControlLeft", false);
assert.equal(G.readyAnimate, 0);
przenies(punkty.dzwon.clone().setZ(0)); klatka();
assert.equal(G.readyAnimate, 0);
assert.equal(gra.overlay(3).obraz, "K02_maly_dziedziniec");
klawisz("ControlLeft", true); klatka(); klawisz("ControlLeft", false);
assert.equal(G.readyAnimate, 1);
assert.equal(Z.model("dzwon2").userData.bonesPlayer.playing, true);
const patrole = gra.aktorzy.filter((a) => a.model.name.startsWith("rycerz_maly"));
assert.ok(patrole.every((a) => a.patroluje));
const pozycje = patrole.map((a) => a.model.position.clone());
// Sam gracz zostaje przy dzwonie; każdy rycerz musi przejść całą trasę bez teleportacji.
for (let i = 0; i < 120; i++) klatka();
assert.ok(patrole.every((a, i) => a.model.position.distanceTo(pozycje[i]) > 100));
let klatkiPatrolu = 120;
while (G.readyAnimate && klatkiPatrolu < 2400) { klatka(); klatkiPatrolu++; }

assert.equal(G.readyAnimate, 0, "Patrole muszą zakończyć pełne trasy");
assert.equal(Z.model("dzwon2").userData.bonesPlayer.playing, false);
// Dzwon może uruchomić następną rundę, a marchewka przywraca energię tylko raz.
klawisz("ControlLeft", true); klatka(); klawisz("ControlLeft", false);
assert.equal(G.readyAnimate, 1);
G.energy = 20;
przenies(G.carrots_positions[0]); klatka();
assert.equal(G.energy, 100);
assert.equal(Z.model(G.carrots_refs[0]), undefined);
G.energy = 75; klatka(); assert.equal(G.energy, 75);
// Mały strażnik zadaje obrażenia po animacji ciosu również podczas biegu.
const maly = patrole[0];
// Kończymy rundę, aby strażnik wrócił do pilnowania drzwi.
przenies(punkty.dzwon.clone().setZ(0));
while (G.readyAnimate) klatka();
przenies(maly.model.position.clone().add(new THREE.Vector3(80, 0, -22)));
G.energy = 100;
for (let i = 0; i < 150 && G.energy === 100; i++) klatka();
assert.equal(G.energy, 95, "Mały strażnik odbiera 5 energii");
assert.equal(G.lives, 3);
// Czarni rycerze zaczynają widoczny atak; cios odbiera jedno życie i resetuje scenę.
const czarny = gra.aktorzy.find((a) => a.model.name.startsWith("rycerz_czarny"));

przenies(czarny.model.position.clone().add(new THREE.Vector3(110, 0, -35)));
let czasAtaku = null;
for (let i = 0; i < 180 && G.lives === 3; i++) {
  klatka();
  if (czarny.model.userData.bonesPlayer.playList[0]?.name === "rycerz_czarny_attack3" && czasAtaku === null) czasAtaku = gra.milliSeconds;
}
assert.notEqual(czasAtaku, null, "Czarny rycerz musi pokazać atak");
assert.ok(gra.milliSeconds - czasAtaku >= 500);
assert.equal(G.lives, 2); assert.equal(G.energy, 100);
assert.ok(Z.model("master").position.distanceTo(punkty.start) < 5);
assert.equal(G.readyAnimate, 0);
assert.ok(patrole.every((a) => !a.patroluje));
assert.equal(Z.model("dzwon2").userData.bonesPlayer.playing, false);
assert.equal(G.doorsOpened, false);
for (const [a, p] of czarneStarty) assert.ok(a.model.position.distanceTo(p) < 1);
assert.equal(gra.overlay(2).obraz, "zycie2");
// Po respawnie przeciwnicy nadal działają.
przenies(czarny.model.position.clone().add(new THREE.Vector3(110, 0, -35)));
for (let i = 0; i < 180 && G.lives === 2; i++) klatka();
assert.equal(G.lives, 1);
// Drzwi wymagają Ctrl i ponad sekundy odtwarzania; bliskość sama nie kończy poziomu.
przenies(punkty.wyjscie.clone().setZ(0));
for (let i = 0; i < 40; i++) klatka();
assert.equal(G.doorsOpened, false); assert.deepEqual(konce, []);
klawisz("ControlLeft", true); klatka(); klawisz("ControlLeft", false);
assert.equal(G.doorsOpened, true); assert.deepEqual(konce, []);
for (let i = 0; i < 40; i++) klatka();
assert.deepEqual(konce, ["wygrana"]);
// Ostatni cios kończy grę; kolejne klatki nie odbierają dalszych żyć.
gra.koniec = false;
przenies(czarny.model.position.clone().add(new THREE.Vector3(110, 0, -35)));
for (let i = 0; i < 180 && !gra.koniec; i++) klatka();
assert.equal(G.lives, 0); assert.deepEqual(konce, ["wygrana", "przegrana"]);
for (let i = 0; i < 60; i++) klatka();
assert.equal(G.lives, 0); assert.equal(konce.length, 2);
console.log("OK: poziom 3 — start, ruch, skok, dzwon Ctrl, cztery pełne patrole i powtórzenie, marchewka, oba rodzaje obrażeń, resety, drzwi, wygrana i utrata ostatniego życia.");
