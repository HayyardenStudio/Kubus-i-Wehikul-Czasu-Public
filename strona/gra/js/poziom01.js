// Poziom 1 "Droga do zamku": logika przeniesiona ze skryptów Lingo z 01_droga_do_zamku.dcr
// (zdekompilowanych ProjectorRays). Nazwy zmiennych i stałe są jak w oryginale, żeby dało się
// porównać kod linia po linii; w komentarzach nazwa skryptu źródłowego.

import * as THREE from "./vendor/three.module.min.js";
import {
  dzwiek, keyPressed, pozycjaSwiat, osXSwiat, identity, translate, rotate, pointAt,
} from "./silnik.js";
import { utworzPostacie } from "./postacie.js";
import { ustawWidocznosc } from "./w3d.js";

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const zawiera = (s, t) => s.toLowerCase().includes(t.toLowerCase());
const random = (n) => 1 + Math.floor(Math.random() * n);

export function uruchomPoziom(gra, zakonczenie) {
  const G = {};                                  // zmienne globalne Lingo
  const Z = gra.member("ziemia");
  const m = (n) => Z.model(n);
  const sw = Z.swiat;

  // Grupy wyłączane i włączane wokół modelsUnderRay (jak w skryptach)
  const odlacz = (g) => g.removeFromParent();
  const dolacz = (g) => sw.add(g);
  const ustawRodzica = (o, rodzic) => { if (rodzic) rodzic.attach(o); else o.removeFromParent(); };

  // ----- inicjalizacja_filmu: prepareMovie -----
  G.speed = 0;
  G.car_rotation = 0;

  // ----- inicjalizacja_kamer: exitFrame -----
  G.lives = 3;
  G.have_power = 0;
  G.have_sword = 0;
  Z.cloneModelFromCastmember("mesiek", "group01", gra.member("kubus"));
  Z.cloneModelFromCastmember("master", "box01", gra.member("kubus_proxy"));
  m("mesiek").position.copy(pozycjaSwiat(m("start1_ph")));
  G.xs = m("mesiek").position.x;
  G.ys = m("mesiek").position.y;

  // kamera, przez którą widać grę, i jej klony-znaczniki (kamery bez obrazu, służą jako punkty)
  const druga = new THREE.PerspectiveCamera(70, 4 / 3, 5, 4000);
  druga.up.set(0, 0, 1);
  druga.name = "druga";
  druga.userData.typ = "camera";
  sw.add(druga);
  Z.wezly.set("druga", druga);
  const znacznik = (n) => {
    const o = new THREE.Object3D();
    o.name = n;
    o.userData.typ = "camera";
    Z.wezly.set(n, o);
    sw.add(o);
    return o;
  };
  const kam1 = znacznik("camera1");
  m("master").add(kam1);

  Z.cloneModelFromCastmember("szlaban_otwarty", "rogatka_szlaban_03", gra.member("szlaban-otwarty"));

  // nakładki kamery (overlay[1]..[7])
  gra.addOverlay("100", 490, 20);               // 1 energia
  gra.addOverlay("moneta", 563, 398);           // 2 moneta
  gra.addOverlay("zycie3", 12, 12);             // 3 życia
  gra.addOverlay("L0", 498, 423);               // 4 dukaty - dziesiątki
  gra.addOverlay("P0", 532, 423);               // 5 dukaty - jedności
  gra.addOverlay("komunikat_01", 0, 352);       // 6 komunikat
  gra.overlay(6).blend = 0;
  gra.addOverlay("miecz", 12, -80);             // 7 miecz (poza ekranem, dopóki go nie ma)

  const kam = {};
  for (const n of ["old", "qba1", "qba2", "przedniaPA", "przedniaR", "qba5", "przod"]) kam[n] = znacznik(n);
  for (const n of ["old", "qba1", "qba2", "przedniaPA", "przedniaR", "przod"]) m("master").add(kam[n]);
  translate(kam.old, -280, 0, 50);
  translate(kam.qba1, 0, -15, 10);
  translate(kam.qba2, 0, 15, 10);
  translate(kam.przedniaPA, 1000, 0, 0);
  translate(kam.przedniaR, -80, -30, 50);
  translate(kam.przod, 100, 0, -50);
  pointAt(druga, pozycjaSwiat(m("master")), V(0, 0, 45));

  // init_animations
  const ruchy = [
    ["ges_atak", "ges_attack1"], ["ges_walk1", "ges_walkB"], ["ges_walk2", "ges_walkB"], ["ges_run", "ges_run"],
    ["ges_am1", "ges_ambient1"], ["ges_am2", "ges_ambient2"], ["ges_am3", "ges_ambient3"],
    ["kubus_run", "kubus_run"], ["kubus_ambient1", "kubus_ambient1"], ["kubus_jump", "kubus_runjump"], ["kubus_hit", "kubus_hit"],
    ["rycerz_gruby_ambient1", "rycerz_ambient1"], ["rycerz_gruby_ambient2", "rycerz_gruby_ambient2"],
    ["rycerz_gruby_walk", "rycerz_gruby_walk"], ["rycerz_gruby_atak", "rycerz_attack1"],
    ["rycerz_maly_ambient1", "rycerz_maly_ambient1"], ["rycerz_maly_walk", "rycerz_maly_walk"],
    ["rycerz_maly_atak", "rycerz_maly_attack1"],
    ["czarodziej_ambient1", "czarodziej_ambient1"], ["czarodziej_fly", "czarodziej_fly"], ["czarodziej_magic", "czarodziej_magic"],
  ];
  for (const [nowa, czlonek] of ruchy) {
    const c = gra.member(czlonek);
    if (c) Z.cloneMotionFromCastmember(nowa, "Group01", c);
  }

  const gAnim = Z.newGroup("g_animated_objects");
  const gProxy = Z.newGroup("g_proxy_objects");
  const { Kubus, Rycerz } = utworzPostacie({ gra, G, Z, m, sw, gAnim, gProxy, kam, druga,
    zakonczenie, promienie, change_energy, change_coins, ambient_sound });


  // initialize_object
  function initialize_object(myName, cmember) {
    const myProxy = myName + "proxy";
    const cproxy = gra.member(cmember + "_proxy");
    const modelproxy = cproxy.modele()[0].name;
    Z.cloneModelFromCastmember(myName, "Group01", gra.member(cmember));
    Z.cloneModelFromCastmember(myProxy, modelproxy, cproxy);
    identity(m(myName));
    Z.addModifier(m(myName), "bonesPlayer");
    const bp = m(myName).userData.bonesPlayer;
    bp.rootLock = 0;
    bp.lockTranslation = "none";
    ustawRodzica(m(myName), gAnim);
    ustawRodzica(m(myProxy), gProxy);
  }

  // add_gooses / add_little_knigths / add_fat_knigths: w miejscu znaczników *_ph
  function rozstaw(znak, utworz) {
    const modele = Z.modele();
    modele.forEach((ph, i) => { if (zawiera(ph.name, znak)) utworz(ph, i + 1); });
    for (const ph of Z.modele()) if (zawiera(ph.name, znak)) Z.deleteModel(ph.name);
  }
  rozstaw("ges1_ph", (ph, a) => {
    initialize_object("ges" + a, "ges");
    new Ges(m("master"), m("ges" + a), pozycjaSwiat(ph), 500);
  });
  rozstaw("rycerzmaly1_ph", (ph, a) => {
    initialize_object("rycerz_maly" + a, "rycerz_maly");
    new Rycerz("maly", m("master"), m("rycerz_maly" + a), pozycjaSwiat(ph), 500);
  });
  rozstaw("rycerzgruby1_ph", (ph, a) => {
    initialize_object("rycerz_gruby" + a, "rycerz_gruby");
    new Rycerz("gruby", m("master"), m("rycerz_gruby" + a), pozycjaSwiat(ph), 600);
  });

  // add_coins
  G.coin_number = 0;
  G.coins_positions = [];
  G.coins_refs = [];
  Z.cloneModelFromCastmember("moniak", "moneta03", gra.member("moneta_rotate"));
  Z.modele().forEach((ph, i) => {
    if (!zawiera(ph.name, "moneta1_ph")) return;
    const myName = "moneta" + (i + 1);
    const moneta = Z.cloneModel(m("moniak"), myName);
    moneta.position.copy(pozycjaSwiat(ph));
    if (ph.name === "moneta1_ph41") {
      moneta.position.x += 800;
      moneta.position.y += 500;
    }
    ustawRodzica(moneta, gAnim);
    G.coins_positions.push(moneta.position.clone());
    G.coins_refs.push(myName);
  });
  for (const ph of Z.modele()) if (zawiera(ph.name, "moneta1_ph")) Z.deleteModel(ph.name);
  Z.deleteModel("moniak");

  // add_source: źródełko i strach na wróble
  Z.cloneModelFromCastmember("zrodlo_mur", "group01", gra.member("zrodlo-anim"));
  m("zrodlo_mur").position.copy(pozycjaSwiat(m("zrodelko_1_ph")));
  translate(m("zrodlo_mur"), 0, 30, 0);
  rotate(m("zrodlo_mur"), 0, 0, 30);
  Z.addModifier(m("zrodlo_mur"), "bonesPlayer");
  m("zrodlo_mur").userData.bonesPlayer.rootLock = 1;
  Z.cloneMotionFromCastmember("zrodlo_anim", "Group01", gra.member("zrodlo-anim"));
  m("zrodlo_mur").userData.bonesPlayer.queue("zrodlo_anim", 1);
  Z.deleteModel("zrodelko_1_ph");
  Z.cloneModelFromCastmember("strach_anim", "strach_1", gra.member("strach_rotate"));
  Z.cloneModelFromCastmember("strach_mur", "rycerz_gruby_proxy", gra.member("rycerz_gruby_proxy"));
  m("strach_mur").position.copy(pozycjaSwiat(m("strach_ph1")));
  m("strach_anim").position.copy(pozycjaSwiat(m("strach_ph1")));
  m("strach_anim").scale.set(0.3, 0.3, 0.3);
  ustawRodzica(m("strach_anim"), gAnim);
  ustawWidocznosc(m("strach_mur"), 0);
  m("strach_anim").userData.keyframePlayer?.pause();
  Z.deleteModel("strach_ph1");
  Z.deleteModel("strach_ph2");

  // add_carrots
  G.carrots_positions = [];
  G.carrots_refs = [];
  Z.cloneModelFromCastmember("marchewa", "group01", gra.member("marchew"));
  // marchewka ma szkielet i własną animację (unosi się i opada), którą Shockwave odtwarza sam
  // w pętli; bez niej siatka stoi w pozie spoczynkowej, do połowy w ziemi
  Z.cloneMotionFromCastmember("marchew_lewitacja", "Group01", gra.member("marchew"));
  Z.modele().forEach((ph, i) => {
    if (!zawiera(ph.name, "marchewka1_ph")) return;
    const myName = "marchew" + (i + 1);
    const marchew = Z.cloneModel(m("marchewa"), myName);
    Z.addModifier(marchew, "bonesPlayer");
    const bp = marchew.userData.bonesPlayer;
    bp.queue("marchew_lewitacja", 1);
    bp.blend = null;
    bp.aktualizuj(0);
    marchew.position.copy(pozycjaSwiat(ph));
    const grunt = podlozePod(marchew.position);
    // Dolna faza animacji schodzi ~9,6 jednostki poniżej początku modelu.
    if (grunt !== undefined) marchew.position.z = Math.max(marchew.position.z, grunt + 12);
    ustawRodzica(marchew, gAnim);
    G.carrots_positions.push(marchew.position.clone());
    G.carrots_refs.push(myName);
  });
  for (const ph of Z.modele()) if (zawiera(ph.name, "marchewka1_ph")) Z.deleteModel(ph.name);
  Z.deleteModel("marchewa");

  // add_magic
  initialize_object("czarodziej", "czarodziej");
  new Czarodziej(m("master"), m("czarodziej"), pozycjaSwiat(m("czarodziej1_ph01")), 500);
  Z.deleteModel("czarodziej1_ph01");
  m("czarodziej").userData.bonesPlayer.queue("czarodziej_fly");
  m("czarodziej").userData.bonesPlayer.currentLoopState = 1;

  const komunikaty = new Komunikaty();

  // podział modeli: kolizje do g_proxy_objects (niewidoczne), *proxy w świecie (niewidoczne),
  // reszta do g_animated_objects
  for (const model of Z.modele()) {
    if (zawiera(model.name, "over")) continue;
    if (zawiera(model.name, "kolizja") || zawiera(model.name, "kolizje")) {
      ustawRodzica(model, gProxy);
      ustawWidocznosc(model, 0);
    } else {
      ustawRodzica(model, gAnim);
    }
    if (zawiera(model.name, "proxy")) {
      ustawRodzica(model, sw);
      ustawWidocznosc(model, 0);
    }
  }
  for (const n of ["kolizja_podloze_tratwa_1", "strach_mur", "Fosa_1", "szlaban_plane_mur", "przed_mostem_ph",
    "miecz_1", "za_mostem_ph", "czarodziejproxy"]) ustawRodzica(m(n), sw);
  odlacz(gProxy);
  odlacz(gAnim);
  m("mesiek").removeFromParent();
  ustawWidocznosc(m("master"), 0);
  new Tratwa();
  const qbus = new Kubus(m("master"), m("master"), m("mesiek"), pozycjaSwiat(m("master")), 500);
  gra.timeout(33, () => qbus.step());
  change_coins();
  G.energy = 100;
  change_energy();
  G.ambient = [
    [pozycjaSwiat(m("zrodlo_mur")), "zrodlo"],
    [pozycjaSwiat(m("wiatrak_mechanizm_1_podloze")), "wiatrak"],
    [pozycjaSwiat(m("tratwa_1_podloze")), "tratwa"],
    [pozycjaSwiat(m("skała_podloze")), "skaly"],
  ];
  // most zwodzony: animację kości (opuszczanie) Shockwave podpina sam, skrypt tylko ją zatrzymuje
  Z.addModifier(m("most_zwodz_mur"), "bonesPlayer");
  const most = m("most_zwodz_mur").userData.bonesPlayer;
  most.queue("most_zwodz_mur");
  // Pozycja wiązania kości leży niżej niż pierwsza klatka animacji. Przed pauzą
  // ustawiamy pozę zamkniętą od razu, bez przejścia z pozy wiązania i bez upływu czasu.
  most.blend = null;
  most.aktualizuj(0);
  most.pause();
  ustawWidocznosc(m("szlaban_plane_mur"), 0);
  Z.shader("woda").blend = 70;

  // mgła i kamera
  gra.ustawSwiat(Z, druga, { kolor: new THREE.Color(0, 204 / 255, 1), far: 4000 });
  oswietl(Z, gra.scena);
  komunikaty.inicjuj();

  // looper_navigate / kfTempoKeys: klawisze +/- zmieniają tempo (co 5 kl./s, od 10 do 80),
  // a ustawienie jest pamiętane jak KubusTempo.txt w wersji na Windows
  let gora = false, dol = false;
  try { gra.tempo = Math.min(Math.max(parseInt(localStorage.getItem("KubusTempo"), 10) || 30, 10), 80); } catch { /* bez pamięci */ }
  gra.exitFrame = () => {
    const up = keyPressed(24) || keyPressed(69);
    const down = keyPressed(27) || keyPressed(78);
    const przed = gra.tempo;
    if (up && !gora) gra.tempo = Math.min(gra.tempo + 5, 80);
    if (down && !dol) gra.tempo = Math.max(gra.tempo - 5, 10);
    gora = up;
    dol = down;
    if (gra.tempo !== przed) try { localStorage.setItem("KubusTempo", String(gra.tempo)); } catch { /* bez pamięci */ }
  };

  // ---------------------------------------------------------------------------------------
  // change_coins / change_energy / change_lives / change_message
  // ---------------------------------------------------------------------------------------
  function change_coins() {
    if (G.coin_number < 0) G.coin_number = 0;
    gra.overlay(4).obraz = gra.bitmapa("L" + Math.trunc(G.coin_number / 10));
    gra.overlay(5).obraz = gra.bitmapa("P" + (G.coin_number % 10));
  }
  function change_energy() {
    if (G.energy < 0) {
      G.energy = 100;
      G.lives -= 1;
      change_lives();
    }
    gra.overlay(1).obraz = gra.bitmapa(String(Math.trunc(G.energy / 5) * 5));
  }
  function change_lives() {
    if (G.lives < 1) {
      zakonczenie("przegrana");
      gra.koniec = true;
    }
    if (G.lives < 1) G.lives = 1;
    gra.overlay(3).obraz = gra.bitmapa("zycie" + G.lives);
  }
  function change_message(message) {
    if (message !== G.lastMessage) {
      gra.overlay(6).obraz = gra.bitmapa(message);
      G.lastMessage = message;
    }
  }

  // ambient_sounds
  function ambient_sound() {
    G.ambient.forEach(([poz, nazwa], i) => {
      const myDistance = pozycjaSwiat(m("mesiek")).distanceTo(poz);
      if (myDistance < 1530) {
        if (!dzwiek.soundBusy(i + 3)) dzwiek.puppetSound(i + 3, nazwa);
        dzwiek.setVolume(i + 3, Math.round((1530 - myDistance) / 5));
      }
      if (myDistance > 1530) dzwiek.stop(i + 3);
    });
  }

  // modelsUnderRay z odłączonymi modelami animowanymi i dołączonymi kolizjami
  function promienie(fn) {
    odlacz(gAnim);
    dolacz(gProxy);
    const wynik = fn();
    dolacz(gAnim);
    odlacz(gProxy);
    return wynik;
  }

  function podlozePod(p) {
    return promienie(() => Z.modelsUnderRay(V(p.x, p.y, 1000), V(0, 0, -1))
      .find((hit) => zawiera(hit.model.name, "podloze"))?.isectPosition.z);
  }

  // ---------------------------------------------------------------------------------------
  // behavior_ges
  // ---------------------------------------------------------------------------------------
  function Ges(targetModel, ourModel, worldpos, actionRadius) {
    const pmodel = ourModel, pTargetModel = targetModel, pWorldPos = worldpos, pRadius = actionRadius;
    const bp = pmodel.userData.bonesPlayer;
    let pTrigger = 0, dontGO = 0, lastTime = gra.milliSeconds;
    const land = () => {
      const gesPos = pozycjaSwiat(pmodel);
      const dirvect = osXSwiat(pmodel);
      const modelsList = promienie(() => Z.modelsUnderRay(gesPos, dirvect, 1));
      for (const hit of modelsList) {
        if (zawiera(hit.model.name, "mur") || zawiera(hit.model.name, "proxy")) {
          if (hit.distance < 100 && bp.playList.length === 0) {
            bp.queue("ges_am" + random(3));
            break;
          }
        }
      }
      m(pmodel.name + "proxy").position.copy(pozycjaSwiat(pmodel));
    };
    land();
    pmodel.position.y = pWorldPos.y;
    pmodel.position.x = pWorldPos.x;
    pmodel.position.z = -100;
    gra.dodajAktora(this);
    this.stepFrame = () => {
      rotateTowards();
      if (gra.milliSeconds - lastTime < 100) return;
      sensor();
      lastTime = gra.milliSeconds;
    };
    const sensor = () => {
      const pDistance = pWorldPos.distanceTo(pozycjaSwiat(pTargetModel));
      if (pDistance < pRadius && pTrigger === 0) pTrigger = 1;
      if (pDistance > pRadius && pTrigger === 1) pTrigger = 0;
      if (pDistance < pRadius && pTrigger === 1) withinZone();
      if (pDistance > pRadius && pTrigger === 0) outsideZone();
    };
    const withinZone = () => {
      land();
      const myDistance = pozycjaSwiat(pTargetModel).distanceTo(pozycjaSwiat(pmodel));
      if (myDistance < 150) {
        if (bp.playList.length > 0 && zawiera(bp.playList.at(-1).name, "walk")) bp.removeLast();
        if (bp.playList.length > 0 && zawiera(bp.playList.at(-1).name, "run")) bp.removeLast();
      }
      if (bp.playList.length === 0) {
        if (myDistance < 150) {
          bp.queue("ges_atak");
          if (!dzwiek.soundBusy(2)) dzwiek.puppetSound(2, "sound_ges_atak");
          G.enemyNear = 1;
        }
        if (myDistance > 300 && dontGO === 0) {
          if (!dzwiek.soundBusy(2)) dzwiek.puppetSound(2, "sound_ges_ambient");
          bp.queue("ges_walk" + random(2));
        }
        if (myDistance < 300 && myDistance > 150 && dontGO === 0) bp.queue("ges_run");
      }
      bp.play();
    };
    const outsideZone = () => {
      if (bp.playList.length === 0) bp.queue("ges_am" + random(3));
      bp.play();
    };
    const rotateTowards = () => {
      m(pmodel.name + "proxy").position.copy(pozycjaSwiat(pmodel));
      const q5 = pozycjaSwiat(kam.qba5);
      pointAt(pmodel, V(q5.x, q5.y, -117), V(0, 0, 1), V(1, 0, 0), V(0, 0, 1));
    };
  }

  // ---------------------------------------------------------------------------------------
  // behavior_czarodziej (z poprawką z edycji fanowskiej: czar siły 5,5 s po zaklęciu)
  // ---------------------------------------------------------------------------------------
  function Czarodziej(targetModel, ourModel, worldpos, actionRadius) {
    const pmodel = ourModel, pTargetModel = targetModel, pWorldPos = worldpos, pRadius = actionRadius;
    const bp = pmodel.userData.bonesPlayer;
    let pTrigger = 0, blisko = 0, lastStrach = 0;
    G.kfMagicStart = 0;
    ustawRodzica(pmodel, gAnim);
    pmodel.position.copy(pWorldPos);
    const vert = podlozePod(pWorldPos) ?? pWorldPos.z;
    // Początek modelu leży ponad stopami; animacja lotu ma inną pozę nóg niż stanie.
    const ustawWysokosc = () => { pmodel.position.z = vert + (bp.playList[0]?.name === "czarodziej_fly" ? 39.25 : 34.5); };
    ustawWysokosc();
    gra.dodajAktora(this);
    this.stepFrame = () => {
      sensor();
      ustawWysokosc();
      rotateTowards();
      if (blisko === 1) {
        if (G.have_power === 0) {
          if (G.kfMagicStart === 0) G.kfMagicStart = gra.milliSeconds;
          else if (gra.milliSeconds - G.kfMagicStart > 5500) G.have_power = 1;
        }
      } else {
        G.kfMagicStart = 0;
      }
    };
    const sensor = () => {
      const targetLocation = pozycjaSwiat(pTargetModel);
      const pDistance = pWorldPos.distanceTo(targetLocation);
      const strach = m("strach_anim");
      const sDistance = pozycjaSwiat(strach).distanceTo(targetLocation);
      if (sDistance < 100) strach.userData.keyframePlayer?.play();
      else strach.userData.keyframePlayer?.pause();
      if (sDistance < 100 && gra.milliSeconds - lastStrach > 300) {
        lastStrach = gra.milliSeconds;
        G.enemyNear = 1;
      }
      if (pDistance < pRadius && pTrigger === 0) pTrigger = 1;
      if (pDistance > pRadius && pTrigger === 1) pTrigger = 0;
      if (pDistance < pRadius && pTrigger === 1) withinZone();
      if (pDistance > pRadius && pTrigger === 0) outsideZone();
    };
    const withinZone = () => {
      const myDistance = pozycjaSwiat(pTargetModel).distanceTo(pozycjaSwiat(pmodel));
      if (myDistance <= 400 && bp.playList[0]?.name === "czarodziej_fly") bp.removeLast();
      if (myDistance < 250 && blisko === 0 && G.coin_number === 50) {
        bp.removeLast();
        bp.removeLast();
        bp.queue("czarodziej_magic");
        dzwiek.stop(7);
        dzwiek.puppetSound(7, "sound_czarodziej_magia");
        blisko = 1;
      }
      if (bp.playList.length > 0 && G.have_power === 0) {
        if (zawiera(bp.playList[0].name, "magic") && bp.currentTime > 5500) G.have_power = 1;
      }
      if (bp.playList.length === 0) {
        if (myDistance > 400) bp.queue("czarodziej_fly");
        if (myDistance <= 400) bp.queue("czarodziej_ambient1");
      }
      bp.play();
    };
    const outsideZone = () => {
      if (bp.playList.length === 0) bp.queue("czarodziej_ambient1");
      bp.play();
    };
    const rotateTowards = () => {
      m(pmodel.name + "proxy").position.copy(pozycjaSwiat(pmodel));
      const q5 = pozycjaSwiat(kam.qba5);
      pointAt(pmodel, V(q5.x, q5.y, pozycjaSwiat(pmodel).z), V(0, 0, 1), V(1, 0, 0), V(0, 0, 1));
    };
  }

  // ---------------------------------------------------------------------------------------
  // behavior_tratwa, przebudowana w edycji fanowskiej, żeby dało się nią pływać:
  // - w oryginale widoczna tratwa i jej kolizja (na której stoi Kubuś) dostają osobne
  //   translate i jadą trochę inaczej, więc tratwa przesuwała się Kubusiowi pod nogami;
  //   tu kolizja jest przestawiana za widoczną tratwą, więc Kubuś jedzie jak przyklejony,
  // - zamiast stawać, gdy Kubuś jest obok (kolizjaTratwa, przez co zatrzymywała się na wodzie
  //   przed brzegiem), tratwa czeka chwilę przy brzegu i przy wyspie.
  // ---------------------------------------------------------------------------------------
  function Tratwa() {
    const POSTOJ = 45;                            // klatek czekania przy brzegu i przy wyspie
    const pmodel = m("tratwa_1_podloze");
    const wyspaP = pozycjaSwiat(m("tratwa_wyspa_ph"));
    const brzegP = pozycjaSwiat(m("tratwa_brzeg_ph"));
    const proxyModel = m("kolizja_podloze_tratwa_1");
    const przesuniecieKolizji = pozycjaSwiat(proxyModel).sub(pozycjaSwiat(pmodel));
    const woda = Z.shader("woda");
    let doWyspy = true, postoj = 0;
    ustawWidocznosc(m("tratwa_wyspa_ph"), 0);
    ustawWidocznosc(m("tratwa_brzeg_ph"), 0);
    gra.dodajAktora(this);
    this.stepFrame = () => {
      woda.textureTransformList[1].translate(-0.005, -0.005, 0);
      if (postoj > 0) { postoj--; return; }
      translate(pmodel, 0, doWyspy ? 3 : -3, 0);
      const cel = pozycjaSwiat(pmodel).add(przesuniecieKolizji);
      proxyModel.position.copy(proxyModel.parent.worldToLocal(cel));
      if (wyspaP.distanceTo(pozycjaSwiat(pmodel)) < 80 && doWyspy) { doWyspy = false; postoj = POSTOJ; }
      if (brzegP.distanceTo(pozycjaSwiat(pmodel)) < 80 && !doWyspy) { doWyspy = true; postoj = POSTOJ; }
    };
  }

  // ---------------------------------------------------------------------------------------
  // behavior_komunikaty: napisy, miecz, most zwodzony i koniec poziomu
  // ---------------------------------------------------------------------------------------
  function Komunikaty() {
    let magPosition, swordPosition, bridgePosition, checkpointPosition, endPosition, bridge_opened = 0;
    this.inicjuj = () => {
      magPosition = pozycjaSwiat(m("czarodziej"));
      swordPosition = pozycjaSwiat(m("miecz_1"));
      bridgePosition = pozycjaSwiat(m("przed_mostem_ph"));
      checkpointPosition = pozycjaSwiat(m("szlaban_plane_mur"));
      endPosition = pozycjaSwiat(m("za_mostem_ph"));
      G.have_power = 0;
      ustawWidocznosc(m("przed_mostem_ph"), 0);
      ustawWidocznosc(m("za_mostem_ph"), 0);
      gra.dodajAktora(this);
    };
    this.stepFrame = () => {
      const kubus = pozycjaSwiat(m("master"));
      gra.overlay(6).blend = 0;
      if (swordPosition.distanceTo(kubus) < 250) {
        if (G.coin_number < 25) change_message("komunikat_01");
        if (G.coin_number === 50 && G.have_power === 1 && G.have_sword === 0) {
          dzwiek.puppetSound(7, "sound_sword");
          Z.deleteModel("miecz_1");
          G.have_sword = 1;
          change_message("komunikat_00");
          gra.overlay(7).loc = [260, 12];
        }
        gra.overlay(6).blend = 100;
      }
      if (magPosition.distanceTo(kubus) < 250) {
        if (G.coin_number < 50) change_message("komunikat_02");
        if (G.coin_number === 50) change_message("komunikat_03");
        if (G.coin_number === 50 && G.have_power === 1) change_message("komunikat_04");
        gra.overlay(6).blend = 100;
      }
      if (checkpointPosition.distanceTo(kubus) < 250 && G.coin_number < 25) {
        change_message("komunikat_05");
        gra.overlay(6).blend = 100;
      }
      if (bridgePosition.distanceTo(kubus) < 150) {
        if (G.have_sword === 0) change_message("komunikat_06");
        if (G.have_sword === 1) {
          const most = m("most_zwodz_mur").userData.bonesPlayer;
          if (most) { most.currentLoopState = 0; most.play(); }
          if (bridge_opened === 0) {
            dzwiek.puppetSound(7, "sound_open_bridge");
            bridge_opened = 1;
          }
        }
        gra.overlay(6).blend = 100;
      }
      if (endPosition.distanceTo(kubus) < 150 && G.have_sword === 1) {
        gra.koniec = true;
        zakonczenie("wygrana");
      }
    };
  }

  return { G, V };
}

// Światła W3D; punktowe są opcjonalnie włączane dla holu laboratorium.
export function oswietl(Z, scena, { punktowe = false } = {}) {
  for (const [, def] of Z.dane.swiatla) {
    if (!def.enabled) continue;
    const kolor = new THREE.Color(def.color[0], def.color[1], def.color[2]);
    if (def.type === "ambient") {
      scena.add(new THREE.AmbientLight(kolor, Math.PI));
    } else if (def.type === "directional") {
      const wezel = Z.wezly.get(def.name.toLowerCase());
      const s = new THREE.DirectionalLight(kolor, Math.PI);
      if (wezel) {
        wezel.updateWorldMatrix(true, false);
        const kierunek = new THREE.Vector3(0, 0, -1).transformDirection(wezel.matrixWorld);
        s.position.copy(kierunek).negate();
      }
      scena.add(s);
      scena.add(s.target);
    } else if (def.type === "point" && punktowe) {
      const wezel = Z.wezly.get(def.name.toLowerCase());
      if (!wezel) continue;
      wezel.updateWorldMatrix(true, false);
      const s = new THREE.PointLight(kolor, Math.PI / (def.attenuation?.[0] || 1), 0, 0);
      s.name = def.name;
      s.position.setFromMatrixPosition(wezel.matrixWorld);
      scena.add(s);
    } else if (def.type === "spot") {
      const wezel = Z.wezly.get(def.name.toLowerCase());
      if (!wezel) continue;
      wezel.updateWorldMatrix(true, false);
      // IFX zapisuje półkąt stożka i osłabienie 1/(a0+a1*d+a2*d²).
      // Reflektory poziomu 7 mają wyłącznie a0 (1/1,8; 1; 1/0,7)
      // oraz wyłączony SPOTDECAY: stała jasność i twardy brzeg stożka.
      const a0 = def.attenuation?.[0] || 1;
      const s = new THREE.SpotLight(kolor, Math.PI / a0, 0,
        THREE.MathUtils.degToRad(def.spotAngle), 0, 0);
      s.name = def.name;
      s.position.setFromMatrixPosition(wezel.matrixWorld);
      const kierunek = new THREE.Vector3(0, 0, -1).transformDirection(wezel.matrixWorld);
      s.target.position.copy(s.position).add(kierunek);
      scena.add(s, s.target);
    }
  }
}
