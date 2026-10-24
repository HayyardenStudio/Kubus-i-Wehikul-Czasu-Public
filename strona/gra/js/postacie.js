// Ruch, kamera, zbieranie przedmiotów i rycerze wspólne dla poziomów 1–11.
import * as THREE from "./vendor/three.module.min.js";
import { dzwiek, keyPressed, pozycjaSwiat, osXSwiat, identity, translate, ustawObrotZ, pointAt } from "./silnik.js";
import { ustawWidocznosc } from "./w3d.js";
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const zawiera = (s, t) => s.toLowerCase().includes(t.toLowerCase());
const random = (n) => 1 + Math.floor(Math.random() * n);

export function utworzPostacie({ gra, G, Z, m, sw, gAnim, gProxy, kam, druga, zakonczenie,
  promienie, change_energy, change_coins, ambient_sound = () => {}, przedKrokiem, skok = null,
  odlegloscKamery = 280, profilKamery = {}, niebezpiecznePodloze, silaSkoku = 20,
  kolizjePrzyStopach = null }) {
  const kamera = { wysokosc: 130, cel: 50, kolizjaWysokosc: 170, kolizjaCel: 50,
    progKolizji: odlegloscKamery, ...profilKamery };
  const ustawRodzica = (o, rodzic) => { if (rodzic) rodzic.attach(o); else o.removeFromParent(); };
  function Kubus(targetModel, followModel, ourModel, worldpos, actionRadius) {
    const pmodel = ourModel;
    const fModel = followModel;
    let jumped = -91, jumpBase = 0, profilSkoku = null, pIdle = gra.milliSeconds, noControl = 0, idleNow = 0;
    let fVert = 0, masterVert = 0, oldcamerapointatZ;
    void targetModel; void worldpos; void actionRadius;
    ustawRodzica(pmodel, gAnim);
    identity(pmodel);
    Z.addModifier(pmodel, "bonesPlayer");
    const bp = pmodel.userData.bonesPlayer;
    bp.rootLock = 1;
    bp.lockTranslation = "all";
    pmodel.position.copy(pozycjaSwiat(m("start1_ph")));
    fModel.position.copy(pmodel.position);
    const start = pozycjaSwiat(m("start1_ph"));
    druga.position.set(start.x - odlegloscKamery, start.y, start.z + kamera.wysokosc);
    pointAt(druga, pozycjaSwiat(fModel), V(0, 0, 10));
    Z.deleteModel("start1_ph");
    G.xs = m("master").position.x;
    G.ys = m("master").position.y;
    kam.qba5.position.set(start.x, start.y, start.z + kamera.cel);
    oldcamerapointatZ = start.z + kamera.cel;
    // edycja: wysokość pokładu tratwy (kolizja pływa tylko w poziomie)
    const tratwa = m("kolizja_podloze_tratwa_1");
    const gornaTratwy = tratwa ? new THREE.Box3().setFromObject(tratwa).max.z : Infinity;
    const STOPIEN = 40;                          // tyle Kubuś wchodzi bez skoku (jak przy Pvert)

    this.reset = (p, obrot = 0) => {
      sw.attach(fModel);
      gAnim.attach(pmodel);
      fModel.position.copy(p);
      pmodel.position.copy(p);
      jumped = -91;
      jumpBase = p.z;
      profilSkoku = null;
      masterVert = fVert = p.z;
      G.car_rotation = obrot;
      druga.position.set(p.x - odlegloscKamery, p.y, p.z + kamera.wysokosc);
    };
    this.step = () => {
      przedKrokiem?.(this);
      G.action = keyPressed(59) ? 1 : 0;
      ambient_sound();
      const ms = gra.milliSeconds;
      const lista = bp.playList;
      if (ms - pIdle > 5000 && lista.length === 0) { bp.queue("kubus_ambient1"); idleNow = 1; }
      if (G.speed > 4 && idleNow === 1) bp.removeLast();
      if (G.speed < 3 && idleNow === 0 && lista.length > 0 && !zawiera(lista[0].name, "kubus_hit")) bp.removeLast();
      if (G.speed > 0 && lista.length === 0) { bp.queue("kubus_run"); idleNow = 0; }
      if (ms - pIdle < 5000 && lista.length === 0 && G.speed < 4) { bp.queue("kubus_ambient1"); idleNow = 1; }
      if (jumped > -90 && jumped < -62) { bp.removeLast(); bp.removeLast(); bp.queue("kubus_jump"); }
      if (G.obrazenia > 0 || (G.speed < 4 && G.enemyNear === 1)) {
        bp.removeLast(); bp.removeLast(); bp.queue("kubus_hit");
        G.energy -= G.obrazenia || 5;
        G.obrazenia = 0;
        change_energy();
        idleNow = 0;
      }
      if (G.action && gra.member("kubus_take") && !bp.playList.some((p) => p.name === "kubus_take")) {
        while (bp.playList.length) bp.removeLast();
        bp.queue("kubus_take");
      }
      bp.play();
      G.enemyNear = 0;
      if (keyPressed(123)) { G.car_rotation += 5; pIdle = ms; }
      if (keyPressed(124)) { G.car_rotation -= 5; pIdle = ms; }
      if (keyPressed(126)) { G.speed = 10; pIdle = ms; }
      if (keyPressed(49)) {
        if (jumped === -91 && Math.abs(masterVert - fVert) < 10) {
          jumped = -90;
          const p = pozycjaSwiat(fModel);
          jumpBase = p.z;
          const podparcie = skok && promienie(() => Z.modelsUnderRay(V(p.x, p.y, p.z + 20), V(0, 0, -1)))
            .find((h) => zawiera(h.model.name, "podloze"));
          profilSkoku = podparcie?.model.name === skok?.powierzchnia ? skok : null;
        }
        pIdle = ms;
      }
      if (keyPressed(53)) { zakonczenie("menu"); return; }
      G.cr_rad = G.car_rotation / (180 / Math.PI);
      ustawObrotZ(pmodel, G.car_rotation);
      ustawObrotZ(fModel, G.car_rotation);
      const dummypos = pozycjaSwiat(fModel);
      const rightpos = pozycjaSwiat(kam.qba1);
      const leftpos = pozycjaSwiat(kam.qba2);
      const dirvect = osXSwiat(m("master"));
      // Podparcie badamy w miejscu następnego kroku, nie kilka kroków przed postacią.
      const przodPos = dummypos.clone().addScaledVector(dirvect.clone().normalize(), 10);
      const dirvect1 = osXSwiat(kam.qba1);
      const dirvect2 = osXSwiat(kam.qba2);
      const camerapos = pozycjaSwiat(fModel);
      const cameravect = osXSwiat(kam.old).negate();
      const dol = V(0.001, 0.001, -0.999);
      const [modelsList, modelsListPrzod, modelsList0, modelsList1, modelsList2, cameraList] = promienie(() => [
        Z.modelsUnderRay(V(dummypos.x, dummypos.y, dummypos.z + 20), dol),
        Z.modelsUnderRay(V(przodPos.x, przodPos.y, dummypos.z + 40), dol),
        Z.modelsUnderRay(V(dummypos.x, dummypos.y, dummypos.z + 40), dirvect),
        Z.modelsUnderRay(rightpos, dirvect1),
        Z.modelsUnderRay(leftpos, dirvect2),
        Z.modelsUnderRay(V(camerapos.x, camerapos.y, camerapos.z + 40), cameravect),
      ]);
      if (niebezpiecznePodloze?.(modelsList, jumped === -91, this)) return;

      // tratwa: Kubuś na tratwie płynie razem z nią. Edycja: tylko wtedy, gdy pokład jest
      // najbliżej pod nim (w oryginale wystarczyło, że promień trafił tratwę pod brzegiem wyspy)
      let na_tratwie = 0;
      if (modelsList[0]?.model.name === "kolizja_podloze_tratwa_1") {
        m("kolizja_podloze_tratwa_1").attach(m("master"));
        m("kolizja_podloze_tratwa_1").attach(m("mesiek"));
        na_tratwie = 1;
        if (jumped === -91) noControl = 1;
      } else if (modelsList.length) {
        sw.attach(m("master"));
        gAnim.attach(m("mesiek"));
      }

      // wysokość podłoża pod Kubusiem
      masterVert = pozycjaSwiat(fModel).z;
      fVert = masterVert;
      let vert = 0;
      for (const hit of modelsList) {
        if (!zawiera(hit.model.name, "podloze")) continue;
        vert = hit.isectPosition.z;
        if (vert - STOPIEN > masterVert) continue;
        fVert = vert;
        break;
      }
      // edycja: na tratwie Kubuś stoi na pokładzie, a nie zapadnięty w nim ani nad nim (wchodząc
      // z niższego brzegu zostawał poniżej, a wtedy promienie po bokach trafiały w brzeg wyspy)
      if (na_tratwie && jumped === -91 && fVert !== masterVert && Math.abs(fVert - masterVert) < STOPIEN) {
        translate(fModel, 0, 0, fVert - masterVert);
        masterVert = fVert;
      }
      let Pvert = fVert;
      for (const hit of modelsListPrzod) {
        if (zawiera(hit.model.name, "podloze")) { Pvert = hit.isectPosition.z; break; }
      }
      // Na schodach nie wolno po podniesieniu nóg do następnego stopnia ściągać
      // ich z powrotem do poprzedniego promieniem spod obecnej pozycji.
      if (jumped === -91 && Math.abs(masterVert - fVert) <= STOPIEN) {
        if (Pvert > fVert && Pvert - fVert <= STOPIEN) fVert = Pvert;
        translate(fModel, 0, 0, fVert - masterVert);
        masterVert = fVert;
      }
      let verDif = (fVert - masterVert) / 6;
      if (verDif < fVert - masterVert) verDif = fVert - masterVert + 1;
      if (jumped === -91 && Pvert - masterVert > 70) G.speed = 0;

      // kamera
      const fw = pozycjaSwiat(fModel);
      // Stały punkt obserwacji ponad stopami również na płaskim gruncie.
      // Próg aktualizacji znacznika zostawiał go na Z=0, a kamera opadała do 45.
      const podlozeKamery = jumped > -91 ? Math.max(fVert, jumpBase) : fVert;
      kam.qba5.position.set(fw.x, fw.y, podlozeKamery + kamera.cel);
      let dystansKamery = odlegloscKamery, wysokoscKamery = kamera.wysokosc, wysokoscCelu = kamera.cel;
      G.kolizjaTratwa = 0;
      for (const hit of cameraList) {
        if (zawiera(hit.model.name, "tratwa") && hit.distance < 60) G.kolizjaTratwa = 1;
        if (zawiera(hit.model.name, "mur") || zawiera(hit.model.name, "podloze")) {
          const myvert = hit.distance;
          if (myvert < kamera.progKolizji) {
            dystansKamery = Math.max(35, myvert - 10);
            wysokoscKamery = kamera.kolizjaWysokosc;
            wysokoscCelu = kamera.kolizjaCel;
          }
          break;
        }
      }
      kam.old.position.x += (-dystansKamery - kam.old.position.x) / 5;
      kam.old.position.z = 50;
      const k1 = pozycjaSwiat(kam.old);
      druga.position.x += (k1.x - druga.position.x) / 5;
      druga.position.y += (k1.y - druga.position.y) / 5;
      druga.position.z += (podlozeKamery + wysokoscKamery - druga.position.z) / 5;
      oldcamerapointatZ += (podlozeKamery + wysokoscCelu - oldcamerapointatZ) / 5;
      const q5 = pozycjaSwiat(kam.qba5);
      pointAt(druga, V(q5.x, q5.y, oldcamerapointatZ), V(0, 0, 1));
      if (jumped > 90) jumped = -91;

      // ściany przed Kubusiem i po bokach
      const sciana = (lista) => {
        for (const hit of lista) {
          if (zawiera(hit.model.name, "tratwa") && hit.distance < 60) G.kolizjaTratwa = 1;
          const n = hit.model.name;
          if (hit.model.userData.przepuszczaGracza) continue;
          // edycja: na tratwę wchodzi się jak na stopień, jej burta nie jest ścianą
          if (n === "kolizja_podloze_tratwa_1" && gornaTratwy - pozycjaSwiat(fModel).z < STOPIEN) break;
          // Pochyła powierzchnia podparcia (kolizja schodów) nie jest ścianą.
          if (zawiera(n, "podloze") && hit.isectNormal.z > 0.65) continue;
          if (zawiera(n, "mur") || zawiera(n, "podloze") || zawiera(n, "proxy")) {
            if (hit.distance < 60) {
              G.speed = 0;
              if (jumped > -90) G.speed = -3;
            }
            break;
          }
        }
      };
      sciana(modelsList0);
      sciana(modelsList1);
      sciana(modelsList2);

      // grawitacja i skok
      const przedSkokiemZ = pozycjaSwiat(fModel).z;
      // Dolne podłoże nie skraca skoku nad przerwą. Wyższa powierzchnia
      // zachowuje podparcie z Lingo: można dokończyć wskakiwanie na daszek,
      // gdy stopy znajdą się tuż pod jego krawędzią w czasie wznoszenia.
      const bazaOpadania = jumped > -91 ? Math.max(jumpBase, fVert) : fVert;
      if (!(profilSkoku && jumped > -91) && masterVert - 10 > bazaOpadania) {
        translate(fModel, 0, 0, jumped > -91 ? (bazaOpadania - masterVert) / 6 : verDif);
      }
      if (jumped > -91) {
        jumped += profilSkoku ? 180 / profilSkoku.klatki : 12;
        const luk = Math.cos(jumped / (180 / Math.PI));
        if (!dzwiek.soundBusy(8) && jumped < -50) dzwiek.puppetSound(8, "sound_kubus_skok");
        if (profilSkoku) {
          // Jeden łuk od wysokości wybicia: opadanie nie kasuje wznoszenia
          // w tej samej klatce ani nie skraca przeskoku na wyższy chodnik.
          translate(fModel, 0, 0, jumpBase + Math.max(0, luk) * profilSkoku.wysokosc - pozycjaSwiat(fModel).z);
          if (jumped >= 90) jumped = -91;
        } else if (jumped > -90) fModel.position.z += silaSkoku * luk;
      }
      if (kolizjePrzyStopach) {
        // Po obliczeniu pionowego kroku sprawdzamy także boki przy stopach.
        // Promienie +40 sprzed skoku/opadania mogły ominąć górną skrzynkę.
        const stopa = pozycjaSwiat(fModel), prawa = pozycjaSwiat(kam.qba1), lewa = pozycjaSwiat(kam.qba2);
        prawa.z = lewa.z = stopa.z + 2;
        const przyStopach = promienie(() => [
          Z.modelsUnderRay(stopa.clone().add(V(0, 0, 2)), dirvect),
          Z.modelsUnderRay(prawa, dirvect1),
          Z.modelsUnderRay(lewa, dirvect2),
        ]);
        przyStopach.forEach(lista => sciana(lista.filter(h => kolizjePrzyStopach(h.model))));
      }
      if (G.speed > 0) noControl = 0;
      if (noControl === 0 && G.speed > 0) translate(fModel, 10, 0, 0);
      const poSkoku = pozycjaSwiat(fModel);
      if (poSkoku.z < przedSkokiemZ) {
        // Promień w miejscu lądowania obejmuje cały pionowy krok. Dzięki temu
        // opadanie nie przebija wyższej platformy ani rampy między klatkami.
        const ladowanie = promienie(() => Z.modelsUnderRay(
          V(poSkoku.x, poSkoku.y, przedSkokiemZ + 0.01), V(0, 0, -1)))
          .find((h) => zawiera(h.model.name, "podloze") && h.isectNormal.z > 0.65 &&
            h.isectPosition.z >= poSkoku.z && h.isectPosition.z <= przedSkokiemZ + 0.01);
        if (ladowanie) {
          translate(fModel, 0, 0, ladowanie.isectPosition.z - poSkoku.z);
          jumped = -91;
          masterVert = fVert = ladowanie.isectPosition.z;
        }
      }
      G.speed *= 0.5;
      if (G.speed < 1) G.speed = 0;
      if (G.speed > 0 && !dzwiek.soundBusy(8) && jumped === -91) dzwiek.puppetSound(8, "sound_kubus_kroki");
      calc_coins();
      calc_carrots();
      // jak w Lingo: kopiowane są transformacje lokalne (na tratwie oba modele są jej dziećmi)
      pmodel.position.set(fModel.position.x, fModel.position.y, fModel.position.z + 35);
    };

    function calc_coins() {
      const myPos = pozycjaSwiat(pmodel);
      G.coins_positions.forEach((p, a) => {
        if (myPos.distanceTo(p) < 50) {
          Z.deleteModel(G.coins_refs[a]);
          dzwiek.puppetSound(7, "sound_get_coin");
          G.coins_positions[a] = V(-999999, -999999, -999999);
          G.coin_number += 1;
          change_coins();
        }
      });
      if (G.coin_number === 25 && m("szlaban_plane_mur")) {
        // szlaban się otwiera: model otwarty zamiast zamkniętego, znika niewidzialna ściana
        const zamkniety = m("rogatka_szlaban_03");
        const otwarty = m("szlaban_otwarty");
        if (zamkniety && otwarty) {
          for (const c of [...zamkniety.children]) if (c.isMesh) c.removeFromParent();
          for (const c of otwarty.children) if (c.isMesh) zamkniety.add(c.clone());
          ustawWidocznosc(otwarty, 0);
        }
        Z.deleteModel("szlaban_plane_mur");
      }
    }

    function calc_carrots() {
      const myPos = pozycjaSwiat(pmodel);
      G.carrots_positions.forEach((p, a) => {
        if (myPos.distanceTo(p) < 70) {
          Z.deleteModel(G.carrots_refs[a]);
          dzwiek.puppetSound(7, "sound_get_carrot");
          G.carrots_positions[a] = V(-999999, -999999, -999999);
          G.energy = 100;
          change_energy();
        }
      });
    }
  }

  function Rycerz(rodzaj, targetModel, ourModel, worldpos, actionRadius) {
    const gruby = rodzaj === "gruby";
    const pmodel = ourModel, pTargetModel = targetModel, pWorldPos = worldpos, pRadius = actionRadius;
    const bp = pmodel.userData.bonesPlayer;
    const anim = (n) => `rycerz_${rodzaj}_${n}`;
    let pTrigger = 0, lastTime = 0;
    ustawRodzica(pmodel, gAnim);
    // Stopy grubego rycerza w animacjach leżą ~22,5 jednostki poniżej początku
    // modelu, a droga na Z=-126. Dawne -90 zostawiało ~13,5 jednostki prześwitu.
    pmodel.position.z = gruby ? -103.5 : -100;
    pmodel.position.y = pWorldPos.y;
    pmodel.position.x = pWorldPos.x;
    gra.dodajAktora(this);
    this.stepFrame = () => {
      if (gra.milliSeconds - lastTime < 30) return;
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
      if (bp.playList.some((p) => zawiera(p.name, "walk"))) rotateTowards();
      const gesPos = pozycjaSwiat(pmodel);
      const dirvect = osXSwiat(pmodel);
      const modelsList = promienie(() => Z.modelsUnderRay(gesPos, dirvect, 1));
      const myDistance = pozycjaSwiat(pTargetModel).distanceTo(pozycjaSwiat(pmodel));
      // "playList contains "walk"" sprawdza listę jako tekst, więc działa jak szukanie nazwy
      const zawieraNazwe = (t) => bp.playList.some((p) => zawiera(p.name, t));
      if (myDistance <= 150 || myDistance >= 400) {
        if (zawieraNazwe("walk")) bp.removeLast();
        if (zawieraNazwe("run")) bp.removeLast();
      }
      for (const hit of modelsList) {
        const n = hit.model.name;
        if (zawiera(n, "mur") || (zawiera(n, "proxy") && n !== pmodel.name + "proxy")) {
          if (hit.distance < (gruby ? 80 : 100)) {
            if (bp.playList.length > 0) {
              const ls = bp.playList[0];
              if (zawiera(ls.name, "walk")) bp.removeLast();
              if (zawiera(ls.name, "atak")) bp.removeLast();
            }
            if (bp.playList.length === 0) bp.queue(anim("ambient1"));
            break;
          }
        }
      }
      if (bp.playList.length === 0) {
        rotateTowards();
        if (myDistance <= 150) {
          G.enemyNear = 1;
          bp.queue(anim("atak"));
          if (!dzwiek.soundBusy(7)) dzwiek.puppetSound(7, `sound_${rodzaj}_atak`);
        }
        if (myDistance >= 400) {
          if (!dzwiek.soundBusy(7)) dzwiek.puppetSound(7, `sound_${rodzaj}_ambient`);
          bp.queue(gruby ? anim("ambient" + random(2)) : anim("ambient1"));
        }
        if (myDistance < 400 && myDistance > 150) {
          // Ciągły chód: bez przerwy i ponownego autoBlend na granicy każdego kroku.
          bp.queue(anim("walk"), 1);
          if (!dzwiek.soundBusy(7)) dzwiek.puppetSound(7, `sound_${rodzaj}_ambient`);
        }
      }
      m(pmodel.name + "proxy").position.copy(pozycjaSwiat(pmodel));
    };
    const outsideZone = () => {
      if (bp.playList.some((p) => zawiera(p.name, "walk"))) bp.removeLast();
      if (bp.playList.length === 0) {
        rotateTowards();
        bp.queue(gruby ? anim("ambient2") : anim("ambient1"));
      }
      bp.play();
    };
    const rotateTowards = () => {
      m(pmodel.name + "proxy").position.copy(pozycjaSwiat(pmodel));
      const cel = gruby ? pozycjaSwiat(m("master")) : pozycjaSwiat(kam.qba5);
      // Cel wyznacza tylko azymut; rycerz obraca się w poziomie i zachowuje pionową sylwetkę.
      pointAt(pmodel, V(cel.x, cel.y, pozycjaSwiat(pmodel).z), V(0, 0, 1), V(1, 0, 0), V(0, 0, 1));
    };
  }

  return { Kubus, Rycerz };
}
