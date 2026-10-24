/*
 * Launcher "Kubuś i Wehikuł Czasu" - edycja fanowska pełnej wersji (11 poziomów).
 *
 * Okno z listą poziomów, podglądem i ustawieniami. Uruchamia poprawione pliki .dcr
 * w odtwarzaczu Flashpoint SPR (SPR.exe w oknie / SPRS.exe na pełnym ekranie),
 * sprawdza, czy jest Adobe Shockwave Player 12, i w razie potrzeby uruchamia
 * dołączony instalator sw_lic_full_installer.msi.
 *
 * Z grą launcher rozmawia przez pliki ustawień Shockwave (setPref/getPref), które
 * odtwarzacz trzyma w ...\AppData\LocalLow\Adobe\Director 12\<SPR|SPRS>\Prefs:
 *   KubusPostep.txt - najwyższy odblokowany poziom (zapisuje go gra po ukończeniu
 *                     poziomu; 12 = cała gra ukończona),
 *   KubusTempo.txt  - tempo startowe (zapisuje launcher; gra zapisuje zmiany z +/-).
 *
 * Czysty Win32, bez dodatkowych bibliotek. Budowanie: launcher/build.sh (MinGW-w64).
 * Ustawienia launchera: %APPDATA%\Kubus i Wehikul Czasu\ustawienia.ini
 */
#define COBJMACROS
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <windowsx.h>
#include <commctrl.h>
#include <shellapi.h>
#include <shlobj.h>
#include <knownfolders.h>
#include <olectl.h>
#include <wchar.h>

#include "resource.h"

#ifndef WERSJA
#define WERSJA L"dev"
#endif

#define REPO_URL L"https://github.com/Hayyarden/Kubus-i-Wehikul-Czasu-Edycja-fanowska"
#define ARCHIWUM_DIR L"kubus-i-wehiku-czasu-pl-pelna-wersja-demo-winnie-and-the-time-machine-full-version-demo.w\\Kubus - Wehiku Czasu Pełna Wersja"
#define MSI_NAME L"sw_lic_full_installer.msi"
#define FLAG_NO_DX7 L"--noDirectX7"
#define FLAG_BAD_DRIVER L"--bugfixShockwave3DBadDriverList"
#define PREF_POSTEP L"KubusPostep.txt"
#define PREF_TEMPO L"KubusTempo.txt"

#define LEVELS 11
#define TEMPO_MIN 10
#define TEMPO_MAX 80
#define TEMPO_STEP 5
#define TEMPO_DEFAULT 30
#define WM_APP_GAME_ENDED (WM_APP + 1)

enum {
    IDC_LIST = 100, IDC_SHOW_ALL, IDC_FULLSCREEN, IDC_NODX7, IDC_BADDRIVER, IDC_TEMPO, IDC_TEMPO_SPIN,
    IDC_PLAY, IDC_DEMO, IDC_STATUS, IDC_INSTALL_SW, IDC_INSTRUKCJA, IDC_EXIT
};

static const struct { const wchar_t *name, *world; } LEVEL_INFO[LEVELS] = {
    {L"Droga do zamku", L"Zamek króla Artura"},
    {L"Duży dziedziniec", L"Zamek króla Artura"},
    {L"Mały dziedziniec", L"Zamek króla Artura"},
    {L"Zamek króla Artura", L"Zamek króla Artura"},
    {L"Dziedziniec pałacu szoguna", L"Kraina samurajów"},
    {L"Pałac szoguna", L"Kraina samurajów"},
    {L"Komnata szoguna", L"Kraina samurajów"},
    {L"Hol świątyni", L"Świątynia słońca"},
    {L"Trzy próby", L"Świątynia słońca"},
    {L"Hol laboratorium", L"Miasto przyszłości"},
    {L"Pokój badań", L"Miasto przyszłości"},
};

/* Kolory: zielony baner jak opakowania Kubusia */
#define C_BANNER_TEXT RGB(255, 255, 255)
#define C_BANNER_DIM RGB(238, 250, 222)
#define C_BANNER_SHADOW RGB(46, 110, 22)
#define C_BANNER_STRIPE RGB(62, 138, 30)
#define C_NUMBER RGB(70, 150, 35)

static HINSTANCE g_inst;
static HWND g_wnd, g_list, g_show_all, g_play, g_demo, g_status, g_install;
static HWND g_fullscreen, g_nodx7, g_baddriver, g_tempo, g_tempo_spin, g_tempo_hint;
static HFONT g_font, g_font_bold, g_font_small, g_font_big, g_font_number, g_font_title;
static IPicture *g_banner, *g_preview[LEVELS];
static int g_dpi = 96;

static wchar_t g_exe_dir[MAX_PATH];
static wchar_t g_game_dir[MAX_PATH];          /* folder z .dcr i SPR.exe ("" gdy brak) */
static wchar_t g_level_file[LEVELS][MAX_PATH]; /* np. 01_droga_do_zamku.dcr ("" gdy brak) */
static wchar_t g_demo_exe[MAX_PATH];
static wchar_t g_ini[MAX_PATH];
static BOOL g_has_shockwave;
static int g_unlocked = 1;                     /* najwyższy odblokowany poziom (1..12) */

#define S(x) MulDiv((x), g_dpi, 96)

/* ------------------------------------------------------------------------- */
/* Ścieżki                                                                   */
/* ------------------------------------------------------------------------- */

static BOOL file_exists(const wchar_t *path)
{
    DWORD a = GetFileAttributesW(path);
    return a != INVALID_FILE_ATTRIBUTES && !(a & FILE_ATTRIBUTE_DIRECTORY);
}

static BOOL dir_exists(const wchar_t *path)
{
    DWORD a = GetFileAttributesW(path);
    return a != INVALID_FILE_ATTRIBUTES && (a & FILE_ATTRIBUTE_DIRECTORY);
}

/* Łączy katalog z dalszą częścią ścieżki i normalizuje ".." */
static void join(wchar_t *out, const wchar_t *dir, const wchar_t *rest)
{
    wchar_t tmp[MAX_PATH * 2];
    _snwprintf(tmp, MAX_PATH * 2, L"%s\\%s", dir, rest);
    tmp[MAX_PATH * 2 - 1] = 0;
    if (!GetFullPathNameW(tmp, MAX_PATH, out, NULL))
        lstrcpynW(out, tmp, MAX_PATH);
    size_t n = wcslen(out);
    if (n > 3 && out[n - 1] == L'\\')
        out[n - 1] = 0;
}

static void find_paths(void)
{
    GetModuleFileNameW(NULL, g_exe_dir, MAX_PATH);
    wchar_t *slash = wcsrchr(g_exe_dir, L'\\');
    if (slash)
        *slash = 0;

    /* Gra obok launchera (repozytorium: pelna_wersja\) albo w podfolderze dane\ (wydanie) */
    static const wchar_t *game_dirs[] = {L".", L"dane", L"pelna_wersja"};
    g_game_dir[0] = 0;
    for (int i = 0; i < (int)(sizeof game_dirs / sizeof *game_dirs); i++) {
        wchar_t dir[MAX_PATH], spr[MAX_PATH];
        join(dir, g_exe_dir, game_dirs[i]);
        join(spr, dir, L"SPR.exe");
        if (!file_exists(spr))
            continue;
        wchar_t pattern[MAX_PATH];
        join(pattern, dir, L"01_*.dcr");
        WIN32_FIND_DATAW fd;
        HANDLE h = FindFirstFileW(pattern, &fd);
        if (h == INVALID_HANDLE_VALUE)
            continue;
        FindClose(h);
        lstrcpynW(g_game_dir, dir, MAX_PATH);
        break;
    }

    for (int i = 0; i < LEVELS; i++) {
        g_level_file[i][0] = 0;
        if (!g_game_dir[0])
            continue;
        wchar_t mask[16], pattern[MAX_PATH];
        _snwprintf(mask, 16, L"%02d_*.dcr", i + 1);
        join(pattern, g_game_dir, mask);
        WIN32_FIND_DATAW fd;
        HANDLE h = FindFirstFileW(pattern, &fd);
        if (h != INVALID_HANDLE_VALUE) {
            lstrcpynW(g_level_file[i], fd.cFileName, MAX_PATH);
            FindClose(h);
        }
    }

    /* Wersja z płyty (poprawiony Kuba.exe) - nie wymaga Shockwave */
    static const wchar_t *demo_paths[] = {
        L"demo\\Kuba.exe", L"..\\demo\\Kuba.exe", L"..\\poprawka\\Kuba.exe"};
    g_demo_exe[0] = 0;
    for (int i = 0; i < (int)(sizeof demo_paths / sizeof *demo_paths); i++) {
        wchar_t p[MAX_PATH];
        join(p, g_exe_dir, demo_paths[i]);
        if (file_exists(p)) {
            lstrcpynW(g_demo_exe, p, MAX_PATH);
            break;
        }
    }

    wchar_t appdata[MAX_PATH];
    if (SUCCEEDED(SHGetFolderPathW(NULL, CSIDL_APPDATA | CSIDL_FLAG_CREATE, NULL, 0, appdata))) {
        join(g_ini, appdata, L"Kubus i Wehikul Czasu");
        CreateDirectoryW(g_ini, NULL);
        join(g_ini, g_ini, L"ustawienia.ini");
    } else {
        join(g_ini, g_exe_dir, L"ustawienia.ini");
    }
}

static BOOL find_msi(wchar_t *out)
{
    const wchar_t *bases[] = {g_game_dir, g_exe_dir};
    for (int i = 0; i < 2; i++) {
        if (!bases[i][0])
            continue;
        join(out, bases[i], MSI_NAME);
        if (file_exists(out))
            return TRUE;
        wchar_t arch[MAX_PATH];
        join(arch, bases[i], L"..\\" ARCHIWUM_DIR);
        join(out, arch, MSI_NAME);
        if (file_exists(out))
            return TRUE;
    }
    return FALSE;
}

static BOOL detect_shockwave(void)
{
    wchar_t dir[MAX_PATH], p[MAX_PATH];
    if (GetSystemWow64DirectoryW(dir, MAX_PATH)) {
        join(p, dir, L"Adobe\\Shockwave 12\\dirapi.dll");
        if (file_exists(p))
            return TRUE;
    }
    if (GetSystemDirectoryW(dir, MAX_PATH)) {
        join(p, dir, L"Adobe\\Shockwave 12\\dirapi.dll");
        if (file_exists(p))
            return TRUE;
    }
    return FALSE;
}

/* ------------------------------------------------------------------------- */
/* Pliki ustawień Shockwave (wspólne z grą)                                  */
/* ------------------------------------------------------------------------- */

#define PREF_DIRS 6

/* Foldery Prefs obu odtwarzaczy. Shockwave 12 używa LocalLow; pozostałe dwa
 * położenia to zapas, gdyby jakaś wersja odtwarzacza zapisywała gdzie indziej. */
static int pref_dirs(wchar_t dirs[PREF_DIRS][MAX_PATH], BOOL *primary)
{
    wchar_t bases[3][MAX_PATH];
    int nb = 0;
    PWSTR low = NULL;
    if (SUCCEEDED(SHGetKnownFolderPath(&FOLDERID_LocalAppDataLow, 0, NULL, &low))) {
        lstrcpynW(bases[nb++], low, MAX_PATH);
        CoTaskMemFree(low);
    }
    if (SUCCEEDED(SHGetFolderPathW(NULL, CSIDL_LOCAL_APPDATA, NULL, 0, bases[nb])))
        nb++;
    if (SUCCEEDED(SHGetFolderPathW(NULL, CSIDL_APPDATA, NULL, 0, bases[nb])))
        nb++;
    static const wchar_t *players[] = {L"Adobe\\Director 12\\SPR\\Prefs", L"Adobe\\Director 12\\SPRS\\Prefs"};
    int n = 0;
    for (int b = 0; b < nb; b++)
        for (int p = 0; p < 2; p++) {
            join(dirs[n], bases[b], players[p]);
            primary[n] = b == 0;
            n++;
        }
    return n;
}

/* Czyta liczbę ze wszystkich folderów Prefs: największą albo najnowszą. */
static BOOL pref_read(const wchar_t *name, BOOL newest, int *value)
{
    wchar_t dirs[PREF_DIRS][MAX_PATH];
    BOOL primary[PREF_DIRS];
    int n = pref_dirs(dirs, primary);
    BOOL found = FALSE;
    ULONGLONG best_time = 0;
    for (int i = 0; i < n; i++) {
        wchar_t path[MAX_PATH];
        join(path, dirs[i], name);
        HANDLE f = CreateFileW(path, GENERIC_READ, FILE_SHARE_READ | FILE_SHARE_WRITE, NULL,
                               OPEN_EXISTING, 0, NULL);
        if (f == INVALID_HANDLE_VALUE)
            continue;
        char buf[16] = {0};
        DWORD got = 0;
        FILETIME ft;
        ReadFile(f, buf, sizeof buf - 1, &got, NULL);
        GetFileTime(f, NULL, NULL, &ft);
        CloseHandle(f);
        if (buf[0] < '0' || buf[0] > '9')
            continue;
        int v = atoi(buf);
        ULONGLONG t = ((ULONGLONG)ft.dwHighDateTime << 32) | ft.dwLowDateTime;
        if (!found || (newest ? t > best_time : v > *value)) {
            *value = v;
            best_time = t;
            found = TRUE;
        }
    }
    return found;
}

/* Zapisuje liczbę w folderach Prefs, które już istnieją, i zawsze w LocalLow. */
static void pref_write(const wchar_t *name, int value)
{
    wchar_t dirs[PREF_DIRS][MAX_PATH];
    BOOL primary[PREF_DIRS];
    int n = pref_dirs(dirs, primary);
    char buf[16];
    int len = wsprintfA(buf, "%d", value);
    for (int i = 0; i < n; i++) {
        if (!dir_exists(dirs[i])) {
            if (!primary[i])
                continue;
            SHCreateDirectoryExW(NULL, dirs[i], NULL);
        }
        wchar_t path[MAX_PATH];
        join(path, dirs[i], name);
        HANDLE f = CreateFileW(path, GENERIC_WRITE, 0, NULL, CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, NULL);
        if (f == INVALID_HANDLE_VALUE)
            continue;
        DWORD written;
        WriteFile(f, buf, len, &written, NULL);
        CloseHandle(f);
    }
}

static int read_unlocked(void)
{
    int v = 1;
    if (!pref_read(PREF_POSTEP, FALSE, &v))
        v = 1;
    return v < 1 ? 1 : (v > LEVELS + 1 ? LEVELS + 1 : v);
}

static int clamp_tempo(int v)
{
    return v < TEMPO_MIN ? TEMPO_MIN : (v > TEMPO_MAX ? TEMPO_MAX : v);
}

static int read_tempo(void)
{
    int v = TEMPO_DEFAULT;
    if (!pref_read(PREF_TEMPO, TRUE, &v))
        v = TEMPO_DEFAULT;
    return clamp_tempo(v);
}

/* ------------------------------------------------------------------------- */
/* Ustawienia launchera                                                      */
/* ------------------------------------------------------------------------- */

static int ini_get(const wchar_t *key, int def)
{
    return GetPrivateProfileIntW(L"Kubus", key, def, g_ini);
}

static void ini_set(const wchar_t *key, int value)
{
    wchar_t buf[16];
    _snwprintf(buf, 16, L"%d", value);
    WritePrivateProfileStringW(L"Kubus", key, buf, g_ini);
}

static int selected_level(void)
{
    int sel = ListBox_GetCurSel(g_list);
    return sel < 0 ? -1 : (int)ListBox_GetItemData(g_list, sel);
}

static int tempo_value(void)
{
    BOOL ok = FALSE;
    int v = (int)GetDlgItemInt(g_wnd, IDC_TEMPO, &ok, FALSE);
    return clamp_tempo(ok ? v : TEMPO_DEFAULT);
}

static void set_tempo_value(int v)
{
    SendMessageW(g_tempo_spin, UDM_SETPOS32, 0, clamp_tempo(v));
}

static void save_settings(void)
{
    int level = selected_level();
    ini_set(L"poziom", level >= 0 ? level + 1 : 1);
    ini_set(L"pokaz_wszystkie", Button_GetCheck(g_show_all) == BST_CHECKED);
    ini_set(L"pelny_ekran", Button_GetCheck(g_fullscreen) == BST_CHECKED);
    ini_set(L"bez_directx7", Button_GetCheck(g_nodx7) == BST_CHECKED);
    ini_set(L"obejscie_sterownikow", Button_GetCheck(g_baddriver) == BST_CHECKED);
}

/* ------------------------------------------------------------------------- */
/* Grafika                                                                   */
/* ------------------------------------------------------------------------- */

static IPicture *load_jpeg(int id)
{
    HRSRC r = FindResourceW(g_inst, MAKEINTRESOURCEW(id), (LPCWSTR)RT_RCDATA);
    if (!r)
        return NULL;
    DWORD size = SizeofResource(g_inst, r);
    const void *data = LockResource(LoadResource(g_inst, r));
    HGLOBAL mem = GlobalAlloc(GMEM_MOVEABLE, size);
    if (!mem)
        return NULL;
    memcpy(GlobalLock(mem), data, size);
    GlobalUnlock(mem);
    IStream *stream = NULL;
    IPicture *pic = NULL;
    if (SUCCEEDED(CreateStreamOnHGlobal(mem, TRUE, &stream))) {
        OleLoadPicture(stream, size, FALSE, &IID_IPicture, (void **)&pic);
        IStream_Release(stream);
    } else {
        GlobalFree(mem);
    }
    return pic;
}

static void draw_picture(HDC dc, IPicture *pic, int x, int y, int w, int h)
{
    OLE_HANDLE handle = 0;
    if (!pic || FAILED(IPicture_get_Handle(pic, &handle)) || !handle)
        return;
    HBITMAP bmp = (HBITMAP)(UINT_PTR)handle;
    BITMAP bm;
    GetObject(bmp, sizeof bm, &bm);
    HDC mem = CreateCompatibleDC(dc);
    HGDIOBJ old = SelectObject(mem, bmp);
    SetStretchBltMode(dc, HALFTONE);
    SetBrushOrgEx(dc, 0, 0, NULL);
    StretchBlt(dc, x, y, w, h, mem, 0, 0, bm.bmWidth, bm.bmHeight, SRCCOPY);
    SelectObject(mem, old);
    DeleteDC(mem);
}

static HFONT make_font(int pt, int weight)
{
    NONCLIENTMETRICSW ncm = {sizeof ncm};
    SystemParametersInfoW(SPI_GETNONCLIENTMETRICS, sizeof ncm, &ncm, 0);
    LOGFONTW lf = ncm.lfMessageFont;
    lf.lfHeight = -MulDiv(pt, g_dpi, 72);
    lf.lfWeight = weight;
    lf.lfQuality = CLEARTYPE_QUALITY;
    return CreateFontIndirectW(&lf);
}

/* Tekst na banerze: jasny, z ciemnozielonym cieniem, żeby był czytelny na zieleni */
static void banner_text(HDC dc, const wchar_t *text, RECT r, COLORREF color)
{
    RECT shadow = {r.left + S(1), r.top + S(1), r.right + S(1), r.bottom + S(1)};
    SetTextColor(dc, C_BANNER_SHADOW);
    DrawTextW(dc, text, -1, &shadow, DT_RIGHT | DT_SINGLELINE | DT_NOPREFIX);
    SetTextColor(dc, color);
    DrawTextW(dc, text, -1, &r, DT_RIGHT | DT_SINGLELINE | DT_NOPREFIX);
}

/* ------------------------------------------------------------------------- */
/* Układ okna (współrzędne dla 96 DPI, skalowane przez S())                  */
/* ------------------------------------------------------------------------- */

#define CLIENT_W 800
#define CLIENT_H 664
#define BANNER_H 112
#define LIST_X 20
#define LIST_Y 146
#define LIST_W 280
#define LIST_H 356
#define PREV_X 316
#define PREV_Y 146
#define PREV_W 464
#define PREV_H 348
#define OPTS_Y 550
#define TEMPO_X 330
#define BOTTOM_Y 626

static RECT preview_rect(void)
{
    RECT r = {S(PREV_X), S(PREV_Y), S(PREV_X + PREV_W), S(PREV_Y + PREV_H)};
    return r;
}

static RECT caption_rect(void)
{
    RECT r = {S(PREV_X), S(PREV_Y + PREV_H + 6), S(PREV_X + PREV_W), S(PREV_Y + PREV_H + 28)};
    return r;
}

static void update_status(void)
{
    g_has_shockwave = detect_shockwave();
    if (!g_game_dir[0]) {
        SetWindowTextW(g_status, L"Nie znaleziono plików gry (SPR.exe, 01_*.dcr) obok launchera.");
        ShowWindow(g_install, SW_HIDE);
    } else if (g_has_shockwave) {
        SetWindowTextW(g_status, L"Adobe Shockwave Player 12 jest zainstalowany.");
        ShowWindow(g_install, SW_HIDE);
    } else {
        SetWindowTextW(g_status, L"Brak Adobe Shockwave Player 12 – potrzebny do pełnej wersji.");
        ShowWindow(g_install, SW_SHOW);
    }
    EnableWindow(g_play, g_game_dir[0] != 0);
}

static void invalidate_preview(void)
{
    RECT pr = preview_rect(), cap = caption_rect();
    InvalidateRect(g_wnd, &pr, FALSE);
    InvalidateRect(g_wnd, &cap, FALSE);
}

/* Wypełnia listę: odblokowane poziomy albo wszystkie, i zaznacza `select` (0..10) */
static void fill_list(int select)
{
    BOOL all = Button_GetCheck(g_show_all) == BST_CHECKED;
    int visible = all ? LEVELS : (g_unlocked > LEVELS ? LEVELS : g_unlocked);
    SendMessageW(g_list, WM_SETREDRAW, FALSE, 0);
    ListBox_ResetContent(g_list);
    int sel_index = 0;
    for (int i = 0; i < visible; i++) {
        int idx = ListBox_AddString(g_list, LEVEL_INFO[i].name);
        ListBox_SetItemData(g_list, idx, i);
        if (i == select)
            sel_index = idx;
    }
    if (select >= visible)
        sel_index = visible - 1;
    ListBox_SetCurSel(g_list, sel_index);
    SendMessageW(g_list, WM_SETREDRAW, TRUE, 0);
    InvalidateRect(g_list, NULL, TRUE);
    invalidate_preview();
}

static void create_controls(HWND wnd)
{
    HWND label;
    label = CreateWindowExW(0, L"STATIC", L"Wybierz poziom:", WS_CHILD | WS_VISIBLE,
                            S(LIST_X), S(LIST_Y - 24), S(140), S(20), wnd, NULL, g_inst, NULL);
    SendMessageW(label, WM_SETFONT, (WPARAM)g_font_bold, TRUE);

    /* pole wyboru naprzeciw "Wybierz poziom:", dosunięte do prawego boku listy */
    g_show_all = CreateWindowExW(0, L"BUTTON", L"Pokaż wszystkie",
                                 WS_CHILD | WS_VISIBLE | WS_TABSTOP | BS_AUTOCHECKBOX | BS_LEFTTEXT | BS_RIGHT,
                                 S(LIST_X + LIST_W - 150), S(LIST_Y - 25), S(150), S(22),
                                 wnd, (HMENU)IDC_SHOW_ALL, g_inst, NULL);

    g_list = CreateWindowExW(WS_EX_CLIENTEDGE, L"LISTBOX", NULL,
                             WS_CHILD | WS_VISIBLE | WS_TABSTOP | WS_VSCROLL | LBS_NOTIFY |
                                 LBS_OWNERDRAWFIXED | LBS_NOINTEGRALHEIGHT,
                             S(LIST_X), S(LIST_Y), S(LIST_W), S(LIST_H),
                             wnd, (HMENU)IDC_LIST, g_inst, NULL);

    label = CreateWindowExW(0, L"STATIC", L"Ustawienia:", WS_CHILD | WS_VISIBLE,
                            S(LIST_X), S(OPTS_Y - 24), S(LIST_W), S(20), wnd, NULL, g_inst, NULL);
    SendMessageW(label, WM_SETFONT, (WPARAM)g_font_bold, TRUE);

    g_fullscreen = CreateWindowExW(0, L"BUTTON", L"Pełny ekran (lub okno 640×480)",
                                   WS_CHILD | WS_VISIBLE | WS_TABSTOP | WS_GROUP | BS_AUTOCHECKBOX,
                                   S(LIST_X), S(OPTS_Y), S(300), S(20),
                                   wnd, (HMENU)IDC_FULLSCREEN, g_inst, NULL);
    g_nodx7 = CreateWindowExW(0, L"BUTTON", L"DirectX 9 / OpenGL zamiast DirectX 7",
                              WS_CHILD | WS_VISIBLE | WS_TABSTOP | BS_AUTOCHECKBOX,
                              S(LIST_X), S(OPTS_Y + 22), S(300), S(20),
                              wnd, (HMENU)IDC_NODX7, g_inst, NULL);
    g_baddriver = CreateWindowExW(0, L"BUTTON", L"Obejście Shockwave 3D",
                                  WS_CHILD | WS_VISIBLE | WS_TABSTOP | BS_AUTOCHECKBOX,
                                  S(LIST_X), S(OPTS_Y + 44), S(300), S(20),
                                  wnd, (HMENU)IDC_BADDRIVER, g_inst, NULL);

    HWND tempo_label = CreateWindowExW(0, L"STATIC", L"Szybkość gry:", WS_CHILD | WS_VISIBLE | SS_CENTERIMAGE,
                                       S(TEMPO_X), S(OPTS_Y - 1), S(88), S(22), wnd, NULL, g_inst, NULL);
    g_tempo = CreateWindowExW(WS_EX_CLIENTEDGE, L"EDIT", L"",
                              WS_CHILD | WS_VISIBLE | WS_TABSTOP | WS_GROUP | ES_NUMBER | ES_RIGHT,
                              S(TEMPO_X + 90), S(OPTS_Y - 1), S(44), S(22), wnd, (HMENU)IDC_TEMPO, g_inst, NULL);
    SendMessageW(g_tempo, EM_SETLIMITTEXT, 2, 0);
    g_tempo_spin = CreateWindowExW(0, UPDOWN_CLASSW, NULL,
                                   WS_CHILD | WS_VISIBLE | UDS_SETBUDDYINT | UDS_ALIGNRIGHT |
                                       UDS_ARROWKEYS | UDS_NOTHOUSANDS,
                                   0, 0, 0, 0, wnd, (HMENU)IDC_TEMPO_SPIN, g_inst, NULL);
    SendMessageW(g_tempo_spin, UDM_SETBUDDY, (WPARAM)g_tempo, 0);
    SendMessageW(g_tempo_spin, UDM_SETRANGE32, TEMPO_MIN, TEMPO_MAX);
    UDACCEL accel = {0, TEMPO_STEP};
    SendMessageW(g_tempo_spin, UDM_SETACCEL, 1, (LPARAM)&accel);
    HWND tempo_unit = CreateWindowExW(0, L"STATIC", L"kl./s", WS_CHILD | WS_VISIBLE | SS_CENTERIMAGE,
                                      S(TEMPO_X + 140), S(OPTS_Y - 1), S(40), S(22), wnd, NULL, g_inst, NULL);
    g_tempo_hint = CreateWindowExW(0, L"STATIC", L"Dostosuj w grze: + / -", WS_CHILD | WS_VISIBLE,
                                   S(TEMPO_X), S(OPTS_Y + 25), S(200), S(16), wnd, NULL, g_inst, NULL);
    SendMessageW(g_tempo_hint, WM_SETFONT, (WPARAM)g_font_small, TRUE);

    g_play = CreateWindowExW(0, L"BUTTON", L"Graj!",
                             WS_CHILD | WS_VISIBLE | WS_TABSTOP | WS_GROUP | BS_DEFPUSHBUTTON,
                             S(580), S(OPTS_Y - 20), S(200), S(52), wnd, (HMENU)IDC_PLAY, g_inst, NULL);
    SendMessageW(g_play, WM_SETFONT, (WPARAM)g_font_big, TRUE);

    g_demo = CreateWindowExW(0, L"BUTTON", L"Wersja z płyty (demo, 1 poziom)",
                             WS_CHILD | WS_VISIBLE | WS_TABSTOP | BS_PUSHBUTTON,
                             S(580), S(OPTS_Y + 38), S(200), S(26), wnd, (HMENU)IDC_DEMO, g_inst, NULL);
    EnableWindow(g_demo, g_demo_exe[0] != 0);

    g_status = CreateWindowExW(0, L"STATIC", L"", WS_CHILD | WS_VISIBLE | SS_LEFTNOWORDWRAP | SS_CENTERIMAGE,
                               S(LIST_X), S(BOTTOM_Y), S(400), S(26), wnd, (HMENU)IDC_STATUS, g_inst, NULL);
    g_install = CreateWindowExW(0, L"BUTTON", L"Zainstaluj Shockwave 12",
                                WS_CHILD | WS_TABSTOP | BS_PUSHBUTTON,
                                S(424), S(BOTTOM_Y), S(156), S(26), wnd, (HMENU)IDC_INSTALL_SW, g_inst, NULL);
    HWND help = CreateWindowExW(0, L"BUTTON", L"Instrukcja", WS_CHILD | WS_VISIBLE | WS_TABSTOP | BS_PUSHBUTTON,
                                S(588), S(BOTTOM_Y), S(94), S(26), wnd, (HMENU)IDC_INSTRUKCJA, g_inst, NULL);
    HWND quit = CreateWindowExW(0, L"BUTTON", L"Wyjście", WS_CHILD | WS_VISIBLE | WS_TABSTOP | BS_PUSHBUTTON,
                                S(686), S(BOTTOM_Y), S(94), S(26), wnd, (HMENU)IDC_EXIT, g_inst, NULL);

    HWND normal[] = {g_list, g_show_all, g_fullscreen, g_nodx7, g_baddriver, tempo_label, g_tempo,
                     tempo_unit, g_demo, g_status, g_install, help, quit};
    for (int i = 0; i < (int)(sizeof normal / sizeof *normal); i++)
        SendMessageW(normal[i], WM_SETFONT, (WPARAM)g_font, TRUE);

    Button_SetCheck(g_show_all, ini_get(L"pokaz_wszystkie", 0) ? BST_CHECKED : BST_UNCHECKED);
    Button_SetCheck(g_fullscreen, ini_get(L"pelny_ekran", 1) ? BST_CHECKED : BST_UNCHECKED);
    Button_SetCheck(g_nodx7, ini_get(L"bez_directx7", 0) ? BST_CHECKED : BST_UNCHECKED);
    Button_SetCheck(g_baddriver, ini_get(L"obejscie_sterownikow", 0) ? BST_CHECKED : BST_UNCHECKED);
    set_tempo_value(read_tempo());

    g_unlocked = read_unlocked();
    fill_list(ini_get(L"poziom", g_unlocked) - 1);
    update_status();
}

/* ------------------------------------------------------------------------- */
/* Rysowanie                                                                 */
/* ------------------------------------------------------------------------- */

static void paint(HWND wnd, HDC dc)
{
    RECT client;
    GetClientRect(wnd, &client);

    /* Baner: zielone tło z logo (jeden obraz w podwójnej rozdzielczości) */
    draw_picture(dc, g_banner, 0, 0, client.right, S(BANNER_H) - S(4));
    RECT stripe = {0, S(BANNER_H) - S(4), client.right, S(BANNER_H)};
    HBRUSH b = CreateSolidBrush(C_BANNER_STRIPE);
    FillRect(dc, &stripe, b);
    DeleteObject(b);

    SetBkMode(dc, TRANSPARENT);
    HGDIOBJ old_font = SelectObject(dc, g_font_title);
    RECT t = {S(430), S(22), client.right - S(20), S(52)};
    banner_text(dc, L"Edycja fanowska", t, C_BANNER_TEXT);
    SelectObject(dc, g_font);
    RECT t2 = {S(430), S(56), client.right - S(20), S(76)};
    banner_text(dc, L"pełna wersja · 11 poziomów · Windows 10 i 11", t2, C_BANNER_DIM);
    RECT t3 = {S(430), S(76), client.right - S(20), S(96)};
    banner_text(dc, L"wersja " WERSJA, t3, C_BANNER_DIM);

    /* Podgląd poziomu */
    int level = selected_level();
    RECT pr = preview_rect();
    RECT frame = {pr.left - 1, pr.top - 1, pr.right + 1, pr.bottom + 1};
    b = CreateSolidBrush(RGB(0, 0, 0));
    FrameRect(dc, &frame, b);
    DeleteObject(b);
    if (level >= 0 && g_preview[level])
        draw_picture(dc, g_preview[level], pr.left, pr.top, pr.right - pr.left, pr.bottom - pr.top);
    else
        FillRect(dc, &pr, GetSysColorBrush(COLOR_3DSHADOW));

    /* Podpis pod podglądem */
    RECT cap = caption_rect();
    FillRect(dc, &cap, GetSysColorBrush(COLOR_BTNFACE));
    if (level >= 0) {
        wchar_t line[200];
        SelectObject(dc, g_font_bold);
        SetTextColor(dc, GetSysColor(COLOR_BTNTEXT));
        _snwprintf(line, 200, L"Poziom %d z %d: %s", level + 1, LEVELS, LEVEL_INFO[level].name);
        RECT r = cap;
        DrawTextW(dc, line, -1, &r, DT_LEFT | DT_VCENTER | DT_SINGLELINE | DT_NOPREFIX);
    }
    SelectObject(dc, old_font);
}

static void draw_list_item(const DRAWITEMSTRUCT *di)
{
    if ((int)di->itemID < 0)
        return;
    BOOL selected = (di->itemState & ODS_SELECTED) != 0;
    HDC dc = di->hDC;
    RECT r = di->rcItem;
    FillRect(dc, &r, GetSysColorBrush(selected ? COLOR_HIGHLIGHT : COLOR_WINDOW));
    SetBkMode(dc, TRANSPARENT);

    int i = (int)di->itemData;
    BOOL locked = i + 1 > g_unlocked;
    COLORREF text = GetSysColor(selected ? COLOR_HIGHLIGHTTEXT : (locked ? COLOR_GRAYTEXT : COLOR_WINDOWTEXT));
    COLORREF dim = selected ? GetSysColor(COLOR_HIGHLIGHTTEXT) : GetSysColor(COLOR_GRAYTEXT);

    wchar_t num[8];
    _snwprintf(num, 8, L"%d", i + 1);
    HGDIOBJ old = SelectObject(dc, g_font_number);
    SetTextColor(dc, selected ? GetSysColor(COLOR_HIGHLIGHTTEXT) : (locked ? dim : C_NUMBER));
    RECT rn = {r.left + S(4), r.top, r.left + S(36), r.bottom};
    DrawTextW(dc, num, -1, &rn, DT_CENTER | DT_VCENTER | DT_SINGLELINE);

    SelectObject(dc, g_font_bold);
    SetTextColor(dc, text);
    RECT rt = {r.left + S(42), r.top + S(2), r.right - S(4), r.top + (r.bottom - r.top) / 2 + S(1)};
    DrawTextW(dc, LEVEL_INFO[i].name, -1, &rt, DT_LEFT | DT_BOTTOM | DT_SINGLELINE | DT_END_ELLIPSIS | DT_NOPREFIX);
    SelectObject(dc, g_font_small);
    SetTextColor(dc, dim);
    RECT rw = {r.left + S(42), rt.bottom, r.right - S(4), r.bottom - S(2)};
    const wchar_t *sub = !g_level_file[i][0] ? L"brak pliku poziomu!"
                         : locked            ? L"jeszcze nieodblokowany"
                                             : LEVEL_INFO[i].world;
    DrawTextW(dc, sub, -1, &rw, DT_LEFT | DT_TOP | DT_SINGLELINE | DT_END_ELLIPSIS | DT_NOPREFIX);
    SelectObject(dc, old);

    if (di->itemState & ODS_FOCUS)
        DrawFocusRect(dc, &r);
}

/* ------------------------------------------------------------------------- */
/* Uruchamianie                                                              */
/* ------------------------------------------------------------------------- */

static DWORD WINAPI wait_thread(LPVOID param)
{
    HANDLE process = (HANDLE)param;
    WaitForSingleObject(process, INFINITE);
    CloseHandle(process);
    PostMessageW(g_wnd, WM_APP_GAME_ENDED, 0, 0);
    return 0;
}

static void show_error(const wchar_t *what, DWORD err)
{
    wchar_t sys[512] = L"", msg[1024];
    FormatMessageW(FORMAT_MESSAGE_FROM_SYSTEM | FORMAT_MESSAGE_IGNORE_INSERTS, NULL, err, 0, sys, 512, NULL);
    _snwprintf(msg, 1024, L"%s\n\n%s", what, sys);
    msg[1023] = 0;
    MessageBoxW(g_wnd, msg, L"Kubuś i Wehikuł Czasu", MB_ICONERROR);
}

/* Uruchamia program, chowa launcher do czasu jego zamknięcia */
static BOOL run_and_hide(const wchar_t *exe, const wchar_t *args, const wchar_t *dir)
{
    wchar_t cmd[MAX_PATH * 3];
    _snwprintf(cmd, MAX_PATH * 3, L"\"%s\" %s", exe, args ? args : L"");
    cmd[MAX_PATH * 3 - 1] = 0;
    STARTUPINFOW si = {sizeof si};
    PROCESS_INFORMATION pi;
    if (!CreateProcessW(exe, cmd, NULL, NULL, FALSE, 0, NULL, dir, &si, &pi)) {
        show_error(L"Nie udało się uruchomić gry.", GetLastError());
        return FALSE;
    }
    CloseHandle(pi.hThread);
    ShowWindow(g_wnd, SW_HIDE);
    HANDLE t = CreateThread(NULL, 0, wait_thread, pi.hProcess, 0, NULL);
    if (t)
        CloseHandle(t);
    else
        CloseHandle(pi.hProcess), ShowWindow(g_wnd, SW_SHOW);
    return TRUE;
}

/* Uruchamia instalator Shockwave i czeka na jego zakończenie */
static BOOL install_shockwave(void)
{
    wchar_t msi[MAX_PATH], params[MAX_PATH + 16];
    if (!find_msi(msi)) {
        MessageBoxW(g_wnd,
                    L"Nie znaleziono instalatora " MSI_NAME L".\n\n"
                    L"Skopiuj go do folderu z grą albo zainstaluj Adobe Shockwave Player 12 ręcznie.",
                    L"Kubuś i Wehikuł Czasu", MB_ICONWARNING);
        return FALSE;
    }
    _snwprintf(params, MAX_PATH + 16, L"/i \"%s\"", msi);
    params[MAX_PATH + 15] = 0;
    SHELLEXECUTEINFOW sei = {sizeof sei};
    sei.fMask = SEE_MASK_NOCLOSEPROCESS;
    sei.hwnd = g_wnd;
    sei.lpFile = L"msiexec.exe";
    sei.lpParameters = params;
    sei.nShow = SW_SHOWNORMAL;
    if (!ShellExecuteExW(&sei)) {
        show_error(L"Nie udało się uruchomić instalatora Shockwave.", GetLastError());
        return FALSE;
    }
    if (sei.hProcess) {
        EnableWindow(g_wnd, FALSE);
        /* czekamy, ale okno ma się odrysowywać */
        while (MsgWaitForMultipleObjects(1, &sei.hProcess, FALSE, INFINITE, QS_ALLINPUT) != WAIT_OBJECT_0) {
            MSG m;
            while (PeekMessageW(&m, NULL, 0, 0, PM_REMOVE)) {
                TranslateMessage(&m);
                DispatchMessageW(&m);
            }
        }
        CloseHandle(sei.hProcess);
        EnableWindow(g_wnd, TRUE);
        SetForegroundWindow(g_wnd);
    }
    update_status();
    return g_has_shockwave;
}

static void play(void)
{
    int level = selected_level();
    if (level < 0 || !g_game_dir[0])
        return;
    if (!g_level_file[level][0]) {
        MessageBoxW(g_wnd, L"Brakuje pliku tego poziomu w folderze z grą.", L"Kubuś i Wehikuł Czasu", MB_ICONWARNING);
        return;
    }
    if (!detect_shockwave()) {
        int answer = MessageBoxW(g_wnd,
                                 L"Pełna wersja wymaga programu Adobe Shockwave Player 12 "
                                 L"(zawiera wtyczki Shockwave 3D i Flash, których używają poziomy).\n\n"
                                 L"Zainstalować go teraz z dołączonego pliku?",
                                 L"Kubuś i Wehikuł Czasu", MB_ICONQUESTION | MB_YESNO);
        if (answer != IDYES || !install_shockwave())
            return;
    }
    save_settings();
    int tempo = tempo_value();
    set_tempo_value(tempo);
    pref_write(PREF_TEMPO, tempo);

    BOOL full = Button_GetCheck(g_fullscreen) == BST_CHECKED;
    wchar_t exe[MAX_PATH], args[MAX_PATH * 2];
    join(exe, g_game_dir, full ? L"SPRS.exe" : L"SPR.exe");
    _snwprintf(args, MAX_PATH * 2, L"\"%s\"%s%s", g_level_file[level],
               Button_GetCheck(g_nodx7) == BST_CHECKED ? L" " FLAG_NO_DX7 : L"",
               Button_GetCheck(g_baddriver) == BST_CHECKED ? L" " FLAG_BAD_DRIVER : L"");
    args[MAX_PATH * 2 - 1] = 0;
    run_and_hide(exe, args, g_game_dir);
}

static void play_demo(void)
{
    if (!g_demo_exe[0])
        return;
    save_settings();
    wchar_t dir[MAX_PATH];
    lstrcpynW(dir, g_demo_exe, MAX_PATH);
    wchar_t *slash = wcsrchr(dir, L'\\');
    if (slash)
        *slash = 0;
    run_and_hide(g_demo_exe, NULL, dir);
}

/* Po zamknięciu gry: nowe poziomy odblokowane przez grę i tempo zmienione klawiszami */
static void game_ended(void)
{
    int before = g_unlocked;
    g_unlocked = read_unlocked();
    int select = selected_level();
    if (g_unlocked > before)
        select = (g_unlocked > LEVELS ? LEVELS : g_unlocked) - 1;
    fill_list(select);
    set_tempo_value(read_tempo());
}

static void open_help(void)
{
    static const wchar_t *docs[] = {L"README.txt", L"..\\README.txt", L"..\\docs\\README.txt"};
    for (int i = 0; i < (int)(sizeof docs / sizeof *docs); i++) {
        wchar_t p[MAX_PATH];
        join(p, g_exe_dir, docs[i]);
        if (file_exists(p)) {
            if ((INT_PTR)ShellExecuteW(g_wnd, L"open", p, NULL, NULL, SW_SHOWNORMAL) > 32)
                return;
            ShellExecuteW(g_wnd, NULL, L"notepad.exe", p, NULL, SW_SHOWNORMAL);
            return;
        }
    }
    ShellExecuteW(g_wnd, L"open", REPO_URL, NULL, NULL, SW_SHOWNORMAL);
}

/* ------------------------------------------------------------------------- */
/* Okno                                                                      */
/* ------------------------------------------------------------------------- */

static LRESULT CALLBACK wnd_proc(HWND wnd, UINT msg, WPARAM wp, LPARAM lp)
{
    switch (msg) {
    case WM_CREATE:
        g_wnd = wnd;
        create_controls(wnd);
        return 0;

    case WM_MEASUREITEM: {
        MEASUREITEMSTRUCT *mi = (MEASUREITEMSTRUCT *)lp;
        if (mi->CtlID == IDC_LIST) {
            mi->itemHeight = S((LIST_H - 4) / LEVELS);
            return TRUE;
        }
        break;
    }

    case WM_DRAWITEM: {
        const DRAWITEMSTRUCT *di = (const DRAWITEMSTRUCT *)lp;
        if (di->CtlID == IDC_LIST) {
            draw_list_item(di);
            return TRUE;
        }
        break;
    }

    case WM_CTLCOLORSTATIC:
        SetBkColor((HDC)wp, GetSysColor(COLOR_BTNFACE));
        if ((HWND)lp == g_status)
            SetTextColor((HDC)wp, g_has_shockwave ? RGB(0, 120, 40) : RGB(180, 60, 0));
        else if ((HWND)lp == g_tempo_hint)
            SetTextColor((HDC)wp, GetSysColor(COLOR_GRAYTEXT));
        return (LRESULT)GetSysColorBrush(COLOR_BTNFACE);

    case WM_COMMAND:
        switch (LOWORD(wp)) {
        case IDC_LIST:
            if (HIWORD(wp) == LBN_SELCHANGE)
                invalidate_preview();
            else if (HIWORD(wp) == LBN_DBLCLK)
                play();
            return 0;
        case IDC_SHOW_ALL:
            fill_list(selected_level());
            return 0;
        case IDC_TEMPO:
            if (HIWORD(wp) == EN_KILLFOCUS)
                set_tempo_value(tempo_value());
            return 0;
        case IDC_PLAY:
        case IDOK:
            play();
            return 0;
        case IDC_DEMO:
            play_demo();
            return 0;
        case IDC_INSTALL_SW:
            install_shockwave();
            return 0;
        case IDC_INSTRUKCJA:
            open_help();
            return 0;
        case IDC_EXIT:
        case IDCANCEL:
            DestroyWindow(wnd);
            return 0;
        }
        break;

    case WM_APP_GAME_ENDED:
        game_ended();
        ShowWindow(wnd, SW_SHOW);
        SetForegroundWindow(wnd);
        SetFocus(g_play);
        return 0;

    case WM_ERASEBKGND:
        return 1;

    case WM_PAINT: {
        PAINTSTRUCT ps;
        HDC dc = BeginPaint(wnd, &ps);
        RECT rc;
        GetClientRect(wnd, &rc);
        /* podwójne buforowanie - bez migotania przy zmianie poziomu */
        HDC mem = CreateCompatibleDC(dc);
        HBITMAP bmp = CreateCompatibleBitmap(dc, rc.right, rc.bottom);
        HGDIOBJ old = SelectObject(mem, bmp);
        FillRect(mem, &rc, GetSysColorBrush(COLOR_BTNFACE));
        paint(wnd, mem);
        BitBlt(dc, ps.rcPaint.left, ps.rcPaint.top, ps.rcPaint.right - ps.rcPaint.left,
               ps.rcPaint.bottom - ps.rcPaint.top, mem, ps.rcPaint.left, ps.rcPaint.top, SRCCOPY);
        SelectObject(mem, old);
        DeleteObject(bmp);
        DeleteDC(mem);
        EndPaint(wnd, &ps);
        return 0;
    }

    case WM_SYSCOLORCHANGE:
        InvalidateRect(wnd, NULL, TRUE);
        break;

    case WM_DESTROY:
        save_settings();
        PostQuitMessage(0);
        return 0;
    }
    return DefWindowProcW(wnd, msg, wp, lp);
}

int WINAPI wWinMain(HINSTANCE inst, HINSTANCE prev, LPWSTR cmdline, int show)
{
    (void)prev;
    (void)cmdline;
    g_inst = inst;

    /* Manifest deklaruje DPI-awareness; to jest zapas */
    HMODULE user32 = GetModuleHandleW(L"user32.dll");
    BOOL(WINAPI * set_dpi_aware)(void) = (BOOL(WINAPI *)(void))GetProcAddress(user32, "SetProcessDPIAware");
    if (set_dpi_aware)
        set_dpi_aware();

    INITCOMMONCONTROLSEX icc = {sizeof icc, ICC_STANDARD_CLASSES | ICC_UPDOWN_CLASS};
    InitCommonControlsEx(&icc);
    OleInitialize(NULL);

    HDC screen = GetDC(NULL);
    g_dpi = GetDeviceCaps(screen, LOGPIXELSY);
    ReleaseDC(NULL, screen);

    find_paths();

    g_font = make_font(9, FW_NORMAL);
    g_font_bold = make_font(10, FW_BOLD);
    g_font_small = make_font(8, FW_NORMAL);
    g_font_big = make_font(18, FW_BOLD);
    g_font_number = make_font(15, FW_NORMAL);
    g_font_title = make_font(16, FW_NORMAL);

    g_banner = load_jpeg(IDR_BANNER);
    for (int i = 0; i < LEVELS; i++)
        g_preview[i] = load_jpeg(IDR_LEVEL1 + i);

    WNDCLASSEXW wc = {sizeof wc};
    wc.lpfnWndProc = wnd_proc;
    wc.hInstance = inst;
    wc.hIcon = LoadIconW(inst, MAKEINTRESOURCEW(IDI_KUBUS));
    wc.hIconSm = (HICON)LoadImageW(inst, MAKEINTRESOURCEW(IDI_KUBUS), IMAGE_ICON,
                                   GetSystemMetrics(SM_CXSMICON), GetSystemMetrics(SM_CYSMICON), 0);
    wc.hCursor = LoadCursorW(NULL, (LPCWSTR)IDC_ARROW);
    wc.hbrBackground = (HBRUSH)(COLOR_BTNFACE + 1);
    wc.lpszClassName = L"KubusLauncher";
    RegisterClassExW(&wc);

    DWORD style = WS_OVERLAPPED | WS_CAPTION | WS_SYSMENU | WS_MINIMIZEBOX | WS_CLIPCHILDREN;
    RECT r = {0, 0, S(CLIENT_W), S(CLIENT_H)};
    AdjustWindowRect(&r, style, FALSE);
    int w = r.right - r.left, h = r.bottom - r.top;
    RECT work;
    SystemParametersInfoW(SPI_GETWORKAREA, 0, &work, 0);
    HWND wnd = CreateWindowExW(0, wc.lpszClassName, L"Kubuś i Wehikuł Czasu", style,
                               work.left + (work.right - work.left - w) / 2,
                               work.top + (work.bottom - work.top - h) / 2, w, h,
                               NULL, NULL, inst, NULL);
    if (!wnd)
        return 1;
    ShowWindow(wnd, show);
    UpdateWindow(wnd);
    SetFocus(g_list);

    if (!g_game_dir[0])
        MessageBoxW(wnd,
                    L"Nie znaleziono plików gry.\n\n"
                    L"Launcher musi leżeć w tym samym folderze co SPR.exe i pliki poziomów (*.dcr) "
                    L"albo obok podfolderu „dane” z tymi plikami.",
                    L"Kubuś i Wehikuł Czasu", MB_ICONWARNING);

    MSG m;
    while (GetMessageW(&m, NULL, 0, 0) > 0) {
        if (IsDialogMessageW(wnd, &m))
            continue;
        TranslateMessage(&m);
        DispatchMessageW(&m);
    }

    for (int i = 0; i < LEVELS; i++)
        if (g_preview[i])
            IPicture_Release(g_preview[i]);
    if (g_banner)
        IPicture_Release(g_banner);
    OleUninitialize();
    return 0;
}
