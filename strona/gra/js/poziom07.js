// Komnata szoguna: reguły z 07_komnata_szoguna.dcr (ProjectorRays).
import * as THREE from "./vendor/three.module.min.js";
import { dzwiek, keyPressed, pozycjaSwiat, identity, translate, pointAt } from "./silnik.js";
import { ustawWidocznosc } from "./w3d.js";
import { utworzPostacie } from "./postacie.js";
import { oswietl } from "./poziom01.js";

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const zawiera = (s, t) => s.toLowerCase().includes(t.toLowerCase());

export function uruchomPoziom(gra, zakonczenie) {
  const G = { speed: 0, car_rotation: 270, lives: 3, energy: 100, coin_number: 0,
    action: 0, obrazenia: 0, enemyNear: 0, haveLuk: true, haveOko: false, schodyOtwarte: false, szkatulkaOtwarta: false,
    crystals_number: 0, crystals_positions: [], crystals_refs: [],
    coins_positions: [], coins_refs: [], carrots_positions: [], carrots_refs: [] };
  const Z = gra.member("ziemia"), sw = Z.swiat, m = (n) => Z.model(n);
  const gAnim = Z.newGroup("g_animated_objects"), gProxy = Z.newGroup("g_proxy_objects");
  function promienie(fn) {
    gAnim.removeFromParent(); sw.add(gProxy);
    try { return fn(); }
    finally { sw.add(gAnim); gProxy.removeFromParent(); }
  }
  const punkty = { start: pozycjaSwiat(m("start1_ph")), oko: pozycjaSwiat(m("okosmoka_ph")),
    szogun: pozycjaSwiat(m("szogun_ph01")), szkatulka: pozycjaSwiat(m("ninja_szkatulka_w")),
    koniec: pozycjaSwiat(m("portal")) };
  Z.cloneModelFromCastmember("mesiek", "Group01", gra.member("kubus"));
  Z.cloneModelFromCastmember("master", "box01", gra.member("kubus_proxy"));
  const druga = new THREE.PerspectiveCamera(60, 4 / 3, 5, 3000);
  druga.up.set(0, 0, 1); sw.add(druga);
  const kam = {};
  for (const n of ["old", "qba1", "qba2", "przedniaPA", "przedniaR", "qba5", "przod"]) {
    kam[n] = new THREE.Object3D(); kam[n].userData.typ = "camera";
    (n === "qba5" ? sw : m("master")).add(kam[n]);
  }
  translate(kam.old, -240, 0, 50);
  translate(kam.qba1, 0, -15, 40); translate(kam.qba2, 0, 15, 40);
  translate(kam.przedniaPA, 1000, 0, 0); translate(kam.przedniaR, -80, -30, 50);
  translate(kam.przod, 30, 0, -50);
  for (const [n, x, y] of [["100", 490, 20], ["image_lukikolczan", 280, 12],
    ["image_strzala", 563, 398], ["zycie3", 12, 12], ["L0", 498, 423], ["P0", 532, 423],
    ["k01_komnata_szoguna", 50, 352]]) gra.addOverlay(n, x, y);
  gra.overlay(7).blend = 0;
  for (const n of ["kubus_run", "kubus_take", "kubus_ambient1", "kubus_hit", "kubus_runjump",
    "ninja_ambient1", "ninja_ambient2", "ninja_run", ...[1, 2, 3, 4, 5].map((i) => "ninja_attack" + i),
    "szogun_ambient1", "szogun_portal", "szogun_show"]) {
    Z.cloneMotionFromCastmember(n === "kubus_runjump" ? "kubus_jump" : n, "Group01", gra.member(n));
  }
  const drzwi = Array.from({ length: 8 }, (_, i) => {
    const nr = String(i + 1).padStart(2, "0"), model = m(`drzwi_${nr}`), proxy = m(`kolizja_drzwi_${nr}_mur`);
    return { model, proxy, pozycja: pozycjaSwiat(model), opened: false };
  });
  const schody = Array.from({ length: 4 }, (_, i) => {
    const nr = String(i + 1).padStart(2, "0");
    const proxy = m(`kolizja_schody_${nr}_podloze_mur`);
    proxy.position.z -= 200;
    return { a: m(`schody_${nr}a`), b: m(`schody_${nr}b`), proxy };
  });
  const wieko = m("ninja_szkatulka_w"), portal = m("portal");
  for (const o of [...drzwi.map((d) => d.model), ...schody.flatMap((s) => [s.a, s.b]), wieko]) {
    const kp = o.userData.keyframePlayer;
    kp.currentLoopState = 0; kp.aktualizuj(0); kp.pause();
  }
  ustawWidocznosc(portal, 0);
  function obiekt(n, czlonek, p, animowany = true) {
    const c = gra.member(czlonek), o = Z.cloneModelFromCastmember(n, c.modele()[0].name, c);
    identity(o); gAnim.attach(o); o.position.copy(p);
    if (animowany) {
      Z.addModifier(o, "bonesPlayer");
      o.userData.bonesPlayer.rootLock = 1; o.userData.bonesPlayer.lockTranslation = "all";
    }
    return o;
  }
  const oko = obiekt("oko_smoka", "oko_smoka", punkty.oko, false);
  oko.visible = false;
  for (const ph of [...Z.modele()]) {
    if (!zawiera(ph.name, "ph_strzala")) continue;
    const p = pozycjaSwiat(ph), o = obiekt("strzala" + G.crystals_refs.length, "strzala", p, false);
    G.crystals_positions.push(p.clone()); G.crystals_refs.push(o.name); Z.deleteModel(ph.name);
  }
  const ninja = Z.modele().filter((o) => zawiera(o.name, "ninja_ph")).map((ph, i) => {
    // Stopy leżą ~42 jednostki poniżej korzenia; +55 z Lingo unosiło ninja.
    const start = pozycjaSwiat(ph), model = obiekt("ninja" + i, "ninja", start.clone().add(V(0, 0, 42)));
    const c = gra.member("ninja_proxy"), proxy = Z.cloneModelFromCastmember(model.name + "proxy", c.modele()[0].name, c);
    identity(proxy); sw.attach(proxy); ustawWidocznosc(proxy, 0);
    Z.deleteModel(ph.name);
    const aktor = przeciwnik(model, proxy, start); gra.dodajAktora(aktor); return aktor;
  });
  // Dół siatki szoguna jest ~52 jednostki pod korzeniem, podest ma Z≈46,4.
  const szogun = obiekt("szogun", "szogun", punkty.szogun.clone().add(V(0, 0, 54)));
  const c = gra.member("szogun_proxy"), szogunProxy = Z.cloneModelFromCastmember("szogunproxy", c.modele()[0].name, c);
  identity(szogunProxy); sw.attach(szogunProxy); szogunProxy.position.copy(punkty.szogun).z += 2.2; ustawWidocznosc(szogunProxy, 0);
  for (const o of Z.modele()) {
    if (zawiera(o.name, "proxy")) { sw.attach(o); ustawWidocznosc(o, 0); }
    else if (zawiera(o.name, "kolizja") || zawiera(o.name, "kolizje")) { gProxy.attach(o); ustawWidocznosc(o, 0); }
    else gAnim.attach(o);
    if (zawiera(o.name, "_ph") || o.name.startsWith("ph_") || zawiera(o.name, "kungfu") || zawiera(o.name, "over")) ustawWidocznosc(o, 0);
  }
  sw.attach(m("master")); ustawWidocznosc(m("master"), 0); gProxy.removeFromParent();
  const { Kubus } = utworzPostacie({ gra, G, Z, m, sw, gAnim, gProxy, kam, druga,
    zakonczenie, promienie, change_energy, change_coins() {}, odlegloscKamery: 180,
    // Lingo: qba5 +30, upcam 45/120; próg ściany 250.
    // Oryginalny cel +140 chowa postać pod kadrem przy wejściu; ograniczamy go do +70.
    profilKamery: { wysokosc: 75, cel: 40, kolizjaWysokosc: 150, kolizjaCel: 70, progKolizji: 250 } });
  const player = new Kubus(m("master"), m("master"), m("mesiek"), punkty.start, 500);
  gra.timeout(33, () => { if (!gra.koniec) player.step(); });
  gra.ustawSwiat(Z, druga, { kolor: new THREE.Color(0, 204 / 255, 1), near: 2700, far: 3000 });
  oswietl(Z, gra.scena); change_energy();
  const materialPortalu = Z.shader("portal").material;
  const tekstury = [1, 2, 3, 4].map((i) => {
    const tex = new THREE.Texture(gra.bitmapa(`portal0${i}`)); tex.flipY = false; tex.needsUpdate = true; return tex;
  });
  let portalKlatka = 0, poprzedniePlus = false, poprzednieMinus = false;
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
    const p = pozycjaSwiat(m("master")), postac = pozycjaSwiat(m("mesiek"));
    G.crystals_positions.forEach((punkt, i) => {
      if (postac.distanceTo(punkt) >= 50) return;
      Z.deleteModel(G.crystals_refs[i]); G.crystals_positions[i] = V(-999999, -999999, -999999);
      G.crystals_number++; dzwiek.puppetSound(7, "sound_get_crystal");
      gra.overlay(5).obraz = gra.bitmapa("L" + Math.trunc(G.crystals_number / 10));
      gra.overlay(6).obraz = gra.bitmapa("P" + G.crystals_number % 10);
    });
    gra.overlay(7).blend = 0;
    if (p.distanceTo(punkty.start) < 150) komunikat("01");
    function otworz(d) {
      if (d.opened) return;
      d.opened = true; d.model.userData.keyframePlayer.play();
      if (!dzwiek.soundBusy(5)) dzwiek.puppetSound(5, "sound_the_doors_wood");
    }
    for (const d of drzwi) {
      if (p.distanceTo(d.pozycja) < 250 && !d.opened) { komunikat("02"); if (G.action) otworz(d); }
      d.proxy.position.copy(d.model.position); d.proxy.quaternion.copy(d.model.quaternion); d.proxy.scale.copy(d.model.scale);
    }
    // Osobna flaga: wcześniejsze otwarcie drzwi przez Ctrl nie blokuje schodów.
    if (G.crystals_number === 20 && !G.schodyOtwarte) {
      G.schodyOtwarte = true; drzwi.forEach(otworz);
      schody.forEach((s) => { s.a.userData.keyframePlayer.play(); s.b.userData.keyframePlayer.play(); });
      m("kolizja_podest_mur").removeFromParent();
      gra.overlay(2).obraz = gra.bitmapa("image_lukikolczan1");
    }
    if (G.schodyOtwarte) for (const s of schody) s.proxy.position.z = pozycjaSwiat(s.a).z + 50;
    const bp = szogun.userData.bonesPlayer, blisko = p.distanceTo(punkty.oko) < 150;
    pointAt(szogun, V(p.x, p.y, szogun.position.z), V(0, 0, 1), V(0, -1, 0), V(0, 0, 1));
    if (!bp.playList.length) {
      if (blisko && G.haveLuk && G.crystals_number === 20) bp.queue("szogun_show");
      else if (blisko && G.haveOko) bp.queue("szogun_portal");
      else bp.queue("szogun_ambient1");
    }
    if (bp.playList[0]?.name === "szogun_show" && bp.czas > 2.4 && G.haveLuk) {
      G.haveLuk = false; gra.overlay(2).loc = [280, -80];
    }
    if (p.distanceTo(punkty.szkatulka) < 200) {
      komunikat(G.szkatulkaOtwarta || G.haveOko ? "04" : "03");
      if (G.action && !G.haveLuk && !G.szkatulkaOtwarta) {
        G.szkatulkaOtwarta = true; wieko.userData.keyframePlayer.play();
      }
    }
    const kp = wieko.userData.keyframePlayer;
    oko.visible = G.szkatulkaOtwarta && !G.haveOko && kp.czas > 0.1;
    if (oko.visible) oko.position.z = punkty.oko.z + Math.min(kp.czas * 45, 65);
    // Lingo sprawdzało czas = 0 i pozwalało zabrać nagrodę z zamkniętej szkatułki.
    if (!G.haveLuk && G.szkatulkaOtwarta && !G.haveOko && kp.czas >= kp.ruch.dlugosc && p.distanceTo(punkty.oko) < 200) {
      G.haveOko = true; Z.deleteModel("oko_smoka"); ustawWidocznosc(portal, 1);
      gra.overlay(2).obraz = gra.bitmapa("okosmoka"); gra.overlay(2).loc = [280, 12];
      dzwiek.puppetSound(7, "sound_portal"); dzwiek.puppetSound(6, "sound_get_crystal");
    }
    materialPortalu.map = materialPortalu.emissiveMap = tekstury[[0, 1, 2, 3, 2, 1][portalKlatka++ % 6]];
    materialPortalu.needsUpdate = true;
    if (G.haveOko && p.distanceTo(punkty.koniec) < 150) { gra.koniec = true; zakonczenie("wygrana"); }
  };
  function komunikat(n) { gra.overlay(7).obraz = gra.bitmapa(`k${n}_komnata_szoguna`); gra.overlay(7).blend = 100; }
  function change_energy() {
    if (G.energy <= 0) {
      G.energy = 100; G.lives--; gra.overlay(4).obraz = gra.bitmapa("zycie" + Math.max(1, G.lives));
      if (G.lives < 1 && !gra.koniec) { gra.koniec = true; zakonczenie("przegrana"); }
    }
    gra.overlay(1).obraz = gra.bitmapa(String(Math.trunc(G.energy / 5) * 5));
  }
  function przeciwnik(model, proxy, start) {
    const bp = model.userData.bonesPlayer;
    proxy.position.copy(model.position).z -= 42;
    return { model, proxy, start, stepFrame() {
      if (gra.koniec) return;
      const cel = pozycjaSwiat(m("master")), dystans = cel.distanceTo(model.position);
      pointAt(model, V(cel.x, cel.y, model.position.z), V(0, 0, 1), V(0, -1, 0), V(0, 0, 1));
      const wStrefie = cel.distanceTo(start) < 500 && dystans < 500;
      const kierunek = V(cel.x - model.position.x, cel.y - model.position.y, 0).normalize();
      const blokada = wStrefie && promienie(() => Z.modelsUnderRay(model.position.clone().add(V(0, 0, -20)), kierunek))
        .some((h) => h.distance < 80 && (zawiera(h.model.name, "mur") || (zawiera(h.model.name, "proxy") && h.model !== proxy)));
      const biegnie = wStrefie && dystans >= 100 && !blokada;
      if (bp.playList[0]?.name === "ninja_run" && !biegnie) bp.removeLast();
      if (!bp.playList.length) {
        if (wStrefie && dystans < 100 && !blokada) {
          bp.queue("ninja_attack" + (1 + Math.floor(Math.random() * 5))); G.enemyNear = 1;
          if (!dzwiek.soundBusy(5)) dzwiek.puppetSound(5, "sound_ninja_attack" + (1 + Math.floor(Math.random() * 2)));
        } else if (biegnie) bp.queue("ninja_run", 1);
        else bp.queue("ninja_ambient" + (1 + Math.floor(Math.random() * 2)));
      }
      if (biegnie && bp.playList[0]?.name === "ninja_run") {
        model.position.addScaledVector(kierunek, 4);
        if (!dzwiek.soundBusy(4)) dzwiek.puppetSound(4, "sound_ninja_run");
      }
      proxy.position.copy(model.position).z -= 42;
    } };
  }
  return { G, V, punkty, drzwi, schody, wieko, portal, oko, szogun, ninja, player, promienie };
}
