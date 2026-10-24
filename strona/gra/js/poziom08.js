// Hol świątyni: reguły z 08_hol_swiatyni.dcr (ProjectorRays).
import * as THREE from "./vendor/three.module.min.js";
import { dzwiek, keyPressed, pozycjaSwiat, identity, translate, pointAt } from "./silnik.js";
import { ustawWidocznosc } from "./w3d.js";
import { utworzPostacie } from "./postacie.js";
import { oswietl } from "./poziom01.js";

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const zawiera = (s, t) => s.toLowerCase().includes(t.toLowerCase());
const nr = (n) => String(n).padStart(2, "0");

export function uruchomPoziom(gra, zakonczenie) {
  const G = { speed: 0, car_rotation: -90, lives: 3, energy: 100, coin_number: 0,
    action: 0, obrazenia: 0, enemyNear: 0, pochodnie: 0, przyKaplanie: false,
    drzwiOtwarte: false, drzwiKoncowe: false,
    coins_positions: [], coins_refs: [], carrots_positions: [], carrots_refs: [] };
  const Z = gra.member("ziemia"), sw = Z.swiat, m = (n) => Z.model(n);
  const punkty = { start: pozycjaSwiat(m("start1_ph")), kaplan: pozycjaSwiat(m("kaplan_ph01")),
    koniec: pozycjaSwiat(m("ph_koniec_etapu ")), drzwi: pozycjaSwiat(m("drzwi_koncowe_lewe")) };
  const gAnim = Z.newGroup("g_animated_objects"), gProxy = Z.newGroup("g_proxy_objects");
  function promienie(fn) {
    gAnim.removeFromParent(); sw.add(gProxy);
    try { return fn(); }
    finally { sw.add(gAnim); gProxy.removeFromParent(); }
  }
  Z.cloneModelFromCastmember("mesiek", "Group01", gra.member("kubus"));
  Z.cloneModelFromCastmember("master", "box01", gra.member("kubus_proxy"));
  const druga = new THREE.PerspectiveCamera(60, 4 / 3, 5, 4000);
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
  for (const [n, x, y] of [["100", 490, 20], ["moneta", 563, 340], ["zycie3", 12, 12],
    ["L0", 498, 423], ["P0", 532, 423], ["k01_hol_swiatyni", 12, 352]]) gra.addOverlay(n, x, y);
  gra.overlay(6).blend = 0;
  for (const [n, czlonek] of [["kubus_run", "kubus_run"], ["kubus_take", "kubus_takeup"],
    ["kubus_ambient1", "kubus_ambient1"], ["kubus_hit", "kubus_hit"], ["kubus_jump", "kubus_runjump"],
    ...["waz_attack1", "waz_attack2", "waz_walk1", "waz_walk2", "waz_walk3", "kaplan_ambient1", "kaplan_talk1"].map((n) => [n, n])]) {
    Z.cloneMotionFromCastmember(n, "Group01", gra.member(czlonek));
  }
  const drzwi = { sekretne: [], koncowe: [] };
  for (const typ of Object.keys(drzwi)) for (const strona of ["lewe", "prawe"]) {
    const model = m(`drzwi_${typ}_${strona}`), kp = model.userData.keyframePlayer;
    kp.currentLoopState = 0; kp.aktualizuj(0); kp.pause();
    drzwi[typ].push({ model, proxy: m(`kolizja_drzwi_${typ}_${strona}_mur`) });
  }
  const pochodnie = Array.from({ length: 16 }, (_, i) => {
    const model = m(`ogien${nr(i + 1)}`);
    ustawWidocznosc(model, 0);
    return { model, pozycja: pozycjaSwiat(model), zapalona: false };
  });
  const znacznikiWezy = Z.modele().filter((o) => /^waz_ph\d+$/.test(o.name)).sort((a, b) => a.name.localeCompare(b.name));
  const znacznikiStrzal = Z.modele().filter((o) => /^strzala_ph\d+\s*$/.test(o.name)).sort((a, b) => a.name.localeCompare(b.name));
  function trasa(typ, i) {
    return Z.modele().filter((o) => new RegExp(`^w\\d+_${typ}${nr(i + 1)}$`).test(o.name))
      .sort((a, b) => parseInt(a.name.slice(1), 10) - parseInt(b.name.slice(1), 10)).map(pozycjaSwiat);
  }
  const trasyWezy = znacznikiWezy.map((_, i) => trasa("waz", i));
  const trasyStrzal = znacznikiStrzal.map((_, i) => trasa("strzala", i));
  for (const o of Z.modele()) {
    if (zawiera(o.name, "proxy")) { sw.attach(o); ustawWidocznosc(o, 0); }
    else if (zawiera(o.name, "kolizja") || zawiera(o.name, "kolizje")) { gProxy.attach(o); ustawWidocznosc(o, 0); }
    else gAnim.attach(o);
    // Oryginał ma także znacznik „w21waz03”, bez podkreślenia po numerze.
    if (zawiera(o.name, "_ph") || o.name.startsWith("ph_") || /^w\d+_?(?:waz|strzala)\d+$/.test(o.name) || zawiera(o.name, "over")) ustawWidocznosc(o, 0);
  }
  sw.attach(m("master")); ustawWidocznosc(m("master"), 0); gProxy.removeFromParent();
  function obiekt(n, czlonek, rodzic = gAnim, animowany = true) {
    const c = gra.member(czlonek), o = Z.cloneModelFromCastmember(n, c.modele()[0].name, c);
    rodzic.add(o); identity(o);
    if (animowany) {
      Z.addModifier(o, "bonesPlayer");
      o.userData.bonesPlayer.rootLock = 1; o.userData.bonesPlayer.lockTranslation = "all";
    }
    return o;
  }
  const weze = znacznikiWezy.map((ph, i) => {
    const start = pozycjaSwiat(ph), grupa = Z.newGroup("serpent" + i + "group");
    // Dół siatki w chodzie leży ~77 jednostek pod korzeniem (w Lingo +60).
    gAnim.attach(grupa); grupa.position.copy(start).z += 78;
    const model = obiekt("serpent" + i, "waz", grupa); model.rotation.z = Math.PI / 2;
    // Proxy zachowuje obrót i skalę z W3D. identity() obracało bryłę pod podłogę.
    const c = gra.member("waz_proxy");
    const proxy = Z.cloneModelFromCastmember(model.name + "proxy", c.modele()[0].name, c);
    ustawWidocznosc(proxy, 0);
    const aktor = waz(model, grupa, proxy, start, trasyWezy[i]);
    Z.deleteModel(ph.name); gra.dodajAktora(aktor); return aktor;
  });
  const strzaly = znacznikiStrzal.map((ph, i) => {
    const start = pozycjaSwiat(ph).add(V(0, 0, -43)), grupa = Z.newGroup("arrow" + i + "group");
    gAnim.attach(grupa); grupa.position.copy(start);
    const model = obiekt("arrow" + i, "strzala", grupa, false); model.rotation.z = Math.PI / 2;
    const aktor = strzala(model, grupa, start, trasyStrzal[i]);
    Z.deleteModel(ph.name); gra.dodajAktora(aktor); return aktor;
  });
  // Widoczny schód ma Z=-33,23, kolizja jest o ~6,7 wyżej. Stopy są ~44,5 pod korzeniem.
  const kaplan = obiekt("kaplan", "kaplan"); kaplan.position.copy(punkty.kaplan).z += 45.3;
  const kaplanProxy = obiekt("kaplanproxy", "kaplan_proxy", sw, false);
  kaplanProxy.position.copy(punkty.kaplan).z += 7.6; ustawWidocznosc(kaplanProxy, 0);
  let rozmowy = 0;
  gra.dodajAktora({ stepFrame() {
    if (gra.koniec) return;
    const p = pozycjaSwiat(m("master")), bp = kaplan.userData.bonesPlayer, dystans = p.distanceTo(punkty.kaplan);
    pointAt(kaplan, V(p.x, p.y, kaplan.position.z), V(0, 0, 1), V(0, -1, 0), V(0, 0, 1));
    if (!bp.playList.length) {
      if (dystans < 200 && rozmowy < 3) {
        bp.queue("kaplan_talk1"); rozmowy++; dzwiek.puppetSound(4, "sound_kaplan_talk");
      } else {
        bp.queue("kaplan_ambient1");
        if (dystans >= 200) rozmowy = 0;
      }
    }
  } });
  const { Kubus } = utworzPostacie({ gra, G, Z, m, sw, gAnim, gProxy, kam, druga,
    zakonczenie, promienie, change_energy, change_coins() {}, odlegloscKamery: 180,
    profilKamery: { wysokosc: 75, cel: 40, kolizjaWysokosc: 150, kolizjaCel: 70, progKolizji: 250 } });
  const player = new Kubus(m("master"), m("master"), m("mesiek"), punkty.start, 500);
  gra.timeout(33, () => { if (!gra.koniec) player.step(); });
  gra.ustawSwiat(Z, druga, { kolor: new THREE.Color(0, 204 / 255, 1), far: 4000 });
  oswietl(Z, gra.scena); change_energy();
  const plomien = Z.shader("plomien").material;
  plomien.side = THREE.DoubleSide;
  const tekstury = Array.from({ length: 14 }, (_, i) => {
    const tex = new THREE.Texture(gra.bitmapa(`pochodnia${nr(i + 1)}`));
    tex.flipY = false; tex.needsUpdate = true; return tex;
  });
  let klatkaOgnia = 0, poprzedniePlus = false, poprzednieMinus = false;
  try { gra.tempo = Math.min(80, Math.max(10, parseInt(localStorage.getItem("KubusTempo"), 10) || 30)); } catch { /* Bez zapisu. */ }
  gra.exitFrame = () => {
    if (gra.koniec) return;
    const plus = keyPressed(24) || keyPressed(69), minus = keyPressed(27) || keyPressed(78);
    if (plus && !poprzedniePlus) gra.tempo = Math.min(80, gra.tempo + 5);
    if (minus && !poprzednieMinus) gra.tempo = Math.max(10, gra.tempo - 5);
    if ((plus && !poprzedniePlus) || (minus && !poprzednieMinus)) {
      try { localStorage.setItem("KubusTempo", String(gra.tempo)); } catch { /* Bez zapisu. */ }
    }
    poprzedniePlus = plus; poprzednieMinus = minus;
    const p = pozycjaSwiat(m("master"));
    gra.overlay(6).blend = 0;
    if (!G.przyKaplanie && p.distanceTo(punkty.start) < 150) komunikat("01");
    for (const t of pochodnie) {
      if (t.zapalona) pointAt(t.model, V(druga.position.x, druga.position.y, t.pozycja.z), V(0, 0, 1));
      if (t.zapalona || p.distanceTo(t.pozycja) >= 160 || G.speed >= 5 || keyPressed(126)) continue;
      komunikat("03");
      if (G.action) {
        t.zapalona = true; G.pochodnie++; ustawWidocznosc(t.model, 1);
        gra.overlay(4).obraz = gra.bitmapa("L" + Math.trunc(G.pochodnie / 10));
        gra.overlay(5).obraz = gra.bitmapa("P" + G.pochodnie % 10);
        dzwiek.puppetSound(5, "zapalenie_pochodni");
      }
    }
    plomien.map = plomien.emissiveMap = tekstury[klatkaOgnia++ % 14]; plomien.needsUpdate = true;
    if (p.distanceTo(punkty.kaplan) < 150) {
      G.przyKaplanie = true;
      if (G.pochodnie < 16) komunikat("02");
      else {
        if (!G.drzwiOtwarte) { G.drzwiOtwarte = true; otworz("sekretne", 4); }
        komunikat("04");
      }
    }
    if (G.drzwiOtwarte && !G.drzwiKoncowe && p.distanceTo(punkty.drzwi) < 250) {
      G.drzwiKoncowe = true; otworz("koncowe", 5);
    }
    if (G.drzwiKoncowe && p.distanceTo(punkty.koniec) < 100) {
      gra.koniec = true; zakonczenie("wygrana");
    }
  };
  function otworz(typ, kanal) {
    for (const d of drzwi[typ]) { d.model.userData.keyframePlayer.play(); Z.deleteModel(d.proxy.name); }
    dzwiek.puppetSound(kanal, "otwieranie_drzwi_koncowych_4.1");
  }
  function komunikat(n) { gra.overlay(6).obraz = gra.bitmapa(`k${n}_hol_swiatyni`); gra.overlay(6).blend = 100; }
  function change_energy() {
    if (G.energy <= 0) {
      G.energy = 100; G.lives--; gra.overlay(3).obraz = gra.bitmapa("zycie" + Math.max(1, G.lives));
      if (G.lives < 1 && !gra.koniec) { gra.koniec = true; zakonczenie("przegrana"); }
    }
    gra.overlay(1).obraz = gra.bitmapa(String(Math.trunc(G.energy / 5) * 5));
  }
  function waz(model, grupa, proxy, start, trasa) {
    const bp = model.userData.bonesPlayer;
    const aktor = { model, grupa, proxy, start, trasa, currentWP: 0, odwiedzone: new Set(), stepFrame() {
      if (gra.koniec || !trasa.length) return;
      const cel = pozycjaSwiat(m("master")), p = grupa.position, blisko = p.distanceTo(cel) < 150;
      if (blisko) {
        pointAt(grupa, V(cel.x, cel.y, p.z), V(0, 0, 1), V(1, 0, 0), V(0, 0, 1));
        if (bp.playList[0]?.name.includes("walk")) bp.removeLast();
        if (!bp.playList.length) {
          // Obrażenia także w biegu, jak w behavior_kubus tego poziomu.
          G.obrazenia = 5; bp.queue("waz_attack" + (1 + Math.floor(Math.random() * 2)));
          if (!dzwiek.soundBusy(3)) dzwiek.puppetSound(3, "sound_waz_atak");
        }
      } else {
        const wp = trasa[aktor.currentWP], celObrotu = new THREE.Object3D();
        celObrotu.position.copy(p);
        pointAt(celObrotu, V(wp.x, wp.y, p.z), V(0, 0, 1), V(1, 0, 0), V(0, 0, 1));
        grupa.quaternion.slerp(celObrotu.quaternion, 0.2); translate(grupa, 2, 0, 0);
        // Znaczniki leżą przy podłodze; wysokość korzenia nie zmienia osiągnięcia punktu.
        if (Math.hypot(p.x - wp.x, p.y - wp.y) < Math.sqrt(80 ** 2 - 60 ** 2)) {
          aktor.odwiedzone.add(aktor.currentWP); aktor.currentWP = (aktor.currentWP + 1) % trasa.length;
        }
        if (!bp.playList.length) bp.queue("waz_walk" + (1 + Math.floor(Math.random() * 3)));
        if (p.distanceTo(cel) < 450 && !dzwiek.soundBusy(7)) dzwiek.puppetSound(7, "sound_waz_ambient");
      }
      // W Lingo: korzeń +60, proxy -70, czyli podstawa 10 poniżej znacznika.
      // Poprawka wysokości widocznej siatki (+78) nie podnosi bryły kolizji.
      proxy.position.copy(p).z -= 88;
    } };
    proxy.position.copy(grupa.position).z -= 88;
    return aktor;
  }
  function strzala(model, grupa, start, trasa) {
    const aktor = { model, grupa, start, trasa, currentWP: 0, cykle: 0, trafienia: 0, stepFrame() {
      if (gra.koniec || !trasa.length) return;
      const p = grupa.position, cel = pozycjaSwiat(m("master"));
      if (p.distanceTo(cel) < 60) {
        G.obrazenia = 5; aktor.trafienia++; reset(); return;
      }
      const wp = trasa[aktor.currentWP];
      pointAt(grupa, V(wp.x, wp.y, p.z), V(0, 0, 1), V(1, 0, 0), V(0, 0, 1));
      if (aktor.currentWP === 0 && p.distanceTo(cel) < 200 && !dzwiek.soundBusy(4)) dzwiek.puppetSound(4, "strzaly_strzelanie");
      translate(grupa, 15, 0, 0);
      if (p.distanceTo(wp) < 50) {
        aktor.currentWP++;
        if (aktor.currentWP === trasa.length) { aktor.cykle++; reset(); }
      }
    } };
    function reset() { aktor.currentWP = 0; grupa.position.copy(start); }
    return aktor;
  }
  return { G, V, punkty, pochodnie, drzwi, weze, strzaly, kaplan, kaplanProxy, player, promienie };
}
