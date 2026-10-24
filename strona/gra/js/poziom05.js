// Dziedziniec pałacu szoguna: reguły z 05_dziedziniec_palacu_szoguna.dcr (ProjectorRays).
import * as THREE from "./vendor/three.module.min.js";
import { dzwiek, keyPressed, pozycjaSwiat, identity, translate, pointAt } from "./silnik.js";
import { ustawWidocznosc } from "./w3d.js";
import { utworzPostacie } from "./postacie.js";
import { oswietl } from "./poziom01.js";

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const zawiera = (s, t) => s.toLowerCase().includes(t.toLowerCase());

export function uruchomPoziom(gra, zakonczenie) {
  const G = { speed: 0, car_rotation: 90, lives: 3, energy: 100, coin_number: 0,
    action: 0, obrazenia: 0, enemyNear: 0, crystals_number: 0, wasFlying: false,
    coins_positions: [], coins_refs: [], carrots_positions: [], carrots_refs: [],
    crystals_positions: [], crystals_refs: [] };
  const Z = gra.member("ziemia"), sw = Z.swiat, m = (n) => Z.model(n);
  const gAnim = Z.newGroup("g_animated_objects"), gProxy = Z.newGroup("g_proxy_objects");
  function promienie(fn) {
    gAnim.removeFromParent(); sw.add(gProxy);
    try { return fn(); }
    finally { sw.add(gAnim); gProxy.removeFromParent(); }
  }
  const punkty = { start: pozycjaSwiat(m("start1_ph")), smok: pozycjaSwiat(m("smok_ph01")),
    koniec: pozycjaSwiat(m("ph_koniec_etapu")) };
  Z.cloneModelFromCastmember("mesiek", "Group01", gra.member("kubus"));
  Z.cloneModelFromCastmember("master", "box01", gra.member("kubus_proxy"));
  const druga = new THREE.PerspectiveCamera(70, 4 / 3, 5, 4000);
  druga.up.set(0, 0, 1); sw.add(druga);
  const kam = {};
  for (const n of ["old", "qba1", "qba2", "przedniaPA", "przedniaR", "qba5", "przod"]) {
    kam[n] = new THREE.Object3D(); kam[n].userData.typ = "camera";
    (n === "qba5" ? sw : m("master")).add(kam[n]);
  }
  translate(kam.old, -280, 0, 50);
  translate(kam.qba1, 0, -15, 40); translate(kam.qba2, 0, 15, 40);
  translate(kam.przedniaPA, 1000, 0, 0); translate(kam.przedniaR, -80, -30, 50);
  translate(kam.przod, 30, 0, -50);
  for (const [n, x, y] of [["100", 490, 20], ["moneta", 563, 398], ["zycie3", 12, 12],
    ["L0", 498, 423], ["P0", 532, 423], ["k01_dziedziniec_japonia", 12, 352]]) gra.addOverlay(n, x, y);
  gra.overlay(6).blend = 0;
  for (const [n, czlonek] of [["kubus_run", "kubus_run"], ["kubus_take", "kubus_take"],
    ["kubus_ambient1", "kubus_ambient1"], ["kubus_jump", "kubus_runjump"], ["kubus_hit", "kubus_hit"],
    ...["ambient1", "walk", "attack"].map((n) => [`samuraj_${n}`, `samuraj_${n}`]),
    ...["walk", "attack1", "attack2"].map((n) => [`kungfu_${n}`, `mistrz_kungfu_${n}`]),
    ...["ambient1", "ambient2", "fly", "show", "attack1"].map((n) => [`smok_${n}`, `smok_${n}`])]) {
    Z.cloneMotionFromCastmember(n, "Group01", gra.member(czlonek));
  }
  function obiekt(n, czlonek, p) {
    const c = gra.member(czlonek), o = Z.cloneModelFromCastmember(n, c.modele()[0].name, c);
    identity(o); gAnim.attach(o); o.position.copy(p); Z.addModifier(o, "bonesPlayer");
    return o;
  }
  const drzwi = Array.from({ length: 21 }, (_, i) => {
    const nr = String(i + 1).padStart(2, "0"), model = m(`drzwi${nr}_mur`), proxy = m(`kolizja_drzwi${nr}_mur`);
    proxy.position.copy(model.position);
    return { model, proxy, pozycja: pozycjaSwiat(model), baza: pozycjaSwiat(model), opened: false };
  });
  const brama = [m("duze drzwi_01_mur"), m("duze drzwi_02_mur")];
  for (const o of [...drzwi.flatMap((d) => [d.model, d.proxy]), ...brama]) {
    const kp = o.userData.keyframePlayer;
    kp.currentLoopState = 0; kp.aktualizuj(0); kp.pause();
  }
  // Tak jak w inicjalizacji Lingo: skrzydła i smok blokują wejście zamiast dodatkowej ściany.
  Z.deleteModel("kolizja_duze drzwi_mur");
  const zamkniete = Z.modele().filter((o) => /^kolizja_off_drzwi/.test(o.name)).map(pozycjaSwiat);
  const patrole = [];
  for (const [typ, czlonek] of [["samuraj", "samuraj"], ["kungfu", "mistrz_kungfu"]]) {
    const znaczniki = Z.modele().filter((o) => o.name.startsWith(typ + "_ph"));
    znaczniki.forEach((ph, i) => {
      const trasa = Z.modele().filter((o) => o.name.startsWith(`w${String(i + 1).padStart(2, "0")}_${typ}_`))
        .sort((a, b) => a.name.localeCompare(b.name)).map(pozycjaSwiat);
      const p = pozycjaSwiat(ph), wysokosc = typ === "samuraj" ? 28.5 : 42;
      // Mierzymy podłoże tuż pod znacznikiem: kung-fu patroluje piwnicę,
      // a promień z góry umieściłby go na powierzchni dziedzińca.
      p.z = (promienie(() => Z.modelsUnderRay(V(p.x, p.y, p.z + 20), V(0, 0, -1)))
        .find((h) => zawiera(h.model.name, "podloze"))?.isectPosition.z ?? p.z) + wysokosc;
      const o = obiekt(typ + i, czlonek, p);
      const c = gra.member(czlonek + "_proxy");
      const proxy = Z.cloneModelFromCastmember(o.name + "proxy", c.modele()[0].name, c);
      identity(proxy); sw.attach(proxy); ustawWidocznosc(proxy, 0);
      // Ruch patrolu jest liczony jawnie (4 jednostki/klatkę), nie z korzenia klipu.
      o.userData.bonesPlayer.rootLock = 1; o.userData.bonesPlayer.lockTranslation = "all";
      const r = patrol(o, proxy, typ, trasa, wysokosc); patrole.push(r); gra.dodajAktora(r);
      Z.deleteModel(ph.name);
    });
  }
  const smok = obiekt("smok", "smok", V(punkty.smok.x, punkty.smok.y, 150));
  const cSmok = gra.member("smok_proxy");
  const smokProxy = Z.cloneModelFromCastmember("smokproxy", cSmok.modele()[0].name, cSmok);
  identity(smokProxy); sw.attach(smokProxy); ustawWidocznosc(smokProxy, 0);
  // Hips smoka ma klatki w układzie modelu, także w animacjach stania.
  // Odjęcie pozy wiązania podnosiło siatkę o 48 jednostek przy podejściu.
  // Lot pozostaje w szkielecie; kolejne animacje nie przesuwają całego modelu.
  smok.userData.bonesPlayer.absoluteRoot = true;
  smok.userData.bonesPlayer.extractRootMotion = false;
  for (const ph of [...Z.modele()]) {
    if (!zawiera(ph.name, "krysztal_ph")) continue;
    const p = pozycjaSwiat(ph), c = gra.member("crystal");
    const o = Z.cloneModelFromCastmember("krysztal" + G.crystals_refs.length, "krysztal", c);
    o.position.copy(p); gAnim.attach(o);
    G.crystals_positions.push(p.clone()); G.crystals_refs.push(o.name); Z.deleteModel(ph.name);
  }
  for (const o of Z.modele()) {
    if (zawiera(o.name, "proxy")) { sw.attach(o); ustawWidocznosc(o, 0); }
    else if (zawiera(o.name, "kolizja") || zawiera(o.name, "kolizje")) { gProxy.attach(o); ustawWidocznosc(o, 0); }
    else gAnim.attach(o);
    if (zawiera(o.name, "_ph") || /^w\d+_/.test(o.name)) ustawWidocznosc(o, 0);
  }
  sw.attach(m("master")); ustawWidocznosc(m("master"), 0); gProxy.removeFromParent();
  const { Kubus } = utworzPostacie({ gra, G, Z, m, sw, gAnim, gProxy, kam, druga,
    zakonczenie, promienie, change_energy, change_coins() {}, odlegloscKamery: 180 });
  const player = new Kubus(m("master"), m("master"), m("mesiek"), punkty.start, 500);
  gra.timeout(33, () => { if (!gra.koniec) player.step(); });
  gra.ustawSwiat(Z, druga, { kolor: new THREE.Color(0, 204 / 255, 1), far: 4000 });
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
    const p = pozycjaSwiat(m("master")), postac = pozycjaSwiat(m("mesiek"));
    G.crystals_positions.forEach((punkt, i) => {
      if (postac.distanceTo(punkt) >= 50) return;
      Z.deleteModel(G.crystals_refs[i]); G.crystals_positions[i] = V(-999999, -999999, -999999);
      G.crystals_number++; dzwiek.puppetSound(7, "sound_get_crystal");
      gra.overlay(4).obraz = gra.bitmapa("L" + Math.trunc(G.crystals_number / 10));
      gra.overlay(5).obraz = gra.bitmapa("P" + G.crystals_number % 10);
    });
    gra.overlay(6).blend = 0;
    if (p.distanceTo(punkty.start) < 200) komunikat("01");
    if (zamkniete.some((punkt) => p.distanceTo(punkt) < 200)) komunikat("02");
    for (const d of drzwi) {
      // Lingo kopiuje pozycję skrzydła wprost. Dwa znaczniki proxy w pliku
      // są przesunięte o ~145 jednostek; zachowanie tej różnicy blokuje przejście.
      d.proxy.position.copy(d.model.position);
      if (p.distanceTo(d.pozycja) < 200) {
        komunikat("03");
        if (G.action && !d.opened) {
          d.opened = true; d.model.userData.keyframePlayer.play();
          dzwiek.puppetSound(5, "sound_the_doors_paper");
        }
      }
    }
    const d = p.distanceTo(punkty.smok), bp = smok.userData.bonesPlayer;
    if (d < 200) komunikat(G.crystals_number < 50 ? "04" : "05");
    if (!bp.playList.length) {
      if (d < 200 && G.crystals_number < 50) {
        bp.queue("smok_attack1"); G.enemyNear = 1; dzwiek.puppetSound(2, "sound_smok_attack");
      } else if (d < 200 && G.crystals_number === 50 && !G.wasFlying) {
        G.wasFlying = true; brama.forEach((o) => o.userData.keyframePlayer.play());
        bp.queue("smok_fly"); dzwiek.puppetSound(2, "sound_smok_fly");
        smokProxy.removeFromParent();
      } else if (d < 200 && G.wasFlying) {
        bp.queue("smok_ambient2"); dzwiek.puppetSound(2, "sound_smok_ambient1");
      } else if (d < 600 && d >= 200) {
        bp.queue("smok_ambient1"); dzwiek.puppetSound(2, "sound_smok_ambient1");
      }
    }
    smokProxy.position.copy(smok.position);
    // Zakończenie wymaga otwartej bramy, także gdy ktoś dotrze do znacznika od drugiej strony.
    if (G.wasFlying && p.distanceTo(punkty.koniec) < 150) { gra.koniec = true; zakonczenie("wygrana"); }
  };
  function komunikat(n) { gra.overlay(6).obraz = gra.bitmapa(`k${n}_dziedziniec_japonia`); gra.overlay(6).blend = 100; }
  function change_energy() {
    if (G.energy <= 0) {
      G.energy = 100; G.lives--; gra.overlay(3).obraz = gra.bitmapa("zycie" + Math.max(1, G.lives));
      if (G.lives < 1 && !gra.koniec) { gra.koniec = true; zakonczenie("przegrana"); }
    }
    gra.overlay(1).obraz = gra.bitmapa(String(Math.trunc(G.energy / 5) * 5));
  }
  function patrol(model, proxy, typ, trasa, wysokosc) {
    const bp = model.userData.bonesPlayer;
    let waypoint = 0;
    // Te siatki patrzą w -Y. Oryginał obracał je o 90° względem grupy,
    // która szła w +X; tu obrót i przesunięcie stosujemy bezpośrednio do modelu.
    const obroc = (cel) => pointAt(model, V(cel.x, cel.y, model.position.z), V(0, 0, 1), V(0, -1, 0), V(0, 0, 1));
    proxy.position.copy(model.position).z -= wysokosc;
    return { model, proxy, trasa, typ, wysokosc, get waypoint() { return waypoint; }, stepFrame() {
      if (gra.koniec || !trasa.length) return;
      const cel = pozycjaSwiat(m("master")), d = cel.distanceTo(model.position);
      const chodzi = bp.playList[0]?.name.includes("walk");
      if (d < 150) {
        if (chodzi) bp.removeLast();
        obroc(cel);
        if (!bp.playList.length) {
          bp.queue(typ === "samuraj" ? "samuraj_attack" : "kungfu_attack" + (1 + Math.floor(Math.random() * 2)));
          G.enemyNear = 1;
          const kanal = typ === "samuraj" ? 7 : 6;
          if (!dzwiek.soundBusy(kanal)) dzwiek.puppetSound(kanal, `sound_${typ}_attack`);
        }
      } else {
        obroc(trasa[waypoint]); translate(model, 0, -4, 0);
        if (!bp.playList.length) bp.queue(typ + "_walk", 1);
        const kanal = typ === "samuraj" ? 7 : 6;
        if (d < (typ === "samuraj" ? 450 : 400) && d > 200 && !dzwiek.soundBusy(kanal)) {
          dzwiek.puppetSound(kanal, `sound_${typ}_walk`);
        }
        // Oryginalne 80 jednostek uwzględniało także 60 jednostek wysokości korzenia.
        if (Math.hypot(model.position.x - trasa[waypoint].x, model.position.y - trasa[waypoint].y) < Math.sqrt(80 ** 2 - 60 ** 2)) {
          waypoint = (waypoint + 1) % trasa.length;
        }
      }
      proxy.position.copy(model.position).z -= wysokosc;
    } };
  }
  return { G, V, punkty, drzwi, brama, patrole, smok, player, promienie };
}
