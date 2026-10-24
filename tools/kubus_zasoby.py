#!/usr/bin/env python3
"""Wyciąga zasoby z poziomu "Kubuś i Wehikuł Czasu" (.dcr) do zwykłych plików.

Na potrzeby wersji three.js (port/). Dla każdego członka obsady zapisuje:
  bitmapy/NAZWA.png   bitmapy (JPEG albo RLE z Directora + kanał alfa ALFA)
  dzwieki/NAZWA.mp3   dźwięki (Shockwave Audio i "snd " kompresowane MP3 w Afterburnerze)
  w3d/NAZWA.w3d       surowe dane Shockwave 3D (IFX) do eksportu w port/narzedzia/w3d_eksport
  flash/NAZWA.swf     elementy Flash (ekrany końca poziomu, menu Esc)
  obsada.json         lista członków: obsada, numer, typ, nazwa, plik, rozmiar i punkt rejestracji bitmap

Użycie:
  python kubus_zasoby.py POZIOM.dcr KATALOG_WYJŚCIOWY

Wymaga Pillow (pip install pillow) do zapisu PNG.
"""
import argparse
import collections
import io
import json
import os
import struct
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kubus_dcr_patch import Afterburner  # noqa: E402

TYPES = {1: "bitmap", 3: "field", 4: "palette", 6: "sound", 11: "script", 15: "xtra"}


def unpack_rle(data, size):
    """RLE Directora (jak PackBits): n < 0x80 -> n+1 bajtów dosłownie, inaczej powtórz bajt 257-n razy."""
    out = bytearray()
    p = 0
    while p < len(data) and len(out) < size:
        n = data[p]
        p += 1
        if n < 0x80:
            out += data[p:p + n + 1]
            p += n + 1
        else:
            out += bytes([data[p]]) * (257 - n)
            p += 1
    return bytes(out[:size]).ljust(size, b"\0")


def member_name(info):
    if len(info) < 20:
        return ""
    off = struct.unpack_from(">I", info, 0)[0]
    cnt = struct.unpack_from(">H", info, off)[0]
    if cnt < 2:
        return ""
    offs = struct.unpack_from(">%dI" % (cnt + 1), info, off + 2)
    base = off + 2 + 4 * (cnt + 1)
    raw = info[base + offs[1]:base + offs[2]]
    return raw[1:1 + raw[0]].decode("cp1250") if raw else ""


def bitmap_image(movie, spec, chunks):
    pitch = struct.unpack_from(">H", spec, 0)[0] & 0x7FFF
    top, left, bottom, right = struct.unpack_from(">4h", spec, 2)
    reg_y, reg_x = struct.unpack_from(">2h", spec, 18)
    depth = spec[23]
    w, h = right - left, bottom - top
    if depth != 32:
        raise ValueError(f"nieobsługiwana głębia bitmapy: {depth}")
    if "BITD" not in chunks:                               # JPEG
        img = Image.open(io.BytesIO(movie.get(chunks["ediM"]))).convert("RGB")
    else:                                                  # RLE: w każdym wierszu płaszczyzny A, R, G, B
        raw = movie.get(chunks["BITD"])
        if len(raw) != pitch * h:
            raw = unpack_rle(raw, pitch * h)
        planes = [Image.frombytes("L", (w, h), b"".join(raw[y * pitch + c * w:y * pitch + (c + 1) * w]
                                                        for y in range(h))) for c in range(4)]
        img = Image.merge("RGBA", planes[1:] + planes[:1])
    img = img.convert("RGBA")
    if "ALFA" in chunks:
        alpha = movie.get(chunks["ALFA"])
        if len(alpha) != w * h:
            alpha = unpack_rle(alpha, w * h)
        img.putalpha(Image.frombytes("L", (w, h), alpha))
    return img, (reg_x - left, reg_y - top)


MP3_BITRATES = {3: (0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320),   # MPEG-1
                2: (0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160)}       # MPEG-2/2.5
MP3_RATES = {3: (44100, 48000, 32000), 2: (22050, 24000, 16000), 0: (11025, 12000, 8000)}


def mp3_frame_len(data, p):
    """Długość ramki MPEG Layer III zaczynającej się w p albo None, gdy to nie ramka."""
    if p + 4 > len(data) or data[p] != 0xFF or data[p + 1] & 0xE6 != 0xE2:
        return None
    ver = (data[p + 1] >> 3) & 3
    br, sr, pad = data[p + 2] >> 4, (data[p + 2] >> 2) & 3, (data[p + 2] >> 1) & 1
    if ver == 1 or br in (0, 15) or sr == 3:
        return None
    kbps = MP3_BITRATES[3 if ver == 3 else 2][br]
    return (144 if ver == 3 else 72) * kbps * 1000 // MP3_RATES[ver][sr] + pad


def mp3_from(data):
    """Ramki MP3 z danych Shockwave Audio: od pierwszej ramki, po której od razu jest następna."""
    for p in range(len(data) - 4):
        n = mp3_frame_len(data, p)
        if n and (p + n == len(data) or mp3_frame_len(data, p + n)):
            return data[p:]
    raise ValueError("brak ramek MP3")


def extract(path, out):
    movie = Afterburner(open(path, "rb").read())
    key = movie.get(movie.ids("KEY*")[0])
    used = struct.unpack_from("<i", key, 4)[0]
    owned = collections.defaultdict(dict)
    for i in range(used):
        sec, owner, tag = struct.unpack_from("<ii4s", key, 12 + i * 12)
        owned[owner][tag[::-1].decode("latin1")] = sec
    for sub in ("bitmapy", "dzwieki", "w3d", "flash"):
        os.makedirs(os.path.join(out, sub), exist_ok=True)

    members = []
    for lib, cas in enumerate(movie.ids("CAS*"), 1):
        data = movie.get(cas)
        for num, cid in enumerate(struct.unpack(">%dI" % (len(data) // 4), data), 1):
            if not cid:
                continue
            c = movie.get(cid)
            typ, ilen, slen = struct.unpack_from(">III", c, 0)
            name = member_name(c[12:12 + ilen])
            spec = c[12 + ilen:12 + ilen + slen]
            chunks = owned.get(cid, {})
            entry = {"obsada": lib, "numer": num, "typ": TYPES.get(typ, typ), "nazwa": name}
            if typ == 15:
                n = struct.unpack_from(">I", spec, 0)[0]
                entry["typ"] = spec[4:4 + n].decode("latin1")
            try:
                if typ == 1:
                    img, reg = bitmap_image(movie, spec, chunks)
                    entry["plik"] = f"bitmapy/{name}.png"
                    entry["rozmiar"], entry["rejestracja"] = img.size, reg
                    img.save(os.path.join(out, entry["plik"]), optimize=True)
                elif typ == 6:
                    src = movie.get(chunks["ediM"] if "ediM" in chunks else chunks["snd "])
                    entry["plik"] = f"dzwieki/{name}.mp3"
                    open(os.path.join(out, entry["plik"]), "wb").write(mp3_from(src))
                elif entry["typ"] == "shockwave3d":
                    entry["plik"] = f"w3d/{name}.w3d"
                    open(os.path.join(out, entry["plik"]), "wb").write(movie.get(chunks["XMED"]))
                elif entry["typ"] == "flash":
                    swf = movie.get(chunks["XMED"])
                    entry["plik"] = f"flash/{name}.swf"
                    open(os.path.join(out, entry["plik"]), "wb").write(swf[swf.find(b"WS") - 1:])
            except (KeyError, ValueError) as e:
                entry["blad"] = str(e)
            members.append(entry)
    with open(os.path.join(out, "obsada.json"), "w", encoding="utf-8") as f:
        json.dump(members, f, ensure_ascii=False, indent=1)
    return members


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("dcr")
    ap.add_argument("out")
    a = ap.parse_args(argv)
    members = extract(a.dcr, a.out)
    by_type = collections.Counter(m["typ"] for m in members if "plik" in m)
    print(f"{a.dcr}: " + ", ".join(f"{t} {n}" for t, n in sorted(by_type.items())))
    for m in members:
        if "blad" in m:
            print(f"  pominięto {m['nazwa']!r}: {m['blad']}")


if __name__ == "__main__":
    main()
