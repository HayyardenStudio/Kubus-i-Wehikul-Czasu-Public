// Zadania holu świątyni na rzeczywistych modelach, bez GPU i dodatkowych zależności.
// node tools/test_poziomu08.mjs
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as THREE from "../strona/gra/js/vendor/three.module.min.js";
import { DaneW3d, Scena3d } from "../strona/gra/js/w3d.js";

const events = {};
globalThis.addEventListener = (n, fn) => { events[n] = fn; };
globalThis.Element = class {};
globalThis.localStorage = { getItem: () => null, setItem() {} };
const { uruchomPoziom } = await import("../strona/gra/js/poziom08.js");
const { przechwytujKlawisze, Gra } = await import("../strona/gra/js/silnik.js");
const katalog = new URL("../strona/gra/dane/08/", import.meta.url);
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
const { G, V, punkty, pochodnie, drzwi, weze, strzaly, kaplan, kaplanProxy, player, promienie } = stan;
const Z = gra.member("ziemia"), master = Z.model("master");
function przenies(p, obrot = 90) { G.speed = 0; player.reset(p, obrot); }
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
assert.equal(pochodnie.length, 16); assert.equal(weze.length, 7); assert.equal(strzaly.length, 16);
assert.equal(G.pochodnie, 0); assert.equal(G.drzwiOtwarte, false);
// Pomocnicze siatki trasy nie mogą pojawiać się jako szare krzyże w komnatach.
for (const def of Z.dane.json.nodes) {
  const zasob = Z.dane.json.resources[def.resource];
  if (!zasob?.shading?.some(s=>s.meshes.includes("placeholder"))) continue;
  const model = Z.model(def.name);
  if (model) assert.ok(model.children.filter(c=>c.isMesh).every(c=>!c.visible),def.name+": znacznik niewidoczny");
}
assert.ok(pochodnie.every(t => t.model.userData.widocznosc === 0));
assert.deepEqual(strzaly.map(s => s.trasa.length), Array(16).fill(2));
assert.deepEqual(weze.map(w => w.trasa.length), [19,22,20,22,25,26,20]);
for (const d of [...drzwi.sekretne, ...drzwi.koncowe]) assert.equal(d.model.userData.keyframePlayer.playing, false);
// Stopy kapłana spoczywają na podeście, a węże nie zapadają się w podłogę.
function bounds(o) {
  Z.swiat.updateMatrixWorld(true);
  o.traverse(c=>{if(c.isSkinnedMesh){c.skeleton.update();c.computeBoundingBox();}});
  return new THREE.Box3().setFromObject(o);
}
// Kolizja jest wyżej niż widoczny schód — testujemy rzeczywistą siatkę podwyższenia.
const stopienKaplana = Z.modelsUnderRay(punkty.kaplan.clone().add(V(0,0,100)),V(0,0,-1))
  .find(h=>h.model.name==="podwyzszenie").isectPosition.z;
for(const [o,klipy,podloga] of [[kaplan,["kaplan_ambient1","kaplan_talk1"],stopienKaplana],
  [weze[0].model,["waz_walk1","waz_walk2","waz_walk3"],-215.7503]]) {
  const bp=o.userData.bonesPlayer;
  for(const klip of klipy) {
    while(bp.playList.length)bp.removeLast(); bp.queue(klip); bp.blend=null;
    for(let i=0;i<90;i++) {
      bp.aktualizuj(1/30);
      const stopy=bounds(o).min.z;
      assert.ok(stopy > podloga-(o===kaplan?0.5:2) && stopy < podloga+(o===kaplan?0.5:4),klip+": siatka przy podłodze");
    }
  }
}
klatki(45);
assert.equal(gra.kamera.fov, 60); assert.equal(gra.kamera.far, 4000);
assert.equal(gra.overlay(6).obraz, "k01_hol_swiatyni");
const z = master.position.z, y = master.position.y;
klawisz("ArrowUp", true); klatki(12); klawisz("ArrowUp", false);
assert.ok(master.position.y < y - 80, "Bieg od wejścia do środka holu");
przenies(punkty.start); klatki(3);
klawisz("Space", true); klatki(); klawisz("Space", false);
let szczyt = -Infinity;
for (let i=0;i<80;i++) { klatki(); szczyt = Math.max(szczyt, master.position.z); }
assert.ok(szczyt > z + 30); assert.ok(Math.abs(master.position.z-z)<1);
klawisz("Escape", true); klatki(); klawisz("Escape", false); assert.equal(konce.pop(), "menu");
klawisz("Equal", true); klatki(3); klawisz("Equal", false); assert.equal(gra.tempo, 35);
klawisz("Minus", true); klatki(3); klawisz("Minus", false); assert.equal(gra.tempo, 30);

// Każda strzała pokonuje całą trasę i wraca do wyrzutni.
przenies(punkty.start);
klatki(160);
for (const s of strzaly) assert.ok(s.cykle >= 2, s.model.name + ": powtarzane salwy");
// Patrole idą przez oryginalne punkty w kolejności numerycznej, także w10 po w9.
przenies(V(0,2000,-175));
for (let i=0;i<16000 && weze.some(w => w.odwiedzone.size < w.trasa.length);i++) {
  for (const w of weze) w.stepFrame();
}
for (const w of weze) {
  assert.equal(w.odwiedzone.size,w.trasa.length,w.model.name + ": pełny patrol");
  assert.ok(w.proxy.position.distanceTo(w.grupa.position.clone().add(V(0,0,-88))) < 0.001);
  const kierunek = V(1,0,0).applyQuaternion(w.grupa.quaternion);
  w.model.updateWorldMatrix(true,false);
  assert.ok(V(0,-1,0).transformDirection(w.model.matrixWorld).dot(kierunek)>0.999, "Wąż patrzy w kierunku ruchu");
}
// Trafienie strzałą resetuje wyłącznie tę strzałę i odbiera 5 energii również w biegu.
const s = strzaly[0];
przenies(s.grupa.position); G.energy=100;
s.stepFrame(); assert.equal(s.trafienia,1); assert.equal(s.currentWP,0);
assert.ok(s.grupa.position.distanceTo(s.start)<0.001);
G.speed=10; player.step(); assert.equal(G.energy,95);
// Węże przerywają chód na dwa rodzaje ataku; atak odbiera energię raz na klip.
for (const w of weze) {
  const bp=w.model.userData.bonesPlayer;
  przenies(w.grupa.position.clone().add(V(100,0,-60)));
  G.energy=100; while(bp.playList.length) bp.removeLast();
  w.stepFrame(); assert.ok(bp.playList[0].name.startsWith("waz_attack"));
  player.step(); assert.equal(G.energy,95);
  w.stepFrame(); player.step(); assert.equal(G.energy,95);
}
// Oryginalna bryła węża musi wystawać ponad podłogę i zatrzymywać bieg.
// Izolujemy jednego węża w rzeczywistym korytarzu; wyłączamy pozostałe pułapki.
{
  const w=weze[0], bp=w.model.userData.bonesPlayer, aktorzyPrzed=gra.aktorzy, losuj=Math.random;
  gra.aktorzy=[w]; weze.slice(1).forEach(o=>o.proxy.removeFromParent()); kaplanProxy.removeFromParent();
  function ustawWeza(offset=200,obrot=180) {
    w.grupa.position.copy(w.start).z+=78; w.grupa.quaternion.identity(); w.currentWP=0;
    w.proxy.position.copy(w.start).z-=10;
    while(bp.playList.length)bp.removeLast();
    G.obrazenia=0;G.energy=100;G.lives=3;przenies(w.start.clone().add(V(offset,0,0)),obrot);
  }
  try {
    const box=new THREE.Box3().setFromObject(w.proxy);
    assert.ok(box.max.z > w.start.z+100,"Bryła kolizji nie leży pod podłogą");
    assert.ok(box.max.x-box.min.x < 100,"Zachowana oryginalna szerokość bryły");
    ustawWeza();
    klawisz("ArrowUp",true);klatki(35);klawisz("ArrowUp",false);G.speed=0;
    assert.ok(master.position.x > w.grupa.position.x+90,"Bieg na wprost zatrzymuje się na wężu");
    // Ten sam odcinek bez bryły jest przechodni — nie zatrzymuje go ściana korytarza.
    ustawWeza();gra.aktorzy=[];w.proxy.removeFromParent();
    klawisz("ArrowUp",true);klatki(35);klawisz("ArrowUp",false);G.speed=0;
    assert.ok(master.position.x < w.start.x-100,"Droga bez węża jest drożna");
    Z.swiat.add(w.proxy);gra.aktorzy=[w];
    // Każdy z dwóch klipów może dać serię trzech ciosów bez dodatkowej przerwy.
    for(const losowanie of [0,0.999]) {
      Math.random=()=>losowanie;
      ustawWeza(100);const trafienia=[];
      for(let i=0;i<60&&trafienia.length<3;i++) {
        const energia=G.energy;klatki();
        if(G.energy!==energia)trafienia.push(gra.milliSeconds);
      }
      assert.equal(trafienia.length,3,"Trzy szybkie ciosy przy pozostaniu obok węża");
      assert.equal(G.energy,85,"Każdy cios odbiera 5 energii");
      for(let i=1;i<trafienia.length;i++) {
        const przerwa=trafienia[i]-trafienia[i-1];
        assert.ok(przerwa>=480&&przerwa<=601,"Kolejny cios po oryginalnym półsekundowym klipie");
      }
      // Odejście poza zasięg kończy serię, bez obrażeń od ataku na odległość.
      przenies(punkty.start);G.obrazenia=0;const energia=G.energy;klatki(40);
      assert.equal(G.energy,energia);
    }
    // Podejście po skosie blokuje się na ziemi; pojedynczy skok pozwala ominąć węża.
    Math.random=()=>0;
    ustawWeza(125,210);
    klawisz("ArrowUp",true);klatki(35);klawisz("ArrowUp",false);G.speed=0;
    assert.ok(master.position.x>w.start.x+90,"Bez skoku nie przechodzi przez bryłę");
    ustawWeza(125,210);
    klawisz("ArrowUp",true);klawisz("Space",true);klatki();klawisz("Space",false);
    klatki(34);klawisz("ArrowUp",false);G.speed=0;
    assert.ok(master.position.x<w.start.x-90&&master.position.y<w.start.y-100,"Skok bokiem omija węża");
    assert.ok(Math.abs(master.position.z+215.7503)<1,"Lądowanie po ominięciu węża");
  } finally {
    Math.random=losuj;gra.aktorzy=aktorzyPrzed;
    weze.slice(1).forEach(o=>Z.swiat.add(o.proxy));Z.swiat.add(kaplanProxy);
    klawisz("ArrowUp",false);klawisz("Space",false);G.speed=0;G.obrazenia=0;
  }
}
// Nie można wygrać ani otworzyć drzwi bez zadania, także po przeniesieniu za bramę.
przenies(punkty.koniec); klatki(5); assert.deepEqual(konce,[]);
przenies(punkty.kaplan); klatki(3);
assert.equal(G.przyKaplanie,true); assert.equal(G.drzwiOtwarte,false);
assert.equal(gra.overlay(6).obraz,"k02_hol_swiatyni");
// Boczne wejścia do sekretnego przejścia blokują Kubusia przed zadaniem.
const aktorzy = gra.aktorzy; gra.aktorzy = [];
weze.forEach(w=>w.proxy.removeFromParent()); kaplanProxy.removeFromParent();
function wBok(znak) {
  przenies(V(350*znak,-1210,-215.75),znak===1?180:0);
  klawisz("ArrowUp",true); klatki(35); klawisz("ArrowUp",false); G.speed=0;
}
for(const znak of [-1,1]) { wBok(znak); assert.ok(master.position.x*znak>250,"Zamknięte sekretne drzwi blokują wejście"); }
gra.aktorzy=aktorzy; weze.forEach(w=>Z.swiat.add(w.proxy)); Z.swiat.add(kaplanProxy);
// Ctrl nie działa z daleka ani podczas biegu. Wysokość ognia różni się od podłogi.
function obok(t) {
  const p=t.pozycja.clone();
  const podloze=promienie(()=>Z.modelsUnderRay(p.clone().add(V(0,0,10)),V(0,0,-1)))
    .find(h=>h.model.name.includes("podloze"));
  assert.ok(podloze,t.model.name + ": podłoga przy pochodni");
  p.z=podloze.isectPosition.z; return p;
}
przenies(punkty.start); ctrl(); assert.equal(G.pochodnie,0);
przenies(obok(pochodnie[0]));
klawisz("ArrowUp",true); ctrl(); klawisz("ArrowUp",false); assert.equal(G.pochodnie,0);
// Kolejność zapalania dowolna, przytrzymanie nie nalicza ponownie.
for (const t of [...pochodnie].reverse()) {
  przenies(obok(t)); ctrl();
  assert.ok(t.zapalona,t.model.name + ": Ctrl zapala z podłogi");
  const liczba=G.pochodnie; ctrl(); assert.equal(G.pochodnie,liczba);
  assert.equal(t.model.userData.widocznosc,1);
}
assert.equal(G.pochodnie,16); assert.equal(gra.overlay(4).obraz,"L1"); assert.equal(gra.overlay(5).obraz,"P6");
assert.equal(G.drzwiOtwarte,false,"Po komplecie trzeba wrócić do kapłana");
przenies(punkty.drzwi); klatki(3); assert.equal(G.drzwiKoncowe,false);
przenies(punkty.kaplan); klatki(3); assert.equal(G.drzwiOtwarte,true);
assert.equal(gra.overlay(6).obraz,"k04_hol_swiatyni");
for(const d of drzwi.sekretne) assert.equal(Z.model(d.proxy.name),undefined);
klatki(150);
for(const d of drzwi.sekretne) assert.equal(d.model.userData.keyframePlayer.czas,d.model.userData.keyframePlayer.ruch.dlugosc);
// Oba boczne otwory prowadzą pod posąg. Wygrana następuje przy biegu przez bramę.
gra.aktorzy=[]; weze.forEach(w=>w.proxy.removeFromParent()); kaplanProxy.removeFromParent();
wBok(-1); assert.ok(Math.abs(master.position.x)<20,"Przejście przez lewe sekretne drzwi");
G.car_rotation=270;klawisz("ArrowUp",true);klatki(10);klawisz("ArrowUp",false);G.speed=0;
assert.ok(master.position.y < -1300,"Korytarz za posągiem");
wBok(1); assert.ok(Math.abs(master.position.x)<20,"Przejście przez prawe sekretne drzwi");
G.car_rotation=270;klawisz("ArrowUp",true);
for(let i=0;i<100&&!gra.koniec;i++)klatki();
klawisz("ArrowUp",false);
assert.equal(G.drzwiKoncowe,true);
for(const d of drzwi.koncowe) assert.equal(Z.model(d.proxy.name),undefined);
assert.deepEqual(konce,["wygrana"]);
klatki(30); assert.deepEqual(konce,["wygrana"]);
// Ostatnie życie kończy grę raz.
gra.koniec=false; G.energy=5; G.lives=1; G.obrazenia=5; player.step();
assert.equal(G.lives,0); assert.equal(konce.at(-1),"przegrana");
klatki(30); assert.equal(G.lives,0);
console.log("OK: poziom 8 — ruch, skok, pauza, tempo, 7 pełnych patroli, 16 pułapek, kolizja węży, skok bokiem, serie ciosów, obrażenia, 16 pochodni z podłogi, licznik, kapłan, obie bramy, wygrana i ostatnie życie.");
