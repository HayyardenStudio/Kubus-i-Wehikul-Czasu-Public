// Trzy próby na rzeczywistych modelach, bez GPU i dodatkowych zależności.
// node tools/test_poziomu09.mjs
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as THREE from "../strona/gra/js/vendor/three.module.min.js";
import { DaneW3d, Scena3d } from "../strona/gra/js/w3d.js";

const events = {};
globalThis.addEventListener = (n, fn) => { events[n] = fn; };
globalThis.Element = class {};
globalThis.localStorage = { getItem: () => null, setItem() {} };
const { uruchomPoziom } = await import("../strona/gra/js/poziom09.js");
const { przechwytujKlawisze, Gra, pozycjaSwiat } = await import("../strona/gra/js/silnik.js");
const katalog = new URL("../strona/gra/dane/09/", import.meta.url);
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

const { G, V, punkty, proby, drzwi, podest, demony, pumy, kaplan, krolowa, ksiaze, player, promienie } = stan;
const Z = gra.member("ziemia"), master = Z.model("master");
function klawisz(code, tak) { events[tak ? "keydown" : "keyup"]({ code, preventDefault() {} }); }
function klatki(n = 1) {
  for (let i = 0; i < n; i++) {
    gra.milliSeconds += 1000 / gra.tempo;
    for (const fn of gra.timery) fn();
    for (const a of gra.aktorzy) a.stepFrame?.();
    gra.exitFrame(); Z.aktualizuj(1 / gra.tempo);
  }
}
function przenies(p, obrot = -90) { G.speed = 0; player.reset(p, obrot); }
function podloga(p) {
  return promienie(() => Z.modelsUnderRay(p.clone().add(V(0, 0, 150)), V(0, 0, -1)))
    .find(h => h.model.name.includes("podloze") && h.isectNormal.z > 0.65).isectPosition.clone();
}
function ctrl() { klawisz("ControlLeft", true); klatki(2); klawisz("ControlLeft", false); klatki(2); }
function przy(p) { przenies(podloga(p)); klatki(); }
przechwytujKlawisze(true);
assert.equal(demony.length, 5); assert.equal(pumy.length, 1);
assert.deepEqual(demony.map(d => d.trasa.length), [4, 4, 8, 8, 8]);
assert.equal(proby.length, 3); assert.equal(gra.kamera.fov, 60);
assert.equal(gra.kamera.far, 4000); assert.equal(gra.kamera.near, 8);
// Kamienna belka i wewnętrzne boki czterech framug mają właściwe materiały.
for (const o of Z.model("KsiazeFramuga").children.filter(o => o.isMesh)) {
  assert.equal(o.material.name, ["futryna_in01", "futryna_belka", "futryna_in02"][o.userData.indeks % 3]);
  const def = Z.dane.shaderyDef.get(o.material.name.toLowerCase());
  assert.ok(def.layers.some(l => Z.dane.json.textures[l.texture]), "Tekstura framugi jest w oryginalnych danych");
}
const bokPodestow = Z.model("slonce_podloga").children.find(o => o.isMesh && o.userData.indeks === 1);
assert.equal(bokPodestow.material.name, "ornament_slonca");
assert.equal(Z.model("slonce_podloga").children.find(o => o.isMesh && o.userData.indeks === 0).material.name, "posadzka01a");
// Widoczna lawa ma pokrywać komnatę, zamiast pozostać w przesuniętej pozie wiązania.
const lawaModel = Z.model("Group01"), lawaAnim = lawaModel.userData.bonesPlayer;
assert.ok(lawaAnim?.playing); assert.equal(lawaAnim.playList[0].loop, true);
const lawaPozycja = lawaModel.position.clone(), wysokosci = [];
for (let i = 0; i < 360; i++) {
  lawaAnim.aktualizuj(1 / 30); Z.swiat.updateMatrixWorld(true);
  lawaModel.traverse(o => { if (o.isSkinnedMesh) {
    o.skeleton.update(); o.computeBoundingBox(); o.computeBoundingSphere();
  } });
  for (const y of [-1000, -1500, -2000, -2500, -3000, -3500]) {
    const ray = new THREE.Raycaster(V(0, y, 0), V(0, 0, -1));
    const h = ray.intersectObject(lawaModel, true)[0];
    assert.ok(h, `Lawa pokrywa komnatę przy Y=${y}, klatka ${i}`);
    assert.ok(h.point.z < -480 && h.point.z > -700, "Powierzchnia poniżej chodników");
    if (y === -2000) wysokosci.push(h.point.z);
  }
  assert.ok(lawaModel.position.distanceTo(lawaPozycja) < 0.001, "Animacja nie przesuwa całej komnaty");
}
assert.ok(Math.max(...wysokosci) - Math.min(...wysokosci) > 10, "Lawa pulsuje w oryginalnej animacji");
for (const d of Object.values(drzwi)) for (const o of d.modele) assert.equal(o.userData.keyframePlayer.playing, false);
assert.ok(proby.every(t => !t.zebrany && !t.wlozony && t.moc.userData.widocznosc === 0));
for (const i of [4, 5, 6]) assert.equal(gra.overlay(i).loc[1], -100);
// Każdy demon stawia stopy przy podłodze w obu chodach i obu atakach.
for (const d of demony) {
  const bp = d.model.userData.bonesPlayer, podloze = podloga(d.start).z;
  for (const klip of ["demon_walk1", "demon_walk2", "demon_attack1", "demon_attack2"]) {
    while (bp.playList.length) bp.removeLast();
    bp.queue(klip, 1); bp.blend = null;
    for (let i = 0; i < 90; i++) {
      bp.aktualizuj(1 / 30); Z.swiat.updateMatrixWorld(true);
      d.model.traverse(o => { if (o.isSkinnedMesh) { o.skeleton.update(); o.computeBoundingBox(); } });
      const stopy = new THREE.Box3().setFromObject(d.model).min.z;
      assert.ok(stopy > podloze - 2 && stopy < podloze + 4, d.model.name + ": stopy przy podłodze w " + klip);
    }
  }
  while (bp.playList.length) bp.removeLast();
}

klatki(30);
const poczatek = master.position.clone();
klawisz("ArrowUp", true); klatki(12); klawisz("ArrowUp", false);
assert.ok(master.position.y < poczatek.y - 80, "Start: bieg w stronę kapłana");
przenies(punkty.start); klatki();
klawisz("Space", true); klatki(); klawisz("Space", false);
let maxZ = -Infinity;
for (let i = 0; i < 90; i++) { klatki(); maxZ = Math.max(maxZ, master.position.z); }
assert.ok(maxZ > poczatek.z + 50, "Skok z siłą 25 z Lingo");
assert.ok(Math.abs(master.position.z - poczatek.z) < 1, "Lądowanie bez narastania wysokości");
klawisz("Escape", true); klatki(); klawisz("Escape", false); assert.equal(konce.pop(), "menu");
klawisz("Equal", true); klatki(3); klawisz("Equal", false); assert.equal(gra.tempo, 35);
klawisz("Minus", true); klatki(3); klawisz("Minus", false); assert.equal(gra.tempo, 30);

// Nie można ominąć zadań teleportacją do dalszej części etapu.
przy(punkty.koniec); assert.equal(gra.koniec, undefined);
przy(punkty.cokół); ctrl(); assert.equal(G.lustroInserted, false);
przy(punkty.lustro); ctrl(); assert.equal(G.haveLustro, false);
for (const t of proby) { przy(t.miejsceMocy); ctrl(); assert.equal(t.wlozony, false, "Bez kamienia moc nie działa"); }
przy(drzwi.ksiaze.pozycja); assert.equal(G.ksiazeDoorOpened, false);

// Wszystkie patrole przechodzą całą trasę niezależnie od pozostałych demonów.
przenies(V(0, 5000, -170));
for (let i = 0; i < 20000 && demony.some(d => d.odwiedzone.size < d.trasa.length); i++) for (const d of demony) d.stepFrame();
for (const d of demony) {
  assert.equal(d.odwiedzone.size, d.trasa.length, d.model.name + ": pełny patrol");
  assert.ok(d.proxy.position.distanceTo(d.grupa.position.clone().add(V(0, 0, -45))) < 0.001);
}
// Własny atak każdego przeciwnika zadaje 25 obrażeń, również biegnącemu graczowi.
for (const a of [...demony, ...pumy]) {
  const bp = a.model.userData.bonesPlayer;
  while (bp.playList.length) bp.removeLast();
  przenies(a.grupa.position.clone().add(V(50, 0, -80))); G.obrazenia = 0; G.energy = 100;
  a.stepFrame(); assert.equal(G.obrazenia, 25); G.speed = 10; player.step(); assert.equal(G.energy, 75);
}
przy(punkty.ksiaze.clone().add(V(100, 0, 0)));
while (ksiaze.model.userData.bonesPlayer.playList.length) ksiaze.model.userData.bonesPlayer.removeLast();
G.energy = 100; G.obrazenia = 0; ksiaze.stepFrame(); player.step(); assert.equal(G.energy, 75);

// Lawa i smoła odsyłają na właściwe znaczniki bez odbierania życia.
function pole(n) {
  const o = Z.model(n); o.updateWorldMatrix(true, true);
  return new THREE.Box3().setFromObject(o).getCenter(V(0, 0, 0));
}
const lawa = pole("kolizja_lawa_podloze_mur"), smola = pole("kolizja_smola_podloze_mur");
// Poszukaj punktu wolnego od chodników ponad niebezpieczną powierzchnią.
function niebezpieczenstwo(p, typ) {
  for (let x = -150; x <= 150; x += 30) for (let y = -150; y <= 150; y += 30) {
    const q = p.clone().add(V(x, y, 20));
    const h = promienie(() => Z.modelsUnderRay(q, V(0, 0, -1))).find(h => h.model.name.includes("podloze"));
    if (h?.model.name.includes(typ)) return h.isectPosition.clone();
  }
  throw Error("Brak punktu pułapki: " + typ);
}
const lawaP = niebezpieczenstwo(lawa, "lawa"), smolaP = niebezpieczenstwo(smola, "smola");
G.energy = 100; const zycia = G.lives;
przenies(lawaP); player.step(); assert.ok(master.position.distanceTo(punkty.lawa) < 1);
przenies(smolaP); player.step(); assert.ok(master.position.distanceTo(punkty.smola) < 1);
assert.equal(G.lives, zycia); assert.equal(G.energy, 100);
// Bezpieczny chodnik nad lawą nie uruchamia pułapki.
przy(punkty.lawa); const powroty = G.powroty; klatki(20); assert.equal(G.powroty, powroty);

// Kamienie wolno zbierać w dowolnej kolejności. Każdy nalicza się tylko raz.
przy(punkty.kaplan); assert.equal(G.canOpenThreeGates, true); assert.equal(gra.overlay(3).obraz, "k01_trzy_proby");
for (const typ of ["gwiazd", "ognia", "przodkow"]) {
  const d = drzwi[typ]; przy(d.pozycja); assert.equal(d.opened, true); klatki(100);
  assert.ok(d.modele[0].position.z > d.pozycja.z + 150);
  assert.ok(Math.abs(d.proxy.position.z - d.modele[0].position.z) < 1);
}
const kolejnosc = process.argv.includes("--odwrotnie") ? [...proby].reverse() : proby;
for (const t of kolejnosc) {
  przy(t.pozycja); assert.equal(t.zebrany, true); assert.equal(Z.model(t.kamien.name), undefined);
  assert.equal(gra.overlay(t.slot).loc[1], 12); klatki(4); assert.equal(t.wlozony, false);
}
przenies(lawaP); player.step(); assert.ok(master.position.distanceTo(punkty.lawaPowrot) < 1, "Kamień ognia zmienia punkt powrotu");
przy(drzwi.ksiaze.pozycja); assert.equal(G.ksiazeDoorOpened, false, "Po kamieniach trzeba wrócić do kapłana");
przy(punkty.kaplan); assert.equal(G.canOpenKsiaze, true); assert.equal(gra.overlay(3).obraz, "k03_trzy_proby");
przy(drzwi.ksiaze.pozycja); assert.equal(G.ksiazeDoorOpened, true);
assert.ok(Z.model(drzwi.ksiaze.proxy.name), "Kolizja trwa podczas otwierania");
klatki(90); assert.equal(Z.model(drzwi.ksiaze.proxy.name), undefined);
for (const t of kolejnosc) {
  przy(t.miejsceMocy); assert.equal(t.wlozony, false); ctrl(); assert.equal(t.wlozony, true);
  assert.equal(t.moc.userData.widocznosc, 1); assert.equal(t.promien.userData.widocznosc, 1);
  assert.equal(gra.overlay(t.slot).loc[1], -100);
}
klatki(2); assert.equal(G.ksiazeWidoczny, false); assert.equal(G.kaplanWidoczny, false);
assert.equal(Z.model(ksiaze.model.name), undefined); assert.equal(Z.model(kaplan.proxy.name), undefined);
przy(punkty.lustro); assert.equal(G.haveLustro, false); ctrl(); assert.equal(G.haveLustro, true);
assert.equal(gra.overlay(4).obraz, "lustro"); assert.deepEqual(gra.overlay(4).loc, [280, 12]);
przy(drzwi.krolowa.pozycja); assert.equal(G.krolowaDoorOpened, true); klatki(90);
assert.equal(Z.model(drzwi.krolowa.proxy.name), undefined);
przy(punkty.cokół); ctrl(); assert.equal(G.lustroInserted, true); assert.equal(G.haveLustro, false);
assert.equal(gra.overlay(4).loc[1], -100); assert.equal(Z.model("SlonceSnop").userData.widocznosc, 1);
przy(punkty.krolowa); assert.equal(G.podestOpened, true); assert.equal(G.podestOpenedProxy, false);
przy(punkty.amulet); assert.equal(G.haveAmulet, false, "Nie można zebrać nagrody przed wysunięciem podestu");
klatki(100); assert.equal(G.podestOpenedProxy, true);
przy(pozycjaSwiat(Z.model("amulet_slonca"))); assert.equal(G.haveAmulet, true);
assert.equal(gra.overlay(4).obraz, "amuletslonca"); assert.equal(stan.portal.userData.widocznosc, 1);
przy(punkty.koniec); assert.equal(konce.pop(), "wygrana"); assert.equal(gra.koniec, true);
gra.exitFrame(); assert.equal(konce.length, 0, "Zakończenie tylko raz");
// Ostatnie życie kończy grę i nie pozwala aktorom ponownie zadać obrażeń.
gra.koniec = false; G.lives = 1; G.energy = 25; G.obrazenia = 25; player.step();
assert.equal(konce.pop(), "przegrana"); assert.equal(G.lives, 0); assert.equal(gra.koniec, true);
console.log("Poziom 09 OK: trzy próby, pułapki, 5 demonów, puma, zwierciadło, podest, amulet, portal" + (process.argv.includes("--odwrotnie") ? " (odwrotna kolejność)" : ""));

