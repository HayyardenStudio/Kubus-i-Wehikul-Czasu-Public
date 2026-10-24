// Regresje na oryginalnych danych W3D: node tools/test_animacji.mjs
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as THREE from "../strona/gra/js/vendor/three.module.min.js";
import { DaneW3d, Scena3d } from "../strona/gra/js/w3d.js";

async function dane(imie) {
  const baza = new URL(`../strona/gra/dane/01/modele/${imie}`, import.meta.url);
  const [json, bin] = await Promise.all([readFile(new URL(`${baza.href}.json`)), readFile(new URL(`${baza.href}.bin`))]);
  const d = new DaneW3d(JSON.parse(json), bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength));
  d.tekstura = () => null; // Test szkieletu nie potrzebuje dekodera obrazów ani GPU.
  return d;
}

async function rycerz(rodzaj = "gruby") {
  const scena = new Scena3d(await dane(`rycerz_${rodzaj}`));
  const model = scena.model("Group01");
  model.position.set(0, 0, -103.5);
  model.quaternion.identity();
  model.scale.set(1, 1, 1);
  const ruchy = await dane(`rycerz_${rodzaj}_walk`);
  scena.ruchy.set("chod", ruchy.ruchy.get("group01"));
  scena.addModifier(model, "bonesPlayer");
  return { model, bp: model.userData.bonesPlayer };
}

for (const rodzaj of ["gruby", "maly"]) {
  const { model, bp } = await rycerz(rodzaj);
  // Pochylenie modelu nie może zamieniać poziomego ruchu korzenia we wznoszenie.
  model.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -0.08);
  const z = model.position.z;
  bp.queue("chod", 1);
  const dlugosc = rodzaj === "gruby" ? 0.5 : 0.5667;
  assert.ok(Math.abs(bp.playList[0].ruch.dlugosc - dlugosc) < 1e-5, `${rodzaj}: klip zawiera martwy czas sprzed pierwszej klatki`);
  bp.aktualizuj(1 / 60);
  assert.ok(model.position.x > 0.1, `${rodzaj}: początek chodu zatrzymuje postać`);
  for (let i = 0; i < 1200; i++) {
    const przed = model.position.clone();
    bp.aktualizuj(1 / 60);
    assert.ok(model.position.distanceTo(przed) > 0.01, `${rodzaj}: chód zatrzymał się w klatce ${i}`);
  }
  assert.ok(model.position.x > 100, "Chód musi przesuwać postać do przodu");
  assert.ok(Math.abs(model.position.z - z) < 1e-8, `${rodzaj}: chód zmienił Z o ${model.position.z - z}`);
}

for (const fps of [30, 60, 144]) {
  const { bp } = await rycerz();
  bp.queue("chod", 1);
  const klatki = Math.round(fps / 4);
  for (let i = 0; i < klatki; i++) bp.aktualizuj(1 / fps);
  assert.ok(bp.blend, `${fps} FPS: przejście skończyło się przed 0,5 s`);
  assert.ok(Math.abs(bp.blend.t - klatki / fps) < 1e-8, `${fps} FPS: przejście nie korzysta z czasu rzeczywistego`);
}

// Przesunięcie przy przekroczeniu granicy pętli musi zachować resztę czasu.
const { model, bp } = await rycerz();
bp.queue("chod", 1);
const ruch = bp.playList[0].ruch;
const sz = model.userData.szkielet;
const track = ruch.sciezki.find((s) => sz.indeks.get(s.kosc) === 0);
function korzen(t) {
  const p = new THREE.Vector3(), q = new THREE.Quaternion();
  ruch.probka(track, t, p, q);
  bp.korzen(sz, p, q);
  return p;
}
const czas = ruch.dlugosc * 8 + 0.137;
const klatki = Math.ceil(czas * 144);
for (let i = 0; i < klatki; i++) bp.aktualizuj(czas / klatki);
const oczekiwane = korzen(ruch.dlugosc).sub(korzen(0)).multiplyScalar(8)
  .add(korzen(0.137).sub(korzen(0)));
assert.ok(Math.abs(model.position.x - oczekiwane.x) < 1e-4, "Pętla gubi przesunięcie korzenia");
assert.ok(Math.abs(model.position.y - oczekiwane.y) < 1e-4, "Pętla gubi przesunięcie boczne");
assert.equal(bp.playList.length, 1);
assert.equal(bp.blend, null, "Kolejne cykle chodu nie mogą restartować przejścia");
console.log("OK: poziomy chód obu rycerzy przez 20 s, przejścia przy 30/60/144 FPS i ciągłość 8 pętli.");
