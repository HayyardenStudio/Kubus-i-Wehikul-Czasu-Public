// Hol laboratorium: reguły z 10_hol_laboratorium.dcr (ProjectorRays).
import * as THREE from "./vendor/three.module.min.js";
import { dzwiek, keyPressed, pozycjaSwiat, identity, translate, pointAt } from "./silnik.js";
import { ustawWidocznosc } from "./w3d.js";
import { utworzPostacie } from "./postacie.js";
import { oswietl } from "./poziom01.js";

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const nr = n => String(n).padStart(2, "0");

export function uruchomPoziom(gra, zakonczenie) {
  const G = { speed: 0, car_rotation: -180, lives: 3, energy: 100, coin_number: 0,
    action: 0, obrazenia: 0, enemyNear: 0, crystals_number: 0, kompWystartowal: false,
    coins_positions: [], coins_refs: [], carrots_positions: [], carrots_refs: [] };
  const Z = gra.member("ziemia"), sw = Z.swiat, m = n => Z.model(n);
  const punkty = { start: pozycjaSwiat(m("start1_ph")), konsola: pozycjaSwiat(m("panel_monitor")),
    drzwi: pozycjaSwiat(m("pokojbadan_gora")), koniec: pozycjaSwiat(m("ph_koniec_etapu")) };
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
  for (const [n, x, y] of [["100", 490, 20], ["moneta", 563, 400], ["zycie3", 12, 12],
    ["L0", 498, 423], ["P0", 532, 423], ["K01_hol_labolatorium", 12, 352],
    ["miecz01", 210, 12], ["okosmoka01", 300, 12], ["amuletslonca01", 390, 12]]) gra.addOverlay(n, x, y);
  gra.overlay(6).blend = 0;
  for (const n of ["kubus_run", "kubus_take", "kubus_ambient1", "kubus_hit", "kubus_takeup",
    "pajak_walk", "pajak_attack1", "pajak_attack2", "pajak_attack3",
    "raptor_walk", "raptor_attack1", "raptor_attack2", "raptor_attack3", "kubus_jump"]) {
    Z.cloneMotionFromCastmember(n, "Group01", gra.member(n === "kubus_jump" ? "kubus_runjump" : n));
  }
  function drzwiDla(n, gorne) {
    const modele = ["lewe", "prawe", ...(gorne ? ["gora"] : [])].map(s => m(`${n}_${s}`));
    for (const o of modele) {
      const kp = o.userData.keyframePlayer;
      kp.currentLoopState = 0; kp.aktualizuj(0); kp.pause();
    }
    return { modele, pozycja: pozycjaSwiat(modele[gorne ? 2 : 0]), proxy: m(`kolizja_${n}_mur`), opened: false };
  }
  const drzwi = Array.from({ length: 8 }, (_, i) => drzwiDla("wejscie" + nr(i + 1), i < 5));
  const koncowe = drzwiDla("pokojbadan", true);
  const krysztaly = Z.modele().filter(o => /^piorun_ph\d+$/.test(o.name)).map((ph, i) => {
    const pozycja = pozycjaSwiat(ph), model = Z.cloneModelFromCastmember("ogniwo" + nr(i + 1), "piorun", gra.member("crystal"));
    model.position.copy(pozycja); Z.deleteModel(ph.name);
    return { model, pozycja, zebrany: false };
  });
  function znaczniki(typ) {
    return Z.modele().filter(o => new RegExp(`^${typ}_ph\\d+$`).test(o.name)).sort((a, b) => a.name.localeCompare(b.name));
  }
  const pajakiPh = znaczniki("pajak"), raptoryPh = znaczniki("raptor");
  function trasa(typ, i) {
    return Z.modele().filter(o => new RegExp(`^w\\d+_${typ}${nr(i + 1)}$`).test(o.name))
      .sort((a, b) => parseInt(a.name.slice(1)) - parseInt(b.name.slice(1))).map(pozycjaSwiat);
  }
  const trasyPajakow = pajakiPh.map((_, i) => trasa("pajak", i));
  const trasyRaptorow = raptoryPh.map((_, i) => trasa("raptor", i));
  for (const o of Z.modele()) {
    if (/proxy/i.test(o.name)) { sw.attach(o); ustawWidocznosc(o, 0); }
    else if (/kolizj/i.test(o.name)) { gProxy.attach(o); ustawWidocznosc(o, 0); }
    else gAnim.attach(o);
    if (/_ph|^ph_|^w\d+_|over/i.test(o.name)) ustawWidocznosc(o, 0);
  }
  sw.attach(m("master")); ustawWidocznosc(m("master"), 0); gProxy.removeFromParent();
  // Wbudowane animacje ryb, podobnie jak animacja statku, grają od wejścia do sali.
  const ryby = Z.modele().filter(o => /^ryba\d$/i.test(o.name));
  for (const o of ryby) {
    Z.addModifier(o, "bonesPlayer");
    const bp = o.userData.bonesPlayer;
    bp.extractRootMotion = false; bp.queue(o.name, 1); bp.blend = null; bp.aktualizuj(0);
  }
  function przeciwnik(typ, ph, trasa) {
    const start = pozycjaSwiat(ph), wysokosc = typ === "pajak" ? 64 : 76;
    const grupa = Z.newGroup(typ + ph.name + "group"); gAnim.attach(grupa);
    // Dopasowanie stóp do siatki podłogi: pająk +64 (Lingo +60), raptor +76 (+80).
    grupa.position.copy(start).z += wysokosc;
    const c = gra.member(typ), model = Z.cloneModelFromCastmember(typ + ph.name, c.modele()[0].name, c);
    grupa.add(model); identity(model); model.rotation.z = Math.PI / 2;
    Z.addModifier(model, "bonesPlayer");
    const bp = model.userData.bonesPlayer; bp.lockTranslation = "all";
    // Hips raptora jest zapisany w układzie modelu; odejmowanie pozy wiązania
    // podnosiło stopy o 32,7 jednostki. Ruch patrolu nadal liczy grupa.
    bp.absoluteRoot = typ === "raptor"; bp.extractRootMotion = false;
    bp.queue(typ + "_walk"); bp.blend = null; bp.aktualizuj(0);
    const cp = gra.member(typ + "_proxy"), proxy = Z.cloneModelFromCastmember(model.name + "proxy", cp.modele()[0].name, cp);
    sw.attach(proxy); ustawWidocznosc(proxy, 0);
    const celObrotu = new THREE.Object3D();
    const aktor = { model, grupa, proxy, start, trasa, currentWP: 0, odwiedzone: new Set(), ataki: 0, stepFrame() {
      if (gra.koniec || !trasa.length) return;
      const p = grupa.position, cel = pozycjaSwiat(m("master")), dystans = p.distanceTo(cel);
      const atak = dystans < (typ === "pajak" ? 200 : 150), wp = trasa[aktor.currentWP];
      if (atak) {
        pointAt(grupa, V(cel.x, cel.y, p.z), V(0, 0, 1), V(1, 0, 0), V(0, 0, 1));
        if (bp.playList.some(a => a.name.includes("walk"))) while (bp.playList.length) bp.removeLast();
        if (!bp.playList.length) {
          const n = 1 + Math.floor(Math.random() * 3);
          bp.queue(`${typ}_attack${n}`); G.obrazenia = 5; aktor.ataki++;
          dzwiek.puppetSound(2, `sound_${typ}_atak${n}`);
        }
      } else {
        // pointAt przyjmuje punkt świata, więc pomocniczy obiekt stoi przy grupie.
        celObrotu.position.copy(p);
        pointAt(celObrotu, V(wp.x, wp.y, p.z), V(0, 0, 1), V(1, 0, 0), V(0, 0, 1));
        grupa.quaternion.slerp(celObrotu.quaternion, 0.2);
        translate(grupa, typ === "pajak" ? 5 : 3.5, 0, 0);
        // Wysokość znacznika jest częścią oryginalnego progu osiągnięcia punktu.
        if (Math.hypot(p.x - wp.x, p.y - wp.y, start.z + (typ === "pajak" ? 60 : 80) - wp.z) < 100) {
          aktor.odwiedzone.add(aktor.currentWP); aktor.currentWP = (aktor.currentWP + 1) % trasa.length;
        }
        if (!bp.playList.length) bp.queue(typ + "_walk");
        if (dystans < 450 && !dzwiek.soundBusy(3)) dzwiek.puppetSound(3, `sound_${typ}_walk`);
      }
      proxy.position.copy(p).z += (typ === "pajak" ? -10 : 10) - wysokosc;
    } };
    proxy.position.copy(grupa.position).z += (typ === "pajak" ? -10 : 10) - wysokosc;
    Z.deleteModel(ph.name); gra.dodajAktora(aktor); return aktor;
  }
  const pajaki = pajakiPh.map((ph, i) => przeciwnik("pajak", ph, trasyPajakow[i]));
  const raptory = raptoryPh.map((ph, i) => przeciwnik("raptor", ph, trasyRaptorow[i]));
  const { Kubus } = utworzPostacie({ gra, G, Z, m, sw, gAnim, gProxy, kam, druga, zakonczenie, promienie,
    change_energy, change_coins() {}, ambient_sound, odlegloscKamery: 180,
    kolizjePrzyStopach: model => /^kolizja_skrzynie_/.test(model.name),
    profilKamery: { wysokosc: 75, cel: 40, kolizjaWysokosc: 150, kolizjaCel: 70, progKolizji: 250 } });
  const player = new Kubus(m("master"), m("master"), m("mesiek"), punkty.start, 500);
  gra.timeout(33, () => { if (!gra.koniec) player.step(); });
  gra.ustawSwiat(Z, druga, { kolor: new THREE.Color(0, 204 / 255, 1), far: 4000 });
  oswietl(Z, gra.scena, { punktowe: true }); change_energy();
  let plusByl = false, minusByl = false;
  try { gra.tempo = Math.min(80, Math.max(10, parseInt(localStorage.getItem("KubusTempo")) || 30)); } catch { /* Bez zapisu. */ }
  gra.exitFrame = () => {
    if (gra.koniec) return;
    const plus = keyPressed(24) || keyPressed(69), minus = keyPressed(27) || keyPressed(78);
    if (plus && !plusByl) gra.tempo = Math.min(80, gra.tempo + 5);
    if (minus && !minusByl) gra.tempo = Math.max(10, gra.tempo - 5);
    if (plus && !plusByl || minus && !minusByl) try { localStorage.setItem("KubusTempo", String(gra.tempo)); } catch { /* Bez zapisu. */ }
    plusByl = plus; minusByl = minus;
    const p = pozycjaSwiat(m("master")), postac = pozycjaSwiat(m("mesiek"));
    for (const k of krysztaly) if (!k.zebrany && postac.distanceTo(k.pozycja) < 50) {
      k.zebrany = true; Z.deleteModel(k.model.name); G.crystals_number++;
      dzwiek.puppetSound(4, "sound_get_crystal");
      gra.overlay(4).obraz = gra.bitmapa("L" + Math.trunc(G.crystals_number / 10));
      gra.overlay(5).obraz = gra.bitmapa("P" + G.crystals_number % 10);
    }
    gra.overlay(6).blend = 0;
    if (p.distanceTo(punkty.start) < 200) komunikat("01");
    if (G.crystals_number < 35 && (p.distanceTo(punkty.drzwi) < 200 || p.distanceTo(punkty.konsola) < 120)) komunikat("02");
    if (G.crystals_number === 35 && !G.kompWystartowal && p.distanceTo(punkty.konsola) < 120) {
      komunikat("03");
      if (G.action) { G.kompWystartowal = true; otworz(koncowe, false); }
    }
    if (koncowe.opened && koncowe.modele[0].userData.keyframePlayer.czas > 1 && m(koncowe.proxy.name)) {
      Z.deleteModel(koncowe.proxy.name); dzwiek.puppetSound(6, "otwieranie_drzwi");
    }
    for (const d of drzwi) if (!d.opened && p.distanceTo(d.pozycja) < 200) otworz(d, true);
    // Warunek zadania chroni przed wygraną po samym przeniesieniu za zamkniętą bramę.
    if (G.kompWystartowal && !m(koncowe.proxy.name) && p.distanceTo(punkty.koniec) < 80) {
      gra.koniec = true; zakonczenie("wygrana");
    }
  };
  function otworz(d, usunKolizje) {
    if (d.opened) return;
    d.opened = true; d.modele.forEach(o => o.userData.keyframePlayer.play());
    if (usunKolizje) { Z.deleteModel(d.proxy.name); dzwiek.puppetSound(6, "otwieranie_drzwi"); }
  }
  function komunikat(n) { gra.overlay(6).obraz = gra.bitmapa(`K${n}_hol_labolatorium`); gra.overlay(6).blend = 100; }
  function ambient_sound() {
    const p = pozycjaSwiat(m("master"));
    for (const [n, dzw] of [["statek_podloze_mur", "statek_kosmiczny_unoszenie"], ["akwarium_mur", "sound_rybki"]]) {
      const dystans = p.distanceTo(pozycjaSwiat(m(n)));
      if (dystans < 510) {
        dzwiek.setVolume(5, (510 - dystans) / 1.5);
        if (!dzwiek.soundBusy(5)) dzwiek.puppetSound(5, dzw);
        return;
      }
    }
    dzwiek.stop(5);
  }
  function change_energy() {
    if (G.energy <= 0) {
      G.energy = 100; G.lives--; gra.overlay(3).obraz = gra.bitmapa("zycie" + Math.max(1, G.lives));
      if (G.lives < 1 && !gra.koniec) { gra.koniec = true; zakonczenie("przegrana"); }
    }
    gra.overlay(1).obraz = gra.bitmapa(String(Math.trunc(G.energy / 5) * 5));
  }
  return { G, V, punkty, drzwi, koncowe, krysztaly, pajaki, raptory, player, promienie, ryby };
}
