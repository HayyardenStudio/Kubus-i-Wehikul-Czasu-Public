// Regresja położenia domów i kwiatów: node tools/test_transformacji.mjs
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as THREE from "../strona/gra/js/vendor/three.module.min.js";
import { DaneW3d, Scena3d } from "../strona/gra/js/w3d.js";

const baza = new URL("../strona/gra/dane/01/modele/ziemia", import.meta.url);
const [opis, bin] = await Promise.all([readFile(new URL(`${baza.href}.json`)), readFile(new URL(`${baza.href}.bin`))]);
const json = JSON.parse(opis);
const dane = new DaneW3d(json, bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength));
dane.tekstura = () => null;
const scena = new Scena3d(dane);
const grupa = scena.newGroup("test_grupy");
grupa.position.set(100, -30, 17);
grupa.rotation.z = 0.4;

function sprawdzWierzcholki(model, oczekiwana) {
  model.updateWorldMatrix(true, true);
  for (const mesh of model.children.filter((c) => c.isMesh)) {
    for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
      const p = new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position, i);
      const oryginal = p.clone().applyMatrix4(oczekiwana);
      p.applyMatrix4(mesh.matrixWorld);
      assert.ok(p.distanceTo(oryginal) < 1e-4, `${model.name}: odchylenie od W3D ${p.distanceTo(oryginal)}`);
    }
  }
}

let liczba = 0;
for (const def of json.nodes) {
  if (!(def.name.startsWith("podzamcze") || /^Object\d+$/.test(def.name))) continue;
  const model = scena.model(def.name);
  const oryginal = new THREE.Matrix4().fromArray(def.transform);
  sprawdzWierzcholki(model, oryginal);
  grupa.attach(model);
  sprawdzWierzcholki(model, oryginal);
  liczba++;
}
assert.equal(liczba, 201);

// Object180 miał największe odchylenie: prawie 27 jednostek wysokości.
const wzorzec = scena.model("Object180");
const oryginal = new THREE.Matrix4().fromArray(dane.wezly.get("object180").transform);
const kopie = [scena.cloneModel(wzorzec, "kwiat_kopia"),
  scena.cloneModelFromCastmember("kwiat_z_obsady", "Object180", scena)];
const skosnaGrupa = scena.newGroup("test_niejednorodnej_skali");
skosnaGrupa.rotation.z = -0.7;
skosnaGrupa.scale.set(1.2, 0.8, 1);
for (const kopia of kopie) {
  sprawdzWierzcholki(kopia, oryginal);
  skosnaGrupa.attach(kopia);
  sprawdzWierzcholki(kopia, oryginal);
}
console.log("OK: 201 modeli domów i kwiatów zgodnych z W3D; położenie zachowane po zmianie rodzica i obu rodzajach klonowania.");
