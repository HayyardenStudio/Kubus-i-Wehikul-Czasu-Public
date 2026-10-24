// Zamek króla Artura: reguły z 04_zamek_krola_artura.dcr (ProjectorRays).
import * as THREE from "./vendor/three.module.min.js";
import { dzwiek, keyPressed, pozycjaSwiat, osXSwiat, identity, translate, pointAt } from "./silnik.js";
import { ustawWidocznosc } from "./w3d.js";
import { utworzPostacie } from "./postacie.js";
import { oswietl } from "./poziom01.js";

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const zawiera = (s, t) => s.toLowerCase().includes(t.toLowerCase());

export function uruchomPoziom(gra, zakonczenie) {
  const G = { speed: 0, car_rotation: 90, lives: 3, energy: 100, coin_number: 0,
    action: 0, obrazenia: 0, enemyNear: 0, haveGraal: false, wasHappy: false,
    coins_positions: [], coins_refs: [], carrots_positions: [], carrots_refs: [] };
  const Z = gra.member("ziemia"), sw = Z.swiat, m = (n) => Z.model(n);
  const gAnim = Z.newGroup("g_animated_objects"), gProxy = Z.newGroup("g_proxy_objects");
  function promienie(fn) {
    gAnim.removeFromParent(); sw.add(gProxy);
    try { return fn(); }
    finally { sw.add(gAnim); gProxy.removeFromParent(); }
  }
  const punkty = { start: pozycjaSwiat(m("start1_ph")), graal: pozycjaSwiat(m("graal_ph")),
    dzwignia: pozycjaSwiat(m("ph_komunikat08")), krata: pozycjaSwiat(m("ph_komunikat07")),
    krol: pozycjaSwiat(m("krol_ph01")), koniec: pozycjaSwiat(m("ph_koniec_gry")) };
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
  for (const [n, x, y] of [["100", 490, 20], ["kielich", 260, -80],
    ["zycie3", 12, 12], ["k01_komnaty", 80, 352]]) gra.addOverlay(n, x, y);
  gra.overlay(4).blend = 0;
  for (const [n, czlonek, model = "Group01"] of [["kubus_run", "kubus_run"],
    ["kubus_take", "kubus_take"], ["kubus_ambient1", "kubus_ambient1"],
    ["kubus_jump", "kubus_runjump"], ["kubus_hit", "kubus_hit"],
    ["duch_walk", "duch_walk"], ["duch_attack1", "duch_attack1", "Group02"],
    ["rycerz_gruby_walk", "rycerz_gruby_walk"], ["rycerz_gruby_atak", "rycerz_gruby_attack1"],
    ["rycerz_gruby_ambient1", "rycerz_gruby_ambient1"],
    ...["ambient1", "angry", "happy"].flatMap((n) => [1, 2, 3].map((i) =>
      [`krol_${n === "ambient1" ? "ambient" : n}${i}`, `krol_${n}`, `Group0${i}`]))]) {
    Z.cloneMotionFromCastmember(n, model, gra.member(czlonek));
  }
  function obiekt(n, czlonek, p, model = "Group01") {
    const o = Z.cloneModelFromCastmember(n, model, gra.member(czlonek));
    identity(o); gAnim.attach(o); o.position.copy(p); Z.addModifier(o, "bonesPlayer");
    return o;
  }
  const krolowie = [];
  for (let i = 0; i < 3; i++) {
    const p = punkty.krol.clone().add(V(i === 1 ? 50 : i === 2 ? -50 : 0, 0, i === 0 ? 22 : 0));
    const o = obiekt(["krol", "kroldrugi", "kroltrzeci"][i], "krol", p, `Group0${i + 1}`);
    o.rotation.z = Math.PI / 2;
    o.userData.bonesPlayer.extractRootMotion = false;
    krolowie.push(o.userData.bonesPlayer);
  }
  const graal = Z.cloneModelFromCastmember("graal", gra.member("graal").modele()[0].name, gra.member("graal"));
  graal.position.copy(punkty.graal);
  const skrzynie = Z.modele().filter((o) => zawiera(o.name, "wieko"))
    .map((model) => ({ model, pozycja: pozycjaSwiat(model), opened: false }));
  const prawdziwa = skrzynie.find((s) => s.model.name === "2pietro_skrzynia_05_podloze_mur_wieko");
  const kraty = Z.modele().filter((o) => zawiera(o.name, "_krata_anim"))
    .map((model) => ({ model, pozycja: pozycjaSwiat(model), opened: false }));
  for (const { model } of [...skrzynie, ...kraty, { model: m("parter_krata_02") }]) {
    const kp = model.userData.keyframePlayer;
    kp.currentLoopState = 0; kp.aktualizuj(0); kp.pause();
  }
  for (const n of ["Group01", "Group02", "KOTARA1", "KOTARA2"]) {
    const o = m(n); Z.addModifier(o, "bonesPlayer");
    const bp = o.userData.bonesPlayer;
    bp.extractRootMotion = false; bp.queue(n); bp.blend = null; bp.aktualizuj(0); bp.pause();
  }
  // Odtwarzanie fragmentów 0–650 i 700–1330 ms, jak w wywołaniach Lingo.
  const odcinki = new Map();
  function odcinek(bp, od, doCzasu, nazwa) {
    if (nazwa) { while (bp.playList.length) bp.removeLast(); bp.queue(nazwa); bp.blend = null; }
    bp.czas = od; bp.play(); bp.aktualizuj(0); odcinki.set(bp, doCzasu);
  }
  const powiazaniaKrat = [
    ["parter_krata_anim_01", "kolizja_parter_krata_01_mur"],
    ["parter_krata_02", "kolizja_parter_krata_02_mur"],
    ["2pietro_krata_anim_01", "kolizja_2pietro_krata_01_mur"],
    ["2pietro_krata_anim_02", "kolizja_2pietro_krata_02_mur"],
  ].map(([n, k]) => ({ model: m(n), proxy: m(k), start: pozycjaSwiat(m(n)), baza: pozycjaSwiat(m(k)) }));
  const przeciwnicy = [];
  let nrDucha = 0;
  for (const ph of [...Z.modele()]) {
    const duch = zawiera(ph.name, "duch1_ph"), gruby = zawiera(ph.name, "rycerzgruby1_ph");
    if (!duch && !gruby) continue;
    const czlonek = duch ? "duch" : "rycerz_gruby", p = pozycjaSwiat(ph);
    // Początek ducha nie leży przy dole siatki: chód sięga ~32,5 jednostki
    // poniżej znacznika. Uniesienie zostawia ~10 jednostek nad podłogą
    // biblioteki i zapobiega przebijaniu sufitu sali tronowej.
    if (duch) p.z += 40;
    if (gruby) p.z = 25;
    const o = obiekt(czlonek + przeciwnicy.length, czlonek, p);
    const c = gra.member(czlonek + "_proxy");
    const proxy = Z.cloneModelFromCastmember(o.name + "proxy", c.modele()[0].name, c);
    identity(proxy); sw.attach(proxy); proxy.position.copy(p); ustawWidocznosc(proxy, 0);
    const trasa = duch ? Z.modele().filter((w) => w.name.startsWith(`w${nrDucha + 1}_duch_`))
      .sort((a, b) => a.name.localeCompare(b.name)).map(pozycjaSwiat) : [];
    if (duch) nrDucha++;
    przeciwnicy.push(przeciwnik(o, proxy, p, duch, trasa)); Z.deleteModel(ph.name);
  }
  for (const o of Z.modele()) {
    if (zawiera(o.name, "proxy")) { sw.attach(o); ustawWidocznosc(o, 0); }
    else if (zawiera(o.name, "kolizja") || zawiera(o.name, "kolizje")) { gProxy.attach(o); ustawWidocznosc(o, 0); }
    else gAnim.attach(o);
    if (zawiera(o.name, "_ph") || o.name.startsWith("ph_") || /^w\d+_duch_/.test(o.name)) ustawWidocznosc(o, 0);
  }
  sw.attach(m("master")); ustawWidocznosc(m("master"), 0); gProxy.removeFromParent();
  const { Kubus } = utworzPostacie({ gra, G, Z, m, sw, gAnim, gProxy, kam, druga,
    zakonczenie, promienie, change_energy, change_coins() {} });
  const player = new Kubus(m("master"), m("master"), m("mesiek"), punkty.start, 500);
  gra.timeout(33, () => { if (!gra.koniec) player.step(); });
  gra.ustawSwiat(Z, druga, { kolor: new THREE.Color(0, 204 / 255, 1), far: 4000 });
  oswietl(Z, gra.scena); change_energy();
  const lustro = Z.shader("lustro_tafla").material;
  const teksturyLustra = [1, 2, 3].map((i) => {
    const tex = new THREE.Texture(gra.bitmapa(`Lustro_tafla_UV${i}`));
    tex.flipY = false; tex.needsUpdate = true; return tex;
  });
  let tykniecie = 0, opoznienie = 0, lustroKlatka = 0, zapadniaRuszyla = false;
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
    for (const [bp, koniec] of odcinki) if (bp.czas >= koniec) {
      bp.czas = koniec; bp.aktualizuj(0); bp.pause(); odcinki.delete(bp);
    }
    for (const k of powiazaniaKrat) k.proxy.position.copy(k.baza).add(k.model.position.clone().sub(k.start));
    // Komunikaty i odliczanie oryginału pracują co 100 ms aktywnej gry.
    tykniecie += 1 / gra.tempo;
    if (tykniecie < 0.1 - 1e-8) return;
    tykniecie -= 0.1;
    if (opoznienie > 0 && --opoznienie === 1) {
      odcinek(m("parter_krata_02").userData.keyframePlayer, 0.7, 1.33);
      odcinek(m("Group01").userData.bonesPlayer, 0.7, 1.33, "Group01");
      dzwiek.puppetSound(3, "sound_mala_krata_close");
    }
    const p = pozycjaSwiat(m("master")); gra.overlay(4).blend = 0;
    for (const [punkt, n] of [[punkty.start, "01"], [punkty.krata, "07"], [punkty.dzwignia, "08"]]) {
      if (p.distanceTo(punkt) < 150) komunikat(n);
    }
    if (p.distanceTo(punkty.dzwignia) < 100 && G.action && opoznienie === 0) {
      odcinek(m("parter_krata_02").userData.keyframePlayer, 0, 0.65);
      odcinek(m("Group01").userData.bonesPlayer, 0, 0.65, "Group01");
      opoznienie = 55; dzwiek.puppetSound(3, "sound_mala_krata_open");
    }
    for (const s of skrzynie) if (p.distanceTo(s.pozycja) < 150) {
      if (!s.opened) {
        komunikat("06");
        if (G.action) { s.opened = true; s.model.userData.keyframePlayer.play(); dzwiek.puppetSound(7, "sound_open_trunk"); }
      } else if (s !== prawdziwa) komunikat("02");
    }
    if (!G.haveGraal && p.distanceTo(punkty.graal) < 250 && prawdziwa.model.userData.keyframePlayer.czas > 1.5) {
      Z.deleteModel("graal"); G.haveGraal = true; gra.overlay(2).loc[1] = 12; dzwiek.puppetSound(3, "sound_get_carrot");
    }
    for (const k of kraty) {
      const kp = k.model.userData.keyframePlayer;
      if (k.opened && kp.czas >= kp.ruch.dlugosc) k.opened = false;
      if (!k.opened && p.distanceTo(k.pozycja) < 100) {
        k.opened = true; kp.czas = 0; kp.play(); dzwiek.puppetSound(7, "sound_mala_krata_open");
      }
    }
    lustro.map = teksturyLustra[[0, 1, 2, 1][lustroKlatka++ % 4]]; lustro.needsUpdate = true;
    zachowanieKrola(p);
    if (G.wasHappy && p.distanceTo(punkty.koniec) < 100) { gra.koniec = true; zakonczenie("wygrana"); }
  };
  function komunikat(n) { gra.overlay(4).obraz = gra.bitmapa(`k${n}_komnaty`); gra.overlay(4).blend = 100; }
  function change_energy() {
    if (G.energy <= 0) {
      G.energy = 100; G.lives--;
      gra.overlay(3).obraz = gra.bitmapa("zycie" + Math.max(1, G.lives));
      if (G.lives < 1 && !gra.koniec) { gra.koniec = true; zakonczenie("przegrana"); }
    }
    gra.overlay(1).obraz = gra.bitmapa(String(Math.trunc(G.energy / 5) * 5));
  }
  function animujKrola(n) {
    krolowie.forEach((bp, i) => { bp.queue(`krol_${n}${i + 1}`); bp.play(); });
  }
  animujKrola("ambient");
  function zachowanieKrola(p) {
    const bp = krolowie[0], n = bp.playList[0]?.name ?? "", d = p.distanceTo(punkty.krol);
    const zapadnia = m("Group02").userData.bonesPlayer;
    if (n.includes("angry")) {
      if (bp.czas > 2.3 && !zapadniaRuszyla) {
        zapadniaRuszyla = true; odcinek(zapadnia, 0, 2, "Group02");
      }
      if (zapadniaRuszyla && zapadnia.czas > 0.55) m("kolizja_1pietro_zapadnia01_podloze").removeFromParent();
    }
    if (n.includes("happy") && bp.czas > 3.7 && !G.wasHappy) {
      G.wasHappy = true;
      for (const n of ["KOTARA1", "KOTARA2"]) m(n).userData.bonesPlayer.play();
      m("kolizja_1pietro_kotara_box01_mur").removeFromParent();
      dzwiek.puppetSound(5, "sound_kotary"); dzwiek.puppetSound(6, "sound_lustro", true);
    }
    if (d < 130 && !G.haveGraal) komunikat("03");
    if (d < 180 && G.wasHappy) komunikat("05");
    if (d < 120 && G.haveGraal && !G.wasHappy) komunikat("04");
    if (!bp.playList.length) {
      if (d < 140 && !G.haveGraal) {
        zapadniaRuszyla = false; animujKrola("angry"); dzwiek.puppetSound(4, "sound_krol_angry");
      } else if (d < 140 && G.haveGraal && !G.wasHappy) {
        animujKrola("happy"); gra.overlay(2).loc[1] = -112; dzwiek.puppetSound(4, "sound_krol_happy");
      } else {
        animujKrola("ambient");
        if (d > 140) {
          gProxy.add(m("kolizja_1pietro_zapadnia01_podloze"));
          odcinek(zapadnia, 0, 0, "Group02");
        }
      }
    }
  }
  function przeciwnik(o, proxy, start, duch, trasa) {
    const bp = o.userData.bonesPlayer;
    let waypoint = 0;
    const animuj = (n, petla = false) => {
      while (bp.playList.length) bp.removeLast();
      bp.rootLock = n.includes("walk") ? 0 : 1;
      bp.queue(n, petla ? 1 : 0); bp.play();
    };
    const obroc = (p) => pointAt(o, V(p.x, p.y, o.position.z), V(0, 0, 1), V(1, 0, 0), V(0, 0, 1));
    const aktor = { model: o, get waypoint() { return waypoint; }, stepFrame() {
      if (gra.koniec) return;
      const cel = pozycjaSwiat(m("master")), p = pozycjaSwiat(o), d = cel.distanceTo(p);
      const wStrefie = duch || cel.distanceTo(start) < 500;
      const chodzi = bp.playList[0]?.name.includes("walk");
      if (chodzi && d < 150) { bp.removeLast(); obroc(cel); }
      if (duch) {
        const w = trasa[waypoint];
        if (Math.hypot(p.x - w.x, p.y - w.y) < 50) waypoint = (waypoint + 1) % trasa.length;
        if (bp.playList[0]?.name.includes("walk")) obroc(trasa[waypoint]);
      } else if (chodzi) {
        obroc(cel);
        const blokada = promienie(() => Z.modelsUnderRay(p, osXSwiat(o)))
          .some((h) => h.distance < 100 && (zawiera(h.model.name, "mur") ||
            (zawiera(h.model.name, "proxy") && h.model !== proxy)));
        if (blokada || !wStrefie || d > 400) animuj("rycerz_gruby_ambient1");
      }
      if (!bp.playList.length) {
        if (wStrefie && d < 150) {
          obroc(cel); G.enemyNear = 1;
          animuj(duch ? "duch_attack1" : "rycerz_gruby_atak");
          dzwiek.puppetSound(7, duch ? "sound_duch_atak" : "sound_gruby_atak");
        } else if (duch) { obroc(trasa[waypoint]); animuj("duch_walk", true); }
        else if (wStrefie && d < 400) { obroc(cel); animuj("rycerz_gruby_walk", true); }
        else animuj("rycerz_gruby_ambient1");
      }
      proxy.position.copy(o.position);
    } };
    gra.dodajAktora(aktor); return aktor;
  }
  return { G, V, punkty, skrzynie, kraty };
}
