// Skoki po murach i pościg czarnych rycerzy na rzeczywistych danych W3D.
// node tools/test_ruchu03.mjs
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

function przenies(p) { Z.model("master").position.copy(p); Z.model("mesiek").position.copy(p).z += 35; }
function klawisz(code, tak) { events[tak ? "keydown" : "keyup"]({ code, preventDefault() {} }); }
function klatka() {
 gra.milliSeconds += 1000 / 30;
 for(const fn of gra.timery)fn();
 for(const a of gra.aktorzy)a.stepFrame?.();
 gra.exitFrame();Z.aktualizuj(1 / 30);
}
przechwytujKlawisze(true);
assert.ok(czarneStarty.every(([a])=>a.model.position.z === 35), "Czarni rycerze muszą stać na dolnym dziedzińcu");
// Sześć przerw w oryginalnych murach, w obie strony. Każdy skok musi
// zachować wysokość i prędkość nad otworem oraz zakończyć się na chodniku.
for (const [x,od,doY] of [[-1220,2253,2352],[-1220,2503,2602],[-1220,2853,2952],
 [1040,2054,2152],[1040,2963,3057],[1040,3158,3257]]) for(const kierunek of [1,-1]) {
 const y=(kierunek===1?od:doY)-40*kierunek;
 przenies(new THREE.Vector3(x,y,356)); G.car_rotation=90*kierunek; G.speed=0;
 for(let i=0;i<20;i++)klatka();
 const baza=Z.model("master").position.z,zycia=G.lives;
 klawisz("ArrowUp",true);klawisz("Space",true);klatka();klawisz("Space",false);
 for(let i=1;i<20;i++) {
  klatka(); const p=Z.model("master").position;
  assert.ok(p.z<baza+100, "Skoki z muru zachowują dotychczasową wysokość");
  assert.ok(p.z>=baza-1, `Mur x=${x}, przerwa ${od}, kierunek ${kierunek}: skok spada do gruntu`);
  assert.ok(Math.abs(p.y-(y+(i+1)*10*kierunek))<1, "Dalsza platforma nie może zatrzymać ruchu w locie");
  assert.ok(gra.kamera.position.z>baza+100, "Kamera nie może nurkować do gruntu pod przerwą");
 }
 klawisz("ArrowUp",false);G.speed=0;
 for(let i=0;i<30;i++)klatka();
 assert.ok(Math.abs(Z.model("master").position.z-baza)<1, "Lądowanie musi utrzymać Kubusia na murze");
 assert.equal(G.lives,zycia);
}
console.log("OK: sześć przerw w murach w obu kierunkach — bieg w locie, wysokość skoku, lądowanie i kamera.");
// Zwykły bieg nie tworzy niewidzialnego mostu nad przerwą.
przenies(new THREE.Vector3(-1220,2213,356));G.car_rotation=90;
for(let i=0;i<20;i++)klatka();
klawisz("ArrowUp",true);for(let i=0;i<12;i++)klatka();klawisz("ArrowUp",false);G.speed=0;
assert.ok(Z.model("master").position.z<300);
// Całe odcinki muru wymagające trzech kolejnych skoków bez przenoszenia gracza.
for(const [x,poczatek,przerwy,koniec] of [[-1220,2213,[2253,2503,2853],3400],[1040,2014,[2054,2963,3158],3420]]) {
 for(const a of gra.aktorzy)a.reset();G.enemyKilled=0;G.readyAnimate=0;
 przenies(new THREE.Vector3(x,poczatek,356));G.car_rotation=90;G.speed=0;
 for(let i=0;i<20;i++)klatka();
 let skoki=0;
 klawisz("ArrowUp",true);
 for(let i=0;i<180&&Z.model("master").position.y<koniec;i++){
  const y=Z.model("master").position.y;
  const skok=skoki<przerwy.length&&y>=przerwy[skoki]-40;
  klawisz("Space",skok);if(skok)skoki++;
  klatka();assert.ok(Z.model("master").position.z>350,`Cała górna trasa musi być przejezdna skokami: x=${x}, klatka=${i}, pozycja=${Z.model("master").position.toArray()}`);
 }
 klawisz("ArrowUp",false);klawisz("Space",false);G.speed=0;
 assert.equal(skoki,3);assert.ok(Z.model("master").position.y>=koniec);
}
// Powrót spod dzwonu po beczkach na daszek: trzy skoki bez przenoszenia.
for(const a of gra.aktorzy)a.reset();G.enemyKilled=0;G.readyAnimate=0;
przenies(new THREE.Vector3(-630,3860,0));G.car_rotation=0;G.speed=0;
for(let i=0;i<20;i++)klatka();
function skokPrzez(klatki,obrot){
 G.car_rotation=obrot;klawisz("ArrowUp",true);klawisz("Space",true);klatka();klawisz("Space",false);
 for(let i=1;i<klatki;i++)klatka();klawisz("ArrowUp",false);G.speed=0;
 for(let i=0;i<35;i++)klatka();
}
skokPrzez(16,0);
assert.ok(Z.model("master").position.z>58&&Z.model("master").position.z<60,"Pierwszy skok musi kończyć się na dolnych beczkach");
skokPrzez(11,90);
assert.ok(Z.model("master").position.z>108&&Z.model("master").position.z<120,"Drugi skok musi kończyć się na górnej beczce");
skokPrzez(25,0);
assert.ok(Z.model("master").position.x>-440&&Z.model("master").position.z>190,"Trzeci skok musi prowadzić z beczki na daszek");
// Wyższa część daszku przy tylnej krawędzi też musi przejmować lądowanie.
for(const y of [3920,3940,3950]){
 for(const a of gra.aktorzy)a.reset();G.enemyKilled=0;
 przenies(new THREE.Vector3(-480,y,118));G.speed=0;
 for(let i=0;i<20;i++)klatka();
 skokPrzez(25,0);
 assert.ok(Z.model("master").position.z>190,`Lądowanie na daszku przy y=${y} nie może kończyć się spadnięciem`);
}
console.log("OK: powrót po dwóch stopniach beczek na daszek oraz lądowanie na trzech wysokościach jego krawędzi.");
// Niższy łuk na dachach: szczyt ma być 130 jednostek nad wybiciem.
for(const a of gra.aktorzy)a.reset();G.enemyKilled=0;
przenies(new THREE.Vector3(550,4150,260));G.speed=0;
for(let i=0;i<20;i++)klatka();
const dachZ=Z.model("master").position.z;let szczytDachu=dachZ;
klawisz("Space",true);klatka();klawisz("Space",false);
for(let i=0;i<60;i++){klatka();szczytDachu=Math.max(szczytDachu,Z.model("master").position.z);}
assert.ok(Math.abs(szczytDachu-dachZ-130)<1,"Skok z daszku musi mieć wysokość 130, zamiast poprzednich 200 jednostek");
// Ostatni skok powrotny: NE daszek -> wschodnia galeria muru.
// Chodnik jest około 100 jednostek wyżej, za przerwą szeroką na 185–240.
// Wcześniejsze testy beczek i dachów nie obejmowały tego lądowania.
for(const y of [4100,4150,4170,4180,4200])for(const x of [550,570,580]){
 for(const a of gra.aktorzy)a.reset();G.enemyKilled=0;G.readyAnimate=0;
 przenies(new THREE.Vector3(x,y,260));G.car_rotation=0;G.speed=0;
 for(let i=0;i<20;i++)klatka();
 assert.ok(Z.model("master").position.z>250&&Z.model("master").position.z<265,"Wybicie musi nastąpić z NE daszku");
 const zycia=G.lives;
 skokPrzez(25,0);
 const p=Z.model("master").position;
 assert.ok(p.x>=780&&p.z>355&&p.z<358, `NE daszek x=${x}, y=${y}: Kubuś musi wylądować na wschodnim murze, pozycja=${p.toArray()}`);
 assert.equal(G.lives,zycia);
 // Po lądowaniu można iść dalej po galerii, a nie tylko zawisnąć nad nią.
 const przed=p.y;G.car_rotation=90;klawisz("ArrowUp",true);
 for(let i=0;i<4;i++)klatka();klawisz("ArrowUp",false);G.speed=0;
 assert.ok(p.y>przed+20&&p.z>355,"Galeria musi utrzymać Kubusia po wznowieniu biegu");
}
// Łuk dachowy nie może umożliwiać pominięcia trasy skokiem z ziemi na mur.
for(const a of gra.aktorzy)a.reset();G.enemyKilled=0;
przenies(new THREE.Vector3(700,4100,0));G.car_rotation=0;G.speed=0;
for(let i=0;i<20;i++)klatka();
klawisz("Space",true);klatka();klawisz("Space",false);let maxZ=0;
for(let i=0;i<50;i++){klatka();maxZ=Math.max(maxZ,Z.model("master").position.z);}
assert.ok(maxZ<100,"Zwykły skok z ziemi zachowuje dotychczasową wysokość");
console.log("OK: NE daszek -> wschodnia galeria — 15 miejsc wybicia, stabilne lądowanie, dalszy bieg i brak skrótu z ziemi.");
// Pościg: ruch korzenia z W3D, bez dodatkowego mnożnika szybkości.
const czarny=gra.aktorzy.find(a=>a.model.name.startsWith("rycerz_czarny")&&a.model.position.x>700);
const bp=czarny.model.userData.bonesPlayer;
function resetRycerza() { czarny.reset(); czarny.model.position.set(600,3000,35); Z.model(czarny.model.name+"proxy").position.copy(czarny.model.position); while(bp.playList.length)bp.removeLast();G.enemyKilled=0; }
function krokRycerza() { gra.milliSeconds+=1000/30;czarny.stepFrame();Z.aktualizuj(1/30); }
resetRycerza();let droga=0;
for(let i=0;i<60;i++){
 const p=czarny.model.position.clone();przenies(p.clone().add(new THREE.Vector3(0,-300,-35)));
 krokRycerza();droga+=p.y-czarny.model.position.y;
 assert.equal(bp.playList[0]?.name,"rycerz_czarny_walk","Ciągły pościg nie może wstawiać bezczynności");
 assert.ok(czarny.model.position.distanceTo(p)>1,"Chód nie może zatrzymywać się między cyklami");
}
const ruch=Z.ruchy.get("rycerz_czarny_walk"),sz=czarny.model.userData.szkielet;
const track=ruch.sciezki.find(s=>sz.indeks.get(s.kosc)===0);
function probka(t){const p=new THREE.Vector3();ruch.probka(track,t,p,new THREE.Quaternion());return p;}
const oryginalnaDroga=probka(ruch.dlugosc).sub(probka(0)).setZ(0).length()*2/ruch.dlugosc;
assert.ok(Math.abs(droga-oryginalnaDroga)<1, `Dwa sekundy chodu: ${droga} zamiast ${oryginalnaDroga}`);
// Renderowanie 60/144 Hz przy logice 30 Hz nie może zmieniać szybkości
// ani wstawiać zatrzymań na granicach klipu.
for(const fps of [60,144]) {
 resetRycerza();przenies(czarny.model.position.clone().add(new THREE.Vector3(0,-300,-35)));czarny.stepFrame();
 const y=czarny.model.position.y;let zaleglosc=0;
 for(let i=0;i<fps*2;i++){
  gra.milliSeconds+=1000/fps;zaleglosc+=1/fps;
  while(zaleglosc>=1/30-1e-9){
   przenies(czarny.model.position.clone().add(new THREE.Vector3(0,-300,-35)));
   czarny.stepFrame();zaleglosc-=1/30;
  }
  const p=czarny.model.position.clone();Z.aktualizuj(1/fps);
  assert.ok(czarny.model.position.distanceTo(p)>0.01, `${fps} Hz: zatrzymanie animacji chodu`);
 }
 assert.ok(Math.abs(y-czarny.model.position.y-oryginalnaDroga)<1, `${fps} Hz: zmieniona szybkość pościgu`);
}
// Oddalenie ponad 400 albo poza strefę nie ucina rozpoczętego kroku.
for(const pozaStrefa of [false,true]){
 resetRycerza();
 for(let i=0;i<7;i++){przenies(czarny.model.position.clone().add(new THREE.Vector3(0,-300,-35)));krokRycerza();}
 const p=czarny.model.position.clone();
 przenies(pozaStrefa ? czarneStarty.find(([a])=>a===czarny)[1].clone().add(new THREE.Vector3(0,-850,-35)) : p.clone().add(new THREE.Vector3(0,-410,-35)));
 krokRycerza();
 assert.equal(bp.playList[0]?.name,"rycerz_czarny_walk");
 assert.ok(czarny.model.position.distanceTo(p)>1);
 for(let i=0;i<15;i++){ if(!pozaStrefa)przenies(czarny.model.position.clone().add(new THREE.Vector3(0,-410,-35))); krokRycerza(); }
 assert.equal(bp.playList[0]?.name,"rycerz_czarny_ambient1");
}
// Zbliżenie do gracza przechodzi prosto z chodu w cios, bez 1,2 s przerwy.
resetRycerza();
for(let i=0;i<7;i++){przenies(czarny.model.position.clone().add(new THREE.Vector3(0,-300,-35)));krokRycerza();}
przenies(czarny.model.position.clone().add(new THREE.Vector3(0,-110,-35)));krokRycerza();
assert.equal(bp.playList[0]?.name,"rycerz_czarny_attack3");
// Jak w Lingo: rozpoczęty cios trafia po 500 ms także po odejściu ponad 150.
przenies(czarny.model.position.clone().add(new THREE.Vector3(0,-260,-35)));
for(let i=0;i<14;i++)krokRycerza();assert.equal(G.enemyKilled,0);
for(let i=0;i<3&&!G.enemyKilled;i++)krokRycerza();assert.equal(G.enemyKilled,1);
console.log(`OK: czarni rycerze — ${droga.toFixed(1)} jednostek w 2 s zgodnie z W3D, ciągły chód, kończenie kroku po utracie zasięgu i natychmiastowe przejście do ciosu.`);
