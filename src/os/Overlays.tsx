// Полноэкранные панели: Launchpad (все приложения) и Spotlight (поиск и быстрые действия).
import { useEffect, useMemo, useState } from "react";
import { useLang } from "../machine/store";
import { useOs } from "./osStore";
import { APP_META } from "./apps/meta";
import { AppIcon } from "./AppIcon";
import { osPower } from "./power";
import { WALLPAPERS } from "./wallpapers";
import { usePresence } from "./util";

export function Launchpad() {
  const os = useOs();
  const { lang, t } = useLang();
  const [q, setQ] = useState("");
  const { mounted, closing } = usePresence(os.panel === "launchpad", 260);
  useEffect(() => { if (os.panel === "launchpad") setQ(""); }, [os.panel]);
  if (!mounted) return null;

  const apps = Object.values(APP_META).filter((m) => m.title[lang].toLowerCase().includes(q.trim().toLowerCase()));
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
      if (m.title.en.toLowerCase().includes(s) || m.title.ru.toLowerCase().includes(s))
        out.push({ id: m.id, title: m.title[lang], sub: t("Application", "Программа"), icon: m.icon, run: () => os.open(m.id) });
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
    return out.slice(0, 7);
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
