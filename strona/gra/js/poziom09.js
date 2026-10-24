// Trzy próby: reguły z 09_trzy_proby.dcr, zdekompilowane ProjectorRays.
import * as THREE from "./vendor/three.module.min.js";
import { dzwiek, keyPressed, pozycjaSwiat, identity, translate, pointAt } from "./silnik.js";
import { ustawWidocznosc } from "./w3d.js";
import { utworzPostacie } from "./postacie.js";
import { oswietl } from "./poziom01.js";

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const typy = ["gwiazd", "ognia", "przodkow"];
export function uruchomPoziom(gra, zakonczenie) {
  const G = { speed: 0, car_rotation: -90, lives: 3, energy: 100, coin_number: 0,
    action: 0, obrazenia: 0, enemyNear: 0, canOpenThreeGates: false, canOpenKsiaze: false,
    ksiazeDoorOpened: false, krolowaDoorOpened: false, haveLustro: false, lustroInserted: false,
    podestOpened: false, podestOpenedProxy: false, haveAmulet: false,
    ksiazeWidoczny: true, kaplanWidoczny: true, powroty: 0,
    coins_positions: [], coins_refs: [], carrots_positions: [], carrots_refs: [] };
  const Z = gra.member("ziemia"), sw = Z.swiat, m = n => Z.model(n);
  // W tym zasobie kolejność siatek to słup, belka, wewnętrzny bok,
  // a zapisane przypisania zamieniają miejscami dwie ostatnie tekstury.
  for (const siatka of m("KsiazeFramuga").children.filter(o => o.isMesh)) {
    const n = siatka.userData.indeks % 3;
    if (n === 0) continue;
    const shader = n === 1 ? "futryna_belka" : "futryna_in02";
    siatka.material = Z.shader(shader).material; siatka.userData.shader = shader;
  }
  // Boki podestów mają w W3D czarny materiał bez tekstury. Uzupełniamy
  // go istniejącym złotym ornamentem użytym na ścianach komnaty Słońca.
  const bokPodestow = m("slonce_podloga").children.find(o => o.isMesh && o.userData.indeks === 1);
  bokPodestow.material = Z.shader("ornament_slonca").material;
  bokPodestow.userData.shader = "ornament_slonca";
  const punkty = Object.fromEntries(Object.entries({ start: "start1_ph", lawa: "start2_ph", smola: "start3_ph",
    lawaPowrot: "start4_ph", kaplan: "kaplan_ph01", ksiaze: "ksiaze_ph01", krolowa: "krolowa_ph01",
    lustro: "zwierciadlo_ksiaze", cokół: "slonce_cokol_lustra_02", amulet: "amulet_slonca", koniec: "ph_koniecetapu " })
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
  translate(kam.przedniaPA, 1000, 0, 0); translate(kam.przedniaR, -80, -30, 50); translate(kam.przod, 30, 0, -50);
  for (const [n, x, y] of [["100", 490, 20], ["zycie3", 12, 12], ["k01_trzy_proby", 12, 352],
    ["kamien_gwiazdy", 240, -100], ["kamien_ognia", 320, -100], ["kamien_przodkow", 400, -100]]) gra.addOverlay(n, x, y);
  gra.overlay(3).blend = 0;
  for (const n of ["kubus_run", "kubus_take", "kubus_ambient1", "kubus_hit", "kubus_takeup",
    "kaplan_ambient1", "kaplan_talk1", "krolowa_ambient1", "krolowa_ambient2", "krolowa_talk",
    "ksiaze_attack1", "ksiaze_ambient1", "ksiaze_walk", "demon_walk1", "demon_walk2", "demon_attack1", "demon_attack2",
    "puma_ambient1", "puma_run", "puma_attack1", "puma_attack2", "kubus_jump"]) {
    Z.cloneMotionFromCastmember(n, "Group01", gra.member(n === "kubus_jump" ? "kubus_runjump" : n));
  }
  const drzwi = {};
  function zatrzymaj(o) { const kp = o.userData.keyframePlayer; kp.currentLoopState = 0; kp.aktualizuj(0); kp.pause(); }
  for (const typ of [...typy, "ksiaze", "krolowa"]) {
    const modele = typy.includes(typ) ? [m("drzwi_" + typ)] : Array.from({ length: 6 }, (_, i) => m(`drzwi_${typ}${i + 1}`));
    modele.forEach(zatrzymaj);
    drzwi[typ] = { modele, pozycja: pozycjaSwiat(modele[0]), proxy: m(`kolizja_drzwi_${typ}_mur`), opened: false };
  }
  const podest = [2, 3, 4, 5].map(i => m("slonce_planetarium_0" + i));
  podest.forEach(zatrzymaj); zatrzymaj(m("amulet_slonca"));
  const proby = typy.map((typ, i) => ({ typ, kamien: m("kamien_" + typ), pozycja: pozycjaSwiat(m("kamien_" + typ)),
    moc: m("moc_" + typ), miejsceMocy: pozycjaSwiat(m("moc_" + typ)), promien: m("promien_" + typ),
    zebrany: false, wlozony: false, slot: i + 4 }));
  const znacznikiDemonow = Z.modele().filter(o => /^demon_ph\d+$/.test(o.name)).sort((a, b) => a.name.localeCompare(b.name));
  const trasy = znacznikiDemonow.map((_, i) => Z.modele().filter(o => new RegExp(`^w\\d+_demon0${i + 1}$`).test(o.name))
    .sort((a, b) => parseInt(a.name.slice(1)) - parseInt(b.name.slice(1))).map(pozycjaSwiat));
  const pumyPh = Z.modele().filter(o => /^puma_ph\d+$/.test(o.name));
  for (const o of Z.modele()) {
    if (/proxy/i.test(o.name)) { sw.attach(o); ustawWidocznosc(o, 0); }
    else if (/kolizj/i.test(o.name)) { gProxy.attach(o); ustawWidocznosc(o, 0); }
    else gAnim.attach(o);
    if (/_ph|^ph_|^w\d+_|over/i.test(o.name)) ustawWidocznosc(o, 0);
  }
  for (const n of ["moc_gwiazd", "moc_ognia", "moc_przodkow", "promien_gwiazd", "promien_ognia", "promien_przodkow",
    "SlonceSnop", "lustro_krolowa", "amulet_slonca", "portal"]) ustawWidocznosc(m(n), 0);
  m("kolizja_piramida_mur_podloze").position.z -= 400;
  sw.attach(m("master")); ustawWidocznosc(m("master"), 0); gProxy.removeFromParent();
  // Shockwave sam uruchamia wbudowaną animację lawy. Poza wiązania leży
  // poza komnatą; ruch kości trzeba zastosować względem korzenia z W3D.
  const lawa = m("Group01");
  Z.addModifier(lawa, "bonesPlayer");
  const lawaAnim = lawa.userData.bonesPlayer;
  lawaAnim.extractRootMotion = false;
  lawaAnim.queue("Group01", 1); lawaAnim.blend = null; lawaAnim.aktualizuj(0);
  function obiekt(n, czlonek, rodzic = gAnim, animowany = true) {
    const c = gra.member(czlonek), o = Z.cloneModelFromCastmember(n, c.modele()[0].name, c);
    rodzic.add(o); if (animowany) {
      identity(o); Z.addModifier(o, "bonesPlayer");
      o.userData.bonesPlayer.rootLock = 1; o.userData.bonesPlayer.lockTranslation = "all";
    } else ustawWidocznosc(o, 0);
    return o;
  }
  function postac(typ, punkt, wysokosc) {
    const model = obiekt(typ, typ), proxy = obiekt(typ + "proxy", typ + "_proxy", sw, false);
    model.position.copy(punkt).z += wysokosc; proxy.position.copy(punkt);
    let rozmowy = 0;
    const aktor = { model, proxy, stepFrame() {
      if (gra.koniec || !model.parent) return;
      const p = pozycjaSwiat(m("master")), dystans = p.distanceTo(punkt), bp = model.userData.bonesPlayer;
      pointAt(model, V(p.x, p.y, model.position.z), V(0, 0, 1), V(0, -1, 0), V(0, 0, 1));
      if (typ === "ksiaze" && !G.ksiazeWidoczny || typ === "kaplan" && !G.kaplanWidoczny) {
        Z.deleteModel(model.name); Z.deleteModel(proxy.name); return;
      }
      if (!bp.playList.length) {
        if (typ === "ksiaze") {
          bp.queue(dystans < 200 ? "ksiaze_attack1" : "ksiaze_ambient1");
          if (dystans < 200) { G.obrazenia = 25; dzwiek.puppetSound(2, "sound_ksiaze_attack"); }
        } else if (dystans < 200 && rozmowy < 2) {
          bp.queue(typ === "kaplan" ? "kaplan_talk1" : "krolowa_talk"); rozmowy++;
          dzwiek.puppetSound(4, `sound_${typ}_talk`);
        } else { bp.queue(typ + "_ambient" + (typ === "kaplan" ? 1 : 1 + Math.floor(Math.random() * 2))); }
      }
      if (dystans >= 200) rozmowy = 0;
    } };
    gra.dodajAktora(aktor); return aktor;
  }
  const kaplan = postac("kaplan", punkty.kaplan, 45), krolowa = postac("krolowa", punkty.krolowa, 45), ksiaze = postac("ksiaze", punkty.ksiaze, 50);
  function przeciwnik(typ, ph, trasa = []) {
    const start = pozycjaSwiat(ph), grupa = Z.newGroup(typ + ph.name + "group"), wysokosc = typ === "demon" ? 55 : 75;
    gAnim.attach(grupa); grupa.position.copy(start).z += wysokosc;
    if (typ === "demon") {
      const podloga = promienie(() => Z.modelsUnderRay(start.clone().add(V(0, 0, 100)), V(0, 0, -1)))
        .find(h => h.model.name.includes("podloze") && h.isectNormal.z > 0.65);
      // Stopy w animacjach są ~54 jednostki pod korzeniem. Znaczniki W3D
      // stoją 5–9 jednostek ponad podłogą, więc mierzymy rzeczywiste podparcie.
      if (podloga) grupa.position.z = podloga.isectPosition.z + wysokosc;
    }
    const model = obiekt(typ + ph.name, typ, grupa); model.rotation.z = Math.PI / 2;
    const proxy = obiekt(model.name + "proxy", typ + "_proxy", sw, false), bp = model.userData.bonesPlayer;
    // Zachowaj pionowy ruch korzenia; poziomy ruch liczy aktor.
    bp.rootLock = 0;
    if (typ === "demon") { bp.queue("demon_walk1"); bp.blend = null; bp.aktualizuj(0); }
    const aktor = { model, grupa, proxy, start, trasa, currentWP: 0, odwiedzone: new Set(), ataki: 0, stepFrame() {
      if (gra.koniec) return;
      const p = grupa.position, cel = pozycjaSwiat(m("master")), dystans = p.distanceTo(cel), demon = typ === "demon";
      const zasieg = demon ? 200 : 150, wStrefie = demon || cel.distanceTo(start) < 500 && dystans < 500;
      const atak = wStrefie && dystans < zasieg;
      const wp = demon ? trasa[aktor.currentWP] : cel;
      const kierunek = (atak ? cel : wp).clone().sub(p); kierunek.z = 0; kierunek.normalize();
      pointAt(grupa, V((atak ? cel : wp).x, (atak ? cel : wp).y, p.z), V(0, 0, 1), V(1, 0, 0), V(0, 0, 1));
      const blokada = !demon && promienie(() => Z.modelsUnderRay(p.clone().add(V(0, 0, -20)), kierunek))
        .some(h => h.distance < 150 && (h.model.name.includes("mur") && h.isectNormal.z < 0.65 || h.model.name.includes("proxy") && h.model !== proxy));
      const ruch = !atak && (demon || wStrefie && !blokada);
      if (atak && /walk|run/.test(bp.playList[0]?.name ?? "")) while (bp.playList.length) bp.removeLast();
      if (!bp.playList.length) {
        if (atak) {
          const nr = 1 + Math.floor(Math.random() * 2); bp.queue(`${typ}_attack${nr}`); G.obrazenia = 25; aktor.ataki++;
          dzwiek.puppetSound(2, demon ? `sound_demon_attack_${nr}` : `sound_puma_atak_${nr}`);
        } else if (ruch) bp.queue(demon ? "demon_walk" + (1 + Math.floor(Math.random() * 2)) : "puma_run");
        else if (!demon) bp.queue("puma_ambient1");
      }
      if (ruch && /walk|run/.test(bp.playList[0]?.name ?? "")) {
        p.addScaledVector(kierunek, demon ? 1.5 : 6);
        // Próg trasy zachowuje oryginalną wysokość znacznika mimo opuszczenia siatki.
        if (demon && Math.hypot(p.x - wp.x, p.y - wp.y, start.z + 80 - wp.z) < 100) {
          aktor.odwiedzone.add(aktor.currentWP); aktor.currentWP = (aktor.currentWP + 1) % trasa.length;
        }
        if (dystans < 450 && !dzwiek.soundBusy(3)) dzwiek.puppetSound(3, demon ? "sound_demon_walk" : "sound_puma_run");
      }
      proxy.position.copy(p).z -= demon ? wysokosc - 10 : wysokosc;
    } };
    proxy.position.copy(grupa.position).z -= typ === "demon" ? wysokosc - 10 : wysokosc;
    Z.deleteModel(ph.name); gra.dodajAktora(aktor); return aktor;
  }
  const demony = znacznikiDemonow.map((ph, i) => przeciwnik("demon", ph, trasy[i]));
  const pumy = pumyPh.map(ph => przeciwnik("puma", ph));
  const { Kubus } = utworzPostacie({ gra, G, Z, m, sw, gAnim, gProxy, kam, druga, zakonczenie, promienie,
    change_energy, change_coins() {}, ambient_sound, odlegloscKamery: 180, silaSkoku: 25,
    profilKamery: { wysokosc: 75, cel: 40, kolizjaWysokosc: 150, kolizjaCel: 70, progKolizji: 250 },
    niebezpiecznePodloze(lista, naZiemi, gracz) {
      if (!naZiemi) return false;
      // Liczy się najbliższa powierzchnia, aby lawa pod mostkiem nie teleportowała gracza.
      const h = lista.find(h => h.model.name.includes("podloze") && h.isectNormal.z > 0.65);
      if (!h || !/lawa|smola/.test(h.model.name)) return false;
      const cel = h.model.name.includes("smola") ? punkty.smola : proby[1].zebrany ? punkty.lawaPowrot : punkty.lawa;
      G.speed = 0; G.powroty++; gracz.reset(cel, 0); return true;
    } });
  const player = new Kubus(m("master"), m("master"), m("mesiek"), punkty.start, 500);
  gra.timeout(33, () => { if (!gra.koniec) player.step(); });
  gra.ustawSwiat(Z, druga, { kolor: new THREE.Color(0, 204 / 255, 1), far: 4000 }); oswietl(Z, gra.scena); change_energy();
  const portal = m("portal"), portalMaterial = Z.shader("portal").material;
  const tekstury = [1, 2, 3, 4].map(i => { const t = new THREE.Texture(gra.bitmapa("portal0" + i)); t.flipY = false; t.needsUpdate = true; return t; });
  let portalKlatka = 0, plusByl = false, minusByl = false;
  try { gra.tempo = Math.min(80, Math.max(10, parseInt(localStorage.getItem("KubusTempo")) || 30)); } catch { /* Bez zapisu. */ }
  gra.exitFrame = () => {
    if (gra.koniec) return;
    const plus = keyPressed(24) || keyPressed(69), minus = keyPressed(27) || keyPressed(78);
    if (plus && !plusByl) gra.tempo = Math.min(80, gra.tempo + 5);
    if (minus && !minusByl) gra.tempo = Math.max(10, gra.tempo - 5);
    if (plus && !plusByl || minus && !minusByl) try { localStorage.setItem("KubusTempo", String(gra.tempo)); } catch { /* Bez zapisu. */ }
    plusByl = plus; minusByl = minus;
    const p = pozycjaSwiat(m("master")); gra.overlay(3).blend = 0;
    if (G.kaplanWidoczny && p.distanceTo(punkty.kaplan) < 150 && !G.haveLustro) {
      G.canOpenThreeGates = true;
      const ile = proby.filter(t => t.zebrany).length;
      komunikat(ile === 3 ? "03" : ile ? "02" : "01");
      if (ile === 3) G.canOpenKsiaze = true;
    }
    for (const t of proby) {
      const d = drzwi[t.typ];
      if (G.canOpenThreeGates && p.distanceTo(d.pozycja) < 200) otworz(t.typ);
      if (!t.zebrany && p.distanceTo(t.pozycja) < 70) {
        t.zebrany = true; Z.deleteModel(t.kamien.name); gra.overlay(t.slot).loc[1] = 12;
        dzwiek.puppetSound(2, "zebranie_kamieni_mocy");
      }
      if (!t.wlozony && t.zebrany && G.ksiazeDoorOpened && p.distanceTo(t.miejsceMocy) < 150) {
        komunikat("00");
        if (G.action) {
          t.wlozony = true; ustawWidocznosc(t.moc, 1); ustawWidocznosc(t.promien, 1);
          gra.overlay(t.slot).loc[1] = -100; dzwiek.puppetSound(4, "po_wlozeniu_kamieni_mocy");
        }
      }
    }
    if (G.canOpenKsiaze && proby.every(t => t.zebrany) && p.distanceTo(drzwi.ksiaze.pozycja) < 250) {
      G.ksiazeDoorOpened = true; otworz("ksiaze");
    }
    for (const [typ, d] of Object.entries(drzwi)) {
      // Bryła drzwi prób podąża za unoszoną płytą. Sześciokąt znika po 2,8 s.
      if (typy.includes(typ)) d.proxy.position.z = d.modele[0].position.z;
      else if (d.opened && d.modele[0].userData.keyframePlayer.czas > 2.8 && m(d.proxy.name)) Z.deleteModel(d.proxy.name);
    }
    if (proby.every(t => t.wlozony)) { G.ksiazeWidoczny = false; G.kaplanWidoczny = false; }
    if (!G.ksiazeWidoczny && !G.haveLustro && !G.lustroInserted && !G.haveAmulet && p.distanceTo(punkty.lustro) < 1000) {
      komunikat(p.distanceTo(punkty.lustro) < 150 ? "00" : "04");
      if (p.distanceTo(punkty.lustro) < 150 && G.action) {
        G.haveLustro = true; ustawWidocznosc(m("zwierciadlo_ksiaze"), 0); przedmiot("lustro"); dzwiek.puppetSound(4, "wlozenie_zwierciadlo");
      }
    }
    if (G.haveLustro && p.distanceTo(drzwi.krolowa.pozycja) < 350) { G.krolowaDoorOpened = true; otworz("krolowa"); }
    if (p.distanceTo(punkty.krolowa) < 200 && G.haveLustro) komunikat("05");
    if (G.haveLustro && G.krolowaDoorOpened && p.distanceTo(punkty.cokół) < 150) {
      komunikat("00");
      if (G.action) {
        G.haveLustro = false; G.lustroInserted = true; gra.overlay(4).loc[1] = -100;
        ustawWidocznosc(m("SlonceSnop"), 1); ustawWidocznosc(m("lustro_krolowa"), 1); dzwiek.puppetSound(3, "wlozenie_zwierciadlo");
      }
    }
    if (G.lustroInserted && p.distanceTo(punkty.krolowa) < 200) {
      komunikat(G.haveAmulet ? "07" : "06");
      if (!G.podestOpened) {
        G.podestOpened = true; ustawWidocznosc(m("amulet_slonca"), 1);
        [...podest, m("amulet_slonca")].forEach(o => o.userData.keyframePlayer.play()); dzwiek.puppetSound(3, "wysuwanie_planetarium");
      }
    }
    if (G.podestOpened && !G.podestOpenedProxy && podest[1].userData.keyframePlayer.czas > 3) {
      G.podestOpenedProxy = true; m("kolizja_piramida_mur_podloze").position.z += 400;
    }
    if (G.podestOpenedProxy && !G.haveAmulet && p.distanceTo(pozycjaSwiat(m("amulet_slonca"))) < 130) {
      G.haveAmulet = true; ustawWidocznosc(m("amulet_slonca"), 0); przedmiot("amuletslonca"); ustawWidocznosc(portal, 1);
    }
    if (G.haveAmulet) {
      portalMaterial.map = portalMaterial.emissiveMap = tekstury[[0, 1, 2, 3, 2, 1][portalKlatka++ % 6]]; portalMaterial.needsUpdate = true;
      if (!dzwiek.soundBusy(3)) dzwiek.puppetSound(3, "sound_portal");
      if (p.distanceTo(punkty.koniec) < 150) { gra.koniec = true; zakonczenie("wygrana"); }
    }
  };
  function przedmiot(n) { gra.overlay(4).obraz = gra.bitmapa(n); gra.overlay(4).loc = [280, 12]; }
  function ambient_sound() {
    const p = pozycjaSwiat(m("master"));
    for (const [n, dzw] of [["labirynt", "lawa_pulsowanie"], ["LewStrumien", "lawy_wylewanie"],
      ["lawTwarz", "lawy_wylewanie"], ["ksiaze_zygacz_02", "lawy_wylewanie"], ["ksiaze_zygacz_03", "lawy_wylewanie"]]) {
      const dystans = p.distanceTo(pozycjaSwiat(m(n)));
      if (dystans < 1020) {
        dzwiek.setVolume(7, (1020 - dystans) / 4);
        if (!dzwiek.soundBusy(7)) dzwiek.puppetSound(7, dzw);
        return;
      }
    }
    dzwiek.stop(7);
  }
  function komunikat(n) { gra.overlay(3).obraz = gra.bitmapa(`k${n}_trzy_proby`); gra.overlay(3).blend = 100; }
  function otworz(typ) {
    const d = drzwi[typ]; if (d.opened) return;
    d.opened = true; d.modele.forEach(o => o.userData.keyframePlayer.play());
    dzwiek.puppetSound(2, typy.includes(typ) ? "otwieranie_drzwi_trzech_prob_4.2" : "otwieranie_drzwi_szesciokatne_4.2");
  }
  function change_energy() {
    if (G.energy <= 0) {
      G.energy = 100; G.lives--; gra.overlay(2).obraz = gra.bitmapa("zycie" + Math.max(1, G.lives));
      if (G.lives < 1 && !gra.koniec) { gra.koniec = true; zakonczenie("przegrana"); }
    }
    gra.overlay(1).obraz = gra.bitmapa(String(Math.trunc(G.energy / 5) * 5));
  }
  return { G, V, punkty, proby, drzwi, podest, demony, pumy, kaplan, krolowa, ksiaze, player, promienie, portal };
}
