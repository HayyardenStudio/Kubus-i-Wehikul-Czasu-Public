// Pałac szoguna: reguły z 06_palac_szoguna.dcr (ProjectorRays).
import * as THREE from "./vendor/three.module.min.js";
import { dzwiek, keyPressed, pozycjaSwiat, identity, translate, pointAt } from "./silnik.js";
import { ustawWidocznosc } from "./w3d.js";
import { utworzPostacie } from "./postacie.js";
import { oswietl } from "./poziom01.js";

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const zawiera = (s, t) => s.toLowerCase().includes(t.toLowerCase());

export function uruchomPoziom(gra, zakonczenie) {
  const G = { speed: 0, car_rotation: 90, lives: 3, energy: 100, coin_number: 0,
    action: 0, obrazenia: 0, enemyNear: 0, haveLuk: false, haveKolczan: false,
    coins_positions: [], coins_refs: [], carrots_positions: [], carrots_refs: [] };
  const Z = gra.member("ziemia"), sw = Z.swiat, m = (n) => Z.model(n);
  const gAnim = Z.newGroup("g_animated_objects"), gProxy = Z.newGroup("g_proxy_objects");
  function promienie(fn) {
    gAnim.removeFromParent(); sw.add(gProxy);
    try { return fn(); }
    finally { sw.add(gAnim); gProxy.removeFromParent(); }
  }
  const punkty = { start: pozycjaSwiat(m("start1_ph")), luk: pozycjaSwiat(m("ph_luk")),
    kolczan: pozycjaSwiat(m("ph_kolczan")), koniec: pozycjaSwiat(m("drzwi_ninja_A_deski_mur")) };
  Z.cloneModelFromCastmember("mesiek", "Group01", gra.member("kubus"));
  Z.cloneModelFromCastmember("master", "box01", gra.member("kubus_proxy"));
  const druga = new THREE.PerspectiveCamera(70, 4 / 3, 5, 3000);
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
  for (const [n, x, y] of [["100", 490, 20], ["image_luk", 280, -80],
    ["zycie3", 12, 12], ["k01_palac_szoguna", 80, 352]]) gra.addOverlay(n, x, y);
  gra.overlay(4).blend = 0;
  for (const [n, czlonek] of [["kubus_run", "kubus_run"], ["kubus_take", "kubus_take"],
    ["kubus_ambient1", "kubus_ambient1"], ["kubus_jump", "kubus_runjump"], ["kubus_hit", "kubus_hit"],
    ...["ambient1", "ambient2", "walk", "attack1", "attack2"].map((n) => [`gejsza_${n}`, `gejsza_${n}`])]) {
    Z.cloneMotionFromCastmember(n, "Group01", gra.member(czlonek));
  }
  const drzwi = Array.from({ length: 30 }, (_, i) => {
    const nr = String(i + 1).padStart(2, "0"), model = m(`drzwi_${nr}_deski_mur`),
      proxy = m(`kolizja_drzwi_${nr}_deski_mur`);
    proxy.position.copy(model.position);
    return { model, proxy, pozycja: pozycjaSwiat(model), baza: pozycjaSwiat(model), opened: false };
  });
  const skrzynie = Z.modele().filter((o) => zawiera(o.name, "wieko"))
    .map((model) => ({ model, pozycja: pozycjaSwiat(model), opened: false }));
  const brama = [m("drzwi_ninja_A_deski_mur"), m("drzwi_ninja_B_deski_mur")];
  for (const model of [...drzwi.map((d) => d.model), ...skrzynie.map((s) => s.model), ...brama]) {
    const kp = model.userData.keyframePlayer;
    kp.currentLoopState = 0; kp.aktualizuj(0); kp.pause();
  }
  Z.deleteModel("kolizja_duze drzwi_mur");
  for (const [n, czlonek, p] of [["luk", "luk", punkty.luk], ["strzaly", "strzaly", punkty.kolczan]]) {
    const c = gra.member(czlonek), o = Z.cloneModelFromCastmember(n, c.modele()[0].name, c);
    o.position.copy(p);
    // Kołysanie łuku przecina zamknięte wieko. Odsłaniamy go po odsunięciu pokrywy.
    if (n === "luk") o.visible = false;
  }
  const patrole = [];
  const znaczniki = Z.modele().filter((o) => o.name.startsWith("ph_gejsza"))
    .sort((a, b) => a.name.localeCompare(b.name));
  znaczniki.forEach((ph, i) => {
    const trasa = Z.modele().filter((o) => o.name.startsWith(`w${String(i + 1).padStart(2, "0")}_gejsza_`))
      .sort((a, b) => a.name.localeCompare(b.name)).map(pozycjaSwiat);
    // Dół animowanej siatki leży ~54 jednostki poniżej korzenia.
    // Oryginalne +65 zostawiało gejsze kilkanaście jednostek nad podłogą.
    const p = pozycjaSwiat(ph), wysokosc = 55;
    const c = gra.member("gejsza"), o = Z.cloneModelFromCastmember("gejsza" + i, c.modele()[0].name, c);
    identity(o); gAnim.attach(o); o.position.copy(p).z += wysokosc;
    Z.addModifier(o, "bonesPlayer");
    o.userData.bonesPlayer.rootLock = 1; o.userData.bonesPlayer.lockTranslation = "all";
    const cp = gra.member("gejsza_proxy"), proxy = Z.cloneModelFromCastmember(o.name + "proxy", cp.modele()[0].name, cp);
    identity(proxy); sw.attach(proxy); ustawWidocznosc(proxy, 0);
    const r = patrol(o, proxy, trasa, wysokosc); patrole.push(r); gra.dodajAktora(r);
    Z.deleteModel(ph.name);
  });
  for (const o of Z.modele()) {
    if (zawiera(o.name, "proxy")) { sw.attach(o); ustawWidocznosc(o, 0); }
    else if (zawiera(o.name, "kolizja") || zawiera(o.name, "kolizje")) { gProxy.attach(o); ustawWidocznosc(o, 0); }
    else gAnim.attach(o);
    if (zawiera(o.name, "_ph") || o.name.startsWith("ph_") || /^w\d+_/.test(o.name) ||
      zawiera(o.name, "kungfu") || zawiera(o.name, "over")) ustawWidocznosc(o, 0);
  }
  sw.attach(m("master")); ustawWidocznosc(m("master"), 0); gProxy.removeFromParent();
  const { Kubus } = utworzPostacie({ gra, G, Z, m, sw, gAnim, gProxy, kam, druga,
    zakonczenie, promienie, change_energy, change_coins() {}, odlegloscKamery: 240 });
  const player = new Kubus(m("master"), m("master"), m("mesiek"), punkty.start, 500);
  gra.timeout(33, () => { if (!gra.koniec) player.step(); });
  gra.ustawSwiat(Z, druga, { kolor: new THREE.Color(0, 204 / 255, 1), far: 3000 });
  oswietl(Z, gra.scena); change_energy();
  let poprzedniePlus = false, poprzednieMinus = false;
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
    gra.overlay(4).blend = 0;
    if (p.distanceTo(punkty.start) < 200) komunikat("01");
    for (const d of drzwi) {
      d.proxy.position.copy(d.model.position);
      if (p.distanceTo(d.pozycja) < 100 && !d.opened) {
        komunikat("02");
        if (G.action) {
          d.opened = true; d.model.userData.keyframePlayer.play();
          if (!dzwiek.soundBusy(5)) dzwiek.puppetSound(5, "sound_the_doors_paper");
        }
      }
    }
    for (const s of skrzynie) {
      if (p.distanceTo(s.pozycja) >= 150) continue;
      const specjalna = ["skrzynia_luk_wieko", "skrzynia_kolczan_wieko"].includes(s.model.name);
      if (!s.opened) komunikat("03");
      else if (!specjalna) komunikat("04");
      if (G.action && !s.opened) {
        s.opened = true; s.model.userData.keyframePlayer.play();
        dzwiek.puppetSound(7, "sound_open_trunk");
      }
    }
    for (const [flaga, punkt, przedmiot, wieko] of [
      ["haveLuk", punkty.luk, "luk", "skrzynia_luk_wieko"],
      ["haveKolczan", punkty.kolczan, "strzaly", "skrzynia_kolczan_wieko"]]) {
      const kp = m(wieko).userData.keyframePlayer;
      if (przedmiot === "luk" && !G.haveLuk) m("luk").visible = kp.czas >= 0.45;
      if (G[flaga] || p.distanceTo(punkt) >= 150) continue;
      if (kp.czas > 0.05) translate(m(przedmiot), 0, przedmiot === "strzaly" ? -1.5 : 0, przedmiot === "luk" ? 1.5 : 0);
      if (kp.czas <= 1.2) continue;
      G[flaga] = true; Z.deleteModel(przedmiot); dzwiek.puppetSound(3, "sound_get_crystal");
      gra.overlay(2).loc = [280, 12];
      gra.overlay(2).obraz = gra.bitmapa(G.haveLuk && G.haveKolczan ? "image_lukikolczan" : G.haveLuk ? "image_luk" : "image_kolczan");
      if (G.haveLuk && G.haveKolczan) brama.forEach((o) => o.userData.keyframePlayer.play());
    }
    if (G.haveLuk && G.haveKolczan) {
      if (p.distanceTo(punkty.luk) < 500 || p.distanceTo(punkty.kolczan) < 500) komunikat("05");
      if (p.distanceTo(punkty.koniec) < 100) { gra.koniec = true; zakonczenie("wygrana"); }
    }
  };
  function komunikat(n) { gra.overlay(4).obraz = gra.bitmapa(`k${n}_palac_szoguna`); gra.overlay(4).blend = 100; }
  function change_energy() {
    if (G.energy <= 0) {
      G.energy = 100; G.lives--; gra.overlay(3).obraz = gra.bitmapa("zycie" + Math.max(1, G.lives));
      if (G.lives < 1 && !gra.koniec) { gra.koniec = true; zakonczenie("przegrana"); }
    }
    gra.overlay(1).obraz = gra.bitmapa(String(Math.trunc(G.energy / 5) * 5));
  }
  function patrol(model, proxy, trasa, wysokosc) {
    const bp = model.userData.bonesPlayer;
    let waypoint = 0;
    const obroc = (cel) => pointAt(model, V(cel.x, cel.y, model.position.z), V(0, 0, 1), V(0, -1, 0), V(0, 0, 1));
    proxy.position.copy(model.position).z -= wysokosc;
    return { model, proxy, trasa, wysokosc, get waypoint() { return waypoint; }, stepFrame() {
      if (gra.koniec || !trasa.length) return;
      const cel = pozycjaSwiat(m("master")), d = cel.distanceTo(model.position);
      if (d < 150) {
        if (bp.playList[0]?.name.includes("walk")) bp.removeLast();
        if (!bp.playList.length) {
          obroc(cel); bp.queue("gejsza_attack" + (1 + Math.floor(Math.random() * 2)));
          G.enemyNear = 1;
          if (!dzwiek.soundBusy(7)) dzwiek.puppetSound(7, "sound_gejsza_atak");
        }
      } else {
        obroc(trasa[waypoint]); translate(model, 0, -4, 0);
        if (!bp.playList.length) bp.queue("gejsza_walk");
        if (d < 400 && d > 200 && !dzwiek.soundBusy(7)) dzwiek.puppetSound(7, "sound_gejsza_walk");
        if (Math.hypot(model.position.x - trasa[waypoint].x, model.position.y - trasa[waypoint].y) < Math.sqrt(80 ** 2 - 65 ** 2)) {
          waypoint = (waypoint + 1) % trasa.length;
        }
      }
      proxy.position.copy(model.position).z -= wysokosc;
    } };
  }
  return { G, V, punkty, drzwi, skrzynie, brama, patrole, player, promienie };
}
