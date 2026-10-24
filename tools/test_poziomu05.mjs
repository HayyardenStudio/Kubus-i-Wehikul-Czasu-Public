// Zadania dziedzińca szoguna na rzeczywistych modelach, bez GPU i dodatkowych zależności.
// node tools/test_poziomu05.mjs
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as THREE from "../strona/gra/js/vendor/three.module.min.js";
import { DaneW3d, Scena3d } from "../strona/gra/js/w3d.js";

const events = {};
globalThis.addEventListener = (n, fn) => { events[n] = fn; };
globalThis.Element = class {};
globalThis.localStorage = { getItem: () => null, setItem() {} };
const { uruchomPoziom } = await import("../strona/gra/js/poziom05.js");
const { przechwytujKlawisze } = await import("../strona/gra/js/silnik.js");
const katalog = new URL("../strona/gra/dane/05/", import.meta.url);
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
const { G, punkty, drzwi, brama, patrole, smok, player, promienie } = uruchomPoziom(gra, (co) => konce.push(co));
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

assert.equal(G.crystals_refs.length, 50); assert.equal(drzwi.length, 21);
assert.deepEqual(patrole.map((r) => r.trasa.length), [16,6,6,6,6,6,16]);
function graniceSiatki(o) {
 Z.swiat.updateMatrixWorld(true);
 o.traverse((c) => { if (c.isSkinnedMesh) { c.skeleton.update(); c.computeBoundingBox(); } });
 return new THREE.Box3().setFromObject(o);
}
// Początek rozmowy i atak nie mogą odrywać smoka od drewnianego tarasu.
// Badamy widoczną siatkę, bo samo model.position pozostawało poprawne także przy błędzie.
const taras = promienie(() => Z.modelsUnderRay(
 new THREE.Vector3(punkty.smok.x, punkty.smok.y, 1000), new THREE.Vector3(0, 0, -1)))
 .find((h) => h.model.name.includes("podloze")).isectPosition.z;
const smokBaza = smok.position.clone(), smokBP = smok.userData.bonesPlayer;
assert.ok(Math.abs(graniceSiatki(smok).min.z - taras) < 2);
for (const anim of ["smok_ambient1", "smok_attack1", "smok_ambient1", "smok_attack1", "smok_ambient2"]) {
 while (smokBP.playList.length) smokBP.removeLast();
 smokBP.queue(anim, 1);
 for (let i = 0; i < 120; i++) {
  smokBP.aktualizuj(1 / 30);
  const dol = graniceSiatki(smok).min.z;
  assert.ok(dol > taras - 5.5 && dol < taras + 2, `${anim}: dół smoka ${dol}, taras ${taras}`);
  assert.ok(smok.position.distanceTo(smokBaza) < 0.001);
 }
}
while (smokBP.playList.length) smokBP.removeLast();
smokBP.queue("smok_fly"); smokBP.blend = null;
let goraLotu = taras;
for (let i = 0; i < 150; i++) {
 smokBP.aktualizuj(1 / 30); goraLotu = Math.max(goraLotu, graniceSiatki(smok).min.z);
}
assert.ok(goraLotu > taras + 20, "Właściwy lot nadal unosi smoka");
assert.ok(smok.position.distanceTo(smokBaza) < 0.001);
while (smokBP.playList.length) smokBP.removeLast();
klatki(30);
assert.ok(Math.abs(Z.model("master").position.z - 1.467) < 1);
const y = Z.model("master").position.y;
klawisz("ArrowUp", true); klatki(15); klawisz("ArrowUp", false);
assert.ok(Z.model("master").position.y > y + 100);
przenies(punkty.start); klawisz("Space", true); klatki(); klawisz("Space", false);
let szczyt = 0;
for(let i=0;i<80;i++) { klatki(); szczyt = Math.max(szczyt,Z.model("master").position.z); }
assert.ok(szczyt>30); assert.ok(Math.abs(Z.model("master").position.z-1.467)<1);
klawisz("Escape", true); klatki(); klawisz("Escape", false); assert.equal(konce.pop(),"menu");
klawisz("Equal", true); klatki(3); klawisz("Equal", false); assert.equal(gra.tempo,35);
klawisz("Minus", true); klatki(3); klawisz("Minus", false); assert.equal(gra.tempo,30);
// Stopy obu typów przeciwników pozostają przy podłożu w chodzie i ataku.
for (const typ of ["samuraj", "kungfu"]) {
 const r = patrole.find((r) => r.typ === typ), bp = r.model.userData.bonesPlayer;
 const podloze = r.model.position.z - r.wysokosc;
 for (const anim of [typ + "_walk", typ + (typ === "samuraj" ? "_attack" : "_attack1")]) {
  while (bp.playList.length) bp.removeLast();
  bp.queue(anim, 1); bp.blend = null;
  for (let i = 0; i < 90; i++) {
   bp.aktualizuj(1 / 30); Z.swiat.updateMatrixWorld(true);
   r.model.traverse((c) => { if (c.isSkinnedMesh) { c.skeleton.update(); c.computeBoundingBox(); } });
   const dol = new THREE.Box3().setFromObject(r.model).min.z;
   assert.ok(dol > podloze - 1 && dol < podloze + 10, `${typ}: stopy ${dol}, podłoże ${podloze}`);
  }
 }
 while (bp.playList.length) bp.removeLast();
}
// Pełne trasy, stała szybkość 4 jednostki/klatkę i kolizje pod postaciami.
przenies(new THREE.Vector3(10000,10000,0));
const odwiedzone=patrole.map(()=>new Set());
for(let i=0;i<3600;i++) {
 const przed = patrole.map(r=>r.model.position.clone()); klatki();
 patrole.forEach((r,j)=>{
  odwiedzone[j].add(r.waypoint);
  assert.ok(Math.abs(r.model.position.distanceTo(przed[j])-4)<0.001);
  assert.ok(Math.abs(r.proxy.position.z-r.model.position.z+r.wysokosc)<0.001);
  if (i > 30 && i % 12 === 0) {
   // Oś głowy z rzeczywistych kości sprawdza kierunek widocznej postaci,
   // niezależnie od osi, której kod używa do przesunięcia modelu.
   const sz = r.model.userData.szkielet;
   const bone = (n) => sz.kosci.find((b) => b.name === n).getWorldPosition(new THREE.Vector3());
   const twarz = bone(r.typ === "samuraj" ? "Jaw" : "JAW").sub(bone("Head")); twarz.z = 0;
   const ruch = r.model.position.clone().sub(przed[j]); ruch.z = 0;
   assert.ok(twarz.normalize().dot(ruch.normalize()) > 0.8, r.model.name + ": twarz skierowana zgodnie z chodem");
  }
 });
}
assert.deepEqual(odwiedzone.map(s=>s.size),patrole.map(r=>r.trasa.length));
// Przejścia w obu osiach: zamknięte drzwi zatrzymują bieg, Ctrl otwiera drogę.
for (const i of [0, 4, 8, 9, 10, 19]) {
 const d = drzwi[i], box = new THREE.Box3().setFromObject(d.proxy);
 const axis = box.max.x - box.min.x < box.max.y - box.min.y ? "x" : "y";
 const p = d.pozycja.clone(); p[axis] += 120;
 p.z = promienie(() => Z.modelsUnderRay(p, new THREE.Vector3(0, 0, -1)))
  .find((h) => h.model.name.includes("podloze")).isectPosition.z;
 przenies(p); G.car_rotation = axis === "x" ? 180 : 270;
 klawisz("ArrowUp", true); klatki(30); klawisz("ArrowUp", false); G.speed = 0;
 assert.ok(Z.model("master").position[axis] > d.pozycja[axis], "Zamknięte drzwi blokują bieg");
 ctrl(); klatki(90);
 klawisz("ArrowUp", true); klatki(40); klawisz("ArrowUp", false); G.speed = 0;
 assert.ok(Z.model("master").position[axis] < d.pozycja[axis] - 100, d.model.name + ": przejście po otwarciu");
}
// Ctrl na starcie nie otwiera pozostałych drzwi; wszystkie 21 skrzydeł działa z bliska.
const otwartePrzed = drzwi.map((d) => d.opened);
przenies(punkty.start); ctrl(); assert.deepEqual(drzwi.map((d) => d.opened), otwartePrzed);
for(const d of drzwi) {
 przenies(d.pozycja.clone().add(new THREE.Vector3(0,0,-35))); ctrl();
 assert.ok(d.opened,d.model.name); klatki(70);
 assert.ok(d.model.position.distanceTo(d.baza)>50,d.model.name+" przesuwa się");
 assert.ok(d.proxy.position.clone().sub(d.pozycja).distanceTo(d.model.position.clone().sub(d.baza))<0.01);
 const koniec=d.model.position.clone(); ctrl(); klatki(30);
 assert.ok(d.model.position.distanceTo(koniec)<0.01,"Otwarte drzwi nie wracają");
}
// Przed zebraniem kompletu smok atakuje, a brama pozostaje zamknięta.
przenies(punkty.smok.clone().add(new THREE.Vector3(0,-100,-79)));
G.energy=100;
for(let i=0;i<300 && G.energy===100;i++) klatki();
assert.ok(G.energy<100); assert.equal(G.wasFlying,false);
assert.ok(brama.every(o=>o.userData.keyframePlayer.czas===0));
przenies(punkty.koniec); klatki(3); assert.deepEqual(konce,[]);
// Każdy kryształ daje dokładnie jeden punkt. Licznik bitmapowy przechodzi 09 -> 10 -> 50.
const pozycje=G.crystals_positions.map(p=>p.clone());
for(let i=0;i<pozycje.length;i++) {
 przenies(pozycje[i]); klatki();
 assert.equal(G.crystals_number,i+1,"Zbieranie "+i);
 klatki(); assert.equal(G.crystals_number,i+1);
 assert.equal(Z.model(G.crystals_refs[i]),undefined);
 assert.equal(gra.overlay(4).obraz,"L"+Math.trunc((i+1)/10));
 assert.equal(gra.overlay(5).obraz,"P"+(i+1)%10);
}
przenies(punkty.smok.clone().add(new THREE.Vector3(0,-100,0)));
for(let i=0;i<300 && !G.wasFlying;i++) klatki();
assert.equal(G.wasFlying,true); klatki(90);
assert.ok(brama.every(o=>o.userData.keyframePlayer.czas>0));
assert.equal(Z.model("smokproxy").parent,null);
przenies(punkty.koniec); klatki(3); assert.deepEqual(konce,["wygrana"]);
// Samuraj i mistrz kung-fu zatrzymują patrol i zadają obrażenia.
for(const typ of ["samuraj","kungfu"]) {
 gra.koniec=false; const r=patrole.find(r=>r.typ===typ);
 przenies(r.model.position.clone().add(new THREE.Vector3(0,0,-r.wysokosc)));
 G.energy=100;
 for(let i=0;i<180 && G.energy===100;i++) klatki();
 assert.ok(G.energy<100,typ+" trafia");
}
G.energy=5; G.lives=1;
const r=patrole[0]; przenies(r.model.position.clone().add(new THREE.Vector3(0,0,-r.wysokosc)));
for(let i=0;i<300 && !gra.koniec;i++) klatki();
assert.equal(G.lives,0); assert.equal(konce.at(-1),"przegrana");
klatki(30); assert.equal(G.lives,0);
console.log("OK: poziom 5 — ruch, skok, tempo, pauza, 7 pełnych patroli i kierunek twarzy, 21 drzwi i kolizje, 50 kryształów, licznik, smok na tarasie, właściwy lot, brama, wygrana i obrażenia.");
