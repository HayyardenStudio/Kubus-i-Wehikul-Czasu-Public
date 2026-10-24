//! Eksport sceny Shockwave 3D (blok IFX członka W3D) do formatu portu three.js.
//!
//! Wynik to para plików: NAZWA.json (opis sceny) i NAZWA.bin (dane liczbowe i obrazy tekstur).
//! Format wiernie odwzorowuje dane W3D, bez przeliczania ich na konwencje glTF: semantykę
//! Shockwave 3D (kości liczone od końca kości-rodzica, odtwarzacz animacji bonesPlayer) odtwarza
//! port w JS. Tablice w JSON to [przesunięcie w .bin, liczba elementów]; typ wynika z pola:
//! pozycje/normalne/UV/wagi/klatki kluczowe to f32, indeksy trójkątów i kości to u32.
//!
//! Użycie: w3d_eksport WEJŚCIE.w3d WYJŚCIE (bez rozszerzenia)

use serde_json::{Value, json};
use vm_rust::director::chunks::w3d::{
    parse_w3d,
    types::{W3dLightType, W3dNodeType, W3dScene, W3dShaderType},
};

struct Bin(Vec<u8>);

impl Bin {
    fn align(&mut self) {
        while self.0.len() % 4 != 0 {
            self.0.push(0);
        }
    }
    fn f32s(&mut self, data: impl IntoIterator<Item = f32>) -> Value {
        self.align();
        let start = self.0.len();
        for v in data {
            self.0.extend_from_slice(&v.to_le_bytes());
        }
        json!([start, (self.0.len() - start) / 4])
    }
    fn u32s(&mut self, data: impl IntoIterator<Item = u32>) -> Value {
        self.align();
        let start = self.0.len();
        for v in data {
            self.0.extend_from_slice(&v.to_le_bytes());
        }
        json!([start, (self.0.len() - start) / 4])
    }
    fn bytes(&mut self, data: &[u8]) -> Value {
        self.align();
        let start = self.0.len();
        self.0.extend_from_slice(data);
        json!([start, data.len()])
    }
}

fn export(scene: &W3dScene, bin: &mut Bin) -> Value {
    let nodes: Vec<Value> = scene
        .nodes
        .iter()
        .map(|n| {
            let typ = match n.node_type {
                W3dNodeType::Group => "group",
                W3dNodeType::Model => "model",
                W3dNodeType::Light => "light",
                W3dNodeType::View => "camera",
            };
            let mut v = json!({
                "name": n.name.as_str(),
                "type": typ,
                "parent": n.parent_name.as_str(),
                "transform": n.transform.to_vec(),
            });
            match n.node_type {
                W3dNodeType::Model => {
                    let res = if n.model_resource_name.is_empty() { n.resource_name } else { n.model_resource_name };
                    v["resource"] = json!(res.as_str());
                    v["shader"] = json!(n.shader_name.as_str());
                    v["visibility"] = json!(n.visibility);
                }
                W3dNodeType::Light => v["resource"] = json!(n.resource_name.as_str()),
                W3dNodeType::View => {
                    v["fov"] = json!(n.fov);
                    v["near"] = json!(n.near_plane);
                    v["far"] = json!(n.far_plane);
                }
                W3dNodeType::Group => {}
            }
            v
        })
        .collect();

    let mut resources = serde_json::Map::new();
    let mut names: Vec<_> = scene.clod_meshes.keys().collect();
    names.sort_by_key(|s| s.as_str());
    for name in names {
        let meshes: Vec<Value> = scene.clod_meshes[name]
            .iter()
            .map(|m| {
                let mut v = json!({
                    "positions": bin.f32s(m.positions.iter().flatten().copied()),
                    "normals": bin.f32s(m.normals.iter().flatten().copied()),
                    "uvs": m.tex_coords.iter().map(|l| bin.f32s(l.iter().flatten().copied())).collect::<Vec<_>>(),
                    "faces": bin.u32s(m.faces.iter().flatten().copied()),
                });
                if !m.diffuse_colors.is_empty() {
                    v["colors"] = bin.f32s(m.diffuse_colors.iter().flatten().copied());
                }
                if m.bone_indices.iter().any(|b| !b.is_empty()) {
                    // Wpływy kości: dla każdego wierzchołka 4 największe (indeks, waga). W CLOD
                    // pierwsza waga to 1 minus suma pozostałych (14-bitowych, łatka na DirPlayera),
                    // a wpływów bywa więcej niż 4: sortowanie, 4 największe, normalizacja.
                    let mut idx = Vec::with_capacity(m.bone_indices.len() * 4);
                    let mut wgt = Vec::with_capacity(m.bone_indices.len() * 4);
                    for (bi, bw) in m.bone_indices.iter().zip(&m.bone_weights) {
                        let mut pary: Vec<(u32, f32)> =
                            bi.iter().enumerate().map(|(k, &b)| (b, bw.get(k).copied().unwrap_or(0.0).max(0.0))).collect();
                        pary.sort_by(|a, b| b.1.total_cmp(&a.1));
                        pary.truncate(4);
                        let suma: f32 = pary.iter().map(|p| p.1).sum();
                        for k in 0..4 {
                            let (b, w) = pary.get(k).copied().unwrap_or((0, 0.0));
                            idx.push(b);
                            wgt.push(if suma > 0.001 { w / suma } else if k == 0 { 1.0 } else { 0.0 });
                        }
                    }
                    v["boneIndices"] = bin.u32s(idx);
                    v["boneWeights"] = bin.f32s(wgt);
                }
                v
            })
            .collect();
        let mut res = json!({ "meshes": meshes });
        if let Some(info) = scene.model_resources.get(name) {
            res["shading"] = info
                .shader_bindings
                .iter()
                .map(|b| json!({ "name": b.name.as_str(), "meshes": b.mesh_bindings.iter().map(|s| s.as_str()).collect::<Vec<_>>() }))
                .collect();
        }
        resources.insert(name.as_str().to_string(), res);
    }
    for m in &scene.raw_meshes {
        resources.insert(
            m.name.as_str().to_string(),
            json!({ "meshes": [{
                "positions": bin.f32s(m.positions.iter().flatten().copied()),
                "normals": bin.f32s(m.normals.iter().flatten().copied()),
                "uvs": [bin.f32s(m.tex_coords.iter().flatten().copied())],
                "faces": bin.u32s(m.faces.iter().flatten().copied()),
            }]}),
        );
    }

    let shaders: Vec<Value> = scene
        .shaders
        .iter()
        .map(|s| {
            json!({
                "name": s.name.as_str(),
                "material": s.material_name.as_str(),
                "type": match s.shader_type {
                    W3dShaderType::LitTexture => "standard",
                    W3dShaderType::Painter => "painter",
                    W3dShaderType::Inker => "inker",
                    W3dShaderType::Engraver => "engraver",
                    W3dShaderType::Newsprint => "newsprint",
                    W3dShaderType::Particle => "particle",
                    W3dShaderType::NormalMap => "normalMap",
                },
                "attrs": s.attrs,
                "useDiffuseWithTexture": s.use_diffuse_with_texture,
                "layers": s.texture_layers.iter().map(|l| json!({
                    "texture": l.name.as_str(),
                    "intensity": l.intensity,
                    "blendFunc": l.blend_func,
                    "blendSrc": l.blend_src,
                    "blendConst": l.blend_const,
                    "texMode": l.tex_mode,
                    "texTransform": l.tex_transform.to_vec(),
                    "wrapTransform": l.wrap_transform.to_vec(),
                    "repeatS": l.repeat_s,
                    "repeatT": l.repeat_t,
                })).collect::<Vec<_>>(),
            })
        })
        .collect();

    let materials: Vec<Value> = scene
        .materials
        .iter()
        .map(|m| {
            json!({
                "name": m.name.as_str(), "ambient": m.ambient, "diffuse": m.diffuse,
                "specular": m.specular, "emissive": m.emissive, "opacity": m.opacity,
                "shininess": m.shininess, "reflectivity": m.reflectivity,
            })
        })
        .collect();

    let mut textures = serde_json::Map::new();
    let mut tex_names: Vec<_> = scene.texture_images.keys().collect();
    tex_names.sort_by_key(|s| s.as_str());
    for name in tex_names {
        let data = &scene.texture_images[name];
        if data.is_empty() {
            continue;
        }
        let mime = if data.starts_with(&[0x89, b'P']) { "image/png" } else { "image/jpeg" };
        textures.insert(name.as_str().to_string(), json!({ "mime": mime, "data": bin.bytes(data) }));
    }

    let lights: Vec<Value> = scene
        .lights
        .iter()
        .map(|l| {
            json!({
                "name": l.name.as_str(),
                "type": match l.light_type {
                    W3dLightType::Ambient => "ambient",
                    W3dLightType::Directional => "directional",
                    W3dLightType::Point => "point",
                    W3dLightType::Spot => "spot",
                },
                "color": l.color, "attenuation": l.attenuation, "spotAngle": l.spot_angle,
                "enabled": l.enabled,
            })
        })
        .collect();

    let skeletons: Vec<Value> = scene
        .skeletons
        .iter()
        .map(|s| {
            json!({
                "name": s.name.as_str(),
                "bones": s.bones.iter().map(|b| json!({
                    "name": b.name.as_str(), "parent": b.parent_index, "length": b.length,
                    "dir": [b.dir_x, b.dir_y, b.dir_z], "rot": [b.rot_x, b.rot_y, b.rot_z, b.rot_w],
                    "attributes": b.attributes,
                })).collect::<Vec<_>>(),
            })
        })
        .collect();

    let motions: Vec<Value> = scene
        .motions
        .iter()
        .map(|m| {
            json!({
                "name": m.name.as_str(),
                "tracks": m.tracks.iter().map(|t| json!({
                    "bone": t.bone_name.as_str(),
                    // na klatkę: czas, pozycja xyz, obrót xyzw, skala xyz
                    "keys": bin.f32s(t.keyframes.iter().flat_map(|k| [
                        k.time, k.pos_x, k.pos_y, k.pos_z, k.rot_x, k.rot_y, k.rot_z, k.rot_w,
                        k.scale_x, k.scale_y, k.scale_z,
                    ])),
                })).collect::<Vec<_>>(),
            })
        })
        .collect();

    json!({
        "nodes": nodes, "resources": resources, "shaders": shaders, "materials": materials,
        "textures": textures, "lights": lights, "skeletons": skeletons, "motions": motions,
    })
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() != 3 {
        eprintln!("Użycie: {} WEJŚCIE.w3d WYJŚCIE", args[0]);
        std::process::exit(2);
    }
    let data = std::fs::read(&args[1]).expect("nie da się odczytać pliku wejściowego");
    let scene = parse_w3d(&data).unwrap_or_else(|e| {
        eprintln!("{}: {e}", args[1]);
        std::process::exit(1);
    });
    let mut bin = Bin(Vec::new());
    let desc = export(&scene, &mut bin);
    std::fs::write(format!("{}.json", args[2]), serde_json::to_string(&desc).unwrap()).unwrap();
    std::fs::write(format!("{}.bin", args[2]), &bin.0).unwrap();
}
