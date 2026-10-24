// Silnik gry: to, co w oryginale robił Shockwave Player wokół skryptów Lingo.
// Obraz 640x480 (3D + nakładki z bitmap), klawiatura (keyPressed z kodami klawiszy Maca),
// kanały dźwięku (puppetSound), stały krok logiki (tempo filmu) i pomocnicze funkcje
// transformacji w stylu Directora.

import * as THREE from "./vendor/three.module.min.js";
import { wczytajW3d, Scena3d } from "./w3d.js";

THREE.ColorManagement.enabled = false;

export const SZEROKOSC = 640;
export const WYSOKOSC = 480;

// ---------------------------------------------------------------------------------------
// Klawiatura: keyPressed(kod) z kodami klawiszy Directora (kody Maca, także na Windows)
// ---------------------------------------------------------------------------------------
const KODY = {
  ArrowLeft: [123], ArrowRight: [124], ArrowDown: [125], ArrowUp: [126], Space: [49], Escape: [53],
  Equal: [24], NumpadAdd: [69], Minus: [27], NumpadSubtract: [78],
  ControlLeft: [59], ControlRight: [59],
};
const wcisniete = new Set();
let przechwytuj = false;            // strzałki i spacja nie przewijają strony, dopóki trwa gra
export const przechwytujKlawisze = (tak) => { przechwytuj = tak; if (!tak) wcisniete.clear(); };
addEventListener("keydown", (e) => {
  if (e.target instanceof Element && e.target.closest("input, select, textarea, [contenteditable]")) return;
  const kody = KODY[e.code];
  if (!kody || !przechwytuj) return;
  kody.forEach((k) => wcisniete.add(k));
  e.preventDefault();
});
addEventListener("keyup", (e) => (KODY[e.code] ?? []).forEach((k) => wcisniete.delete(k)));
addEventListener("blur", () => wcisniete.clear());
export const keyPressed = (kod) => wcisniete.has(kod);

// ---------------------------------------------------------------------------------------
// Dźwięk: kanały jak w Directorze (puppetSound, soundBusy, sound(n).volume 0-255, stop)
// ---------------------------------------------------------------------------------------
class Dzwiek {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.masterVolume = 1;
    this.bufory = new Map();
    this.kanaly = new Map();
  }
  async wczytaj(nazwa, url) {
    const dane = await fetch(url).then((r) => r.arrayBuffer());
    this.bufory.set(nazwa.toLowerCase(), dane);
  }
  wlacz() {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.masterVolume;
    this.masterGain.connect(this.ctx.destination);
    for (const [k, v] of this.bufory) {
      this.bufory.set(k, this.ctx.decodeAudioData(v.slice(0)).catch(() => null));
    }
  }
  kanal(n) {
    if (!this.kanaly.has(n)) this.kanaly.set(n, { zrodlo: null, gain: null, volume: 255, gra: false });
    return this.kanaly.get(n);
  }
  async puppetSound(n, nazwa, petla = false) {
    if (!this.ctx) return;
    const k = this.kanal(n);
    this.stop(n);
    k.gra = true;
    const token = (k.token = {});
    const bufor = await this.bufory.get(nazwa.toLowerCase());
    if (!bufor || k.token !== token) { k.gra = false; return; }
    const zrodlo = this.ctx.createBufferSource();
    zrodlo.buffer = bufor;
    zrodlo.loop = petla;
    const gain = this.ctx.createGain();
    gain.gain.value = k.volume / 255;
    zrodlo.connect(gain).connect(this.masterGain);
    zrodlo.onended = () => { if (k.zrodlo === zrodlo) k.gra = false; };
    zrodlo.start();
    k.zrodlo = zrodlo;
    k.gain = gain;
  }
  soundBusy(n) { return this.kanal(n).gra ? 1 : 0; }
  setMasterVolume(v) {
    this.masterVolume = Math.max(0, Math.min(1, v));
    if (this.masterGain) this.masterGain.gain.setTargetAtTime(this.masterVolume, this.ctx.currentTime, 0.01);
  }
  setVolume(n, v) {
    const k = this.kanal(n);
    k.volume = Math.max(0, Math.min(255, v));
    if (k.gain) k.gain.gain.value = k.volume / 255;
  }
  stop(n) {
    const k = this.kanal(n);
    k.token = null;
    if (k.zrodlo) { k.zrodlo.onended = null; k.zrodlo.stop(); k.zrodlo = null; }
    k.gra = false;
  }
  stopWszystko() { for (const n of this.kanaly.keys()) this.stop(n); }
}
export const dzwiek = new Dzwiek();

// ---------------------------------------------------------------------------------------
// Transformacje w stylu Directora (oś Z w górę)
// ---------------------------------------------------------------------------------------
export function pozycjaSwiat(o) {
  o.updateWorldMatrix(true, false);
  return new THREE.Vector3().setFromMatrixPosition(o.matrixWorld);
}

// getWorldTransform().xAxis
export function osXSwiat(o) {
  o.updateWorldMatrix(true, false);
  return new THREE.Vector3().setFromMatrixColumn(o.matrixWorld, 0);
}

// transform.identity()
export function identity(o) {
  o.position.set(0, 0, 0);
  o.quaternion.identity();
  o.scale.set(1, 1, 1);
}

// translate(x, y, z) względem #self: przesunięcie wzdłuż osi węzła, bez jego skali.
// Widać to po tratwie: widoczny model (skala 2,15) i jego kolizja (skala 1) dostają co klatkę
// translate(0, 3, 0) i translate(0.5, -3, 0) - jadą razem tylko wtedy, gdy skala się nie liczy.
export function translate(o, x, y, z) {
  o.position.add(new THREE.Vector3(x, y, z).applyQuaternion(o.quaternion));
}

// rotate(x, y, z) względem #self, w stopniach
export function rotate(o, x, y, z) {
  const d = THREE.MathUtils.DEG2RAD;
  o.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(x * d, y * d, z * d, "ZYX")));
}

// transform.rotation.z = kąt (stopnie), z zachowaniem obrotów wokół X i Y
export function ustawObrotZ(o, stopnie) {
  const e = new THREE.Euler().setFromQuaternion(o.quaternion, "ZYX");
  e.z = stopnie * THREE.MathUtils.DEG2RAD;
  o.quaternion.setFromEuler(e);
}

// pointAt(cel, góra) z pointAtOrientation [przód, góra obiektu]; kamera patrzy wzdłuż -Z
// z górą +Y, model domyślnie wzdłuż +Z z górą +Y (gra podaje [vector(1,0,0), vector(0,0,1)]).
export function pointAt(o, cel, gora = new THREE.Vector3(0, 0, 1), przod = null, goraObiektu = null) {
  const kamera = o.isCamera || o.userData.typ === "camera";
  przod ??= kamera ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 0, 1);
  goraObiektu ??= new THREE.Vector3(0, 1, 0);
  const swiat = baza(cel.clone().sub(pozycjaSwiat(o)), gora);
  const obiekt = baza(przod, goraObiektu);
  if (!swiat || !obiekt) return;
  const q = new THREE.Quaternion().setFromRotationMatrix(swiat.multiply(obiekt.transpose()));
  if (o.parent) {
    o.parent.updateWorldMatrix(true, false);
    const qr = new THREE.Quaternion();
    o.parent.matrixWorld.decompose(new THREE.Vector3(), qr, new THREE.Vector3());
    q.premultiply(qr.invert());
  }
  o.quaternion.copy(q);
}

// Baza ortonormalna (przód, góra x przód, góra) z przodu i przybliżonej góry.
function baza(przod, gora) {
  const a = przod.clone().normalize();
  const c = gora.clone().sub(a.clone().multiplyScalar(gora.dot(a)));
  if (a.lengthSq() < 1e-9 || c.lengthSq() < 1e-9) return null;
  c.normalize();
  const b = new THREE.Vector3().crossVectors(c, a);
  return new THREE.Matrix4().makeBasis(a, b, c);
}

// ---------------------------------------------------------------------------------------
// Gra: wczytanie poziomu, obraz, nakładki i stały krok logiki
// ---------------------------------------------------------------------------------------
export class Gra {
  constructor(kontener, katalogDanych) {
    this.katalog = katalogDanych;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(SZEROKOSC, WYSOKOSC, false);
    this.renderer.domElement.className = "gra-3d";
    this.hud = document.createElement("canvas");
    this.hud.width = SZEROKOSC;
    this.hud.height = WYSOKOSC;
    this.hud.className = "gra-hud";
    kontener.append(this.renderer.domElement, this.hud);
    this.ctx2d = this.hud.getContext("2d");
    this.scena = new THREE.Scene();
    this.obsada = new Map();       // nazwa członka -> Scena3d
    this.bitmapy = new Map();      // nazwa członka -> ImageBitmap
    this.nakladki = [];            // overlay kamery: {obraz, loc: [x, y], blend}
    this.aktorzy = [];             // the actorList (stepFrame)
    this.timery = [];              // timeout(...).new(okres, #handler, obiekt)
    this.tempo = 30;
    this.pauza = false;
    this.ms0 = performance.now();
  }

  get milliSeconds() { return Math.round(performance.now() - this.ms0); }

  async wczytaj(postep) {
    const lista = await fetch(`${this.katalog}/obsada.json`).then((r) => r.json());
    const zadania = [];
    let gotowe = 0;
    const krok = () => postep?.(++gotowe / zadania.length);
    for (const m of lista) {
      if (!m.plik) continue;
      const url = `${this.katalog}/${m.plik}`;
      if (m.typ === "bitmap") {
        zadania.push(fetch(url).then((r) => r.blob()).then(createImageBitmap)
          .then((img) => this.bitmapy.set(m.nazwa.toLowerCase(), img)).then(krok));
      } else if (m.typ === "sound") {
        zadania.push(dzwiek.wczytaj(m.nazwa, url).then(krok));
      } else if (m.typ === "shockwave3d") {
        const baza = `${this.katalog}/modele/${m.nazwa}`;
        zadania.push(wczytajW3d(baza).then((d) => this.obsada.set(m.nazwa.toLowerCase(), new Scena3d(d))).then(krok));
      }
    }
    await Promise.all(zadania);
    await Promise.all([...this.obsada.values()].map((s) => s.dane.gotowe()));
  }

  member(nazwa) { return this.obsada.get(nazwa.toLowerCase()); }
  bitmapa(nazwa) { return this.bitmapy.get(String(nazwa).toLowerCase()); }

  // camera.addOverlay(tekstura, loc, kąt) - tu nakładka to po prostu bitmapa obsady
  addOverlay(nazwaBitmapy, x, y) {
    const n = { obraz: this.bitmapa(nazwaBitmapy), loc: [x, y], blend: 100 };
    this.nakladki.push(n);
    return n;
  }
  overlay(i) { return this.nakladki[i - 1]; }

  ustawSwiat(scena3d, kamera, mgla) {
    this.swiat3d = scena3d;
    this.kamera = kamera;
    this.scena.add(scena3d.swiat);
    if (mgla) {
      this.scena.background = mgla.kolor.clone();
      // Jawne near odtwarza liniową mgłę Lingo; domyślnie #exponential2 z IFX.
      this.scena.fog = mgla.near !== undefined
        ? new THREE.Fog(mgla.kolor.clone(), mgla.near, mgla.far)
        : new THREE.FogExp2(mgla.kolor.clone(), 2.1459660262893472 / mgla.far);
    }
  }

  dodajAktora(a) { this.aktorzy.push(a); }
  timeout(okresMs, fn) { this.timery.push({ okres: okresMs, fn, nastepny: this.milliSeconds + okresMs }); }

  start() {
    let poprzedni = performance.now();
    let zaleglosc = 0;
    const petla = (teraz) => {
      const dt = Math.min((teraz - poprzedni) / 1000, 0.25);
      poprzedni = teraz;
      if (!this.pauza && !this.koniec) {
        zaleglosc += dt;
        const okres = 1 / this.tempo;
        let kroki = 0;
        while (zaleglosc >= okres && kroki < 4) {
          zaleglosc -= okres;
          kroki++;
          this.krok();
        }
        if (kroki === 4) zaleglosc = 0;
        this.swiat3d.aktualizuj(dt);
      }
      this.rysuj();
      requestAnimationFrame(petla);
    };
    requestAnimationFrame(petla);
  }

  // Jedna klatka filmu: timery (timeout), stepFrame aktorów i skrypt klatki.
  krok() {
    const ms = this.milliSeconds;
    for (const t of this.timery) {
      if (ms >= t.nastepny) {
        t.nastepny = Math.max(t.nastepny + t.okres, ms - t.okres);
        t.fn();
        if (this.koniec) return;
      }
    }
    for (const a of [...this.aktorzy]) {
      a.stepFrame?.();
      if (this.koniec) return;
    }
    this.exitFrame?.();
  }

  rysuj() {
    if (this.kamera) this.renderer.render(this.scena, this.kamera);
    const c = this.ctx2d;
    c.clearRect(0, 0, SZEROKOSC, WYSOKOSC);
    for (const n of this.nakladki) {
      if (!n.obraz || n.blend <= 0) continue;
      c.globalAlpha = n.blend / 100;
      c.drawImage(n.obraz, n.loc[0], n.loc[1]);
    }
    c.globalAlpha = 1;
  }
}
