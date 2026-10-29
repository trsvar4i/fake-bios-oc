// Полноэкранные панели: Launchpad (все приложения) и Spotlight (поиск и быстрые действия).
import { useEffect, useMemo, useState } from "react";
import { useLang } from "../machine/store";
import { useOs } from "./osStore";
import { APP_META } from "./apps/meta";
import { AppIcon } from "./AppIcon";
import { osPower } from "./power";
import { WALLPAPERS } from "./wallpapers";
import { usePresence } from "./util";
import { HOME, nameOf, parentOf, useFs } from "./fs";
import { openPath } from "./apps/Finder";
import { switcherCommit } from "./commands";
import { OsLogo } from "./AppIcon";

export function Launchpad() {
  const os = useOs();
  const { lang, t } = useLang();
  const [q, setQ] = useState("");
  const { mounted, closing } = usePresence(os.panel === "launchpad", 260);
  useEffect(() => { if (os.panel === "launchpad") setQ(""); }, [os.panel]);
  if (!mounted) return null;

  const apps = Object.values(APP_META).filter((m) => !m.hidden && m.title[lang].toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div className={"launchpad" + (closing ? " closing" : "")} onPointerDown={() => os.dismiss()}>
      <input
        className="lp-search"
        autoFocus
        value={q}
        placeholder={t("Search", "Поиск")}
        onPointerDown={(e) => e.stopPropagation()}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && apps[0]) os.open(apps[0].id); }}
      />
      <div className="lp-grid">
        {apps.map((m, i) => (
          <button key={m.id} className="lp-app" style={{ animationDelay: `${i * 18}ms` }} onPointerDown={(e) => e.stopPropagation()} onClick={() => os.open(m.id)}>
            <AppIcon name={m.icon} size={128} />
            <span>{m.title[lang]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

interface Result { id: string; title: string; sub: string; icon?: string; glyph?: string; run: () => void }

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

export function Spotlight() {
  const os = useOs();
  const { lang, t } = useLang();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const open = os.panel === "spotlight";
  const { mounted, closing } = usePresence(open, 180);
  useEffect(() => { if (open) { setQ(""); setSel(0); } }, [open]);

  const results = useMemo<Result[]>(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    const out: Result[] = [];
    const value = calc(s);
    if (value !== null) out.push({ id: "calc", title: value, sub: t("Calculator", "Калькулятор"), glyph: "=", run: () => void navigator.clipboard?.writeText(value) });
    for (const m of Object.values(APP_META)) {
      if (!m.hidden && (m.title.en.toLowerCase().includes(s) || m.title.ru.toLowerCase().includes(s)))
        out.push({ id: m.id, title: m.title[lang], sub: t("Application", "Программа"), icon: m.icon, run: () => os.open(m.id) });
    }
    // файлы и папки пользователя (без Корзины)
    for (const path of Object.keys(useFs.getState().nodes)) {
      if (path === HOME || path.includes("/.Trash") || !nameOf(path).toLowerCase().includes(s)) continue;
      const dir = useFs.getState().isDir(path);
      out.push({ id: path, title: nameOf(path), sub: parentOf(path).replace(HOME, "~"), icon: dir ? "folder" : "file", run: () => openPath(path) });
    }
    for (const [id, w] of Object.entries(WALLPAPERS)) {
      const name = w.name[lang];
      if (name.toLowerCase().includes(s) || t("wallpaper", "обои").startsWith(s))
        out.push({ id: "wp-" + id, title: t(`Wallpaper “${name}”`, `Обои «${name}»`), sub: t("Change wallpaper", "Сменить обои"), glyph: "◐", run: () => os.setPref("wallpaper", id) });
    }
    const actions: [string[], string, () => void][] = [
      [["restart", "перезагр"], t("Restart", "Перезагрузить"), osPower.restart],
      [["shut", "выключ"], t("Shut Down", "Выключить"), osPower.shutdown],
      [["lock", "блок"], t("Lock Screen", "Заблокировать экран"), osPower.lock],
      [["bios", "uefi"], t("Restart to UEFI (BIOS)", "Перезагрузить в UEFI (BIOS)"), osPower.restartToFirmware],
      [["focus", "disturb", "фокус", "беспоко"], t("Do Not Disturb", "Не беспокоить"), () => useOs.setState({ dnd: !useOs.getState().dnd })],
    ];
    for (const [keys, title, run] of actions)
      if (keys.some((k) => s.includes(k) || k.startsWith(s))) out.push({ id: "act-" + title, title, sub: t("System action", "Действие системы"), glyph: "⏻", run });
    return out.slice(0, 8);
  }, [q, lang]);

  if (!mounted) return null;

  const run = (r?: Result) => { if (!r) return; os.dismiss(); r.run(); };

  return (
    <div className={"spot-backdrop" + (closing ? " closing" : "")} onPointerDown={() => os.dismiss()}>
      <div className="spotlight" onPointerDown={(e) => e.stopPropagation()}>
        <div className="spot-field">
          <svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5l5 5" /></svg>
          <input
            autoFocus
            value={q}
            placeholder={t("Spotlight Search", "Поиск Spotlight")}
            onChange={(e) => { setQ(e.target.value); setSel(0); }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setSel((i) => Math.min(results.length - 1, i + 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setSel((i) => Math.max(0, i - 1)); }
              if (e.key === "Enter") run(results[sel]);
            }}
          />
        </div>
        {results.length > 0 && (
          <div className="spot-results">
            {results.map((r, i) => (
              <button key={r.id} className={"spot-row" + (i === sel ? " sel" : "")} onPointerEnter={() => setSel(i)} onClick={() => run(r)}>
                {r.icon ? <AppIcon name={r.icon} size={34} /> : <span className="spot-glyph">{r.glyph}</span>}
                <span className="spot-title">{r.title}</span>
                <span className="spot-sub">{r.sub}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** «О программе»: иконка, название, версия — как маленькое окно macOS. */
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
        <div className="about-ver">{t("Version", "Версия")} 1.0 (2611)</div>
        <div className="about-foot">© 2026 Kestrel Systems</div>
        <button className="set-btn" onClick={() => os.dismiss()}>OK</button>
      </div>
    </div>
  );
}

/** Справка: сочетания клавиш. ⌥ — Alt, ⌃ — Ctrl. */
export function ShortcutsPanel() {
  const os = useOs();
  const { t } = useLang();
  const { mounted, closing } = usePresence(os.panel === "shortcuts", 200);
  if (!mounted) return null;
  const rows: [string, string][] = [
    ["⌃ Space", "Spotlight"],
    ["⌥ L", "Launchpad"],
    ["⌥ `", t("Switch apps (hold Alt)", "Переключить программу (держать Alt)")],
    ["⌥ ↑", t("All windows", "Все окна")],
    ["⌥ N", t("New window", "Новое окно")],
    ["⇧ ⌥ N", t("New folder", "Новая папка")],
    ["⌥ W", t("Close window", "Закрыть окно")],
    ["⌥ M", t("Minimize", "Свернуть")],
    ["⌥ H", t("Hide app", "Скрыть программу")],
    ["⌥ Q", t("Quit app", "Завершить программу")],
    ["⌥ ,", t("System Settings", "Системные настройки")],
    ["Esc", t("Close menus and panels", "Закрыть меню и панели")],
    ["Enter", t("Rename in Finder", "Переименовать в Finder")],
    ["Delete", t("Move to Trash", "В Корзину")],
  ];
  return (
    <div className={"modal-backdrop" + (closing ? " closing" : "")} onPointerDown={() => os.dismiss()}>
      <div className="about-app keys" onPointerDown={(e) => e.stopPropagation()}>
        <h2>{t("Keyboard Shortcuts", "Сочетания клавиш")}</h2>
        <div className="about-ver">{t("⌥ is Alt, ⌃ is Ctrl on a PC keyboard", "⌥ — это Alt, ⌃ — Ctrl на клавиатуре ПК")}</div>
        <table className="keys-table"><tbody>{rows.map(([k, v]) => <tr key={k}><td><kbd>{k}</kbd></td><td>{v}</td></tr>)}</tbody></table>
        <button className="set-btn primary" onClick={() => os.dismiss()}>OK</button>
      </div>
    </div>
  );
}

/** Фон режима «Все окна»: затемнение и подсказка; щелчок по пустому месту — выход. */
export function OverviewBackdrop() {
  const os = useOs();
  const { t } = useLang();
  const { mounted, closing } = usePresence(os.panel === "overview", 420);
  if (!mounted) return null;
  const none = !os.windows.some((w) => !w.min && w.phase !== "closing");
  return (
    <div className={"ov-backdrop" + (closing ? " closing" : "")} onPointerDown={(e) => { e.stopPropagation(); os.dismiss(); }}>
      <div className="ov-hint">{none ? t("No open windows", "Открытых окон нет") : t("Click a window to bring it forward", "Щёлкните окно, чтобы перейти к нему")}</div>
    </div>
  );
}

/** Переключатель приложений: ⌥` по кругу, отпустить Alt — перейти. */
export function AppSwitcher() {
  const sw = useOs((s) => s.switcher);
  const { lang } = useLang();
  if (!sw) return null;
  return (
    <div className="switcher" onPointerDown={(e) => e.stopPropagation()}>
      {sw.apps.map((app, i) => (
        <button key={app} className={"sw-app" + (i === sw.i ? " on" : "")} onPointerEnter={() => useOs.setState({ switcher: { ...sw, i } })} onClick={() => switcherCommit(app)}>
          <AppIcon name={APP_META[app].icon} size={110} />
          {i === sw.i && <span>{APP_META[app].title[lang]}</span>}
        </button>
      ))}
    </div>
  );
}
