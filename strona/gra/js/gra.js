// Start gry na stronie: ładowanie poziomu, menu pod Esc i ekrany końca poziomu.

import { Gra, dzwiek, przechwytujKlawisze } from "./silnik.js";
import { uruchomPoziom as poziom01 } from "./poziom01.js";
import { uruchomPoziom as poziom02 } from "./poziom02.js";
import { uruchomPoziom as poziom03 } from "./poziom03.js";
import { uruchomPoziom as poziom04 } from "./poziom04.js";
import { uruchomPoziom as poziom05 } from "./poziom05.js";
import { uruchomPoziom as poziom06 } from "./poziom06.js";
import { uruchomPoziom as poziom07 } from "./poziom07.js";
import { uruchomPoziom as poziom08 } from "./poziom08.js";
import { uruchomPoziom as poziom09 } from "./poziom09.js";
import { uruchomPoziom as poziom10 } from "./poziom10.js";
import { uruchomPoziom as poziom11 } from "./poziom11.js";

const ekran = document.getElementById("ekran");
const plansza = document.getElementById("plansza");
const start = document.getElementById("start");
const pasek = document.getElementById("pasek");
const przyciskGraj = document.getElementById("graj");
const menu = document.getElementById("menu");
const koniec = document.getElementById("koniec");
const glosnosc = document.getElementById("glosnosc");
const glosnoscWartosc = document.getElementById("glosnosc-wartosc");

// Wspólna głośność muzyki i efektów, także ustawiona przed uruchomieniem audio.
try {
  const zapisana = localStorage.getItem("kubus-glosnosc");
  if (zapisana !== null && Number.isFinite(Number(zapisana))) glosnosc.value = zapisana;
} catch { /* Ustawienie działa również bez dostępu do localStorage. */ }
function ustawGlosnosc() {
  const procent = glosnosc.valueAsNumber;
  glosnoscWartosc.value = `${procent}%`;
  glosnosc.setAttribute("aria-valuetext", `${procent}%`);
  dzwiek.setMasterVolume(procent / 100);
}
ustawGlosnosc();
glosnosc.addEventListener("input", () => {
  ustawGlosnosc();
  try { localStorage.setItem("kubus-glosnosc", glosnosc.value); } catch { /* Brak trwałego zapisu. */ }
});

let gra = null;
let blad = false;
const wyborPoziomu = document.getElementById("poziom");
const pokazNieodblokowane = document.getElementById("pokaz-nieodblokowane");
const poziomy = { "01": poziom01, "02": poziom02, "03": poziom03, "04": poziom04, "05": poziom05, "06": poziom06, "07": poziom07, "08": poziom08, "09": poziom09, "10": poziom10, "11": poziom11 };
const nazwyPoziomow = { "01": "Droga do zamku", "02": "Duży dziedziniec",
  "03": "Mały dziedziniec", "04": "Zamek króla Artura", "05": "Dziedziniec pałacu szoguna", "06": "Pałac szoguna", "07": "Komnata szoguna", "08": "Hol świątyni", "09": "Trzy próby", "10": "Hol laboratorium", "11": "Pokój badań" };
function odczytajPostep() {
  try {
    const n = Number(localStorage.getItem("kubus-postep") ?? 1);
    if (Number.isInteger(n) && n >= 1 && n <= 12) return n;
  } catch { /* Pierwszy poziom działa również bez dostępu do localStorage. */ }
  return 1;
}
let odblokowany = odczytajPostep();
let numer = "01";
function odswiezPoziomy(preferowany = wyborPoziomu.value) {
  wyborPoziomu.replaceChildren(...Object.keys(poziomy).sort((a, b) => Number(a) - Number(b))
    .filter((n) => Number(n) <= odblokowany || pokazNieodblokowane.checked)
    .map((n) => new Option(`${Number(n)}. ${nazwyPoziomow[n]}${Number(n) > odblokowany ? " (nieodblokowany)" : ""}`, n)));
  wyborPoziomu.value = [...wyborPoziomu.options].some((o) => o.value === preferowany) ? preferowany : "01";
  numer = wyborPoziomu.value;
}
const parametr = new URLSearchParams(location.search).get("poziom");
const wybrany = (parametr ?? "1").padStart(2, "0");
// Sam adres nie odsłania nazw zamkniętych etapów. Checkbox pozwala je wybrać.
pokazNieodblokowane.checked = false;
odswiezPoziomy(wybrany);
wyborPoziomu.addEventListener("change", () => { numer = wyborPoziomu.value; });
pokazNieodblokowane.addEventListener("change", () => odswiezPoziomy());

async function zaladuj() {
  przyciskGraj.disabled = true;
  wyborPoziomu.disabled = true;
  pokazNieodblokowane.disabled = true;
  przyciskGraj.textContent = "Wczytywanie…";
  const adres = new URL(location.href);
  adres.searchParams.set("poziom", String(Number(numer)));
  history.replaceState(null, "", adres);
  gra = new Gra(plansza, `dane/${numer}`);
  const planszaFinalu = document.getElementById("plansza-finalu");
  if (numer === "11") planszaFinalu.src = "dane/11/zakonczenie.svg";
  await Promise.all([
    gra.wczytaj((p) => { pasek.style.width = `${Math.round(p * 100)}%`; }),
    numer === "11" ? planszaFinalu.decode() : Promise.resolve(),
  ]);
  dzwiek.wlacz();
  window.kubus = { gra, numer, ...poziomy[numer](gra, zakonczenie) };   // podgląd stanu z konsoli
  start.hidden = true;
  plansza.hidden = false;
  dzwiek.puppetSound(1, ["09", "10", "11"].includes(numer) ? "muza" : "muzyka", true);
  gra.start();
  przechwytujKlawisze(true);
  plansza.focus();
}

function zakonczenie(co) {
  przechwytujKlawisze(false);
  if (co === "menu") {
    gra.pauza = true;
    menu.hidden = false;
    menu.querySelector("button").focus();
    return;
  }
  dzwiek.stopWszystko();
  koniec.dataset.final = String(co === "wygrana" && numer === "11");
  if (co === "wygrana") {
    odblokowany = Math.max(odblokowany, odczytajPostep(), Number(numer) + 1);
    try { localStorage.setItem("kubus-postep", String(odblokowany)); } catch { /* Postęp działa w bieżącej sesji. */ }
    odswiezPoziomy(numer);
    document.getElementById("tekst-wygranej").textContent = {
      "01": "Brawo! Kubuś zdobył Ekskalibur i przeszedł przez most.",
      "02": "Brawo! Mechanizm naprawiony — Kubuś opuścił Duży dziedziniec!",
      "03": "Brawo! Kubuś przeszedł przez Mały dziedziniec i dotarł do zamku!",
      "04": "Brawo! Kubuś odnalazł kielich i przeszedł przez magiczne lustro króla Artura!",
      "05": "Brawo! Kubuś zebrał 50 kryształów i dotarł do pałacu szoguna!",
      "06": "Brawo! Kubuś odnalazł łuk i kołczan i dotarł do komnaty szoguna!",
      "07": "Brawo! Kubuś zdobył Oko Smoka i przeszedł przez portal szoguna!",
      "08": "Brawo! Kubuś zapalił 16 pochodni i przeszedł przez Hol świątyni!",
      "09": "Brawo! Kubuś przeszedł trzy próby, zdobył Amulet Słońca i dotarł do portalu!",
      "10": "Brawo! Kubuś zebrał 35 ogniw energetycznych, uruchomił konsolę i dotarł do pokoju badań!",
      "11": "Brawo! Kubuś umieścił trzy artefakty w schowkach, uruchomił wehikuł czasu i zakończył przygodę!",
    }[numer];
    const nastepny = document.getElementById("nastepny-poziom");
    nastepny.hidden = !poziomy[String(Number(numer) + 1).padStart(2, "0")];
    nastepny.href = `?poziom=${Number(numer) + 1}`;
    nastepny.textContent = `Gram dalej — poziom ${Number(numer) + 1}`;
    document.getElementById("dalsze-poziomy").hidden = !nastepny.hidden;
  }
  koniec.dataset.wynik = co;
  koniec.hidden = false;
  const celFokusu = koniec.dataset.final === "true" ? "#powrot-na-strone"
    : co === "wygrana" && !document.getElementById("nastepny-poziom").hidden ? "#nastepny-poziom" : "button";
  koniec.querySelector(celFokusu).focus();
}

przyciskGraj.addEventListener("click", () => {
  if (blad) { location.reload(); return; }
  zaladuj().catch((e) => {
    console.error(e);
    blad = true;
    dzwiek.stopWszystko();
    przyciskGraj.disabled = false;
    przyciskGraj.textContent = "Błąd wczytywania — spróbuj ponownie";
  });
});

document.getElementById("gram-dalej").addEventListener("click", () => {
  menu.hidden = true;
  gra.pauza = false;
  przechwytujKlawisze(true);
  plansza.focus();
});
document.getElementById("zakoncz").addEventListener("click", () => {
  location.href = "../";
});
document.getElementById("jeszcze-raz").addEventListener("click", () => location.reload());

document.getElementById("pelny-ekran").addEventListener("click", () => {
  ekran.requestFullscreen?.().then(() => navigator.keyboard?.lock?.(["Escape"]).catch(() => {})).catch(() => {});
});
