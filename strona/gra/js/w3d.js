// Scena Shockwave 3D (członek obsady typu #shockwave3d) odtworzona na three.js.
//
// Dane pochodzą z tools/w3d_eksport (para NAZWA.json + NAZWA.bin). Ten moduł daje grze
// te same pojęcia, których używały skrypty Lingo: świat z grupami, modele z transformacjami,
// kamery, shadery, modelsUnderRay, cloneModelFromCastmember, bonesPlayer i keyframePlayer.
// Układ współrzędnych zostaje jak w oryginale (oś Z w górę, jednostki z 3ds Max).

import * as THREE from "./vendor/three.module.min.js";

// Nazwy w plikach W3D są w Windows-1250, a eksporter przepuszcza je bajt po bajcie.
const cp1250 = new TextDecoder("windows-1250");
function nazwa(s) {
  return /[\x80-\xff]/.test(s) ? cp1250.decode(Uint8Array.from(s, (c) => c.charCodeAt(0))) : s;
}
const klucz = (s) => s.toLowerCase();

function ustawTransformacjeW3d(wezel, transform) {
  const macierz = new THREE.Matrix4().fromArray(transform);
  macierz.decompose(wezel.position, wezel.quaternion, wezel.scale);
  wezel.updateMatrix();
  // Macierze domów i oddzielnych kwiatów zawierają skos. Samo TRS go gubi,
  // przesuwając kwiaty zależnie od odległości ich geometrii od początku modelu.
  // Zachowujemy pełną macierz; Object3D.attach również zachowa ją przy zmianie rodzica.
  if (macierz.elements.some((v, i) => Math.abs(v - wezel.matrix.elements[i]) > 1e-5)) {
    wezel.matrix.copy(macierz);
    wezel.matrixAutoUpdate = false;
  }
}

export async function wczytajW3d(url) {
  const [json, bin] = await Promise.all([
    fetch(url + ".json").then((r) => r.json()),
    fetch(url + ".bin").then((r) => r.arrayBuffer()),
  ]);
  return new DaneW3d(json, bin);
}

// Surowe dane jednego członka: zasoby budowane na żądanie i współdzielone przez klony.
let licznikDanych = 0;

export class DaneW3d {
  constructor(json, bin) {
    this.id = ++licznikDanych;
    this.json = json;
    this.bin = bin;
    this.wezly = new Map(json.nodes.map((n) => [klucz(nazwa(n.name)), n]));
    this.shaderyDef = new Map(json.shaders.map((s) => [klucz(nazwa(s.name)), s]));
    this.materialyDef = new Map(json.materials.map((m) => [klucz(nazwa(m.name)), m]));
    this.szkielety = new Map(json.skeletons.map((s) => [klucz(nazwa(s.name)), s]));
    this.ruchy = new Map(json.motions.map((m) => [klucz(nazwa(m.name)), new Ruch(m, bin)]));
    this.swiatla = new Map(json.lights.map((l) => [klucz(nazwa(l.name)), l]));
    this.geometrie = new Map();
    this.tekstury = new Map();
  }

  // Wszystkie tekstury członka wczytane i zdekodowane.
  gotowe() {
    return Promise.all(Object.keys(this.json.textures).map((n) => this.tekstura(nazwa(n))?.userData.gotowa));
  }

  f32([o, n]) { return new Float32Array(this.bin, o, n); }
  u32([o, n]) { return new Uint32Array(this.bin, o, n); }

  // Geometrie zasobu modelu: jedna na siatkę (każda siatka ma własny shader).
  geometria(zasob) {
    const k = klucz(zasob);
    if (this.geometrie.has(k)) return this.geometrie.get(k);
    const def = Object.entries(this.json.resources).find(([n]) => klucz(nazwa(n)) === k)?.[1];
    const lista = (def?.meshes ?? []).map((m) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(this.f32(m.positions), 3));
      if (m.normals[1]) g.setAttribute("normal", new THREE.BufferAttribute(this.f32(m.normals), 3));
      if (m.uvs[0]?.[1]) {
        // UV z CLOD są w zakresie [-0,5; 0,5] (jak w IFX): u+0,5 i 0,5-v przy teksturze bez flipY
        const src = this.f32(m.uvs[0]);
        const uv = new Float32Array(src.length);
        for (let i = 0; i < src.length; i += 2) {
          uv[i] = src[i] + 0.5;
          uv[i + 1] = 0.5 - src[i + 1];
        }
        g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
      }
      g.setIndex(new THREE.BufferAttribute(this.u32(m.faces), 1));
      if (!m.normals[1]) g.computeVertexNormals();
      if (m.boneIndices) {
        g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(this.u32(m.boneIndices), 4));
        g.setAttribute("skinWeight", new THREE.BufferAttribute(this.f32(m.boneWeights), 4));
      }
      g.computeBoundingSphere();
      return g;
    });
    const wynik = { siatki: lista, shading: def?.shading ?? [] };
    this.geometrie.set(k, wynik);
    return wynik;
  }

  tekstura(nazwaTekstury) {
    const k = klucz(nazwaTekstury);
    if (this.tekstury.has(k)) return this.tekstury.get(k);
    const def = Object.entries(this.json.textures).find(([n]) => klucz(nazwa(n)) === k)?.[1];
    let tex = null;
    if (def) {
      const bajty = new Uint8Array(this.bin, def.data[0], def.data[1]);
      const alfa = kanalAlfaW3d(bajty);
      tex = new THREE.Texture();
      tex.flipY = false;
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.colorSpace = THREE.NoColorSpace;
      tex.userData.przezroczysta = !!alfa || def.mime === "image/png";
      const blob = new Blob([bajty.subarray(0, alfa?.koniecJpeg ?? bajty.length)], { type: def.mime });
      tex.userData.gotowa = createImageBitmap(blob, { premultiplyAlpha: "none" }).then(async (img) => {
        if (alfa) img = await dolaczAlfa(img, alfa);
        tex.image = img;
        tex.needsUpdate = true;
      });
    }
    this.tekstury.set(k, tex);
    return tex;
  }
}

// Eksporter DirPlayera skleja kontynuacje tekstury: JPEG (RGB), a za nim nagłówek
// szerokość/wysokość/rozmiar i kanał alfa skompresowany zlib. Dekoder JPEG ignoruje
// ten ogon, więc bez odtworzenia maski kwiaty i herby mają nieprzezroczyste tło.
function kanalAlfaW3d(bajty) {
  if (bajty[0] !== 0xff || bajty[1] !== 0xd8) return null;
  const view = new DataView(bajty.buffer, bajty.byteOffset, bajty.byteLength);
  for (let i = 2; i + 14 < bajty.length; i++) {
    if (bajty[i] !== 0xff || bajty[i + 1] !== 0xd9) continue;
    const p = i + 2;
    const szerokosc = view.getUint32(p, true), wysokosc = view.getUint32(p + 4, true);
    const rozmiar = view.getUint32(p + 8, true);
    if (szerokosc > 0 && wysokosc > 0 && rozmiar === bajty.length - p - 12) {
      return { szerokosc, wysokosc, koniecJpeg: p, dane: bajty.subarray(p + 12) };
    }
  }
  return null;
}

async function dolaczAlfa(img, alfa) {
  if (img.width !== alfa.szerokosc || img.height !== alfa.wysokosc) {
    throw new Error("Rozmiar maski W3D nie pasuje do tekstury");
  }
  const strumien = new Blob([alfa.dane]).stream().pipeThrough(new DecompressionStream("deflate"));
  const maska = new Uint8Array(await new Response(strumien).arrayBuffer());
  if (maska.length !== img.width * img.height) throw new Error("Niepełny kanał alfa W3D");
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const piksele = ctx.getImageData(0, 0, img.width, img.height);
  // Surowa maska ma wiersze od dołu, JPEG po dekodowaniu — od góry.
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      piksele.data[(y * img.width + x) * 4 + 3] = maska[(img.height - 1 - y) * img.width + x];
    }
  }
  ctx.putImageData(piksele, 0, 0);
  img.close();
  return createImageBitmap(canvas, { premultiplyAlpha: "none" });
}

// Animacja (motion): ścieżki kości albo węzłów z klatkami kluczowymi [t, pos3, rot4, skala3].
class Ruch {
  constructor(def, bin) {
    this.nazwa = nazwa(def.name);
    this.sciezki = def.tracks.map((t) => ({ kosc: klucz(nazwa(t.bone)), klatki: new Float32Array(bin, t.keys[0], t.keys[1]) }));
    // Wycięte klipy zachowują czas z osi 3ds Max (chód rycerzy zaczyna się w 0,27–0,30 s).
    // Początek odtwarzania to pierwsza klatka klipu, bez martwego odcinka przed każdą pętlą.
    this.poczatek = this.sciezki.length ? Math.min(...this.sciezki.map((s) => s.klatki[0])) : 0;
    this.dlugosc = 0;
    for (const s of this.sciezki) this.dlugosc = Math.max(this.dlugosc, (s.klatki[s.klatki.length - 11] ?? 0) - this.poczatek);
  }

  // Stan ścieżki w chwili t (sekundy): pozycja, obrót, skala.
  probka(s, t, pos, rot, skala) {
    t += this.poczatek;
    const k = s.klatki;
    const n = k.length / 11;
    let i = 0;
    while (i < n - 1 && k[(i + 1) * 11] <= t) i++;
    const a = i * 11;
    const b = Math.min(i + 1, n - 1) * 11;
    const span = k[b] - k[a];
    const f = span > 0 ? Math.min(Math.max((t - k[a]) / span, 0), 1) : 0;
    pos.set(k[a + 1], k[a + 2], k[a + 3]).lerp(_v.set(k[b + 1], k[b + 2], k[b + 3]), f);
    rot.set(k[a + 4], k[a + 5], k[a + 6], k[a + 7]).normalize();
    _q.set(k[b + 4], k[b + 5], k[b + 6], k[b + 7]).normalize();
    rot.slerp(_q, f);
    if (skala) skala.set(k[a + 8], k[a + 9], k[a + 10]).lerp(_v.set(k[b + 8], k[b + 9], k[b + 10]), f);
  }
}
const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();

// ---------------------------------------------------------------------------------------
// Członek obsady #shockwave3d: świat, w którym działa poziom.
// ---------------------------------------------------------------------------------------
export class Scena3d {
  constructor(dane) {
    this.dane = dane;
    this.swiat = new THREE.Group();
    this.swiat.name = "World";
    this.swiat.userData.typ = "group";
    this.wezly = new Map([["world", this.swiat]]);
    this.ruchy = new Map(dane.ruchy);
    this.shadery = new Map();
    this.teksturyNowe = new Map();
    this.animowane = new Set();         // modele z bonesPlayer albo keyframePlayer
    // węzły z pliku W3D, w kolejności z pliku (jak member.model[i])
    for (const def of dane.json.nodes) this.utworzWezel(def, dane, nazwa(def.name));
    for (const def of dane.json.nodes) {
      const w = this.wezly.get(klucz(nazwa(def.name)));
      const rodzic = this.wezly.get(klucz(nazwa(def.parent))) ?? this.swiat;
      if (w !== this.swiat) rodzic.add(w);
    }
    // keyframePlayer: animacje węzłów zapisane w świecie odtwarzają się same
    for (const ruch of dane.ruchy.values()) {
      if (ruch.sciezki.length !== 1) continue;
      const cel = this.wezly.get(ruch.sciezki[0].kosc);
      if (cel && cel.userData.typ === "model") {
        cel.userData.keyframePlayer = new KeyframePlayer(cel, ruch);
        this.animowane.add(cel);
      }
    }
  }

  utworzWezel(def, dane, imie) {
    let w;
    if (def.type === "camera") {
      w = new THREE.PerspectiveCamera(def.fov, 4 / 3, 5, Math.min(def.far, 1e6));
      w.up.set(0, 0, 1);
    } else if (def.type === "model") {
      w = this.zbudujModel(dane, def.resource ? nazwa(def.resource) : imie, def);
    } else {
      w = new THREE.Group();
    }
    w.name = imie;
    w.userData.typ = def.type;
    w.matrixAutoUpdate = true;
    ustawTransformacjeW3d(w, def.transform);
    this.wezly.set(klucz(imie), w);
    return w;
  }

  // Model: kontener z siatkami zasobu (i szkieletem, jeśli zasób go ma).
  zbudujModel(dane, zasob, def) {
    const model = new THREE.Group();
    const { siatki, shading } = dane.geometria(zasob);
    const szkielet = dane.szkielety.get(klucz(zasob));
    model.userData.zasob = zasob;
    model.userData.dane = dane;
    model.userData.shaderWezla = def.shader ? nazwa(def.shader) : "";
    model.userData.widocznosc = def.visibility ?? 1;
    let kosci = null;
    if (szkielet) {
      kosci = zbudujKosci(szkielet);
      model.userData.szkielet = kosci;
      model.add(kosci.korzen);
    }
    siatki.forEach((g, i) => {
      const nazwaShadera = shaderSiatki(shading, i, model.userData.shaderWezla);
      const material = this.materialShadera(nazwaShadera, dane);
      let m;
      if (kosci && g.getAttribute("skinIndex")) {
        m = new THREE.SkinnedMesh(g, material);
        m.bind(kosci.skeleton, new THREE.Matrix4());
      } else {
        m = new THREE.Mesh(g, material);
      }
      m.userData.shader = nazwaShadera;
      m.userData.indeks = i;
      model.add(m);
    });
    ustawWidocznosc(model, model.userData.widocznosc);
    return model;
  }

  // Materiał three.js odpowiadający shaderowi #standard z Directora (oświetlenie Gourauda).
  // Shadery z różnych członków bywają nazwane tak samo ("01 - Default" z 3ds Max), więc klucz
  // zawiera członka, z którego pochodzi model.
  materialShadera(nazwaShadera, dane = this.dane) {
    const k = dane === this.dane ? klucz(nazwaShadera) : `${dane.id}:${klucz(nazwaShadera)}`;
    const istniejacy = this.shadery.get(k);
    if (istniejacy) return istniejacy.material;
    const def = dane.shaderyDef.get(klucz(nazwaShadera)) ?? { layers: [], material: "" };
    const mat = dane.materialyDef.get(klucz(nazwa(def.material ?? ""))) ?? null;
    const warstwa = def.layers.find((l) => l.texture);
    const map = warstwa ? dane.tekstura(nazwa(warstwa.texture)) : null;
    const kolor = map && !def.useDiffuseWithTexture ? [1, 1, 1] : (mat?.diffuse ?? [1, 1, 1]);
    // Np. oczy w budzie: tekstura zastępuje całkowicie czarny materiał, bez oświetlenia.
    const samObraz = map && !def.useDiffuseWithTexture && mat
      && [mat.ambient, mat.diffuse, mat.emissive].every((c) => c.slice(0, 3).every((v) => v === 0));
    const material = new THREE.MeshLambertMaterial({
      color: new THREE.Color(kolor[0], kolor[1], kolor[2]),
      emissive: samObraz ? 0xffffff : mat ? new THREE.Color(mat.emissive[0], mat.emissive[1], mat.emissive[2]) : 0x000000,
      map,
      emissiveMap: map,
      opacity: mat?.opacity ?? 1,
      transparent: (mat?.opacity ?? 1) < 1,
      alphaTest: map?.userData.przezroczysta ? 0.5 : 0,
    });
    material.name = nazwaShadera;
    oswietlenieDirectora(material, mat ? mat.ambient.slice(0, 3).map((a, i) => a / Math.max(kolor[i], 1e-3)) : [1, 1, 1]);
    const shader = new Shader(nazwaShadera, material, map);
    this.shadery.set(k, shader);
    return material;
  }

  // ----- API jak w Lingo: member("ziemia").model("...") itd. -----
  model(n) { return typeof n === "number" ? this.modele()[n - 1] : this.wezly.get(klucz(n)); }
  group(n) { return this.wezly.get(klucz(n)); }
  camera(n) { return this.wezly.get(klucz(n)); }
  shader(n) { this.materialShadera(n); return this.shadery.get(klucz(n)); }

  // Wszystkie modele w kolejności utworzenia (member.model.count, member.model[i]).
  modele() {
    return [...this.wezly.values()].filter((w) => w.userData.typ === "model");
  }

  newGroup(imie) {
    const g = new THREE.Group();
    g.name = imie;
    g.userData.typ = "group";
    this.wezly.set(klucz(imie), g);
    this.swiat.add(g);
    return g;
  }

  deleteModel(imie) {
    const m = this.wezly.get(klucz(imie));
    if (!m) return;
    m.removeFromParent();
    for (const dziecko of [...m.children]) if (dziecko.userData.typ) this.swiat.attach(dziecko);
    this.wezly.delete(klucz(imie));
    this.animowane.delete(m);
  }

  // Kopia modelu z innego członka (razem z dziećmi), dodana do świata w miejscu jak w źródle.
  cloneModelFromCastmember(nowaNazwa, nazwaZrodla, inny) {
    const def = inny.dane.wezly.get(klucz(nazwaZrodla));
    const w = this.kopiujWezel(def, inny.dane, nowaNazwa);
    this.swiat.add(w);
    // dzieci węzła źródłowego (np. pomocnicze grupy) też przechodzą
    for (const d of inny.dane.json.nodes) {
      if (klucz(nazwa(d.parent)) === klucz(nazwaZrodla) && d.type === "model") {
        w.add(this.kopiujWezel(d, inny.dane, nazwa(d.name)));
      }
    }
    // animacje węzłów ze źródła (keyframePlayer) jadą razem z modelem
    for (const ruch of inny.dane.ruchy.values()) {
      if (ruch.sciezki.length === 1 && ruch.sciezki[0].kosc === klucz(nazwaZrodla)) {
        w.userData.keyframePlayer = new KeyframePlayer(w, ruch);
        this.animowane.add(w);
      }
    }
    return w;
  }

  kopiujWezel(def, dane, imie) {
    const w = def.type === "model"
      ? this.zbudujModel(dane, nazwa(def.resource || def.name), def)
      : new THREE.Group();
    w.name = imie;
    w.userData.typ = def.type === "model" ? "model" : "group";
    ustawTransformacjeW3d(w, def.transform);
    this.wezly.set(klucz(imie), w);
    return w;
  }

  cloneMotionFromCastmember(nowaNazwa, nazwaZrodla, inny) {
    const r = inny.dane.ruchy.get(klucz(nazwaZrodla));
    if (r) this.ruchy.set(klucz(nowaNazwa), r);
  }

  // model.clone(nowaNazwa): ten sam zasób i shadery, ten sam rodzic
  cloneModel(model, nowaNazwa) {
    const w = this.zbudujModel(model.userData.dane, model.userData.zasob,
      { shader: model.userData.shaderWezla, visibility: model.userData.widocznosc });
    w.name = nowaNazwa;
    w.userData.typ = "model";
    w.position.copy(model.position);
    w.quaternion.copy(model.quaternion);
    w.scale.copy(model.scale);
    if (!model.matrixAutoUpdate) {
      w.matrix.copy(model.matrix);
      w.matrixAutoUpdate = false;
    }
    if (model.userData.keyframePlayer) {
      w.userData.keyframePlayer = new KeyframePlayer(w, model.userData.keyframePlayer.ruch);
      this.animowane.add(w);
    }
    (model.parent ?? this.swiat).add(w);
    this.wezly.set(klucz(nowaNazwa), w);
    return w;
  }

  addModifier(model, rodzaj) {
    if (rodzaj === "bonesPlayer" && !model.userData.bonesPlayer) {
      model.userData.bonesPlayer = new BonesPlayer(model, this);
      this.animowane.add(model);
    }
  }

  // Tekstura z bitmapy (newTexture #fromCastMember); obraz można później podmienić.
  newTexture(imie, obraz) {
    const t = new THREE.Texture(obraz);
    t.colorSpace = THREE.NoColorSpace;
    t.needsUpdate = true;
    this.teksturyNowe.set(klucz(imie), t);
    return t;
  }

  // modelsUnderRay(punkt, kierunek, maksModeli): trafienia posortowane według odległości,
  // najbliższe na model. Jak w Directorze liczą się tylko ściany, w które promień wchodzi
  // (od strony normalnej), także w modelach z visibility #none; pomijane są modele poza światem.
  modelsUnderRay(punkt, kierunek, maks = Infinity) {
    const ray = new THREE.Ray(punkt.clone(), kierunek.clone().normalize());
    this.swiat.updateMatrixWorld(true);
    const trafienia = [];
    const sfera = new THREE.Sphere();
    const odwr = new THREE.Matrix4();
    const lokalny = new THREE.Ray();
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    const p = new THREE.Vector3();
    const odwiedz = (w) => {
      if (w.userData.typ === "model") {
        let najblizsze = null;
        for (const m of w.children) {
          if (!m.isMesh || m.isSkinnedMesh) continue;
          const g = m.geometry;
          sfera.copy(g.boundingSphere).applyMatrix4(m.matrixWorld);
          if (!ray.intersectsSphere(sfera)) continue;
          odwr.copy(m.matrixWorld).invert();
          lokalny.copy(ray).applyMatrix4(odwr);
          const lustro = m.matrixWorld.determinant() < 0;
          const poz = g.attributes.position.array;
          const idx = g.index.array;
          for (let i = 0; i < idx.length; i += 3) {
            a.fromArray(poz, idx[i] * 3);
            b.fromArray(poz, idx[i + 1] * 3);
            c.fromArray(poz, idx[i + 2] * 3);
            const hit = lustro ? lokalny.intersectTriangle(a, c, b, true, p) : lokalny.intersectTriangle(a, b, c, true, p);
            if (!hit) continue;
            const swiatowy = p.clone().applyMatrix4(m.matrixWorld);
            const d = swiatowy.distanceTo(ray.origin);
            if (!najblizsze || d < najblizsze.distance) {
              const n = new THREE.Vector3().subVectors(b, a).cross(c.clone().sub(a)).transformDirection(m.matrixWorld);
              najblizsze = { model: w, distance: d, isectPosition: swiatowy, isectNormal: lustro ? n.negate() : n, meshID: m.userData.indeks + 1, faceID: i / 3 + 1 };
            }
          }
        }
        if (najblizsze) trafienia.push(najblizsze);
      }
      for (const d of w.children) if (d.userData.typ) odwiedz(d);
    };
    odwiedz(this.swiat);
    trafienia.sort((x, y) => x.distance - y.distance);
    return trafienia.slice(0, maks);
  }

  // Postęp animacji (wołany co klatkę obrazu z czasem w sekundach).
  aktualizuj(dt) {
    for (const m of this.animowane) {
      m.userData.keyframePlayer?.aktualizuj(dt);
      m.userData.bonesPlayer?.aktualizuj(dt);
    }
  }
}

// Shader z Directora: blend (0-100) i przesuwanie tekstury (textureTransformList[1].translate).
class Shader {
  constructor(imie, material, map) {
    this.name = imie;
    this.material = material;
    this.map = map;
    this.textureTransformList = [{ translate: (x, y) => { if (this.map) { this.map.offset.x += x; this.map.offset.y -= y; } } }];
    this.textureTransformList[1] = this.textureTransformList[0];
  }
  get blend() { return this.material.opacity * 100; }
  set blend(v) {
    this.material.opacity = v / 100;
    this.material.transparent = v < 100;
    this.material.depthWrite = v >= 100;
  }
}

// Oświetlenie jak w Shockwave 3D: światło otoczenia mnożone przez kolor ambient materiału
// (a nie diffuse), emisja również mnożona przez teksturę, a cała suma obcięta do 1.
function oswietlenieDirectora(material, ambient) {
  material.onBeforeCompile = (sh) => {
    sh.uniforms.ambientMat = { value: new THREE.Vector3(...ambient) };
    sh.fragmentShader = "uniform vec3 ambientMat;\n" + sh.fragmentShader
      .replace("#include <lights_fragment_begin>", THREE.ShaderChunk.lights_fragment_begin.replace(
        "vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );",
        "vec3 irradiance = getAmbientLightIrradiance( ambientLightColor ) * ambientMat;"))
      .replace("#include <opaque_fragment>",
        "outgoingLight = min( outgoingLight, diffuseColor.rgb );\n#include <opaque_fragment>");
  };
  material.customProgramCacheKey = () => ambient.join(",");
}

function shaderSiatki(shading, i, shaderWezla) {
  for (const s of shading) {
    const n = s.meshes[i];
    if (n && klucz(n) !== "defaultshader" && klucz(s.name) !== "default") return nazwa(n);
  }
  for (const s of shading) if (s.meshes[i]) return nazwa(s.meshes[i]);
  return shaderWezla || "DefaultShader";
}

export function ustawWidocznosc(model, v) {
  // 0 = #none, 1 = #front, 2 = #back, 3 = #both
  model.userData.widocznosc = v;
  for (const m of model.children) {
    if (!m.isMesh) continue;
    m.visible = v !== 0;
    if (v === 3 && m.material.side !== THREE.DoubleSide) {
      const zrodlo = m.material;
      m.material = zrodlo.clone();
      m.material.onBeforeCompile = zrodlo.onBeforeCompile;
      m.material.customProgramCacheKey = zrodlo.customProgramCacheKey;
      m.material.side = THREE.DoubleSide;
    }
  }
}

// ---------------------------------------------------------------------------------------
// Szkielety i bonesPlayer
// ---------------------------------------------------------------------------------------
// Kość w IFX jest doczepiona na KOŃCU kości-rodzica: świat(dziecko) = świat(rodzic) ·
// T(długość rodzica, 0, 0) · T(dir) · R(rot). W three.js to zwykła pozycja lokalna dir +
// (długość rodzica, 0, 0).
function zbudujKosci(def) {
  const kosci = def.bones.map((b) => {
    const k = new THREE.Bone();
    k.name = nazwa(b.name);
    return k;
  });
  const korzen = new THREE.Group();
  def.bones.forEach((b, i) => {
    const plen = b.parent >= 0 ? def.bones[b.parent].length : 0;
    kosci[i].position.set(b.dir[0] + plen, b.dir[1], b.dir[2]);
    kosci[i].quaternion.set(b.rot[0], b.rot[1], b.rot[2], b.rot[3]).normalize();
    (b.parent >= 0 ? kosci[b.parent] : korzen).add(kosci[i]);
  });
  korzen.updateMatrixWorld(true);
  const odwrotne = kosci.map((k) => k.matrixWorld.clone().invert());
  const skeleton = new THREE.Skeleton(kosci, odwrotne);
  const indeks = new Map(kosci.map((k, i) => [klucz(k.name), i]));
  const r = def.bones.find((b) => b.parent < 0);
  const korzenOdwr = new THREE.Matrix4().compose(new THREE.Vector3(...r.dir),
    new THREE.Quaternion(...r.rot).normalize(), new THREE.Vector3(1, 1, 1)).invert();
  return { def, kosci, korzen, skeleton, indeks, korzenOdwr };
}

// Odtwarzacz animacji szkieletowych (modyfikator #bonesPlayer).
// playList[0] to bieżąca animacja; animacja bez zapętlenia po zakończeniu znika z listy,
// a model zostaje w ostatniej pozie. Przy rootLock = 0 przesunięcie kości-korzenia z animacji
// przesuwa cały model (positionReset = 0: przesunięcie narasta między powtórzeniami).
class BonesPlayer {
  constructor(model, scena) {
    this.model = model;
    this.scena = scena;
    this.playList = [];
    this.playing = true;
    this.czas = 0;                  // s od początku bieżącej animacji
    this.rootLock = 0;
    // Mechanizmy sceny mają klatki korzenia w układzie modelu; bipedy używają ruchu względem pozy wiązania.
    this.absoluteRoot = false;
    this.extractRootMotion = true;  // chód postaci przesuwa model; mechanizmy poruszają samymi kośćmi
    this.lockTranslation = "none";
    this.positionReset = 0;
    this.rotationReset = "none";
    this.poprzedniKorzen = null;
    this.blend = null;              // płynne przejście między animacjami (autoBlend, 0,5 s)
  }

  get currentTime() { return this.czas * 1000; }
  get currentLoopState() { return this.playList[0]?.loop ? 1 : 0; }
  set currentLoopState(v) { if (this.playList[0]) this.playList[0].loop = !!v; }

  queue(nazwaRuchu, loop = 0) {
    const ruch = this.scena.ruchy.get(klucz(nazwaRuchu));
    if (!ruch) return;
    this.playList.push({ name: nazwaRuchu, ruch, loop: !!loop });
    if (this.playList.length === 1) this.start();
  }

  play() { this.playing = true; }
  pause() { this.playing = false; }

  removeLast() {
    if (!this.playList.length) return;
    this.playList.pop();
    if (this.playList.length === 0) this.poprzedniKorzen = null;
    else if (this.playList.length === 1) { /* bieżąca zostaje */ }
  }

  start() {
    this.zapamietajPoze();
    this.czas = 0;
    this.poprzedniKorzen = null;
  }

  zapamietajPoze() {
    const sz = this.model.userData.szkielet;
    if (!sz) return;
    this.blend = { t: 0, pozy: sz.kosci.map((k) => [k.position.clone(), k.quaternion.clone()]) };
  }

  aktualizuj(dt) {
    const sz = this.model.userData.szkielet;
    const biezaca = this.playList[0];
    if (!sz || !biezaca || !this.playing) return;
    this.czas += dt;
    if (this.czas >= biezaca.ruch.dlugosc) {
      if (biezaca.loop) {
        this.pozuj(sz, biezaca.ruch, biezaca.ruch.dlugosc);
        this.czas %= Math.max(biezaca.ruch.dlugosc, 1e-3);
        this.poprzedniKorzen = null;
      } else {
        this.pozuj(sz, biezaca.ruch, biezaca.ruch.dlugosc, dt);
        this.playList.shift();
        if (this.playList.length) this.start();
        return;
      }
    }
    this.pozuj(sz, biezaca.ruch, this.czas, dt);
  }

  pozuj(sz, ruch, t, dt = 0) {
    const pos = new THREE.Vector3(), rot = new THREE.Quaternion();
    for (const s of ruch.sciezki) {
      const i = sz.indeks.get(s.kosc);
      if (i === undefined) continue;
      const kosc = sz.kosci[i];
      const def = sz.def.bones[i];
      ruch.probka(s, t, pos, rot);
      if (def.parent < 0) {
        if (!this.absoluteRoot) this.korzen(sz, pos, rot);
        if (this.absoluteRoot) { /* Pozycja i obrót pozostają w układzie modelu. */ }
        else if (this.rootLock) pos.set(0, 0, 0);
        else if (this.extractRootMotion) {
          // poziome przesunięcie z animacji przechodzi na model, ruch w pionie zostaje w kości
          const przed = this.poprzedniKorzen ?? this.korzenStartowy(sz, ruch, s);
          const d = new THREE.Vector3(pos.x - przed.x, pos.y - przed.y, 0);
          const lt = this.lockTranslation;
          if (lt === "all" || lt.includes?.("x")) d.x = 0;
          if (lt === "all" || lt.includes?.("y")) d.y = 0;
          d.multiply(this.model.scale).applyQuaternion(this.model.quaternion);
          // Zerujemy Z po obrocie: pochylenie modelu nie może podnosić go z każdym krokiem.
          d.z = 0;
          this.model.position.add(d);
          this.poprzedniKorzen = pos.clone();
          pos.set(0, 0, pos.z);
        }
        kosc.position.copy(pos);
      } else {
        kosc.position.set(pos.x + sz.def.bones[def.parent].length, pos.y, pos.z);
      }
      kosc.quaternion.copy(rot);
    }
    if (this.blend) {
      this.blend.t += dt;
      const f = Math.min(this.blend.t / 0.5, 1);
      sz.kosci.forEach((k, i) => {
        const [p0, q0] = this.blend.pozy[i];
        k.position.lerpVectors(p0, k.position, f);
        k.quaternion.copy(q0.clone().slerp(k.quaternion, f));
      });
      if (f >= 1) this.blend = null;
    }
  }

  // Korzeń szkieletu działa względem swojej pozy spoczynkowej: animacje bipedów z 3ds Max
  // mają korzeń obrócony o -90° (przód postaci w -Y), a gra zakłada przód modelu w +X.
  korzen(sz, pos, rot) {
    const m = sz.korzenOdwr.clone().multiply(new THREE.Matrix4().compose(pos, rot, new THREE.Vector3(1, 1, 1)));
    m.decompose(pos, rot, new THREE.Vector3());
  }

  korzenStartowy(sz, ruch, s) {
    const p = new THREE.Vector3(), q = new THREE.Quaternion();
    ruch.probka(s, 0, p, q);
    this.korzen(sz, p, q);
    return p;
  }
}

// Animacja węzła (modyfikator #keyframePlayer): domyślnie gra w pętli od startu.
// Klatki działają względem transformacji, którą model miał przy pierwszej aktualizacji
// (skrypty przestawiają i skalują sklonowane modele, zanim animacja ruszy).
class KeyframePlayer {
  constructor(model, ruch) {
    this.model = model;
    this.ruch = ruch;
    this.czas = 0;
    this.playing = true;
    this.currentLoopState = 1;
    this.baza = null;
  }
  play() { this.playing = true; }
  pause() { this.playing = false; }
  aktualizuj(dt) {
    const s = this.ruch.sciezki[0];
    const p = new THREE.Vector3(), q = new THREE.Quaternion(), sk = new THREE.Vector3();
    if (!this.baza) {
      this.ruch.probka(s, 0, p, q, sk);
      this.model.updateMatrix();
      this.baza = this.model.matrix.clone().multiply(new THREE.Matrix4().compose(p, q, sk).invert());
    }
    if (!this.playing) return;
    this.czas += dt;
    if (this.czas > this.ruch.dlugosc) this.czas = this.currentLoopState ? this.czas % this.ruch.dlugosc : this.ruch.dlugosc;
    this.ruch.probka(s, this.czas, p, q, sk);
    this.baza.clone().multiply(new THREE.Matrix4().compose(p, q, sk))
      .decompose(this.model.position, this.model.quaternion, this.model.scale);
  }
}
