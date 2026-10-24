// Pokój badań: finał z 11_pokoj_badan.dcr (ProjectorRays).
import * as THREE from "./vendor/three.module.min.js";
import { dzwiek, keyPressed, pozycjaSwiat, identity, translate, pointAt } from "./silnik.js";
import { ustawWidocznosc } from "./w3d.js";
import { utworzPostacie } from "./postacie.js";
import { oswietl } from "./poziom01.js";

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const nr = n => String(n).padStart(2, "0");
export function uruchomPoziom(gra, zakonczenie) {
  const G = { speed: 0, car_rotation: 0, lives: 3, energy: 100, coin_number: 0,
    action: 0, obrazenia: 0, enemyNear: 0, mieczInserted: false, okoInserted: false,
    amuletInserted: false, kompWystartowal: false, finalRozpoczety: false,
    coins_positions: [], coins_refs: [], carrots_positions: [], carrots_refs: [] };
  const Z = gra.member("ziemia"), sw = Z.swiat, m = n => Z.model(n);
  // Tunel jest zamkniętą powłoką z normalnymi na zewnątrz. Promienie
  // gracza biegną od środka, więc potrzebują wewnętrznych stron ścian.
  for (const siatka of m("kolizja_tunel_podloze_mur").children.filter(o => o.isMesh)) {
    const g = siatka.geometry.clone(), idx = g.index.array;
    for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
    g.index.needsUpdate = true; g.computeVertexNormals(); siatka.geometry = g;
  }
  const punkty = Object.fromEntries(Object.entries({ start: "start1_ph", sala: "start2_ph", wynalazca: "wynalazca_ph" })
    .map(([k, n]) => [k, pozycjaSwiat(m(n))]));
  const gAnim = Z.newGroup("g_animated_objects"), gProxy = Z.newGroup("g_proxy_objects");
  function promienie(fn) {
    gAnim.removeFromParent(); sw.add(gProxy);
    try { return fn(); } finally { sw.add(gAnim); gProxy.removeFromParent(); }
  }
  Z.cloneModelFromCastmember("mesiek", "Group01", gra.member("kubus"));
  Z.cloneModelFromCastmember("master", "box01", gra.member("kubus_proxy"));
  const druga = new THREE.PerspectiveCamera(60, 4 / 3, 8, 4000);
  druga.up.set(0, 0, 1); sw.add(druga);
  const kam = {};
  for (const n of ["old", "qba1", "qba2", "przedniaPA", "przedniaR", "qba5", "przod"]) {
    kam[n] = new THREE.Object3D(); kam[n].userData.typ = "camera";
    (n === "qba5" ? sw : m("master")).add(kam[n]);
  }
  translate(kam.old, -240, 0, 150);
  translate(kam.qba1, 0, -15, 40); translate(kam.qba2, 0, 15, 40);
  translate(kam.przedniaPA, 1000, 0, 0); translate(kam.przedniaR, -80, -30, 50);
  translate(kam.przod, 30, 0, -50);
  for (const [n, x, y] of [["100", 490, 20], ["zycie3", 12, 12], ["K01_pokoj_badan", 12, 352],
    ["miecz01", 210, 12], ["okosmoka01", 300, 12], ["amuletslonca01", 390, 12]]) gra.addOverlay(n, x, y);
  gra.overlay(3).blend = 0;
  const animacje = ["kubus_run", "kubus_take", "kubus_ambient1", "kubus_hit", "kubus_takeup", "kubus_jump",
    "wynalazca_ambient1", "wynalazca_ambient2", "wynalazca_talk", "wynalazca_happy",
    "chrabaszcz_walk", "chrabaszcz_attack1", "chrabaszcz_attack2", "szperacz_walk1", "szperacz_walk2",
    "szperacz_attack1", "szperacz_attack2", "wojownik_walk", "wojownik_attack1", "wojownik_attack2", "wojownik_attack3"];
  for (const n of animacje) Z.cloneMotionFromCastmember(n, "Group01", gra.member(n === "kubus_jump" ? "kubus_runjump" : n));
  function zatrzymaj(o) {
    const kp = o.userData.keyframePlayer; kp.currentLoopState = 0; kp.aktualizuj(0); kp.pause();
  }
  const drzwi = [1, 2].map(i => {
    const n = "wejscie" + nr(i), modele = ["lewe", "prawe", "gora"].map(s => m(`${n}_${s}`));
    modele.forEach(zatrzymaj);
    return { modele, pozycja: pozycjaSwiat(modele[2]), proxy: m(`kolizja_${n}_mur`), opened: false };
  });
  const schowki = [["miecz", "mieczInserted", 2, 4], ["oko_smoka", "okoInserted", 1, 5], ["amulet_slonca", "amuletInserted", 3, 6]]
    .map(([n, flaga, i, slot]) => {
      const model = m(n), schowek = m("schowek_" + nr(i)); zatrzymaj(schowek);
      return { model, schowek, pozycja: pozycjaSwiat(model), flaga, slot };
    });
  const typy = ["chrabaszcz", "szperacz", "wojownik"];
  const znaczniki = Object.fromEntries(typy.map(typ => [typ, Z.modele().filter(o => new RegExp(`^${typ}_ph\\d+$`).test(o.name))
    .sort((a, b) => a.name.localeCompare(b.name))]));
  const trasy = Object.fromEntries(typy.map(typ => [typ, znaczniki[typ].map((_, i) => Z.modele()
    .filter(o => new RegExp(`^w\\d+_${typ}${nr(i + 1)}$`).test(o.name))
    .sort((a, b) => parseInt(a.name.slice(1)) - parseInt(b.name.slice(1))).map(pozycjaSwiat))]));
  for (const o of Z.modele()) {
    if (/proxy/i.test(o.name)) { sw.attach(o); ustawWidocznosc(o, 0); }
    else if (/kolizj/i.test(o.name)) { gProxy.attach(o); ustawWidocznosc(o, 0); }
    else gAnim.attach(o);
    if (/_ph|^ph_|^w\d+_|over/i.test(o.name)) ustawWidocznosc(o, 0);
  }
  schowki.forEach(s => ustawWidocznosc(s.model, 0));
  sw.attach(m("master")); ustawWidocznosc(m("master"), 0); gProxy.removeFromParent();
  function obiekt(n, czlonek, rodzic, animowany) {
    const c = gra.member(czlonek), model = Z.cloneModelFromCastmember(n, c.modele()[0].name, c);
    rodzic.add(model);
    if (animowany) {
      identity(model); Z.addModifier(model, "bonesPlayer");
      const bp = model.userData.bonesPlayer; bp.lockTranslation = "all"; bp.extractRootMotion = false;
      // Modele tego etapu zapisują korzeń Hips w układzie modelu.
      bp.absoluteRoot = true;
    } else ustawWidocznosc(model, 0);
    return model;
  }
  function przeciwnik(typ, ph, trasa) {
    const start = pozycjaSwiat(ph), wysokosc = typ === "chrabaszcz" ? 66 : typ === "szperacz" ? 58 : 70;
    const grupa = Z.newGroup(typ + ph.name + "group"); gAnim.attach(grupa); grupa.position.copy(start).z += wysokosc;
    const model = obiekt(typ + ph.name, typ, grupa, true); model.rotation.z = Math.PI / 2;
    const bp = model.userData.bonesPlayer;
    const proxy = obiekt(model.name + "proxy", typ + "_proxy", sw, false);
    const celObrotu = new THREE.Object3D(), prog = typ === "szperacz" ? 150 : 200;
    const chod = () => typ + "_walk" + (typ === "szperacz" ? 1 + Math.floor(Math.random() * 2) : "");
    bp.queue(chod()); bp.blend = null; bp.aktualizuj(0);
    const aktor = { typ, model, grupa, proxy, start, trasa, currentWP: 0, odwiedzone: new Set(), ataki: 0, stepFrame() {
      if (gra.koniec || !trasa.length) return;
      if (typ === "wojownik" && G.kompWystartowal) { bp.pause(); return; }
      const p = grupa.position, cel = pozycjaSwiat(m("master")), dystans = p.distanceTo(cel);
      const atak = dystans < prog, wp = trasa[aktor.currentWP];
      if (atak) {
        pointAt(grupa, V(cel.x, cel.y, p.z), V(0, 0, 1), V(1, 0, 0), V(0, 0, 1));
        if (bp.playList.some(a => a.name.includes("walk"))) while (bp.playList.length) bp.removeLast();
        if (!bp.playList.length) {
          const i = 1 + Math.floor(Math.random() * (typ === "wojownik" ? 3 : 2));
          bp.queue(`${typ}_attack${i}`); G.obrazenia = 5; aktor.ataki++;
          dzwiek.puppetSound(2, `sound_${typ}_atak${i}`);
        }
      } else {
        celObrotu.position.copy(p);
        pointAt(celObrotu, V(wp.x, wp.y, p.z), V(0, 0, 1), V(1, 0, 0), V(0, 0, 1));
        grupa.quaternion.slerp(celObrotu.quaternion, 0.2);
        translate(grupa, typ === "chrabaszcz" ? 3 : typ === "wojownik" ? 3.5 : 5, 0, 0);
        if (Math.hypot(p.x - wp.x, p.y - wp.y, start.z + 80 - wp.z) < 100) {
          aktor.odwiedzone.add(aktor.currentWP); aktor.currentWP = (aktor.currentWP + 1) % trasa.length;
        }
        if (!bp.playList.length) bp.queue(chod());
        if (dystans < 450 && !dzwiek.soundBusy(3)) dzwiek.puppetSound(3, `sound_${typ}_walk`);
      }
      proxy.position.copy(p).z += 10 - wysokosc;
    } };
    proxy.position.copy(grupa.position).z += 10 - wysokosc;
    Z.deleteModel(ph.name); gra.dodajAktora(aktor); return aktor;
  }
  const przeciwnicy = typy.flatMap(typ => znaczniki[typ].map((ph, i) => przeciwnik(typ, ph, trasy[typ][i])));
  const model = obiekt("wynalazca", "wynalazca", gAnim, true);
  model.position.copy(punkty.wynalazca).z += 53;
  const proxy = obiekt("wynalazcaproxy", "wynalazca_proxy", sw, false); proxy.position.copy(punkty.wynalazca);
  const bp = model.userData.bonesPlayer; bp.rootLock = 1;
  const wynalazca = { model, proxy, rozmowy: 0, stepFrame() {
    if (gra.koniec) return;
    const p = pozycjaSwiat(m("master")), dystans = p.distanceTo(punkty.wynalazca);
    pointAt(model, V(p.x, p.y, model.position.z), V(0, 0, 1), V(0, -1, 0), V(0, 0, 1));
    if (G.finalRozpoczety) {
      // Czekamy na pełną animację powitania; wcześniejsze rozmowy nie są warunkiem finału.
      if (!bp.playList.length) { gra.koniec = true; zakonczenie("wygrana"); }
      return;
    }
    if (G.kompWystartowal && dystans < 200) {
      while (bp.playList.length) bp.removeLast();
      bp.queue("wynalazca_happy"); G.finalRozpoczety = true;
      dzwiek.puppetSound(4, "sound_wynalazca_happy");
    } else if (!bp.playList.length) {
      if (dystans < 200 && wynalazca.rozmowy < 2) {
        bp.queue("wynalazca_talk"); wynalazca.rozmowy++; dzwiek.puppetSound(4, "sound_wynalazca_talk");
      } else {
        const i = 1 + Math.floor(Math.random() * 2); bp.queue("wynalazca_ambient" + i);
        if (dystans < 600) dzwiek.puppetSound(4, "sound_Wynalazca_ambient" + i);
      }
    }
    if (dystans >= 200) wynalazca.rozmowy = 0;
  } };
  gra.dodajAktora(wynalazca);
  const { Kubus } = utworzPostacie({ gra, G, Z, m, sw, gAnim, gProxy, kam, druga, zakonczenie, promienie,
    change_energy, change_coins() {}, odlegloscKamery: 180, silaSkoku: 25,
    profilKamery: { wysokosc: 75, cel: 40, kolizjaWysokosc: 150, kolizjaCel: 70, progKolizji: 250 } });
  const player = new Kubus(m("master"), m("master"), m("mesiek"), punkty.start, 500);
  gra.timeout(33, () => { if (!gra.koniec) player.step(); });
  gra.ustawSwiat(Z, druga, { kolor: new THREE.Color(0, 204 / 255, 1), far: 4000 });
  oswietl(Z, gra.scena, { punktowe: true }); change_energy();
  const energia = m("slup-energii"), materialyEnergii = new Set();
  energia.traverse(o => {
    if (!o.isMesh) return;
    const klon = mat => {
      const kopia = mat.clone(); kopia.onBeforeCompile = mat.onBeforeCompile;
      kopia.customProgramCacheKey = mat.customProgramCacheKey; materialyEnergii.add(kopia); return kopia;
    };
    o.material = Array.isArray(o.material) ? o.material.map(klon) : klon(o.material);
  });
  const tekstury = [1, 2, 3, 4, 5].map(i => {
    const t = new THREE.Texture(gra.bitmapa(nr(i) + "_energia")); t.flipY = false; t.needsUpdate = true; return t;
  });
  let plusByl = false, minusByl = false, texTime = -Infinity, klatkaEnergii = 0;
  try { gra.tempo = Math.min(80, Math.max(10, parseInt(localStorage.getItem("KubusTempo")) || 30)); } catch { /* Bez zapisu. */ }
  gra.exitFrame = () => {
    if (gra.koniec) return;
    const plus = keyPressed(24) || keyPressed(69), minus = keyPressed(27) || keyPressed(78);
    if (plus && !plusByl) gra.tempo = Math.min(80, gra.tempo + 5);
    if (minus && !minusByl) gra.tempo = Math.max(10, gra.tempo - 5);
    if (plus && !plusByl || minus && !minusByl) try { localStorage.setItem("KubusTempo", String(gra.tempo)); } catch { /* Bez zapisu. */ }
    plusByl = plus; minusByl = minus;
    const p = pozycjaSwiat(m("master")); gra.overlay(3).blend = 0;
    for (const d of drzwi) if (!d.opened && p.distanceTo(d.pozycja) < 300) {
      d.opened = true; d.modele.forEach(o => o.userData.keyframePlayer.play());
      Z.deleteModel(d.proxy.name); dzwiek.puppetSound(5, "otwieranie_drzwi");
    }
    if (p.distanceTo(punkty.start) < 200) komunikat("01");
    if (p.distanceTo(punkty.sala) < 200) komunikat("02");
    if (p.distanceTo(punkty.wynalazca) < 150) komunikat(G.kompWystartowal ? "04" : "03");
    for (const s of schowki) if (!G[s.flaga] && p.distanceTo(s.pozycja) < 150) {
      komunikat("00");
      if (G.action) {
        G[s.flaga] = true; ustawWidocznosc(s.model, 1); s.schowek.userData.keyframePlayer.play();
        gra.overlay(s.slot).loc[1] = -100; dzwiek.puppetSound(6, "zamykanie_schowka");
      }
    }
    if (!G.kompWystartowal && schowki.every(s => G[s.flaga])) {
      G.kompWystartowal = true; dzwiek.puppetSound(5, "sound_computer_on");
    }
    if (G.kompWystartowal && gra.milliSeconds - texTime >= 100) {
      texTime = gra.milliSeconds;
      const tekstura = tekstury[[0, 1, 2, 3, 4, 3, 2, 1][klatkaEnergii++ % 8]];
      for (const mat of materialyEnergii) { mat.map = mat.emissiveMap = tekstura; mat.needsUpdate = true; }
    }
  };
  function komunikat(n) { gra.overlay(3).obraz = gra.bitmapa(`K${n}_pokoj_badan`); gra.overlay(3).blend = 100; }
  function change_energy() {
    if (G.energy <= 0) {
      G.energy = 100; G.lives--; gra.overlay(2).obraz = gra.bitmapa("zycie" + Math.max(1, G.lives));
      if (G.lives < 1 && !gra.koniec) { gra.koniec = true; zakonczenie("przegrana"); }
    }
    gra.overlay(1).obraz = gra.bitmapa(String(Math.trunc(G.energy / 5) * 5));
  }
  return { G, V, punkty, drzwi, schowki, przeciwnicy, wynalazca, energia, player, promienie };
}
