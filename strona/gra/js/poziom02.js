// „Duży dziedziniec”: reguły z 02_duzy_dziedziniec.dcr (ProjectorRays).
import * as THREE from "./vendor/three.module.min.js";
import { dzwiek, keyPressed, pozycjaSwiat, osXSwiat, identity, translate, rotate, pointAt } from "./silnik.js";
import { ustawWidocznosc } from "./w3d.js";
import { utworzPostacie } from "./postacie.js";
import { oswietl } from "./poziom01.js";

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const zawiera = (s, t) => s.toLowerCase().includes(t.toLowerCase());

export function uruchomPoziom(gra, zakonczenie) {
  const G = { speed: 0, car_rotation: 90, lives: 3, energy: 100, coin_number: 0,
    haveHandle: 0, haveRack1: 0, haveRack2: 0, haveHandleRepaired: 0, allInserted: 0,
    gateOpened: false, obrazenia: 0, action: 0, coins_positions: [], coins_refs: [],
    carrots_positions: [], carrots_refs: [] };
  const Z = gra.member("ziemia"), sw = Z.swiat;
  const m = (n) => Z.model(n);
  const dolacz = (g) => sw.add(g);
  const gAnim = Z.newGroup("g_animated_objects"), gProxy = Z.newGroup("g_proxy_objects");
  function promienie(fn) {
    gAnim.removeFromParent();
    dolacz(gProxy);
    try { return fn(); }
    finally { dolacz(gAnim); gProxy.removeFromParent(); }
  }
  const podlozePod = (p) => promienie(() => Z.modelsUnderRay(V(p.x, p.y, 1000), V(0, 0, -1))
    .find((hit) => zawiera(hit.model.name, "podloze"))?.isectPosition.z);
  const spawn = pozycjaSwiat(m("start1_ph"));
  Z.cloneModelFromCastmember("mesiek", "group01", gra.member("kubus"));
  Z.cloneModelFromCastmember("master", "box01", gra.member("kubus_proxy"));
  const druga = new THREE.PerspectiveCamera(70, 4 / 3, 5, 4000);
  druga.up.set(0, 0, 1);
  sw.add(druga);
  const kam = {};
  for (const n of ["old", "qba1", "qba2", "przedniaPA", "przedniaR", "qba5", "przod"]) {
    kam[n] = new THREE.Object3D();
    kam[n].userData.typ = "camera";
    (n === "qba5" ? sw : m("master")).add(kam[n]);
  }
  translate(kam.old, -280, 0, 50);
  translate(kam.qba1, 0, -15, 40);
  translate(kam.qba2, 0, 15, 40);
  translate(kam.przedniaPA, 1000, 0, 0);
  translate(kam.przedniaR, -80, -30, 50);
  translate(kam.przod, 30, 0, -50);
  for (const [n, x, y] of [["100", 490, 20], ["moneta", 563, 398], ["zycie3", 12, 12],
    ["L0", 498, 423], ["P0", 532, 423], ["k_01_duzy_dziedziniec", 0, 352],
    ["zebatka_1", 260, -80], ["zebatka_2", 340, -80], ["dzwigniakrzywa", 420, -80]]) gra.addOverlay(n, x, y);
  gra.overlay(6).blend = 0;

  const ruchy = [
    ["kubus_run", "kubus_run"], ["kubus_take", "kubus_take"], ["kubus_ambient1", "kubus_ambient1"],
    ["kubus_jump", "kubus_runjump"], ["kubus_hit", "kubus_hit"],
    ["rycerz_gruby_ambient1", "rycerz_gruby_ambient1"], ["rycerz_gruby_ambient2", "rycerz_gruby_ambient1"],
    ["rycerz_gruby_walk", "rycerz_gruby_walk"], ["rycerz_gruby_atak", "rycerz_gruby_attack1"],
    ["jezdziec_ambient1", "jezdziec_ambient1"], ["jezdziec_ambient2", "jezdziec_ambient2"],
    ["jezdziec_canter", "jezdziec_canter", "Group02"], ["kon_canter", "kon_canter"],
    ["kon_ambient1", "kon_ambient1"], ["kon_ambient2", "kon_ambient2"],
    ["kowal_ambient1", "kowal_ambient1"], ["kowal_talk1", "kowal_talk1"], ["kowal_cutscene", "kowal_cutscene", "Kowal"],
  ];
  for (const [n, czlonek, korzen = "Group01"] of ruchy) Z.cloneMotionFromCastmember(n, korzen, gra.member(czlonek));
  function obiekt(n, czlonek, korzen = "Group01") {
    const c = gra.member(czlonek);
    const o = Z.cloneModelFromCastmember(n, c.model(korzen) ? korzen : c.modele()[0].name, c);
    identity(o);
    gAnim.attach(o);
    Z.addModifier(o, "bonesPlayer");
    return o;
  }
  function zProxy(n, czlonek, p) {
    const o = obiekt(n, czlonek);
    o.position.copy(p);
    const c = gra.member(czlonek + "_proxy");
    const proxy = Z.cloneModelFromCastmember(n + "proxy", c.modele()[0].name, c);
    identity(proxy);
    sw.attach(proxy);
    proxy.position.copy(p);
    ustawWidocznosc(proxy, 0);
    return o;
  }
  const { Kubus, Rycerz } = utworzPostacie({ gra, G, Z, m, sw, gAnim, gProxy, kam, druga,
    zakonczenie, promienie, change_energy, change_coins });
  const przeciwnicy = [];
  for (const ph of [...Z.modele()]) {
    if (zawiera(ph.name, "rycerzgruby1_ph")) {
      const p = pozycjaSwiat(ph), n = "rycerz_gruby" + przeciwnicy.length;
      const o = zProxy(n, "rycerz_gruby", p);
      new Rycerz("gruby", m("master"), o, p, 600);
      // Na dziedzińcu grunt jest na Z≈0, stopy poniżej początku postaci.
      o.position.z = 25;
      przeciwnicy.push([o, o.position.clone()]);
      Z.deleteModel(ph.name);
    } else if (zawiera(ph.name, "rycerzkonny1_ph")) {
      const p = pozycjaSwiat(ph), n = "kon_rycerz" + przeciwnicy.length;
      const o = zProxy(n, "jezdziec", p), kon = obiekt(n + "drugi", "kon_");
      o.position.z = 70;
      kon.userData.bonesPlayer.rootLock = 1;
      przeciwnicy.push([o, o.position.clone()]);
      jezdziec(o, kon, p);
      Z.deleteModel(ph.name);
    }
  }
  function przedmioty(znak, czlonek, korzen, pozycje, referencje, animacja) {
    const baza = obiekt("wzor_" + czlonek, czlonek, korzen);
    if (animacja) Z.cloneMotionFromCastmember(animacja, "Group01", gra.member(czlonek));
    for (const ph of [...Z.modele()]) {
      if (!zawiera(ph.name, znak)) continue;
      const o = Z.cloneModel(baza, czlonek + referencje.length);
      o.position.copy(pozycjaSwiat(ph));
      if (animacja) {
        Z.addModifier(o, "bonesPlayer");
        const bp = o.userData.bonesPlayer;
        bp.queue(animacja, 1); bp.blend = null; bp.aktualizuj(0);
        o.position.z = Math.max(o.position.z, (podlozePod(o.position) ?? o.position.z) + 12);
      }
      pozycje.push(o.position.clone()); referencje.push(o.name);
      Z.deleteModel(ph.name);
    }
    Z.deleteModel(baza.name);
  }
  przedmioty("moneta1_ph", "moneta_rotate", "moneta03", G.coins_positions, G.coins_refs);
  przedmioty("marchewka1_ph", "marchew", "Group01", G.carrots_positions, G.carrots_refs, "marchew_lewitacja");
  const kowal = zProxy("kowal", "kowal", pozycjaSwiat(m("kowal_ph01")));
  kowal.position.z = 30; rotate(kowal, 0, 0, -90);
  m("kowalproxy").position.copy(kowal.position);
  Z.deleteModel("kowal_ph01");
  const narzedzia = [obiekt("narzedzia", "narzedzie1", "KOWAL"), obiekt("narzedzie2", "narzedzie2", "KOWAL")];
  for (const o of narzedzia) {
    // Obie wersje dźwigni mają szkielet kowala i ten sam klip naprawy.
    // Wspólny układ modelu utrzymuje uchwyt w dłoni także po wyprostowaniu.
    o.position.copy(kowal.position);
    o.quaternion.copy(kowal.quaternion);
    o.scale.copy(kowal.scale);
    ustawWidocznosc(o, 0);
  }
  const punkty = {};
  for (const [n, ph, czlonek] of [["zebatka1", "zebatka1_ph", "zebatka1"],
    ["zebatka2", "zebatka2_ph", "zebatka2"], ["dzwignia", "dzwignia_wygieta_anim_ph", "dzwignia wygieta_anim"]]) {
    punkty[n] = pozycjaSwiat(m(ph));
    const c = gra.member(czlonek);
    const o = Z.cloneModelFromCastmember(n, c.modele()[0].name, c);
    o.position.copy(punkty[n]); gAnim.attach(o);
    ustawWidocznosc(m(ph), 0);
  }
  punkty.start = spawn;
  punkty.kowal = pozycjaSwiat(kowal);
  punkty.mechanizm = pozycjaSwiat(m("zebatka1_na_stale"));
  punkty.dzwigniaBrama = pozycjaSwiat(m("dzwignia_na_stale"));
  punkty.wyjscie = pozycjaSwiat(m("drzwi_bramy_zebatki_kolizja_mur "));
  punkty.koniec = pozycjaSwiat(m("kolejny_etap_ph"));

  // Widoczne dekoracje osobno od uproszczonych brył kolizji.
  for (const o of Z.modele()) {
    if (zawiera(o.name, "proxy")) { sw.attach(o); ustawWidocznosc(o, 0); }
    else if (zawiera(o.name, "kolizja") || zawiera(o.name, "kolizje")) { gProxy.attach(o); ustawWidocznosc(o, 0); }
    else gAnim.attach(o);
    if (zawiera(o.name, "_ph") || o.name.startsWith("ph_")) ustawWidocznosc(o, 0);
  }
  sw.attach(m("master")); ustawWidocznosc(m("master"), 0);
  const mechanizm = ["dzwignia_na_stale", "zebatka1_na_stale", "zebatka2_na_stale"];
  const drzwi = ["brama_drzwi_mur", "Group25", "Group26", "Group27", "Group28", "Group29"];
  const krata = ["krata", "LAANCUCHPRAWY", "LANCUCHLEWY", "Group04", "Group05"];
  for (const n of [...mechanizm, ...drzwi, ...krata]) {
    const o = m(n); Z.addModifier(o, "bonesPlayer");
    const bp = o.userData.bonesPlayer;
    // Tylko siatka kraty ma pionowy ruch w układzie modelu. Łańcuchy, korby
    // i drzwi wymagają ruchu względem pozy wiązania, aby trafiały w swoje osie.
    bp.absoluteRoot = n === "krata";
    bp.extractRootMotion = false;
    bp.queue(n); bp.blend = null; bp.aktualizuj(0); bp.pause();
  }
  for (const n of mechanizm) ustawWidocznosc(m(n), 0);
  const kolizjaKraty = m("kratownica_brama_kolizja_mur ");
  const dolKolizji = new THREE.Box3().setFromObject(kolizjaKraty).min.z - kolizjaKraty.position.z;
  function animuj(n, od = 0, doCzasu = null) {
    const bp = m(n).userData.bonesPlayer;
    while (bp.playList.length) bp.removeLast();
    bp.queue(n);
    if (!bp.playList.length) return;
    if (doCzasu !== null) {
      const ruch = Object.create(bp.playList[0].ruch);
      ruch.dlugosc = doCzasu;
      bp.playList[0].ruch = ruch;
    }
    bp.czas = od; bp.blend = null; bp.play(); bp.aktualizuj(0);
  }
  gProxy.removeFromParent();
  const player = new Kubus(m("master"), m("master"), m("mesiek"), spawn, 500);
  gra.timeout(33, () => player.step());
  gra.ustawSwiat(Z, druga, { kolor: new THREE.Color(0, 204 / 255, 1), far: 4000 });
  oswietl(Z, gra.scena);
  change_coins(); change_energy();
  let naprawa = false, naprawaCzas = 0, bramaStan = "opened", poprzedniePlus = false, poprzednieMinus = false;
  try { gra.tempo = Math.min(80, Math.max(10, parseInt(localStorage.getItem("KubusTempo"), 10) || 30)); } catch { /* Bez zapisu. */ }
  gra.exitFrame = () => {
    const plus = keyPressed(24) || keyPressed(69), minus = keyPressed(27) || keyPressed(78);
    if (plus && !poprzedniePlus) gra.tempo = Math.min(80, gra.tempo + 5);
    if (minus && !poprzednieMinus) gra.tempo = Math.max(10, gra.tempo - 5);
    if ((plus && !poprzedniePlus) || (minus && !poprzednieMinus)) {
      try { localStorage.setItem("KubusTempo", String(gra.tempo)); } catch { /* Bez zapisu. */ }
    }
    poprzedniePlus = plus; poprzednieMinus = minus;
    zadania();
  };
  function change_coins() {
    gra.overlay(4).obraz = gra.bitmapa("L" + Math.trunc(G.coin_number / 10));
    gra.overlay(5).obraz = gra.bitmapa("P" + G.coin_number % 10);
  }
  function change_lives() {
    gra.overlay(3).obraz = gra.bitmapa("zycie" + Math.max(1, G.lives));
    if (G.lives < 1 && !gra.koniec) { gra.koniec = true; zakonczenie("przegrana"); }
  }
  function change_energy() {
    if (G.energy <= 0) { G.energy = 100; G.lives--; change_lives(); }
    gra.overlay(1).obraz = gra.bitmapa(String(Math.trunc(G.energy / 5) * 5));
  }
  function komunikat(n) {
    gra.overlay(6).obraz = gra.bitmapa(`k_${n}_duzy_dziedziniec`);
    gra.overlay(6).blend = 100;
  }
  function kowalAnim(n) {
    for (const o of [kowal, ...narzedzia]) {
      const bp = o.userData.bonesPlayer;
      while (bp.playList.length) bp.removeLast();
      bp.queue(n); bp.play();
    }
  }
  function zadania() {
    if (gra.koniec) return;
    const p = pozycjaSwiat(m("master")), blisko = (n, r) => p.distanceTo(punkty[n]) < r;
    gra.overlay(6).blend = 0;
    if (blisko("start", 150)) komunikat("01");
    if (blisko("wyjscie", 250) || blisko("mechanizm", 250)) {
      const ilosc = G.haveRack1 + G.haveRack2;
      komunikat(!G.haveHandle ? ["02", "10", "11"][ilosc]
        : G.haveHandleRepaired ? ["10b", "13", "14"][ilosc] : ["10a", "12", "12a"][ilosc]);
      if (G.allInserted) komunikat("15");
      if (G.gateOpened) komunikat("16");
    }
    for (const [n, flaga, r, overlay] of [["zebatka1", "haveRack1", 100, 7],
      ["zebatka2", "haveRack2", 100, 8], ["dzwignia", "haveHandle", 250, 9]]) {
      if (!G[flaga] && blisko(n, r)) {
        G[flaga] = 1; Z.deleteModel(n); gra.overlay(overlay).loc[1] = 12;
        dzwiek.puppetSound(7, "sound_get_carrot"); komunikat(n === "dzwignia" ? "06" : "05");
      }
    }
    const bp = kowal.userData.bonesPlayer;
    if (naprawa) {
      naprawaCzas += 1 / gra.tempo;
      if (naprawaCzas > 5.33) { ustawWidocznosc(narzedzia[0], 0); ustawWidocznosc(narzedzia[1], 3); }
      if (naprawaCzas > 8.7) {
        naprawa = false; G.haveHandleRepaired = 1;
        for (const o of narzedzia) ustawWidocznosc(o, 0);
        gra.overlay(9).obraz = gra.bitmapa("dzwigniaprosta");
        // Oryginał ustawia licznik na 30 i chowa HUD po zapłacie 25 dukatów.
        G.coin_number = 30;
        for (const i of [2, 4, 5]) gra.overlay(i).blend = 0;
      }
    } else {
      if (!bp.playList.length) kowalAnim("kowal_ambient1");
      if (blisko("kowal", 150) && G.action && G.haveHandle && G.coin_number >= 25 && !G.haveHandleRepaired) {
        naprawa = true; naprawaCzas = 0;
        ustawWidocznosc(narzedzia[0], 3); kowalAnim("kowal_cutscene");
        dzwiek.puppetSound(6, "sound_smith_repair");
      } else if (blisko("kowal", 150) && bp.playList[0]?.name === "kowal_ambient1" && !G.haveHandleRepaired) {
        kowalAnim("kowal_talk1");
        if (!dzwiek.soundBusy(6)) dzwiek.puppetSound(6, "sound_smith_talk");
      }
    }
    if (blisko("kowal", 250)) komunikat(G.haveHandleRepaired ? "09" : G.coin_number >= 25 && G.haveHandle ? "08" : "07");
    if (blisko("mechanizm", 200) && G.haveHandleRepaired && G.haveRack1 && G.haveRack2 && G.action && !G.allInserted) {
      G.allInserted = 1;
      for (const n of mechanizm) ustawWidocznosc(m(n), 3);
      for (const i of [7, 8, 9]) gra.overlay(i).blend = 0;
      dzwiek.puppetSound(6, "sound_insert_rack"); komunikat("15");
    }
    if (blisko("dzwigniaBrama", 100) && G.allInserted && G.action && !G.gateOpened) {
      G.gateOpened = true;
      for (const n of [...mechanizm, ...drzwi]) animuj(n);
      Z.deleteModel("drzwi_bramy_zebatki_kolizja_mur ");
      dzwiek.puppetSound(6, "sound_open_gate"); komunikat("16");
    }
    // Krata zamyka się przy jednych znacznikach i podnosi przy drugich.
    const postac = pozycjaSwiat(m("mesiek"));
    for (const [znak, stan, od, koniec, dzw] of [["zamykanie", "closed", 0, 0.36, "sound_close_gate_truss"],
      ["otwieranie", "opened", 0.5, 3.33, "sound_open_gate_truss"]]) {
      for (let i = 1; i <= 3; i++) {
        if (postac.distanceTo(pozycjaSwiat(m(`ph_${znak}_bramy_0${i}`))) >= 80 || bramaStan === stan) continue;
        if (m("krata").userData.bonesPlayer.playing && m("krata").userData.bonesPlayer.playList.length) continue;
        bramaStan = stan;
        for (const n of krata) animuj(n, od, koniec);
        dzwiek.puppetSound(6, dzw);
      }
    }
    // Początek modelu nie podąża za pionową animacją kości: kolizja śledzi siatkę kraty.
    m("krata").updateWorldMatrix(true, true);
    for (const siatka of m("krata").children) if (siatka.isSkinnedMesh) siatka.computeBoundingBox();
    const box = new THREE.Box3().setFromObject(m("krata"));
    kolizjaKraty.position.z = box.min.z - dolKolizji;
    if (G.gateOpened && blisko("koniec", 100)) { gra.koniec = true; zakonczenie("wygrana"); }
  }
  function jezdziec(o, kon, start) {
    const bp = o.userData.bonesPlayer, kb = kon.userData.bonesPlayer;
    const proxy = m(o.name + "proxy");
    let stan = "czeka", doKiedy = 0, poczatekSzarzy = 0, kontakt = false;
    proxy.userData.przepuszczaGracza = true;
    function zmien(n, petla = false) {
      while (bp.playList.length) bp.removeLast();
      while (kb.playList.length) kb.removeLast();
      bp.rootLock = n === "canter" ? 0 : 1;
      bp.queue("jezdziec_" + n, petla ? 1 : 0);
      kb.queue("kon_" + n, petla ? 1 : 0);
    }
    function odpocznij(ms) {
      stan = "odpoczynek"; doKiedy = gra.milliSeconds + ms; kontakt = false;
      zmien("ambient2");
    }
    gra.dodajAktora({ model: o, get stan() { return stan; }, stepFrame() {
      const teraz = gra.milliSeconds;
      const cel = pozycjaSwiat(m("master")), d = cel.distanceTo(pozycjaSwiat(o));
      const wStrefie = cel.distanceTo(start) < 1000;
      if (stan === "odpoczynek" && teraz >= doKiedy) {
        stan = "czeka"; zmien("ambient1", true);
      }
      if (stan === "czeka") {
        if (wStrefie && d < 600) {
          // Kierunek wybierany raz na próbę. Po przygotowaniu jeździec biegnie
          // przez 1,6 s po prostej, dzięki czemu można zejść z linii szarży.
          pointAt(o, V(cel.x, cel.y, o.position.z), V(0, 0, 1), V(1, 0, 0), V(0, 0, 1));
          stan = "przygotowanie"; doKiedy = teraz + 300; zmien("ambient2");
        } else if (!bp.playList.length) zmien("ambient1", true);
      } else if (stan === "przygotowanie" && teraz >= doKiedy) {
        stan = "szarza"; poczatekSzarzy = teraz; doKiedy = teraz + 1600; kontakt = false;
        zmien("canter", true);
        if (!dzwiek.soundBusy(2)) dzwiek.puppetSound(2, "sound_horse_canter");
      }
      if (stan === "szarza") {
        const przeszkoda = promienie(() => Z.modelsUnderRay(pozycjaSwiat(o), osXSwiat(o)))
          .some((h) => h.distance < 200 && (zawiera(h.model.name, "mur") ||
            (zawiera(h.model.name, "proxy") && h.model.name !== o.name + "proxy")));
        if (przeszkoda) odpocznij(1000);
        else {
          if (d < 100 && wStrefie && cel.z < o.position.z + 10) kontakt = true;
          // Wyłącznie kontakt podczas widocznej szarży, jeden cios na próbę.
          if (kontakt && teraz - poczatekSzarzy >= 200) { G.obrazenia += 5; odpocznij(1000); }
          else if (teraz >= doKiedy || !wStrefie) odpocznij(600);
        }
      }
      // Bezczynny koń i przerwa po szarży nie mogą więzić gracza przy ścianie.
      proxy.userData.przepuszczaGracza = stan !== "szarza" || d < 150;
      kon.position.copy(o.position); kon.quaternion.copy(o.quaternion); translate(kon, -30, 0, 0);
      proxy.position.copy(o.position); proxy.position.z -= 100;
      proxy.quaternion.copy(o.quaternion); rotate(proxy, 0, 0, 90);
    } });
  }
  return { G, V, punkty };
}
