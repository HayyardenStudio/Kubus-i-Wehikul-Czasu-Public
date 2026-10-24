// Pokój badań na rzeczywistych modelach, bez GPU i dodatkowych zależności.
// node tools/test_poziomu11.mjs [--odwrotnie]
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as THREE from "../strona/gra/js/vendor/three.module.min.js";
import { DaneW3d, Scena3d } from "../strona/gra/js/w3d.js";

const events = {};
globalThis.addEventListener = (n, fn) => { events[n] = fn; };
globalThis.Element = class {};
globalThis.localStorage = { getItem: () => null, setItem() {} };
const { uruchomPoziom } = await import("../strona/gra/js/poziom11.js");
const { przechwytujKlawisze, Gra } = await import("../strona/gra/js/silnik.js");
const katalog = new URL("../strona/gra/dane/11/", import.meta.url);
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
  ustawSwiat(...args) { Gra.prototype.ustawSwiat.apply(this, args); },
};
const stan = uruchomPoziom(gra, (co) => konce.push(co));

const { G, V, punkty, drzwi, schowki, przeciwnicy, wynalazca, energia, player, promienie } = stan;
const Z = gra.member("ziemia"), master = Z.model("master");
function klawisz(code, tak) { events[tak ? "keydown" : "keyup"]({ code, preventDefault() {} }); }
function klatki(n = 1) {
  for (let i = 0; i < n && !gra.koniec; i++) {
    gra.milliSeconds += 1000 / gra.tempo;
    for (const fn of gra.timery) fn();
    for (const a of gra.aktorzy) a.stepFrame?.();
    gra.exitFrame(); Z.aktualizuj(1 / gra.tempo);
  }
}
function przenies(p, obrot = -90) { G.speed = 0; player.reset(p, obrot); }
function podloga(p) {
  const h = promienie(() => Z.modelsUnderRay(p.clone().add(V(0, 0, 30)), V(0, 0, -1)))
    .find(h => h.model.name.includes("podloze") && h.isectNormal.z > 0.65);
  assert.ok(h, "Podparcie: " + p.toArray()); return h.isectPosition.clone();
}
function ctrl() { klawisz("ControlLeft", true); klatki(2); klawisz("ControlLeft", false); klatki(2); }
function bounds(o) {
  Z.swiat.updateMatrixWorld(true);
  o.traverse(c => { if (c.isSkinnedMesh) { c.skeleton.update(); c.computeBoundingBox(); } });
  return new THREE.Box3().setFromObject(o);
}
przechwytujKlawisze(true);
assert.deepEqual(przeciwnicy.map(a => a.trasa.length), [6, 6, 2, 2, 2, 2, 7, 7, 7, 7]);
assert.equal(gra.kamera.fov, 60); assert.equal(gra.scena.children.filter(o => o.isPointLight).length, 4);
assert.deepEqual([4, 5, 6].map(i => gra.overlay(i).obraz), ["miecz01", "okosmoka01", "amuletslonca01"]);
for (const d of drzwi) for (const o of d.modele) assert.equal(o.userData.keyframePlayer.playing, false);
for (const s of schowki) {
  assert.equal(s.schowek.userData.keyframePlayer.playing, false);
  assert.equal(s.model.userData.widocznosc, 0);
}
klatki(15); assert.equal(gra.overlay(3).obraz, "K01_pokoj_badan");
const start = master.position.clone();
klawisz("ArrowUp", true); klatki(12); klawisz("ArrowUp", false);
assert.ok(master.position.x > start.x + 80, "Bieg od startu w oryginalnym kierunku");
przenies(podloga(punkty.start)); klatki(3); const z = master.position.z;
klawisz("Space", true); klatki(); klawisz("Space", false);
let szczyt = z;
for (let i = 0; i < 70; i++) { klatki(); szczyt = Math.max(szczyt, master.position.z); }
assert.ok(szczyt > z + 50); assert.ok(Math.abs(master.position.z - z) < 1);
klawisz("Escape", true); klatki(); klawisz("Escape", false); assert.equal(konce.pop(), "menu");
klawisz("Equal", true); klatki(3); klawisz("Equal", false); assert.equal(gra.tempo, 35);
klawisz("Minus", true); klatki(3); klawisz("Minus", false); assert.equal(gra.tempo, 30);
// Każdy przeciwnik zachowuje własny patrol i przechodzi pełną trasę.
przenies(V(5000, 5000, 0));
for (let i = 0; i < 18000 && przeciwnicy.some(a => a.odwiedzone.size < a.trasa.length); i++) {
  przeciwnicy.forEach(a => a.stepFrame());
}
for (const a of przeciwnicy) assert.equal(a.odwiedzone.size, a.trasa.length, a.model.name + ": pełny patrol");
// Pozycje modeli pochodzą z Hips; chód ma podparcie, a ataki zachowują skoki z animacji.
for (const typ of ["chrabaszcz", "szperacz", "wojownik"]) {
  const a = przeciwnicy.find(a => a.typ === typ), bp = a.model.userData.bonesPlayer;
  a.grupa.position.copy(a.start).z += typ === "chrabaszcz" ? 66 : typ === "szperacz" ? 58 : 70;
  const podparcie = podloga(a.start).z;
  const klipy = typ === "szperacz" ? ["walk1", "walk2", "attack1", "attack2"]
    : ["walk", "attack1", "attack2", ...(typ === "wojownik" ? ["attack3"] : [])];
  for (const klip of klipy) {
    while (bp.playList.length) bp.removeLast(); bp.queue(typ + "_" + klip); bp.blend = null;
    for (let i = 0; i < 120; i++) {
      bp.aktualizuj(1 / 60); const stopy = bounds(a.model).min.z;
      assert.ok(stopy > podparcie - 11 && stopy < podparcie + 43, typ + klip + ": siatka " + stopy);
    }
  }
  // Dwa lub trzy konkretne klipy ataku, każdy odbiera energię również podczas biegu.
  const losuj = Math.random;
  for (let i = 1; i <= (typ === "wojownik" ? 3 : 2); i++) {
    przenies(a.grupa.position.clone().add(V(65, 0, 0)));
    while (bp.playList.length) bp.removeLast();
    Math.random = () => (i - 0.5) / (typ === "wojownik" ? 3 : 2);
    a.stepFrame(); Math.random = losuj;
    assert.equal(bp.playList[0].name, typ + "_attack" + i);
    const energiaPrzed = G.energy; G.speed = 10; player.step();
    assert.equal(G.energy, energiaPrzed - 5);
  }
}
G.obrazenia = 0; G.energy = 100;
// Zamknięte wejścia mają kolizję; podejście otwiera obie pary.
for (const [i, d] of drzwi.entries()) {
  assert.ok(Z.model(d.proxy.name));
  const p = podloga(d.pozycja.clone().add(V(0, i ? -100 : 100, 0)));
  przenies(p); klatki(3);
  assert.ok(d.opened); assert.equal(Z.model(d.proxy.name), undefined);
  assert.ok(d.modele.every(o => o.userData.keyframePlayer.playing));
}
// Podłoga tunelu musi podtrzymywać gracza od środka, także pod jego dachem.
przenies(podloga(V(0, 2650, 20)), -90);
klawisz("ArrowUp", true);
for (let i = 0; i < 100; i++) {
  player.step(); gra.exitFrame(); Z.aktualizuj(1 / 30);
  assert.ok(master.position.z > 6 && master.position.z < 11, "Podparcie wewnątrz tunelu");
}
klawisz("ArrowUp", false);
assert.ok(master.position.y < 1730, "Bieg przez oba wejścia i cały tunel");
przenies(podloga(punkty.wynalazca)); klatki(160);
assert.equal(G.kompWystartowal, false); assert.equal(konce.length, 0, "Rozmowa bez artefaktów nie wygrywa");
// Ctrl z daleka nie wkłada artefaktów.
przenies(podloga(punkty.sala)); ctrl(); assert.ok(schowki.every(s => !G[s.flaga]));
const kolejnosc = process.argv.includes("--odwrotnie") ? [...schowki].reverse() : schowki;
for (const s of kolejnosc) {
  przenies(podloga(s.pozycja)); klatki(2);
  assert.equal(G[s.flaga], false); assert.equal(gra.overlay(3).obraz.toLowerCase(), "k00_pokoj_badan");
  ctrl(); assert.equal(G[s.flaga], true); assert.equal(s.model.userData.widocznosc, 1);
  assert.equal(gra.overlay(s.slot).loc[1], -100);
  assert.equal(s.schowek.userData.keyframePlayer.currentLoopState, 0);
  klatki(65); const czas = s.schowek.userData.keyframePlayer.czas;
  ctrl(); assert.equal(s.schowek.userData.keyframePlayer.czas, czas, "Schowek uruchamia się raz");
}
assert.equal(G.kompWystartowal, true); assert.equal(konce.length, 0, "Potrzebny powrót do wynalazcy");
const mapy = new Set();
for (let i = 0; i < 35; i++) { klatki(); mapy.add(energia.children.find(o => o.isMesh).material.map); }
assert.equal(mapy.size, 5, "Pięć klatek energii");
for (const a of przeciwnicy.filter(a => a.typ === "wojownik")) {
  const pozycja = a.grupa.position.clone(), ataki = a.ataki;
  a.stepFrame(); assert.ok(a.grupa.position.equals(pozycja)); assert.equal(a.ataki, ataki);
  assert.equal(a.model.userData.bonesPlayer.playing, false, "Komputer zatrzymuje wojowników");
}
// Finał działa także bez dwóch wcześniejszych rozmów i kończy się po pełnym happy.
wynalazca.rozmowy = 0;
przenies(podloga(punkty.wynalazca)); klatki();
assert.equal(G.finalRozpoczety, true); assert.equal(konce.length, 0);
klatki(90); assert.equal(konce.length, 0, "Animacja finału trwa ponad trzy sekundy");
klatki(30); assert.deepEqual(konce, ["wygrana"]);
klatki(100); wynalazca.stepFrame(); assert.equal(konce.length, 1, "Jedna wygrana");
// Ostatnie życie prowadzi do porażki.
gra.koniec = false; G.finalRozpoczety = false; G.lives = 1; G.energy = 5; G.obrazenia = 5;
player.step(); assert.equal(G.lives, 0); assert.equal(konce.at(-1), "przegrana");
console.log("OK: poziom 11 — ruch, skok, tempo, pauza, 10 patroli, 7 ataków, obrażenia, drzwi, trzy schowki, komputer, energia, wynalazca, finał i porażka" + (process.argv.includes("--odwrotnie") ? " (odwrotna kolejność)" : ""));




