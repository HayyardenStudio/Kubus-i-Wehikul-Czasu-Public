// Zadania komnaty szoguna na rzeczywistych modelach, bez GPU i dodatkowych zależności.
// node tools/test_poziomu07.mjs
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as THREE from "../strona/gra/js/vendor/three.module.min.js";
import { DaneW3d, Scena3d } from "../strona/gra/js/w3d.js";

const events = {};
globalThis.addEventListener = (n, fn) => { events[n] = fn; };
globalThis.Element = class {};
globalThis.localStorage = { getItem: () => null, setItem() {} };
const { uruchomPoziom } = await import("../strona/gra/js/poziom07.js");
const { przechwytujKlawisze, Gra } = await import("../strona/gra/js/silnik.js");
const katalog = new URL("../strona/gra/dane/07/", import.meta.url);
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
const { G, punkty, drzwi, schody, wieko, portal, oko, szogun, ninja, player, promienie } = uruchomPoziom(gra, (co) => konce.push(co));
const Z = gra.member("ziemia");
// Ten etap oświetlają trzy reflektory; sam ambient zostawiał schody czarne.
const reflektory = gra.scena.children.filter((o) => o.isSpotLight);
assert.deepEqual(reflektory.map((o) => o.name), ["Fspot01", "Fspot02", "Fspot03"]);
for (const [i, s] of reflektory.entries()) {
  const def = Z.dane.json.lights.find((l) => l.name === s.name);
  const wezel = Z.wezly.get(s.name.toLowerCase());
  wezel.updateWorldMatrix(true, false);
  assert.ok(s.position.distanceTo(new THREE.Vector3().setFromMatrixPosition(wezel.matrixWorld)) < 0.001);
  const cel = s.target.position.clone().sub(s.position).normalize();
  const kierunek = new THREE.Vector3(0, 0, -1).transformDirection(wezel.matrixWorld);
  assert.ok(cel.dot(kierunek) > 0.99999);
  assert.ok(Math.abs(s.intensity / Math.PI - [1.8, 1, 0.7][i]) < 0.00001);
  assert.ok(Math.abs(s.angle * 180 / Math.PI - 89.75) < 0.00001);
  assert.equal(s.decay, 0); assert.equal(s.penumbra, 0);
  assert.deepEqual(s.color.toArray(), def.color);
}
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


assert.equal(drzwi.length, 8); assert.equal(schody.length, 4); assert.equal(ninja.length, 8);
assert.equal(G.crystals_positions.length, 20); assert.equal(G.crystals_number, 0);
assert.equal(portal.userData.widocznosc, 0); assert.equal(oko.visible, false);
klatki(30);
assert.equal(gra.kamera.fov, 60);
assert.equal(gra.scena.fog.isFog, true);
assert.equal(gra.scena.fog.near, 2700); assert.equal(gra.scena.fog.far, 3000);
function sprawdzKadr() {
  gra.kamera.updateMatrixWorld(true);
  const stopy = Z.model("master").position.clone(), glowa = stopy.clone().add(new THREE.Vector3(0, 0, 100));
  for (const p of [stopy, glowa]) {
    p.project(gra.kamera);
    assert.ok(Math.abs(p.y) < 0.97, "Głowa i stopy mieszczą się w kadrze");
  }
}
sprawdzKadr(); // Kamera skrócona przez ścianę za wejściem.
G.car_rotation = 180; klatki(60); sprawdzKadr();
assert.ok(Math.abs(gra.kamera.position.z - Z.model("master").position.z - 75) < 0.1);
G.car_rotation = 270;
const startZ = Z.model("master").position.z, startY = Z.model("master").position.y;
klawisz("ArrowUp", true); klatki(12); klawisz("ArrowUp", false);
assert.ok(Z.model("master").position.y < startY - 80, "Bieg od wejścia do komnaty");
przenies(punkty.start); klawisz("Space", true); klatki(); klawisz("Space", false);
let szczyt = -Infinity;
for (let i=0; i<80; i++) { klatki(); szczyt = Math.max(szczyt, Z.model("master").position.z); }
assert.ok(szczyt > startZ + 30); assert.ok(Math.abs(Z.model("master").position.z - startZ) < 1);
klawisz("Escape", true); klatki(); klawisz("Escape", false); assert.equal(konce.pop(), "menu");
klawisz("Equal", true); klatki(3); klawisz("Equal", false); assert.equal(gra.tempo, 35);
klawisz("Minus", true); klatki(3); klawisz("Minus", false); assert.equal(gra.tempo, 30);

// Nie można wygrać ani zabrać nagrody z zamkniętej szkatułki.
przenies(punkty.koniec); klatki(10); assert.deepEqual(konce, []);
przenies(punkty.oko); ctrl(); klatki(100);
assert.equal(G.haveOko, false); assert.equal(G.haveLuk, true); assert.equal(G.szkatulkaOtwarta, false);
assert.equal(wieko.userData.keyframePlayer.czas, 0);
// Pierwsze Ctrl działa od czasu zero; wcześniejsze drzwi nie blokują później schodów.
przenies(drzwi[0].pozycja); ctrl(); assert.equal(drzwi[0].opened, true);
assert.equal(G.schodyOtwarte, false);

// Pościg działa tylko w strefie, zatrzymuje się przed murem i uruchamia obrażenia.
const n = ninja[1], bp = n.model.userData.bonesPlayer;
const czysc = (bp) => { while(bp.playList.length) bp.removeLast(); bp.blend=null; };
przenies(n.start.clone().add(new THREE.Vector3(200,0,0))); czysc(bp);
const przed = n.model.position.clone(); klatki(15);
assert.ok(n.model.position.distanceTo(przed)>45, "Ninja biegnie do gracza");
const twarz = new THREE.Vector3(0,-1,0).applyQuaternion(n.model.quaternion); twarz.z=0;
const ruch = n.model.position.clone().sub(przed); ruch.z=0;
assert.ok(twarz.normalize().dot(ruch.normalize())>0.25,"Ninja patrzy w kierunku biegu");
przenies(n.start.clone().add(new THREE.Vector3(1200,0,0))); czysc(bp);
const daleko = n.model.position.clone(); klatki(10); assert.ok(n.model.position.distanceTo(daleko)<0.01);
const cp=gra.member("kubus_proxy"),mur=Z.cloneModelFromCastmember("test_mur",cp.modele()[0].name,cp);
mur.position.copy(n.model.position).x += 60; mur.position.z -= 42;
przenies(n.model.position.clone().add(new THREE.Vector3(200,0,-42))); czysc(bp);
const przyMurze=n.model.position.clone();klatki(10);assert.ok(n.model.position.distanceTo(przyMurze)<0.01,"Mur blokuje pościg");mur.removeFromParent();
przenies(n.model.position.clone().add(new THREE.Vector3(60,0,-42)));czysc(bp);
G.energy=100;G.speed=0;klatki(4);assert.ok(G.energy<100,"Atak odbiera energię");
assert.ok(bp.playList[0]?.name.startsWith("ninja_attack"));
przenies(new THREE.Vector3(10000,10000,0));
function granice(o) {
 Z.swiat.updateMatrixWorld(true);o.traverse(c=>{if(c.isSkinnedMesh){c.skeleton.update();c.computeBoundingBox();}});
 return new THREE.Box3().setFromObject(o);
}
for(const anim of ["ninja_run",...[1,2,3,4,5].map(i=>"ninja_attack"+i)]) {
 czysc(bp);bp.queue(anim);
 for(let i=0;i<90;i++){bp.aktualizuj(1/30);const z=granice(n.model).min.z;assert.ok(z>-52&&z<-22,`${anim}: stopy ${z}`);}
}
czysc(bp);
for(const anim of ["szogun_ambient1","szogun_show","szogun_portal"]) {
 const sb=szogun.userData.bonesPlayer;czysc(sb);sb.queue(anim);
 for(let i=0;i<130;i++){sb.aktualizuj(1/30);const z=granice(szogun).min.z;assert.ok(z>45&&z<48,`${anim}: stopy ${z}`);}
 czysc(sb);
}

// Zbieranie każdego przedmiotu raz, również na niższej i wyższej podłodze.
const strzaly = G.crystals_positions.map(p=>p.clone());
for (let i=0; i<strzaly.length; i++) {
  const p = strzaly[i].clone();
  p.z = promienie(()=>Z.modelsUnderRay(p.clone().add(new THREE.Vector3(0,0,20)),new THREE.Vector3(0,0,-1)))
    .find(h=>h.model.name.includes("podloze"))?.isectPosition.z ?? p.z;
  przenies(p); klatki(2); assert.equal(G.crystals_number, i+1);
  assert.equal(Z.model(G.crystals_refs[i]), undefined); klatki(2); assert.equal(G.crystals_number, i+1);
}
assert.equal(G.schodyOtwarte, true); assert.ok(drzwi.every(d=>d.opened));
assert.equal(gra.overlay(5).obraz,"L2"); assert.equal(gra.overlay(6).obraz,"P0");
assert.equal(gra.overlay(2).obraz,"image_lukikolczan1");
assert.equal(Z.model("kolizja_podest_mur").parent, null);
przenies(punkty.start); klatki(100);
for (const d of drzwi) {
  assert.equal(d.model.userData.keyframePlayer.czas, d.model.userData.keyframePlayer.ruch.dlugosc);
  assert.ok(d.proxy.position.distanceTo(d.model.position) < 0.01);
  assert.ok(d.proxy.quaternion.angleTo(d.model.quaternion) < 0.001);
}
for (const s of schody) {
  assert.equal(s.a.userData.keyframePlayer.czas,s.a.userData.keyframePlayer.ruch.dlugosc);
  assert.ok(Math.abs(s.proxy.position.z - s.a.position.z - 50)<0.01);
}

// Cztery podejścia od dolnej podłogi, przez wysunięte schody i otwarte drzwi.
const aktorzy=gra.aktorzy;gra.aktorzy=[];ninja.forEach(n=>n.proxy.removeFromParent());
for(const [x,y,rot,os,znak,cel] of [[-138,850,270,"y",-1,400],[-138,-850,90,"y",1,-400],
 [720,0,180,"x",-1,250],[-1000,0,0,"x",1,-500]]) {
 przenies(new THREE.Vector3(x,y,-40.2632));G.car_rotation=rot;G.speed=0;
 klawisz("ArrowUp",true);klatki(65);klawisz("ArrowUp",false);G.speed=0;
 assert.ok(Z.model("master").position[os]*znak>cel*znak,"Przejście schodami do środka");
 assert.ok(Z.model("master").position.z>25,"Wejście na podest");
}
gra.aktorzy=aktorzy;ninja.forEach(n=>Z.swiat.add(n.proxy));

// Ukończenie animacji przekazania łuku, otwarcie Ctrl i odbiór dopiero po animacji.
przenies(punkty.oko); klatki(1); assert.equal(G.haveLuk,true);
for (let i=0; i<300 && G.haveLuk; i++) klatki();
assert.equal(G.haveLuk,false); assert.equal(G.haveOko,false);
ctrl(); assert.equal(G.szkatulkaOtwarta,true); assert.equal(G.haveOko,false);
przenies(punkty.start); klatki(100); assert.equal(G.haveOko,false,"Odbiór wymaga bliskości");
przenies(punkty.oko); klatki(2); assert.equal(G.haveOko,true); assert.equal(portal.userData.widocznosc,1);
assert.equal(gra.overlay(2).obraz,"okosmoka"); assert.deepEqual(gra.overlay(2).loc,[280,12]);
przenies(punkty.koniec); klatki(3); assert.deepEqual(konce,["wygrana"]);
// Utrata ostatniego życia kończy grę tylko raz.
gra.koniec=false;G.lives=1;G.energy=5;G.obrazenia=5;przenies(punkty.start);klatki(4);
assert.deepEqual(konce,["wygrana","przegrana"]);assert.equal(G.lives,0);
console.log("Poziom 7: ruch, skok, menu, tempo, 20 strzał, drzwi, schody, szogun, szkatułka, Oko Smoka i portal — OK");


