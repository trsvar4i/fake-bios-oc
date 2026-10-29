// Полноэкранные панели: «Гнездо» (все программы по разделам) и «Бросок» (командная палитра: программы,
// файлы, настройки и действия системы), а также «О программе», приветствие, сочетания клавиш, «Все окна».
import { useEffect, useMemo, useState } from "react";
import { useLang } from "../machine/store";
import { isAvailable, useOs } from "./osStore";
import { APP_META } from "./apps/meta";
import { AppIcon, OsLogo } from "./AppIcon";
import { osPower } from "./power";
import { WALLPAPERS } from "./wallpapers";
import { usePresence } from "./util";
import { HOME, nameOf, parentOf, useFs } from "./fs";
import { openPath } from "./apps/Finder";
import { cmd, switcherCommit } from "./commands";
import { WallpaperArt } from "./Wallpaper";

const GROUPS: { id: "work" | "create" | "system"; en: string; ru: string }[] = [
  { id: "work", en: "Everyday", ru: "На каждый день" },
  { id: "create", en: "Create & Play", ru: "Творчество" },
  { id: "system", en: "System", ru: "Система" },
];

/** «Гнездо»: все программы по разделам, поиск, учётная запись и питание. */
export function Nest() {
  const os = useOs();
  const { lang, t } = useLang();
  const [q, setQ] = useState("");
  const { mounted, closing } = usePresence(os.panel === "nest", 300);
  useEffect(() => { if (os.panel === "nest") setQ(""); }, [os.panel]);
  if (!mounted) return null;

  const s = q.trim().toLowerCase();
  const apps = Object.values(APP_META).filter((m) => !m.hidden && isAvailable(m.id) && (m.title.en.toLowerCase().includes(s) || m.title.ru.toLowerCase().includes(s)));
  let n = 0;
  const power: [string, string, () => void, React.ReactNode][] = [
    ["lock", t("Lock", "Заблокировать"), osPower.lock, <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>],
    ["sleep", t("Sleep", "Сон"), osPower.sleep, <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />],
    ["bios", t("Restart to BIOS", "Перезагрузить в BIOS"), osPower.restartToFirmware, <><rect x="6" y="6" width="12" height="12" rx="1.5" /><path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3" /></>],
    ["restart", t("Restart", "Перезагрузить"), osPower.restart, <><path d="M20 12a8 8 0 1 1-2.3-5.6" /><path d="M20 4v4.5h-4.5" /></>],
    ["off", t("Shut Down", "Выключить"), osPower.shutdown, <path d="M12 3v8M6.5 6.5a8 8 0 1 0 11 0" />],
  ];
  return (
    <div className={"nest" + (closing ? " closing" : "")} onPointerDown={() => os.dismiss()}>
      <div className="nest-sheet" onPointerDown={(e) => e.stopPropagation()}>
        <div className="nest-search">
          <svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5l5 5" /></svg>
          <input
            autoFocus value={q} placeholder={t("Find an app", "Найти программу")}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && apps[0]) os.open(apps[0].id); }}
          />
          <kbd>Alt+L</kbd>
        </div>
        <div className="nest-groups">
          {GROUPS.map((g) => {
            const list = apps.filter((m) => (m.group ?? "work") === g.id);
            if (!list.length) return null;
            return (
              <section key={g.id} className="nest-group">
                <h3>{t(g.en, g.ru)}</h3>
                <div className="nest-grid">
                  {list.map((m) => (
                    <button key={m.id} className="nest-app" style={{ animationDelay: `${60 + n++ * 16}ms` }} onClick={() => os.open(m.id)}>
                      <AppIcon name={m.icon} size={84} />
                      <span>{m.title[lang]}</span>
                    </button>
                  ))}
                </div>
              </section>
            );
          })}
          {!apps.length && <div className="nest-none">{t("Nothing found", "Ничего не найдено")}</div>}
        </div>
        <footer className="nest-foot">
          <button className="nest-user" onClick={() => os.open("settings")}>
            <span className="avatar">{os.prefs.userName.slice(0, 1).toUpperCase()}</span>
            <span><b>{os.prefs.userName}</b><small>{os.prefs.hostName}</small></span>
          </button>
          <div className="nest-power">
            {power.map(([id, label, run, icon]) => (
              <button key={id} className={"np-btn " + id} onClick={() => { os.dismiss(); run(); }} aria-label={label}>
                <svg viewBox="0 0 24 24">{icon}</svg>
                <span className="np-tip">{label}</span>
              </button>
            ))}
          </div>
        </footer>
      </div>
    </div>
  );
}

interface Result { id: string; group: string; title: string; sub?: string; icon?: string; glyph?: React.ReactNode; keys?: string; run: () => void }

/** Безопасный калькулятор: только цифры, скобки и + − × ÷. */
function calc(q: string): string | null {
  const expr = q.replace(/×/g, "*").replace(/÷/g, "/").replace(/,/g, ".").replace(/\s/g, "");
  if (!/^[\d.+\-*/()]+$/.test(expr) || !/\d[+\-*/]/.test(expr)) return null;
  try {
    const v = Function(`"use strict";return (${expr})`)() as number;
    return Number.isFinite(v) ? String(Math.round(v * 1e10) / 1e10) : null;
  } catch {
    return null;
  }
}

const G = (d: React.ReactNode) => <svg viewBox="0 0 24 24">{d}</svg>;

/** «Бросок» (Alt+Space / Ctrl+Space): программы, файлы, вычисления, настройки и действия системы. */
export function Swoop() {
  const os = useOs();
  const { lang, t } = useLang();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const open = os.panel === "swoop";
  const { mounted, closing } = usePresence(open, 200);
  useEffect(() => { if (open) { setQ(""); setSel(0); } }, [open]);

  const results = useMemo<Result[]>(() => {
    const s = q.trim().toLowerCase();
    const out: Result[] = [];
    const A = t("Apps", "Программы"), F = t("Files", "Файлы"), C = t("Commands", "Команды");
    const apps = Object.values(APP_META).filter((m) => !m.hidden && isAvailable(m.id));
    if (!s) {
      // без запроса — недавние программы и закреплённые
      const recent = [...new Set([...os.windows].sort((a, b) => b.z - a.z).map((w) => w.app))].filter((a) => APP_META[a] && !APP_META[a].hidden);
      for (const id of [...recent, ...os.prefs.dock.filter((a) => !recent.includes(a))].slice(0, 5)) {
        const m = APP_META[id];
        out.push({ id, group: recent.includes(id) ? t("Recent", "Недавние") : A, title: m.title[lang], icon: m.icon, run: () => os.open(id) });
      }
    }
    const value = s ? calc(s) : null;
    if (value !== null) out.push({ id: "calc", group: t("Result", "Результат"), title: `= ${value}`, sub: t("Enter copies", "Enter — скопировать"), glyph: "=", run: () => void navigator.clipboard?.writeText(value) });
    if (s) {
      for (const m of apps)
        if (m.title.en.toLowerCase().includes(s) || m.title.ru.toLowerCase().includes(s))
          out.push({ id: m.id, group: A, title: m.title[lang], icon: m.icon, run: () => os.open(m.id) });
      let files = 0;
      for (const path of Object.keys(useFs.getState().nodes)) {
        if (files >= 4 || path === HOME || path.includes("/.Trash") || !nameOf(path).toLowerCase().includes(s)) continue;
        const dir = useFs.getState().isDir(path);
        files++;
        out.push({ id: path, group: F, title: nameOf(path), sub: parentOf(path).replace(HOME, "~"), icon: dir ? "folder" : "file", run: () => openPath(path) });
      }
      for (const [id, w] of Object.entries(WALLPAPERS)) {
        const name = w.name[lang];
        if (name.toLowerCase().includes(s) || t("wallpaper", "обои").startsWith(s))
          out.push({ id: "wp-" + id, group: C, title: t(`Wallpaper “${name}”`, `Обои «${name}»`), glyph: G(<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 16l5-5 4 4 3-3 6 6" /></>), run: () => os.setPref("wallpaper", id) });
      }
    }
    const light = os.prefs.theme === "light";
    const actions: [string[], string, () => void, React.ReactNode, string?][] = [
      [["theme", "dark", "light", "тема", "тёмн", "светл"], light ? t("Switch to dark theme", "Тёмная тема") : t("Switch to light theme", "Светлая тема"), () => os.setPref("theme", light ? "dark" : "light"), <path d="M12 3a9 9 0 1 0 0 18zM12 3a9 9 0 0 1 0 18" />],
      [["night", "warm", "ночн", "тёпл"], t("Night Light", "Ночной свет") + (os.prefs.nightLight ? t(" — turn off", " — выключить") : ""), () => os.setPref("nightLight", !os.prefs.nightLight), <circle cx="12" cy="12" r="4" />],
      [["focus", "disturb", "dnd", "беспоко"], t("Do Not Disturb", "Не беспокоить") + (os.dnd ? t(" — turn off", " — выключить") : ""), () => useOs.setState({ dnd: !useOs.getState().dnd }), <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />],
      [["window", "all", "окна", "обзор"], t("All windows", "Все окна"), () => os.setPanel("overview"), <><rect x="3.5" y="5" width="7.5" height="6" rx="1.6" /><rect x="13" y="5" width="7.5" height="6" rx="1.6" /><rect x="3.5" y="13" width="7.5" height="6" rx="1.6" /><rect x="13" y="13" width="7.5" height="6" rx="1.6" /></>, "Alt+↑"],
      [["desktop", "space", "стол"], t("New desktop", "Новый рабочий стол"), () => os.addSpace(), <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M12 9v6M9 12h6" /></>],
      [["show", "minimize", "рабочий", "свернуть"], t("Show desktop", "Показать рабочий стол"), cmd.showDesktop, <path d="M4 19h16M7 15l5-5 5 5" />, "Alt+D"],
      [["widget", "виджет"], t("Edit widgets", "Изменить виджеты"), () => os.setPanel("widgets"), <><rect x="4" y="4" width="7" height="7" rx="2" /><rect x="13" y="4" width="7" height="7" rx="2" /><rect x="4" y="13" width="16" height="7" rx="2" /></>],
      [["key", "shortcut", "клавиш", "сочетан"], t("Keyboard shortcuts", "Сочетания клавиш"), () => os.setPanel("shortcuts"), <><rect x="3" y="7" width="18" height="10" rx="2" /><path d="M8 14h8" /></>],
      [["lock", "блок"], t("Lock screen", "Заблокировать экран"), osPower.lock, <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>],
      [["bios", "uefi", "firmware", "прошив"], t("Restart to UEFI (BIOS)", "Перезагрузить в UEFI (BIOS)"), osPower.restartToFirmware, <rect x="6" y="6" width="12" height="12" rx="1.5" />],
      [["restart", "reboot", "перезагр"], t("Restart", "Перезагрузить"), osPower.restart, <><path d="M20 12a8 8 0 1 1-2.3-5.6" /><path d="M20 4v4.5h-4.5" /></>],
      [["shut", "power", "off", "выключ"], t("Shut down", "Выключить"), osPower.shutdown, <path d="M12 3v8M6.5 6.5a8 8 0 1 0 11 0" />],
    ];
    for (const [keys, title, run, glyph, k] of actions)
      if (s ? keys.some((key) => key.startsWith(s) || (s.length > 3 && s.startsWith(key))) || title.toLowerCase().includes(s) : ["window", "theme", "lock"].includes(keys[0]))
        out.push({ id: "act-" + keys[0], group: C, title, glyph: G(glyph), keys: k, run });
    return out.slice(0, 10);
  }, [q, lang, os.prefs.theme, os.prefs.nightLight, os.dnd]);

  if (!mounted) return null;
  const run = (r?: Result) => { if (!r) return; os.dismiss(); r.run(); };

  return (
    <div className={"swoop-wrap" + (closing ? " closing" : "")} onPointerDown={() => os.dismiss()}>
      <div className="swoop" onPointerDown={(e) => e.stopPropagation()}>
        <div className="swoop-field">
          <OsLogo size={30} mono />
          <input
            autoFocus
            value={q}
            placeholder={t("Search apps, files and commands", "Программы, файлы и команды")}
            onChange={(e) => { setQ(e.target.value); setSel(0); }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setSel((i) => Math.min(results.length - 1, i + 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setSel((i) => Math.max(0, i - 1)); }
              if (e.key === "Enter") run(results[sel]);
            }}
          />
          <kbd>Esc</kbd>
        </div>
        {results.length > 0 && (
          <div className="swoop-results">
            {results.map((r, i) => (
              <div key={r.id + i}>
                {(i === 0 || results[i - 1].group !== r.group) && <div className="sw-group">{r.group}</div>}
                <button className={"sw-row" + (i === sel ? " sel" : "")} onPointerEnter={() => setSel(i)} onClick={() => run(r)}>
                  {r.icon ? <AppIcon name={r.icon} size={34} /> : <span className="sw-glyph">{r.glyph}</span>}
                  <span className="sw-title">{r.title}</span>
                  {r.sub && <span className="sw-sub">{r.sub}</span>}
                  {r.keys && <kbd>{r.keys}</kbd>}
                  <span className="sw-enter">↵</span>
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="swoop-foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> {t("move", "выбор")}</span>
          <span><kbd>Enter</kbd> {t("open", "открыть")}</span>
          <span className="sf-brand">Swoop</span>
        </div>
      </div>
    </div>
  );
}

/** «О программе»: иконка, название, версия. */
export function AboutPanel() {
  const os = useOs();
  const { lang, t } = useLang();
  const { mounted, closing } = usePresence(os.panel === "about", 200);
  if (!mounted || !os.aboutApp) return null;
  const meta = APP_META[os.aboutApp];
  return (
    <div className={"modal-backdrop" + (closing ? " closing" : "")} onPointerDown={() => os.dismiss()}>
      <div className="about-app" onPointerDown={(e) => e.stopPropagation()}>
        {meta ? <AppIcon name={meta.icon} size={110} /> : <OsLogo size={110} />}
        <h2>{meta ? meta.title[lang] : "Kestrel OS"}</h2>
        <div className="about-ver">{t("Version", "Версия")} 2.0 (2610)</div>
        <div className="about-foot">© 2026 Kestrel Systems</div>
        <button className="set-btn" onClick={() => os.dismiss()}>OK</button>
      </div>
    </div>
  );
}

/** Приветствие при первом входе: что умеет система и куда нажать дальше. */
export function WelcomePanel() {
  const os = useOs();
  const { t } = useLang();
  const { mounted, closing } = usePresence(os.panel === "welcome", 220);
  if (!mounted) return null;
  const close = () => { os.setPref("welcomed", true); os.dismiss(); };
  const go = (fn: () => void) => () => { close(); fn(); };
  const tips: [string, string, string, () => void][] = [
    ["appstore", t("Get apps", "Установите программы"), t("Paint, Music and Preview are one click away in the Store.", "Рисовалка, Музыка и Просмотр — в Магазине, одной кнопкой."), () => os.open("appstore")],
    ["taskmgr", t("Watch the hardware", "Следите за железом"), t("Run `stress` in Terminal and watch temperature and fans react.", "Наберите `stress` в Терминале — температура и вентиляторы отзовутся."), () => os.open("terminal")],
    ["quests", t("Take the challenges", "Пройдите испытания"), t("Overclock to 5 GHz, boot Live Linux, flash the BIOS — collect them all.", "Разгон до 5 ГГц, Live Linux, прошивка BIOS — соберите все."), () => os.open("quests")],
    ["settings", t("Make it yours", "Под себя"), t("Wallpaper, light theme, users. Alt+Space finds anything.", "Обои, светлая тема, пользователи. Alt+Space найдёт что угодно."), () => os.open("settings")],
  ];
  return (
    <div className={"modal-backdrop" + (closing ? " closing" : "")} onPointerDown={close}>
      <div className="about-app welcome" onPointerDown={(e) => e.stopPropagation()}>
        <OsLogo size={84} />
        <h2>{t(`Welcome, ${os.prefs.userName}`, `Добро пожаловать, ${os.prefs.userName}`)}</h2>
        <div className="about-ver">{t("Kestrel OS — Linux for people", "Kestrel OS — Linux для людей")}</div>
        <div className="welcome-tips">
          {tips.map(([icon, title, text, run]) => (
            <button key={title} className="welcome-tip" onClick={go(run)}>
              <AppIcon name={icon} size={46} />
              <span><b>{title}</b><small>{text}</small></span>
            </button>
          ))}
        </div>
        <button className="set-btn primary" onClick={close}>{t("Let's go", "Поехали")}</button>
      </div>
    </div>
  );
}

/** Справка: сочетания клавиш (клавиатура ПК). */
export function ShortcutsPanel() {
  const os = useOs();
  const { t } = useLang();
  const { mounted, closing } = usePresence(os.panel === "shortcuts", 200);
  if (!mounted) return null;
  const rows: [string, string][] = [
    ["Alt+Space", t("Swoop: search and commands", "«Бросок»: поиск и команды")],
    ["Alt+L", t("All apps (Nest)", "Все программы («Гнездо»)")],
    ["Alt+H", t("Hub: notifications and quick settings", "«Хаб»: уведомления и быстрые настройки")],
    ["Alt+`", t("Switch apps (hold Alt)", "Переключить программу (держать Alt)")],
    ["Alt+↑", t("All windows", "Все окна")],
    ["Alt+← / →", t("Previous / next desktop", "Предыдущий / следующий рабочий стол")],
    ["Alt+1…6", t("Go to desktop", "Перейти на рабочий стол")],
    ["Alt+D", t("Show desktop", "Показать рабочий стол")],
    ["Alt+N", t("New window", "Новое окно")],
    ["Shift+Alt+N", t("New folder", "Новая папка")],
    ["Alt+Enter", t("Full size", "Во весь экран")],
    ["Alt+M", t("Minimize", "Свернуть")],
    ["Alt+W", t("Close window", "Закрыть окно")],
    ["Alt+Q", t("Quit app", "Завершить программу")],
    ["Alt+,", t("Settings", "Настройки")],
    ["Ctrl+C / V / X / Z", t("Copy, paste, cut, undo", "Копировать, вставить, вырезать, отменить")],
    ["Esc", t("Close menus and panels", "Закрыть меню и панели")],
  ];
  return (
    <div className={"modal-backdrop" + (closing ? " closing" : "")} onPointerDown={() => os.dismiss()}>
      <div className="about-app keys" onPointerDown={(e) => e.stopPropagation()}>
        <h2>{t("Keyboard Shortcuts", "Сочетания клавиш")}</h2>
        <div className="about-ver">{t("Double-click a title bar to make a window full size", "Двойной щелчок по заголовку разворачивает окно")}</div>
        <table className="keys-table"><tbody>{rows.map(([k, v]) => <tr key={k}><td><kbd>{k}</kbd></td><td>{v}</td></tr>)}</tbody></table>
        <button className="set-btn primary" onClick={() => os.dismiss()}>OK</button>
      </div>
    </div>
  );
}

/** Фон режима «Все окна»: затемнение, полоса рабочих столов и подсказка; щелчок по пустому месту — выход. */
export function OverviewBackdrop() {
  const os = useOs();
  const { t } = useLang();
  const { mounted, closing } = usePresence(os.panel === "overview", 420);
  if (!mounted) return null;
  const none = !os.windows.some((w) => !w.min && w.phase !== "closing" && w.space === os.space);
  return (
    <div className={"ov-backdrop" + (closing ? " closing" : "")} onPointerDown={(e) => { e.stopPropagation(); os.dismiss(); }}>
      <div className="ov-spaces" onPointerDown={(e) => e.stopPropagation()}>
        {Array.from({ length: os.spaces }, (_, i) => {
          const n = os.windows.filter((w) => w.space === i && w.phase !== "closing").length;
          return (
            <div key={i} className={"ov-space" + (i === os.space ? " on" : "")} style={{ animationDelay: `${i * 40}ms` }} onClick={() => os.goSpace(i)}>
              <WallpaperArt id={os.prefs.wallpaper} />
              <span>{t(`Desktop ${i + 1}`, `Стол ${i + 1}`)}{n ? ` · ${n}` : ""}</span>
              {os.spaces > 1 && <button className="ov-space-x" onClick={(e) => { e.stopPropagation(); os.removeSpace(i); }} aria-label="Remove">×</button>}
            </div>
          );
        })}
        {os.spaces < 6 && <button className="ov-space add" onClick={os.addSpace} title={t("New Desktop", "Новый рабочий стол")}>+</button>}
      </div>
      <div className="ov-hint">{none ? t("No open windows", "Открытых окон нет") : t("Click a window to bring it forward", "Щёлкните окно, чтобы перейти к нему")}</div>
    </div>
  );
}

/** Переключатель программ: Alt+` по кругу, отпустить Alt — перейти. */
export function AppSwitcher() {
  const sw = useOs((s) => s.switcher);
  const windows = useOs((s) => s.windows);
  const { lang, t } = useLang();
  if (!sw) return null;
  return (
    <div className="switcher" onPointerDown={(e) => e.stopPropagation()}>
      {sw.apps.map((app, i) => {
        const n = windows.filter((w) => w.app === app && w.phase !== "closing").length;
        return (
          <button key={app} className={"sw-app" + (i === sw.i ? " on" : "")} onPointerEnter={() => useOs.setState({ switcher: { ...sw, i } })} onClick={() => switcherCommit(app)}>
            <AppIcon name={APP_META[app].icon} size={88} />
            <span>{APP_META[app].title[lang]}</span>
            <small>{n > 1 ? t(`${n} windows`, `окон: ${n}`) : " "}</small>
          </button>
        );
      })}
    </div>
  );
}
