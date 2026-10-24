// „Mały dziedziniec”: reguły z 03_maly_dziedziniec.dcr (ProjectorRays).
import * as THREE from "./vendor/three.module.min.js";
import { dzwiek, keyPressed, pozycjaSwiat, osXSwiat, identity, translate, pointAt } from "./silnik.js";
import { ustawWidocznosc } from "./w3d.js";
import { utworzPostacie } from "./postacie.js";
import { oswietl } from "./poziom01.js";

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const zawiera = (s, t) => s.toLowerCase().includes(t.toLowerCase());

export function uruchomPoziom(gra, zakonczenie) {
  const G = { speed: 0, car_rotation: 90, lives: 3, energy: 100, coin_number: 0,
    action: 0, obrazenia: 0, readyAnimate: 0, enemyKilled: 0, doorsOpened: false,
    coins_positions: [], coins_refs: [], carrots_positions: [], carrots_refs: [] };
  const Z = gra.member("ziemia"), sw = Z.swiat, m = (n) => Z.model(n);
  const gAnim = Z.newGroup("g_animated_objects"), gProxy = Z.newGroup("g_proxy_objects");
  function promienie(fn) {
    gAnim.removeFromParent(); sw.add(gProxy);
    try { return fn(); }
    finally { sw.add(gAnim); gProxy.removeFromParent(); }
  }
  const podlozePod = (p) => promienie(() => Z.modelsUnderRay(V(p.x, p.y, 1000), V(0, 0, -1))
    .find((h) => zawiera(h.model.name, "podloze"))?.isectPosition.z ?? 0);
  const punkty = { start: pozycjaSwiat(m("start1_ph")), dzwon: pozycjaSwiat(m("dzwon1")),
    wyjscie: pozycjaSwiat(m("Drzwi ruchome")) };
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
  for (const [n, x, y] of [["100", 490, 20], ["zycie3", 12, 12], ["K01_maly_dziedziniec", 80, 352]]) {
    gra.addOverlay(n, x, y);
  }
  gra.overlay(3).blend = 0;
  for (const [n, czlonek] of [["kubus_run", "kubus_run"], ["kubus_take", "kubus_take"],
    ["kubus_ambient1", "kubus_ambient1"], ["kubus_jump", "kubus_runjump"], ["kubus_hit", "kubus_hit"],
    ["kubus_fall_down", "kubus_fall_down"], ["rycerz_maly_walk", "rycerz_maly_walk"],
    ["rycerz_maly_atak", "rycerz_maly_attack1"], ["rycerz_czarny_walk", "rycerz_czarny_walk"],
    ["rycerz_czarny_ambient1", "rycerz_czarny_ambient1"], ["rycerz_czarny_attack3", "rycerz_czarny_attack3"],
    ...[1, 2, 3, 4].map((i) => [`rycerz_maly_ambient${i}`, `rycerz_maly_ambient${i}`])]) {
    Z.cloneMotionFromCastmember(n, "Group01", gra.member(czlonek));
  }
  function obiekt(n, czlonek, p) {
    const o = Z.cloneModelFromCastmember(n, "Group01", gra.member(czlonek));
    identity(o); gAnim.attach(o); o.position.copy(p); Z.addModifier(o, "bonesPlayer");
    return o;
  }
  const rycerze = [], patrole = [];
  for (const ph of [...Z.modele()]) {
    const maly = zawiera(ph.name, "rycerzmaly1_ph"), czarny = zawiera(ph.name, "rycerzczarny1_ph");
    if (!maly && !czarny) continue;
    const czlonek = maly ? "rycerz_maly" : "rycerz_czarny", p = pozycjaSwiat(ph);
    // Strażnicy stoją na dziedzińcu. Promień puszczony z góry trafia też
    // w chodnik muru i przenosił jednego z czarnych rycerzy na górną trasę.
    p.z = maly ? 22 : 35;
    const o = obiekt(czlonek + rycerze.length, czlonek, p);
    const c = gra.member(czlonek + "_proxy");
    const proxy = Z.cloneModelFromCastmember(o.name + "proxy", c.modele()[0].name, c);
    identity(proxy); sw.attach(proxy); proxy.position.copy(p); ustawWidocznosc(proxy, 0);
    const trasa = maly ? Z.modele().filter((w) => w.name.startsWith(`w${patrole.length + 1}_`))
      .sort((a, b) => a.name.localeCompare(b.name)).map(pozycjaSwiat) : [];
    const r = rycerz(o, proxy, p, maly, trasa);
    rycerze.push(r); if (maly) patrole.push(r);
    Z.deleteModel(ph.name);
  }
  Z.cloneMotionFromCastmember("marchew_lewitacja", "Group01", gra.member("marchew"));
  for (const ph of [...Z.modele()]) {
    if (!zawiera(ph.name, "marchewka1_ph")) continue;
    const p = pozycjaSwiat(ph);
    p.z = Math.max(p.z, podlozePod(p) + 12);
    const o = obiekt("marchew" + G.carrots_refs.length, "marchew", p);
    const bp = o.userData.bonesPlayer;
    bp.queue("marchew_lewitacja", 1); bp.blend = null; bp.aktualizuj(0);
    G.carrots_positions.push(p.clone()); G.carrots_refs.push(o.name); Z.deleteModel(ph.name);
  }
  for (const o of Z.modele()) {
    if (zawiera(o.name, "proxy")) { sw.attach(o); ustawWidocznosc(o, 0); }
    else if (zawiera(o.name, "kolizja") || zawiera(o.name, "kolizje")) { gProxy.attach(o); ustawWidocznosc(o, 0); }
    else gAnim.attach(o);
    if (zawiera(o.name, "_ph") || /^w\d+_\d+$/.test(o.name)) ustawWidocznosc(o, 0);
  }
  sw.attach(m("master")); ustawWidocznosc(m("master"), 0);
  for (const n of ["FLAGA1", "FLAGA2", "dzwon2"]) {
    const o = m(n); Z.addModifier(o, "bonesPlayer");
    const bp = o.userData.bonesPlayer;
    // Flagi mają klatki w układzie modelu. Dzwon wymaga ruchu względem
    // pozy wiązania: absolutny korzeń odrywa go od belek o 125 jednostek.
    bp.absoluteRoot = n !== "dzwon2"; bp.extractRootMotion = false;
    bp.queue(n, 1); bp.blend = null; bp.aktualizuj(0);
    if (n === "dzwon2") bp.pause();
  }
  const drzwi = m("Drzwi ruchome").userData.keyframePlayer;
  drzwi.pause(); drzwi.currentLoopState = 0;
  gProxy.removeFromParent();
  const { Kubus } = utworzPostacie({ gra, G, Z, m, sw, gAnim, gProxy, kam, druga,
    // Z dachów koszar na wschodni chodnik jest 185–240 jednostek przerwy
    // i około 100 w górę. Pełny łuk dotyczy wybicia z tych dachów; krótkie
    // skoki z ziemi, beczek i chodnika muru zachowują dotychczasowy przebieg.
    skok: { powierzchnia: "kolizja_koszary_podloze_mur", wysokosc: 130, klatki: 34 },
    zakonczenie, promienie, change_energy, change_coins() {}, przedKrokiem() {
      if (!G.enemyKilled) return;
      G.enemyKilled = 0; G.lives--; G.energy = 100; G.speed = 0; G.obrazenia = 0; G.enemyNear = 0;
      change_lives(); change_energy();
      player.reset(punkty.start, 90);
      G.readyAnimate = 0; G.doorsOpened = false;
      for (const r of rycerze) r.reset();
      zatrzymajDzwon();
      drzwi.czas = 0; drzwi.play(); drzwi.aktualizuj(0); drzwi.pause();
    } });
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
    gra.overlay(3).blend = 0;
    if (p.distanceTo(punkty.start) < 150) komunikat("01");
    if (p.distanceTo(punkty.wyjscie) < 80) komunikat("03");
    if (p.distanceTo(pozycjaSwiat(m("dzwon2"))) < 400) komunikat("02");
    if (!G.readyAnimate && G.action && postac.distanceTo(punkty.dzwon) < 160) {
      G.readyAnimate = 1;
      for (const r of patrole) r.patrol();
      const bp = m("dzwon2").userData.bonesPlayer;
      bp.czas = 0; bp.play(); dzwiek.puppetSound(6, "sound_bell");
    }
    if (G.readyAnimate && patrole.every((r) => !r.patroluje)) { G.readyAnimate = 0; zatrzymajDzwon(); }
    if (postac.distanceTo(punkty.wyjscie) < 150) {
      if (G.action && !G.doorsOpened) {
        G.doorsOpened = true; drzwi.play(); dzwiek.puppetSound(6, "sound_the_doors");
      }
      if (G.doorsOpened && drzwi.czas > 1) { gra.koniec = true; zakonczenie("wygrana"); }
    }
  };
  function komunikat(n) { gra.overlay(3).obraz = gra.bitmapa(`K${n}_maly_dziedziniec`); gra.overlay(3).blend = 100; }
  function change_lives() {
    gra.overlay(2).obraz = gra.bitmapa("zycie" + Math.max(1, G.lives));
    if (G.lives < 1 && !gra.koniec) { gra.koniec = true; zakonczenie("przegrana"); }
  }
  function change_energy() {
    if (G.energy <= 0) { G.energy = 100; G.lives--; change_lives(); }
    gra.overlay(1).obraz = gra.bitmapa(String(Math.trunc(G.energy / 5) * 5));
  }
  function zatrzymajDzwon() { m("dzwon2").userData.bonesPlayer.pause(); dzwiek.stop(6); }

  function rycerz(o, proxy, start, maly, trasa) {
    const bp = o.userData.bonesPlayer, baza = maly ? "rycerz_maly_" : "rycerz_czarny_";
    let patroluje = false, waypoint = 0, zadanyCios = false, poprzedniCzasChodu = 0;
    function animuj(n, petla = false) {
      while (bp.playList.length) bp.removeLast();
      bp.rootLock = !maly || n === "walk" ? 0 : 1;
      bp.queue(baza + n, petla ? 1 : 0); bp.play(); zadanyCios = false;
      poprzedniCzasChodu = 0;
    }
    function obroc(cel) { pointAt(o, V(cel.x, cel.y, o.position.z), V(0, 0, 1), V(1, 0, 0), V(0, 0, 1)); }
    const aktor = { model: o, get patroluje() { return patroluje; }, get waypoint() { return waypoint; },
      patrol() { patroluje = true; waypoint = 0; animuj("walk", true); },
      reset() {
        patroluje = false; waypoint = 0; o.position.copy(start); proxy.position.copy(start);
        animuj("ambient1"); bp.blend = null; bp.aktualizuj(0);
      },
      stepFrame() {
        if (gra.koniec || G.enemyKilled) return;
        const cel = pozycjaSwiat(m("master")), p = pozycjaSwiat(o), d = p.distanceTo(cel);
        if (patroluje) {
          // Zapisane trasy obchodzą koszary; wysokość znaczników jest przy ziemi.
          const w = trasa[waypoint];
          if (Math.hypot(p.x - w.x, p.y - w.y) < 50) {
            waypoint++;
            if (waypoint === 7) zatrzymajDzwon();
            if (waypoint === trasa.length) { patroluje = false; waypoint = 0; animuj("ambient1"); }
          }
          if (patroluje) obroc(trasa[waypoint]);
        } else {
          const wStrefie = cel.distanceTo(start) < 800;
          const atak = bp.playList[0]?.name === baza + (maly ? "atak" : "attack3");
          if (atak && !zadanyCios && (maly || wStrefie) && bp.currentTime >= (maly ? 300 : 500)) {
            zadanyCios = true;
            if (!maly || d < 150) {
              if (maly) G.obrazenia += 5;
              else G.enemyKilled = 1;
            }
          }
          let ruch = bp.playList[0]?.name === baza + "walk";
          if (!maly && ruch) {
            // W oryginale rycerz kończy rozpoczęty krok, nawet gdy gracz
            // oddali się ponad 400 lub wyjdzie ze strefy 800. Przekroczenie
            // progu nie wstawia bezczynności w środku animacji chodu.
            const koniecKroku = bp.czas < poprzedniCzasChodu;
            poprzedniCzasChodu = bp.czas;
            if ((d >= 400 || !wStrefie) && koniecKroku) {
              animuj("ambient1"); ruch = false;
            } else if (d < 150 && wStrefie) {
              while (bp.playList.length) bp.removeLast();
              ruch = false;
            }
          }
          if (!maly && ruch && wStrefie) {
            obroc(cel);
            const przeszkoda = promienie(() => Z.modelsUnderRay(p, osXSwiat(o)))
              .some((h) => h.distance < 100 && (zawiera(h.model.name, "mur") ||
                (zawiera(h.model.name, "proxy") && h.model !== proxy)));
            if (przeszkoda) animuj("ambient1");
          }
          if (!bp.playList.length) {
            obroc(cel);
            if (d < 150 && (maly || wStrefie)) {
              animuj(maly ? "atak" : "attack3");
              dzwiek.puppetSound(7, maly ? "sound_maly_atak" : `sound_czarny_rycerz_attack${1 + Math.floor(Math.random() * 3)}`);
            } else if (!maly && wStrefie && d > 150 && d < 400) {
              animuj("walk", true);
              if (!dzwiek.soundBusy(7)) dzwiek.puppetSound(7, "sound_czarny_rycerz_walk");
            } else animuj(maly ? "ambient" + (1 + Math.floor(Math.random() * 4)) : "ambient1");
          }
        }
        proxy.position.copy(o.position);
      } };
    gra.dodajAktora(aktor); return aktor;
  }
  return { G, V, punkty };
}
