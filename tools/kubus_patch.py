#!/usr/bin/env python3
"""Patcher dla Kuba.exe ("Kubuś i Wehikuł Czasu", projektor Macromedia Director MX).

Co robi:
  1. Wyłącza członka obsady "DisplayMode1" (StarSoft DisplayMode Xtra). Przy starcie
     gry przełączał on GŁÓWNY monitor w tryb 640x480 przez DirectDraw (tryb
     wyłączności), co na współczesnym Windowsie z dwoma ekranami kończyło się
     zmienioną rozdzielczością i grą "uciekającą" na drugi monitor.
  2. Podmienia skrypt filmu z handlerem `on prepareMovie` i dopisuje do niego Lingo:
       - stałe tempo (`puppetTempo`). Gra przesuwa i obraca postać o stałą wartość
         NA KLATKĘ, a oryginalne tempo filmu to 78 kl./s - współczesny PC je osiąga,
         więc wszystko działa kilka razy za szybko;
       - powiększenie sceny 640x480 na cały monitor, na którym jest gra
         (`the stage.rect` + `the stage.drawRect`); Shockwave 3D renderuje wtedy
         w pełnej rozdzielczości, a mysz jest poprawnie przeliczana;
       - klawisze +/- (także na klawiaturze numerycznej) zmieniają tempo o 5 kl./s
         w trakcie gry. Zdarzenie keyDown nie dociera do skryptu filmu, więc
         klawisze są odpytywane co klatkę (keyPressed) z pętli gry
         ("looper_navigate": on exitFrame / go the frame).

Użycie:
  python kubus_patch.py Kuba.exe Kuba_fix.exe [--fps 30] [--scale fit|integer|none]

Plik wejściowy nie jest modyfikowany. Wymaga tylko standardowego Pythona 3.
"""
import argparse
import hashlib
import struct
import sys

ORIGINAL_SHA1 = "7170f04944a1c9932d67964e02de5931c28b6a97"  # Kuba.exe z wersji 1 (wersja.txt)

TEMPO_STEP = 5
TEMPO_MIN = 10
TEMPO_MAX = 80
# numer zdarzenia exitFrame w tablicy wektorów skryptu (odczytany z oryginalnych
# skryptów: mouseDown=0, mouseEnter=7, mouseLeave=8, enterFrame=14, exitFrame=15)
EVENT_EXIT_FRAME = 15
# kody klawiszy Directora (kody Maca, także na Windows)
KEYS_FASTER = (24, 69)  # "=/+" i "+" na klawiaturze numerycznej
KEYS_SLOWER = (27, 78)  # "-" i "-" na klawiaturze numerycznej


# --------------------------------------------------------------------------- #
# Kontener RIFX ("XFIR" - little endian) używany przez projektory Directora
# --------------------------------------------------------------------------- #
class Rifx:
    """Minimalna obsługa kontenera XFIR z absolutnymi offsetami w mmap."""

    def __init__(self, data, base):
        self.data = data
        self.base = base
        assert data[base:base + 4] == b"XFIR", "brak kontenera XFIR"
        self.codec = bytes(data[base + 8:base + 12])
        assert data[base + 12:base + 16] == b"pami"
        self.mmap_off = struct.unpack_from("<I", data, base + 24)[0]
        assert data[self.mmap_off:self.mmap_off + 4] == b"pamm"
        (self.hdr_len, self.ent_len, _cmax, self.count) = struct.unpack_from(
            "<HHii", data, self.mmap_off + 8)

    def entry_pos(self, idx):
        return self.mmap_off + 8 + self.hdr_len + idx * self.ent_len

    def entry(self, idx):
        p = self.entry_pos(idx)
        fourcc = bytes(self.data[p:p + 4])[::-1].decode("latin1")
        length, offset = struct.unpack_from("<II", self.data, p + 4)
        return fourcc, length, offset

    def entries(self):
        for i in range(self.count):
            yield (i,) + self.entry(i)

    def chunk(self, idx):
        fourcc, length, offset = self.entry(idx)
        assert bytes(self.data[offset:offset + 4])[::-1].decode("latin1") == fourcc
        return bytes(self.data[offset + 8:offset + 8 + length])

    def set_entry(self, idx, length, offset):
        struct.pack_into("<II", self.data, self.entry_pos(idx) + 4, length, offset)

    def size(self):
        return struct.unpack_from("<I", self.data, self.base + 4)[0]

    def set_size(self, value):
        struct.pack_into("<I", self.data, self.base + 4, value)


class Projector:
    """Projektor Director MX (nagłówek PJ01) z jednym osadzonym filmem.

    Ostatnie 4 bajty pliku to offset nagłówka PJ01, który wskazuje kontener APPL
    (Xtras + film). Film jest ostatnim elementem pliku, więc nowe wersje chunków
    dopisujemy na jego końcu (przed 4-bajtową stopką) i przepinamy wpisy mmap.
    """

    TRAILER = 4

    def __init__(self, raw):
        self.data = bytearray(raw)
        pj = struct.unpack_from("<I", self.data, len(self.data) - self.TRAILER)[0]
        assert self.data[pj:pj + 4] == b"10JP", "to nie jest projektor Director MX (PJ01)"
        self.appl = Rifx(self.data, struct.unpack_from("<I", self.data, pj + 4)[0])
        assert self.appl.codec == b"LPPA"
        self.movie_entry = None
        for i, fourcc, length, offset in self.appl.entries():
            if fourcc == "File" and self.data[offset:offset + 4] == b"XFIR" \
                    and self.data[offset + 8:offset + 12] == b"39VM":
                self.movie_entry = i
        assert self.movie_entry is not None, "nie znaleziono osadzonego filmu"
        self.movie = Rifx(self.data, self.appl.entry(self.movie_entry)[2])

    def replace_chunk(self, idx, payload):
        fourcc = self.movie.entry(idx)[0]
        if len(payload) % 2:
            payload += b"\0"
        block = fourcc.encode("latin1")[::-1] + struct.pack("<I", len(payload)) + payload
        insert_at = len(self.data) - self.TRAILER
        self.data[insert_at:insert_at] = block
        grow = len(block)
        self.movie.set_size(self.movie.size() + grow)
        self.appl.set_size(self.appl.size() + grow)
        _, ln, off = self.appl.entry(self.movie_entry)
        self.appl.set_entry(self.movie_entry, ln + grow, off)
        fc, ln, off = self.movie.entry(0)  # wpis opisujący sam kontener
        if fc == "RIFX":
            self.movie.set_entry(0, ln + grow, off)
        self.movie.set_entry(idx, len(payload), insert_at)


# --------------------------------------------------------------------------- #
# Lingo: tablica nazw (Lnam), kontekst (LctX), skrypt (Lscr), asembler
# --------------------------------------------------------------------------- #
class Names:
    def __init__(self, blob):
        self.head = bytearray(blob[:20])
        off, cnt = struct.unpack_from(">HH", blob, 16)
        self.names = []
        p = off
        for _ in range(cnt):
            n = blob[p]
            self.names.append(blob[p + 1:p + 1 + n].decode("latin1"))
            p += 1 + n

    def id(self, name):
        for i, n in enumerate(self.names):
            if n.lower() == name.lower():
                return i
        self.names.append(name)
        return len(self.names) - 1

    def serialize(self):
        body = b"".join(bytes([len(n)]) + n.encode("latin1") for n in self.names)
        head = bytearray(self.head)
        struct.pack_into(">IIHH", head, 8, len(body), len(body), 20, len(self.names))
        return bytes(head) + body


def find_script_context(movie):
    """Zwraca (indeks Lnam, lista indeksów Lscr) obsady z największą liczbą skryptów."""
    best = None
    for i, fourcc, _length, _offset in movie.entries():
        if fourcc not in ("LctX", "Lctx"):
            continue
        blob = movie.chunk(i)
        count = struct.unpack_from(">I", blob, 8)[0]
        entries_off = struct.unpack_from(">H", blob, 16)[0]
        lnam = struct.unpack_from(">i", blob, 32)[0]
        scripts = [struct.unpack_from(">i", blob, entries_off + 12 * k + 4)[0]
                   for k in range(count)]
        scripts = [s for s in scripts if s >= 0]
        if best is None or len(scripts) > len(best[1]):
            best = (lnam, scripts)
    return best


OP = {
    "ret": 0x01, "pushzero": 0x03, "mul": 0x04, "add": 0x05, "sub": 0x06, "div": 0x07,
    "inv": 0x09, "lt": 0x0c, "eq": 0x0f, "containsstr": 0x15, "gt": 0x10, "gteq": 0x11, "and": 0x12, "or": 0x13, "not": 0x14,
    "pushlist": 0x1e,
    "pushint": 0x41, "pusharglistnoret": 0x42, "pusharglist": 0x43, "pushcons": 0x44,
    "pushsymb": 0x45,
    "getglobal": 0x49, "getprop": 0x4a, "getparam": 0x4b, "getlocal": 0x4c, "setglobal": 0x4f, "setlocal": 0x52,
    "setprop": 0x50, "jmp": 0x53, "endrepeat": 0x54, "jmpifz": 0x55, "extcall": 0x57,
    "getmovieprop": 0x5f, "setmovieprop": 0x60, "getobjprop": 0x61, "setobjprop": 0x62,
    "thebuiltin": 0x66, "objcall": 0x67, "getchainedprop": 0x70,
}
NAME_ARG = {"getglobal", "setglobal", "extcall", "getmovieprop", "setmovieprop",
            "getobjprop", "setobjprop", "objcall", "thebuiltin", "pushsymb",
            "getprop", "setprop", "getchainedprop"}
JUMPS = {"jmp", "jmpifz", "endrepeat"}


def assemble(program, names, literals, locals_=None, base=0):
    """program: krotki (op[, arg]) i etykiety ("label", nazwa).

    Zwraca (bytecode, lista nazw zmiennych lokalnych); napisy z "pushcons" trafiają
    do wspólnej listy `literals` skryptu. W tym filmie indeksy zmiennych lokalnych
    i literałów są zapisywane wprost (bez mnożnika) - sprawdzone na oryginalnym
    bytecode.

    `locals_` pozwala dopisać kod do istniejącego handlera (nowe zmienne trafiają
    na koniec jego listy), `base` to pozycja kodu w handlerze. Cel skoku może być
    etykietą albo liczbą - bezwzględną pozycją w handlerze.
    """
    locals_ = [] if locals_ is None else locals_

    def width_for(op, arg):
        if arg is None:
            return 0
        if op in JUMPS:
            return 2
        if op == "pushint":
            return 1 if -128 <= arg <= 127 else (2 if -32768 <= arg <= 32767 else 4)
        return 1 if 0 <= arg <= 255 else 2

    def encode(op, arg):
        width = width_for(op, arg)
        if op == "pushint" and width > 1:
            # osobne kody pushint16 (0x6e) / pushint32 (0x6f)
            return (bytes([0x6e + 0x40]) + struct.pack(">h", arg) if width == 2
                    else bytes([0x6f + 0x80]) + struct.pack(">i", arg))
        base = OP[op]
        if width == 0:
            return bytes([base])
        if width == 1:
            return bytes([base, arg & 0xff])
        return bytes([base + 0x40]) + struct.pack(">h" if arg < 0 else ">H", arg)

    resolved = []
    for item in program:
        if item[0] == "label":
            resolved.append(item)
            continue
        op, arg = item[0], (item[1] if len(item) > 1 else None)
        if op in NAME_ARG:
            arg = names.id(arg)
        elif op in ("getlocal", "setlocal"):
            if arg not in locals_:
                locals_.append(arg)
            arg = locals_.index(arg)
        elif op == "pushcons":
            if arg not in literals:
                literals.append(arg)
            arg = literals.index(arg)
        resolved.append((op, arg))

    labels, pos = {}, 0
    for item in resolved:
        if item[0] == "label":
            labels[item[1]] = pos
        else:
            pos += 1 + width_for(item[0], 0 if item[0] in JUMPS else item[1])
    code = bytearray()
    for item in resolved:
        if item[0] == "label":
            continue
        op, arg = item
        if op in JUMPS:
            target = arg if isinstance(arg, int) else base + labels[arg]
            here = base + len(code)
            arg = here - target if op == "endrepeat" else target - here
            assert arg >= 0, "skok wstecz wymaga endrepeat"
        code += encode(op, arg)
    return bytes(code), locals_


HANDLER_SIZE = 46


def build_script(template, names, handlers, extra_globals=()):
    """Buduje nowy Lscr na bazie nagłówka `template` (skryptu bez literałów).

    handlers: lista (nazwa, argumenty, program, numer zdarzenia albo None).
    Handlery zdarzeń (np. exitFrame) muszą być wpisane do tablicy wektorów
    zdarzeń skryptu, inaczej Director ich nie wywoła. Układ wyjściowy:
    nagłówek(92) | globalne | rekordy handlerów | wektory | kod + argumenty + lokalne.
    """
    g = lambda fmt, off: struct.unpack_from(">" + fmt, template, off)[0]
    assert g("H", 78) == 0 and g("H", 60) == 0, "skrypt ma literały/właściwości"
    header = bytearray(template[:92])
    gcount, goff = g("H", 66), g("I", 68)
    global_ids = [g("h", goff + 2 * i) for i in range(gcount)]
    for name in extra_globals:
        nid = names.id(name)
        if nid not in global_ids:
            global_ids.append(nid)
    record_template = template[g("I", 74):g("I", 74) + HANDLER_SIZE]

    globals_off = 92
    records_off = globals_off + 2 * len(global_ids)
    events = [ev for *_, ev in handlers if ev is not None]
    vectors_off = records_off + HANDLER_SIZE * len(handlers)
    vectors = [-1] * (max(events) + 1 if events else 0)
    event_mask = 0
    for idx, (*_, ev) in enumerate(handlers):
        if ev is not None:
            vectors[ev] = idx
            event_mask |= 1 << ev
    pos = vectors_off + 2 * len(vectors)
    body, records, literals = bytearray(), bytearray(), []
    for name, args, program, event in handlers:
        code, local_names = assemble(program, names, literals)
        code_off = pos + len(body)
        body += code
        if len(body) % 2:
            body += b"\0"
        args_off = pos + len(body)
        body += b"".join(struct.pack(">h", names.id(n)) for n in args)
        locals_off = pos + len(body)
        body += b"".join(struct.pack(">h", names.id(n)) for n in local_names)
        rec = bytearray(record_template)
        struct.pack_into(">hH", rec, 0, names.id(name), 0xffff if event is None else event)
        # len, off, argc, argoff, locc, locoff, globc, globoff
        struct.pack_into(">IIHIHIHI", rec, 4, len(code), code_off, len(args), args_off,
                         len(local_names), locals_off, 0, locals_off)
        struct.pack_into(">HI", rec, 36, 0, locals_off)  # brak tablicy numerów linii
        struct.pack_into(">I", rec, 42, 16)              # maks. wysokość stosu
        records += rec
    if len(body) % 2:
        body += b"\0"
    # literały (tylko napisy): rekordy (typ=1, offset) + dane (długość z NUL, tekst)
    lit_off = pos + len(body)
    lit_data = bytearray()
    for text in literals:
        body += struct.pack(">II", 1, len(lit_data))
        raw = text.encode("cp1250") + b"\0"
        lit_data += struct.pack(">I", len(raw)) + raw
        if len(lit_data) % 2:
            lit_data += b"\0"
    lit_data_off = pos + len(body)
    body += lit_data
    end = pos + len(body)

    struct.pack_into(">II", header, 8, end, end)
    struct.pack_into(">HII", header, 50, len(vectors), vectors_off, event_mask)
    struct.pack_into(">HI", header, 60, 0, globals_off)        # właściwości
    struct.pack_into(">HI", header, 66, len(global_ids), globals_off)
    struct.pack_into(">HI", header, 72, len(handlers), records_off)
    struct.pack_into(">HIII", header, 78, len(literals), lit_off, len(lit_data), lit_data_off)
    out = bytes(header) + b"".join(struct.pack(">h", i) for i in global_ids) \
        + bytes(records) + b"".join(struct.pack(">h", v) for v in vectors) + bytes(body)
    assert len(out) == end
    return out


def handler_names(blob, names_list):
    hcount = struct.unpack_from(">H", blob, 72)[0]
    hoff = struct.unpack_from(">I", blob, 74)[0]
    return [names_list[struct.unpack_from(">h", blob, hoff + HANDLER_SIZE * h)[0]].lower()
            for h in range(hcount)]


# --------------------------------------------------------------------------- #
# Wstrzykiwany kod Lingo
# --------------------------------------------------------------------------- #
def prepare_movie_program(fps, scale):
    p = [
        # oryginalna treść handlera:
        #   the actorList = [] ; speed = 0 ; car_rotation = 0
        ("pusharglist", 0), ("pushlist",), ("setmovieprop", "actorList"),
        ("pushzero",), ("setglobal", "speed"),
        ("pushzero",), ("setglobal", "car_rotation"),
    ]
    if fps:
        # kfTempo = fps ; puppetTempo(kfTempo)
        p += [("pushzero",), ("setglobal", "kfUpWas"), ("pushzero",), ("setglobal", "kfDownWas"),
              ("pushint", fps), ("setglobal", "kfTempo"),
              ("getglobal", "kfTempo"), ("pusharglistnoret", 1), ("extcall", "puppetTempo")]
    if scale == "none":
        return p + [("ret",)]

    p += [
        # kfL = the desktopRectList ; kfR = kfL[1]
        ("getmovieprop", "desktopRectList"), ("setlocal", "kfL"),
        ("getlocal", "kfL"), ("pushint", 1), ("pusharglist", 2), ("objcall", "getAt"),
        ("setlocal", "kfR"),
        # środek obecnego okna sceny
        ("getmovieprop", "stage"), ("getobjprop", "rect"), ("setlocal", "kfS"),
        ("getlocal", "kfS"), ("getobjprop", "left"), ("getlocal", "kfS"),
        ("getobjprop", "right"), ("add",), ("pushint", 2), ("div",), ("setlocal", "kfCX"),
        ("getlocal", "kfS"), ("getobjprop", "top"), ("getlocal", "kfS"),
        ("getobjprop", "bottom"), ("add",), ("pushint", 2), ("div",), ("setlocal", "kfCY"),
        # repeat with kfI = 1 to count(kfL): monitor zawierający środek sceny
        ("pushint", 1), ("setlocal", "kfI"),
        ("label", "mon_loop"),
        ("getlocal", "kfI"), ("getlocal", "kfL"), ("pusharglist", 1), ("objcall", "count"),
        ("gt",), ("pushzero",), ("eq",), ("jmpifz", "mon_done"),
        ("getlocal", "kfL"), ("getlocal", "kfI"), ("pusharglist", 2), ("objcall", "getAt"),
        ("setlocal", "kfD"),
        ("getlocal", "kfCX"), ("getlocal", "kfD"), ("getobjprop", "left"), ("gteq",),
        ("getlocal", "kfCX"), ("getlocal", "kfD"), ("getobjprop", "right"), ("lt",), ("and",),
        ("getlocal", "kfCY"), ("getlocal", "kfD"), ("getobjprop", "top"), ("gteq",), ("and",),
        ("getlocal", "kfCY"), ("getlocal", "kfD"), ("getobjprop", "bottom"), ("lt",), ("and",),
        ("jmpifz", "mon_next"),
        ("getlocal", "kfD"), ("setlocal", "kfR"),
        ("label", "mon_next"),
        ("getlocal", "kfI"), ("pushint", 1), ("add",), ("setlocal", "kfI"),
        ("endrepeat", "mon_loop"),
        ("label", "mon_done"),
        ("getlocal", "kfR"), ("getobjprop", "width"), ("setlocal", "kfW"),
        ("getlocal", "kfR"), ("getobjprop", "height"), ("setlocal", "kfH"),
    ]
    if scale == "integer":
        # kfK = max(1, min(W div 640, H div 480))
        p += [
            ("getlocal", "kfW"), ("pushint", 640), ("div",), ("setlocal", "kfK"),
            ("getlocal", "kfH"), ("pushint", 480), ("div",), ("getlocal", "kfK"), ("lt",),
            ("jmpifz", "k_min"),
            ("getlocal", "kfH"), ("pushint", 480), ("div",), ("setlocal", "kfK"),
            ("label", "k_min"),
            ("getlocal", "kfK"), ("pushint", 1), ("lt",), ("jmpifz", "k_ok"),
            ("pushint", 1), ("setlocal", "kfK"),
            ("label", "k_ok"),
            ("getlocal", "kfK"), ("pushint", 640), ("mul",), ("setlocal", "kfNW"),
            ("getlocal", "kfK"), ("pushint", 480), ("mul",), ("setlocal", "kfNH"),
        ]
    else:
        # największy prostokąt 4:3 mieszczący się na ekranie
        p += [
            ("getlocal", "kfW"), ("pushint", 3), ("mul",),
            ("getlocal", "kfH"), ("pushint", 4), ("mul",), ("gt",), ("jmpifz", "narrow"),
            ("getlocal", "kfH"), ("setlocal", "kfNH"),
            ("getlocal", "kfH"), ("pushint", 4), ("mul",), ("pushint", 3), ("div",),
            ("setlocal", "kfNW"),
            ("jmp", "sized"),
            ("label", "narrow"),
            ("getlocal", "kfW"), ("setlocal", "kfNW"),
            ("getlocal", "kfW"), ("pushint", 3), ("mul",), ("pushint", 4), ("div",),
            ("setlocal", "kfNH"),
            ("label", "sized"),
        ]
    p += [
        ("getlocal", "kfW"), ("getlocal", "kfNW"), ("sub",), ("pushint", 2), ("div",),
        ("setlocal", "kfX"),
        ("getlocal", "kfH"), ("getlocal", "kfNH"), ("sub",), ("pushint", 2), ("div",),
        ("setlocal", "kfY"),
        # (the stage).rect = kfR  -> okno sceny na cały monitor
        ("getmovieprop", "stage"), ("getlocal", "kfR"), ("setobjprop", "rect"),
        # (the stage).drawRect = rect(x, y, x + nw, y + nh)  -> wyśrodkowany obraz 4:3
        ("getmovieprop", "stage"),
        ("getlocal", "kfX"), ("getlocal", "kfY"),
        ("getlocal", "kfX"), ("getlocal", "kfNW"), ("add",),
        ("getlocal", "kfY"), ("getlocal", "kfNH"), ("add",),
        ("pusharglist", 4), ("extcall", "rect"),
        ("setobjprop", "drawRect"),
        ("ret",),
    ]
    return p


def tempo_keys_program():
    """on kfTempoKeys - wywoływane co klatkę z pętli gry.

    Odpytuje klawisze (keyPressed, tak jak sama gra robi ze strzałkami) i reaguje
    tylko na moment wciśnięcia, więc przytrzymanie klawisza zmienia tempo o jeden krok.
    """
    def pressed(codes, local):
        out = []
        for n, code in enumerate(codes):
            out += [("pushint", code), ("pusharglist", 1), ("extcall", "keyPressed")]
            if n:
                out.append(("or",))
        return out + [("setlocal", local)]

    def on_press(local, was, op, label):
        return [
            ("getlocal", local), ("getglobal", was), ("not",), ("and",), ("jmpifz", label),
            ("getglobal", "kfTempo"), ("pushint", TEMPO_STEP), (op,), ("setglobal", "kfTempo"),
            ("pushint", 1), ("setlocal", "kfChanged"),
            ("label", label),
            ("getlocal", local), ("setglobal", was),
        ]

    return [
        ("pushzero",), ("setlocal", "kfChanged"),
        *pressed(KEYS_FASTER, "kfUp"),
        *pressed(KEYS_SLOWER, "kfDown"),
        *on_press("kfUp", "kfUpWas", "add", "up_done"),
        *on_press("kfDown", "kfDownWas", "sub", "down_done"),
        ("getlocal", "kfChanged"), ("jmpifz", "done"),
        ("getglobal", "kfTempo"), ("pushint", TEMPO_MIN), ("lt",), ("jmpifz", "min_ok"),
        ("pushint", TEMPO_MIN), ("setglobal", "kfTempo"),
        ("label", "min_ok"),
        ("getglobal", "kfTempo"), ("pushint", TEMPO_MAX), ("gt",), ("jmpifz", "max_ok"),
        ("pushint", TEMPO_MAX), ("setglobal", "kfTempo"),
        ("label", "max_ok"),
        ("getglobal", "kfTempo"), ("pusharglistnoret", 1), ("extcall", "puppetTempo"),
        ("label", "done"),
        ("ret",),
    ]


# oryginalny skrypt klatki pętli gry ("looper_navigate"):  on exitFrame me / go the frame
LOOP_FRAME_CODE = bytes.fromhex("4300 66") + b"{frame}" + bytes.fromhex("4201 57") + b"{go}" + b"\x01"


def loop_frame_program():
    return [
        ("pusharglistnoret", 0), ("extcall", "kfTempoKeys"),
        ("pusharglist", 0), ("thebuiltin", "frame"),
        ("pusharglistnoret", 1), ("extcall", "go"),
        ("ret",),
    ]


def single_handler_code(blob):
    g = lambda fmt, off: struct.unpack_from(">" + fmt, blob, off)[0]
    if g("H", 72) != 1:
        return None
    rec = g("I", 74)
    return blob[g("I", rec + 8):g("I", rec + 8) + g("I", rec + 4)]


def handler_record(blob, index):
    return struct.unpack_from(">I", blob, 74)[0] + HANDLER_SIZE * index


def jump_fix_patches():
    """Poprawka "podwójnego wybicia" przy skoku na wyższą platformę.

    Gra co klatkę ustawia Kubusia na wysokości podłoża pod nim + 35, a w trakcie skoku
    dodaje do tego łuk `skok`. Gdy w locie Kubuś znajdzie się nad wyższą platformą,
    łuk zaczyna się liczyć od nowego podłoża i postać wybija się drugi raz.
    Poprawka zapamiętuje wysokość startu skoku (kfJumpBase) i dopóki podłoże jest
    co najmniej na tej wysokości, prowadzi postać po łuku liczonym od startu,
    a na platformie ląduje, gdy łuk zejdzie do jej poziomu. Na płaskim terenie i przy
    zeskoku w dół zachowanie jest identyczne z oryginałem.

    Zwraca listę (oryginalny fragment, poprzedzający kontekst, nowy kod - funkcja
    od pozycji powrotu).
    """
    model_pos = [("getprop", "pModel"), ("getchainedprop", "transform"),
                 ("getchainedprop", "position")]
    start_orig = [("pushint", 90), ("inv",), ("setprop", "jumped")]
    start_ctx = [("getprop", "jumped"), ("pushint", 91), ("inv",), ("eq",)]

    def start_new(ret):
        return start_orig + model_pos + [("getobjprop", "z"), ("setglobal", "kfJumpBase"),
                                         ("endrepeat", ret)]

    height_orig = model_pos + model_pos + [("getobjprop", "z"), ("getlocal", "skok"),
                                           ("add",), ("setobjprop", "z")]

    def height_new(ret):
        return model_pos + [
            ("getobjprop", "z"), ("setlocal", "kfG"),
            # if kfG >= kfJumpBase then (podłoże na wysokości startu lub wyżej)
            ("getlocal", "kfG"), ("getglobal", "kfJumpBase"), ("gteq",), ("jmpifz", "down"),
            ("getglobal", "kfJumpBase"), ("getlocal", "skok"), ("add",), ("setlocal", "kfT"),
            #   if kfT > kfG then z = kfT   (inaczej Kubuś stoi już na platformie)
            ("getlocal", "kfT"), ("getlocal", "kfG"), ("gt",), ("jmpifz", "done"),
        ] + model_pos + [
            ("getlocal", "kfT"), ("setobjprop", "z"),
            ("jmp", "done"),
            ("label", "down"),
            # else: jak w oryginale, z = podłoże + skok
        ] + model_pos + [
            ("getlocal", "kfG"), ("getlocal", "skok"), ("add",), ("setobjprop", "z"),
            ("label", "done"),
            ("endrepeat", ret),
        ]

    return [(start_orig, start_ctx, start_new), (height_orig, None, height_new)]


def fix_jump(movie, names, scripts):
    """Dopisuje poprawkę skoku do handlera stepFrame skryptu Kubusia."""
    owners = [s for s in scripts
              if {"stepframe", "calc_coins", "calc_carrots"} <= set(handler_names(movie.chunk(s), names.names))]
    if len(owners) != 1:
        raise SystemExit("Nie znaleziono skryptu sterowania Kubusiem")
    blob = bytearray(movie.chunk(owners[0]))
    g = lambda fmt, off: struct.unpack_from(">" + fmt, blob, off)[0]
    index = handler_names(blob, names.names).index("stepframe")
    rec = handler_record(blob, index)
    code_len, code_off = g("I", rec + 4), g("I", rec + 8)
    loc_count, loc_off = g("H", rec + 18), g("I", rec + 20)
    code = bytearray(blob[code_off:code_off + code_len])
    local_names = [names.names[g("h", loc_off + 2 * i)] for i in range(loc_count)]

    for original, context, build in jump_fix_patches():
        pattern, _ = assemble(original, names, [], list(local_names))
        prefix = assemble(context, names, [], list(local_names))[0] if context else b""
        hits = [i for i in range(len(code)) if code.startswith(pattern, i)
                and (not prefix or code[max(0, i - len(prefix) - 3):i - 3] == prefix)]
        if len(hits) != 1:
            raise SystemExit(f"Poprawka skoku: fragment znaleziony {len(hits)} razy zamiast 1")
        at = hits[0]
        patch_at = len(code)
        extra, _ = assemble(build(at + len(pattern)), names, [], local_names, base=patch_at)
        jump, _ = assemble([("jmp", patch_at)], names, [], local_names, base=at)
        assert len(jump) <= len(pattern)
        code[at:at + len(jump)] = jump      # reszta starego fragmentu jest już nieosiągalna
        code += extra

    return owners[0], replace_handler_code(blob, rec, code, local_names, names, ("kfJumpBase",))


def replace_handler_code(blob, rec, code, local_names, names, extra_globals=()):
    """Podpina handlerowi (rekord `rec`) nowy kod i listę zmiennych lokalnych.

    Kod, lokalne i rozszerzoną listę globalnych dopisuje na końcu skryptu - stare
    dane zostają w pliku, ale nic już na nie nie wskazuje.
    """
    blob = bytearray(blob)
    g = lambda fmt, off: struct.unpack_from(">" + fmt, blob, off)[0]
    gcount, goff = g("H", 66), g("I", 68)
    global_ids = [g("h", goff + 2 * i) for i in range(gcount)]
    for name in extra_globals:
        if names.id(name) not in global_ids:
            global_ids.append(names.id(name))
    if len(blob) % 2:
        blob += b"\0"
    new_code_off = len(blob)
    blob += code
    if len(blob) % 2:
        blob += b"\0"
    new_loc_off = len(blob)
    blob += b"".join(struct.pack(">h", names.id(n)) for n in local_names)
    new_glob_off = len(blob)
    blob += b"".join(struct.pack(">h", i) for i in global_ids)
    struct.pack_into(">II", blob, rec + 4, len(code), new_code_off)
    struct.pack_into(">HI", blob, rec + 18, len(local_names), new_loc_off)
    struct.pack_into(">HI", blob, 66, len(global_ids), new_glob_off)
    struct.pack_into(">II", blob, 8, len(blob), len(blob))
    return bytes(blob)


# --------------------------------------------------------------------------- #
def patch(raw, fps, scale, jump_fix=True, log=print):
    proj = Projector(raw)
    movie = proj.movie
    lnam_idx, scripts = find_script_context(movie)
    names = Names(movie.chunk(lnam_idx))

    # 1) DisplayMode Xtra -> pusty członek obsady (typ 15 "xtra" -> 0 "null")
    disabled = 0
    for i, fourcc, _length, offset in list(movie.entries()):
        if fourcc != "CASt":
            continue
        blob = movie.chunk(i)
        ctype, info_len = struct.unpack_from(">II", blob, 0)
        spec = blob[12 + info_len:]
        if ctype == 15 and spec[4:4 + 11].lower() == b"displaymode":
            struct.pack_into(">I", proj.data, offset + 8, 0)
            disabled += 1
    if not disabled:
        raise SystemExit("Nie znaleziono członka DisplayMode - czy to oryginalny Kuba.exe?")
    log(f"DisplayMode: wyłączono członków obsady: {disabled}")

    replaced = {}
    if jump_fix:
        idx, blob = fix_jump(movie, names, scripts)
        replaced[idx] = blob
        log("Skok: poprawione podwójne wybicie przy skoku na platformę")

    if not fps and scale == "none":
        proj.replace_chunk(lnam_idx, names.serialize())
        for idx, blob in replaced.items():
            proj.replace_chunk(idx, blob)
        return bytes(proj.data)

    # 2) skrypt filmu z `on prepareMovie`
    target = next((s for s in scripts
                   if handler_names(movie.chunk(s), names.names) == ["preparemovie"]), None)
    if target is None:
        raise SystemExit("Nie znaleziono skryptu z handlerem prepareMovie")
    handlers = [("prepareMovie", [], prepare_movie_program(fps, scale), None)]
    if fps:
        handlers.append(("kfTempoKeys", [], tempo_keys_program(), None))
        # 3) pętla gry: przed "go the frame" sprawdź klawisze +/-
        loop_code = (LOOP_FRAME_CODE
                     .replace(b"{frame}", bytes([names.id("frame")]))
                     .replace(b"{go}", bytes([names.id("go")])))
        loops = [s for s in scripts
                 if handler_names(movie.chunk(s), names.names) == ["exitframe"]
                 and single_handler_code(movie.chunk(s)) == loop_code]
        if not loops:
            raise SystemExit("Nie znaleziono skryptu pętli gry (go the frame)")
        for s in loops:
            replaced[s] = build_script(movie.chunk(s), names, [
                ("exitFrame", ["me"], loop_frame_program(), EVENT_EXIT_FRAME)])
    replaced[target] = build_script(
        movie.chunk(target), names, handlers,
        extra_globals=("kfTempo", "kfUpWas", "kfDownWas") if fps else ())
    proj.replace_chunk(lnam_idx, names.serialize())
    for idx, blob in replaced.items():
        proj.replace_chunk(idx, blob)
    log(f"Lingo: tempo={fps or 'bez zmian'} kl./s, skalowanie={scale}, "
        f"przebudowane skrypty: {len(replaced)}")
    return bytes(proj.data)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("input", help="oryginalny Kuba.exe")
    ap.add_argument("output", help="plik wynikowy")
    ap.add_argument("--fps", type=int, default=30,
                    help="tempo gry w kl./s (domyślnie 30; 0 = bez zmian i bez klawiszy +/-)")
    ap.add_argument("--scale", choices=["fit", "integer", "none"], default="fit",
                    help="fit = 4:3 na cały ekran (domyślnie), integer = całkowita "
                         "wielokrotność 640x480, none = bez skalowania")
    ap.add_argument("--bez-poprawki-skoku", dest="jump_fix", action="store_false",
                    help="nie poprawiaj podwójnego wybicia przy skoku na platformę")
    args = ap.parse_args(argv)
    if args.fps and not TEMPO_MIN <= args.fps <= TEMPO_MAX:
        ap.error(f"--fps musi być w zakresie {TEMPO_MIN}-{TEMPO_MAX}")
    raw = open(args.input, "rb").read()
    sha1 = hashlib.sha1(raw).hexdigest()
    print(f"wejście: {args.input} ({len(raw)} B, sha1 {sha1})")
    if sha1 != ORIGINAL_SHA1:
        print("UWAGA: suma kontrolna różni się od znanego oryginału - próbuję mimo to.")
    out = patch(raw, args.fps, args.scale, args.jump_fix)
    with open(args.output, "wb") as f:
        f.write(out)
    print(f"zapisano: {args.output} ({len(out)} B)")


if __name__ == "__main__":
    sys.exit(main())
