// Hol laboratorium na rzeczywistych modelach, bez GPU i dodatkowych zależności.
// node tools/test_poziomu10.mjs
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as THREE from "../strona/gra/js/vendor/three.module.min.js";
import { DaneW3d, Scena3d } from "../strona/gra/js/w3d.js";

const events = {};
globalThis.addEventListener = (n, fn) => { events[n] = fn; };
globalThis.Element = class {};
globalThis.localStorage = { getItem: () => null, setItem() {} };
const { uruchomPoziom } = await import("../strona/gra/js/poziom10.js");
const { przechwytujKlawisze, Gra } = await import("../strona/gra/js/silnik.js");
const katalog = new URL("../strona/gra/dane/10/", import.meta.url);
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


const { G, V, punkty, drzwi, koncowe, krysztaly, pajaki, raptory, player, promienie, ryby } = stan;
const Z = gra.member("ziemia"), master = Z.model("master");
function klawisz(code, tak) { events[tak ? "keydown" : "keyup"]({ code, preventDefault() {} }); }
function klatki(n = 1) {
  for (let i = 0; i < n; i++) {
    if (gra.koniec) break;
    gra.milliSeconds += 1000 / gra.tempo;
    for (const fn of gra.timery) fn();
    for (const a of gra.aktorzy) a.stepFrame?.();
    gra.exitFrame(); Z.aktualizuj(1 / gra.tempo);
  }
}
function przenies(p, obrot = -180) { G.speed = 0; player.reset(p, obrot); }
function podloga(p) {
  const h = promienie(() => Z.modelsUnderRay(p.clone().add(V(0, 0, 60)), V(0, 0, -1)))
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
assert.equal(krysztaly.length, 35); assert.equal(drzwi.length, 8);
assert.deepEqual(pajaki.map(a => a.trasa.length), [5, 6, 6]);
assert.deepEqual(raptory.map(a => a.trasa.length), [5, 5, 2]);
assert.equal(ryby.length, 3);
assert.equal(gra.scena.children.filter(o => o.isPointLight).length, 4);
assert.equal(gra.kamera.fov, 60); assert.equal(gra.kamera.near, 8); assert.equal(gra.kamera.far, 4000);
assert.equal(gra.overlay(7).obraz, "miecz01"); assert.equal(gra.overlay(8).obraz, "okosmoka01"); assert.equal(gra.overlay(9).obraz, "amuletslonca01");
for (const d of [...drzwi, koncowe]) for (const o of d.modele) assert.equal(o.userData.keyframePlayer.playing, false);
klatki(45);
assert.equal(gra.overlay(6).obraz, "K01_hol_labolatorium");
const poczatek = master.position.clone();
klawisz("ArrowUp", true); klatki(12); klawisz("ArrowUp", false);
assert.ok(master.position.x < poczatek.x - 80, "Bieg do wnętrza holu");
przenies(podloga(punkty.start)); klatki(3); const z = master.position.z;
klawisz("Space", true); klatki(); klawisz("Space", false);
let szczyt = z;
for (let i = 0; i < 80; i++) { klatki(); szczyt = Math.max(szczyt, master.position.z); }
assert.ok(szczyt > z + 30); assert.ok(Math.abs(master.position.z - z) < 1);
klawisz("Escape", true); klatki(); klawisz("Escape", false); assert.equal(konce.pop(), "menu");
klawisz("Equal", true); klatki(3); klawisz("Equal", false); assert.equal(gra.tempo, 35);
klawisz("Minus", true); klatki(3); klawisz("Minus", false); assert.equal(gra.tempo, 30);
// Górna skrzynka stosu: skok w górę i spóźnione wejście podczas opadania.
// Wcześniej opóźnienie 9/12 klatek pozwalało przejść przez jej bok.
for (const y of [-5718, -5697, -5678]) for (const opoznienie of [0, 3, 6, 9, 12]) {
  przenies(podloga(V(925, y, 300)), 180);
  for (let i = 0; i < 4; i++) player.step();
  klawisz("Space", true); player.step(); klawisz("Space", false);
  for (let i = 0; i < opoznienie; i++) player.step();
  klawisz("ArrowUp", true);
  for (let i = 0; i < 30; i++) {
    player.step();
    const p = master.position;
    assert.ok(!(p.x > 814 && p.x < 884 && p.z > 288 && p.z < 354),
      `Przenikanie górnej skrzynki: y=${y}, opóźnienie=${opoznienie}, ${p.toArray()}`);
    if (p.x < 860) { klawisz("ArrowUp", false); G.speed = 0; break; }
  }
  klawisz("ArrowUp", false); G.speed = 0;
  for (let i = 0; i < 45; i++) player.step();
  if (opoznienie <= 6) {
    assert.ok(master.position.x < 860 && Math.abs(master.position.z - 356.4) < 1,
      "Poprawny skok kończy się na szczycie stosu");
  } else {
    assert.ok(master.position.x >= 884 && master.position.z < 288,
      "Zbyt niski skok zatrzymuje się obok górnej skrzynki");
  }
}
przenies(podloga(punkty.start)); klatki(3);
// Samo wejście za bramę, ani Ctrl bez ogniw, nie kończy zadania.
przenies(punkty.koniec); klatki(); assert.equal(konce.length, 0);
przenies(podloga(punkty.konsola)); klatki(); ctrl(); assert.equal(G.kompWystartowal, false);
assert.equal(gra.overlay(6).obraz, "K02_hol_labolatorium");
assert.ok(Z.model(koncowe.proxy.name));
// Wszystkie animacje ataku i chodu zachowują stopy przy podłodze.
for (const a of [pajaki[0], raptory[0]]) {
  const typ = pajaki.includes(a) ? "pajak" : "raptor", bp = a.model.userData.bonesPlayer;
  const podparcie = podloga(a.start).z;
  for (const klip of ["walk", "attack1", "attack2", "attack3"]) {
    while (bp.playList.length) bp.removeLast(); bp.queue(typ + "_" + klip); bp.blend = null;
    for (let i = 0; i < 90; i++) {
      bp.aktualizuj(1 / 60); const stopy = bounds(a.model).min.z;
      assert.ok(stopy > podparcie - 3 && stopy < podparcie + 5, typ + klip + ": stopy " + stopy);
    }
  }
}
// Każdy przeciwnik przechodzi całą własną trasę i patrzy w kierunku ruchu.
przenies(V(0, 5000, 8));
for (let i = 0; i < 20000 && [...pajaki, ...raptory].some(a => a.odwiedzone.size < a.trasa.length); i++) {
  for (const a of [...pajaki, ...raptory]) a.stepFrame();
}
for (const a of [...pajaki, ...raptory]) {
  assert.equal(a.odwiedzone.size, a.trasa.length, a.model.name + ": pełny patrol");
  const przod = V(1, 0, 0).applyQuaternion(a.grupa.quaternion); a.model.updateWorldMatrix(true, false);
  assert.ok(V(0, -1, 0).transformDirection(a.model.matrixWorld).dot(przod) > 0.999);
}
// Trzy rodzaje ataku zadają po 5 obrażeń na klip również podczas biegu.
for (const a of [...pajaki, ...raptory]) {
  const bp = a.model.userData.bonesPlayer;
  przenies(podloga(a.grupa.position.clone().setZ(8)).add(V(100, 0, 0)));
  for (let atak = 1; atak <= 3; atak++) {
    const losuj = Math.random; Math.random = () => (atak - 0.5) / 3;
    while (bp.playList.length) bp.removeLast(); G.energy = 100; G.obrazenia = 0;
    a.stepFrame(); Math.random = losuj;
    assert.ok(bp.playList[0].name.endsWith("attack" + atak));
    G.speed = 10; player.step(); assert.equal(G.energy, 95);
    a.stepFrame(); player.step(); assert.equal(G.energy, 95, "Nie naliczaj ciosu co klatkę");
  }
}
przenies(podloga(punkty.start));
// Automatyczne drzwi otwierają się podczas przechodzenia przez rzeczywiste otwory.
function przejscie(d, znak = 1, otwarte = true) {
  d.proxy.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(d.proxy), rozmiar = box.getSize(V(0, 0, 0));
  const os = rozmiar.x < rozmiar.y ? "x" : "y", srodek = box.getCenter(V(0, 0, 0));
  const start = srodek.clone(); start[os] -= znak * 220; start.z = box.min.z;
  przenies(podloga(start), os === "x" ? (znak > 0 ? 0 : 180) : (znak > 0 ? 90 : -90));
  klawisz("ArrowUp", true);
  if (d === drzwi[6] && znak === 1) {
    // Z windy na podwyższony próg śluzy trzeba wskoczyć.
    klatki(12); klawisz("Space", true); klatki(); klawisz("Space", false); klatki(37);
  } else klatki(50);
  klawisz("ArrowUp", false);
  if (otwarte) assert.ok((master.position[os] - srodek[os]) * znak > (d === koncowe ? 70 : 90), d.modele[0].name + ": przejście " + znak + ", " + master.position.toArray() + ", otwarte=" + d.opened);
  else assert.ok((master.position[os] - srodek[os]) * znak < -50, "Zamknięta brama blokuje bieg");
}
przejscie(koncowe, -1, false);
for (const d of drzwi) {
  przejscie(d); assert.equal(d.opened, true); assert.equal(Z.model(d.proxy.name), undefined);
  if (d !== drzwi[7]) przejscie(d, -1); // Ósma śluza wychodzi z galerii na niższy magazyn.
}
// Każde ogniwo da się zebrać z jego powierzchni podparcia, tylko raz.
for (const k of process.argv.includes("--odwrotnie") ? [...krysztaly].reverse() : krysztaly) {
  przenies(podloga(k.pozycja)); klatki(3); const licznik = G.crystals_number;
  assert.equal(k.zebrany, true, k.model.name + ": zbieranie z podłoża");
  assert.equal(Z.model(k.model.name), undefined); klatki(3); assert.equal(G.crystals_number, licznik);
}
assert.equal(G.crystals_number, 35); assert.equal(gra.overlay(4).obraz, "L3"); assert.equal(gra.overlay(5).obraz, "P5");
przenies(podloga(punkty.konsola)); klatki();
assert.equal(gra.overlay(6).obraz, "K03_hol_labolatorium"); assert.equal(G.kompWystartowal, false);
ctrl(); assert.equal(G.kompWystartowal, true); assert.ok(Z.model(koncowe.proxy.name), "Kolizja przez pierwszą sekundę otwierania");
klatki(35); assert.equal(Z.model(koncowe.proxy.name), undefined); klatki(110);
przejscie(koncowe, -1);
assert.equal(konce.pop(), "wygrana"); assert.equal(gra.koniec, true);
gra.exitFrame(); assert.equal(konce.length, 0);
gra.koniec = false; G.lives = 1; G.energy = 5; G.obrazenia = 5; player.step();
assert.equal(konce.pop(), "przegrana"); assert.equal(G.lives, 0); assert.equal(gra.koniec, true);
console.log("Poziom 10 OK: 35 ogniw, konsola, 8 drzwi, 3 pająki, 3 raptory, animacje, ruch, HUD, wygrana i porażka" + (process.argv.includes("--odwrotnie") ? " (odwrotna kolejność)" : ""));

