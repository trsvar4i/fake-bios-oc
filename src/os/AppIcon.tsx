// Иконки Kestrel OS: плитка со срезанным правым верхним углом (как грань шестиугольника в логотипе)
// и белый линейный символ. Все символы нарисованы в квадрате 32×32 одной толщиной линии.
import { useId } from "react";

type Icon = { c: [string, string]; g: string };

const ICONS: Record<string, Icon> = {
  pc: { c: ["#38bdf8", "#0369a1"], g: '<rect x="5" y="6" width="22" height="15" rx="2.5"/><path d="M12 26h8M16 21v5"/>' },
  term: { c: ["#3f3f46", "#0c0c0e"], g: '<path d="M8 11l5 5-5 5" stroke="#86efac"/><path d="M15.5 22h8.5"/>' },
  notes: { c: ["#fbbf24", "#d97706"], g: '<path d="M8 5h12l5 5v15a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/><path d="M20 5v5h5M10.5 15h10M10.5 19.5h10M10.5 24h6"/>' },
  taskmgr: { c: ["#4ade80", "#15803d"], g: '<path d="M4 17h5.5l3-7 4.5 13 3.5-9 2 3H28"/>' },
  vm: { c: ["#a78bfa", "#6d28d9"], g: '<rect x="4" y="7" width="16" height="12" rx="2"/><rect x="12" y="13" width="16" height="12" rx="2" fill="rgba(255,255,255,.18)"/>' },
  disk: { c: ["#a1a1aa", "#52525b"], g: '<rect x="5" y="10" width="22" height="13" rx="3"/><path d="M9 18.5h4"/><circle cx="22.5" cy="16.5" r="1.4" fill="#86efac" stroke="none"/>' },
  finder: { c: ["#60a5fa", "#1d4ed8"], g: '<path d="M5 10a2 2 0 0 1 2-2h5.5l2.5 3h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z"/><path d="M5 14.5h22"/>' },
  reminders: { c: ["#fb7185", "#be123c"], g: '<circle cx="9.5" cy="9.5" r="2.6" fill="#fff"/><circle cx="9.5" cy="16.5" r="2.6"/><circle cx="9.5" cy="23.5" r="2.6"/><path d="M15 9.5h11M15 16.5h11M15 23.5h8"/>' },
  calculator: { c: ["#64748b", "#1e293b"], g: '<rect x="6" y="5" width="20" height="22" rx="3"/><path d="M10 10.5h12"/><path d="M11 16v4M9 18h4M19 18h4M9.5 23.5l3-3M12.5 23.5l-3-3M19 22.2h4M19 24.6h4" stroke-width="1.7"/>' },
  clock: { c: ["#334155", "#0f172a"], g: '<circle cx="16" cy="16" r="11"/><path d="M16 9.5V16l4.5 3"/><path d="M16 16l-4 4" stroke="#fbbf24" stroke-width="1.6"/>' },
  textedit: { c: ["#94a3b8", "#475569"], g: '<path d="M7 8h18M7 13h18M7 18h11M7 23h7"/><path d="M19 26l7.5-7.5 2 2L21 28h-2z" fill="rgba(255,255,255,.25)"/>' },
  trash: { c: ["#71717a", "#3f3f46"], g: '<path d="M9 10h14l-1.3 15a2 2 0 0 1-2 1.8h-7.4a2 2 0 0 1-2-1.8z"/><path d="M7 10h18M13 10V7.5h6V10M13.5 14.5v8M18.5 14.5v8"/>' },
  trashFull: { c: ["#71717a", "#3f3f46"], g: '<path d="M9 10h14l-1.3 15a2 2 0 0 1-2 1.8h-7.4a2 2 0 0 1-2-1.8z"/><path d="M7 10h18"/><path d="M10.5 10l2.5-4 3 2.5 3.5-3 1.8 4.5" fill="rgba(255,255,255,.3)"/><path d="M13.5 14.5v8M18.5 14.5v8"/>' },
  appstore: { c: ["#22d3ee", "#0e7490"], g: '<path d="M8 11h16l-1.4 13.4a2 2 0 0 1-2 1.6h-9.2a2 2 0 0 1-2-1.6z"/><path d="M12 11V9.5a4 4 0 0 1 8 0V11"/><path d="M16 15v6M13.2 18.5 16 21.3l2.8-2.8"/>' },
  care: { c: ["#34d399", "#047857"], g: '<path d="M16 4.5l9 3.5v6.5c0 5.5-4 9.5-9 12-5-2.5-9-6.5-9-12V8z"/><path d="M16 11l1.5 3.4 3.5 1.6-3.5 1.6L16 21l-1.5-3.4L11 16l3.5-1.6z" fill="#fff" stroke="none"/>' },
  paint: { c: ["#fb923c", "#c2410c"], g: '<path d="M22.5 5.5l4 4L15 21l-4-4z"/><path d="M11 17c-3 0-5 2-5 5 0 2-1 3.5-2 4 4 .5 9-.5 11-5"/>' },
  preview: { c: ["#7dd3fc", "#2563eb"], g: '<rect x="4" y="6" width="24" height="20" rx="2.5"/><path d="M6 23l6-6.5 4.5 4.5 3-3L26 24"/><circle cx="21" cy="12" r="2.2"/>' },
  music: { c: ["#f472b6", "#be185d"], g: '<path d="M12.5 22.5V9l12-3v13"/><circle cx="9.5" cy="22.5" r="3" fill="#fff"/><circle cx="21.5" cy="19" r="3" fill="#fff"/>' },
  settings: { c: ["#a1a1aa", "#3f3f46"], g: '<circle cx="16" cy="16" r="4"/><path d="M16 4.5v3.2M16 24.3v3.2M4.5 16h3.2M24.3 16h3.2M7.9 7.9l2.2 2.2M21.9 21.9l2.2 2.2M7.9 24.1l2.2-2.2M21.9 10.1l2.2-2.2"/><circle cx="16" cy="16" r="8.2" stroke-dasharray="3.2 3.2"/>' },
  browser: { c: ["#2dd4bf", "#0f766e"], g: '<circle cx="16" cy="16" r="11"/><path d="M5 16h22M16 5c3.5 3 4.8 7 4.8 11S19.5 24 16 27c-3.5-3-4.8-7-4.8-11S12.5 8 16 5z"/>' },
  quests: { c: ["#facc15", "#a16207"], g: '<path d="M10 5h12v6a6 6 0 0 1-12 0z"/><path d="M10 7H6.5a3.5 3.5 0 0 0 3.8 5M22 7h3.5a3.5 3.5 0 0 1-3.8 5M16 17v4.5M11 27h10M12.5 27l1-5.5h5l1 5.5"/>' },
  // без плитки: папки и документы в «Файлах» и на рабочем столе
  folder: { c: ["", ""], g: '<path d="M3 9a2 2 0 0 1 2-2h7l2.5 2.5H27a2 2 0 0 1 2 2V25a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="#3b82f6" stroke="none"/><path d="M3 12.5h26V25a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="#60a5fa" stroke="none"/><path d="M22 12.5h7v7z" fill="rgba(255,255,255,.18)" stroke="none"/>' },
  file: { c: ["", ""], g: '<path d="M7 3h12l7 7v17a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" fill="#fff" stroke="#c9ccd6" stroke-width="1"/><path d="M19 3v7h7" fill="#e4e6ec" stroke="#c9ccd6" stroke-width="1"/><g stroke="#a0a5b2" stroke-width="1.2"><path d="M9 15h13M9 18.5h13M9 22h9"/></g>' },
  image: { c: ["", ""], g: '<rect x="4" y="6" width="24" height="20" rx="2.5" fill="#fff" stroke="#c9ccd6"/><path d="M6.5 23l6-7 4.5 5 3.5-3.5L26 23z" fill="#4fbf6a" stroke="none"/><circle cx="21.5" cy="11.5" r="2.4" fill="#ffcc33" stroke="none"/>' },
};

/** Календарь показывает сегодняшнее число. */
function calendarIcon(): Icon {
  const d = new Date();
  const wd = d.toLocaleDateString("en-GB", { weekday: "short" }).toUpperCase();
  return {
    c: ["#f43f5e", "#9f1239"],
    g: `<text x="16" y="11" text-anchor="middle" font-size="6.2" font-weight="800" fill="rgba(255,255,255,.8)" stroke="none" letter-spacing=".6" font-family="Manrope,Inter,sans-serif">${wd}</text>` +
      `<text x="16" y="26" text-anchor="middle" font-size="15" font-weight="700" fill="#fff" stroke="none" font-family="Manrope,Inter,sans-serif">${d.getDate()}</text>`,
  };
}

const BARE = new Set(["folder", "file", "image"]);

/** Форма плитки в квадрате 64×64: скруглённые углы и срез справа сверху. */
export const TILE_PATH = "M14 0H39Q42.5 0 45 2.5L61.5 19Q64 21.5 64 25V50A14 14 0 0 1 50 64H14A14 14 0 0 1 0 50V14A14 14 0 0 1 14 0Z";

export function AppIcon({ name, size = 40 }: { name: string; size?: number }) {
  const id = useId().replace(/:/g, "");
  const ic = name === "calendar" ? calendarIcon() : ICONS[name] ?? ICONS.pc;
  if (BARE.has(name)) {
    return <svg className="file-icon" viewBox="0 0 32 32" width={size} height={size} dangerouslySetInnerHTML={{ __html: ic.g }} />;
  }
  return (
    <svg className="app-icon" viewBox="0 0 64 64" width={size} height={size} aria-hidden>
      <defs>
        <linearGradient id={"g" + id} x1="0" y1="0" x2=".7" y2="1">
          <stop offset="0" stopColor={ic.c[0]} />
          <stop offset="1" stopColor={ic.c[1]} />
        </linearGradient>
      </defs>
      <path d={TILE_PATH} fill={`url(#g${id})`} />
      <path d={TILE_PATH} fill="none" stroke="rgba(255,255,255,.16)" strokeWidth="1.5" />
      <g className="ai-glyph" transform="translate(12 12) scale(1.25)" dangerouslySetInnerHTML={{ __html: ic.g }} />
    </svg>
  );
}

/** Логотип Kestrel OS: шестиугольник с крылом. mono — одним цветом (currentColor) для панелей. */
export function OsLogo({ size = 120, mono = false }: { size?: number; mono?: boolean }) {
  const id = useId().replace(/:/g, "");
  const paint = mono ? "currentColor" : `url(#osg${id})`;
  return (
    <svg className="os-logo" viewBox="0 0 64 64" width={size} height={size}>
      {!mono && (
        <defs>
          <linearGradient id={"osg" + id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#7cc4ff" />
            <stop offset="1" stopColor="#2f6bff" />
          </linearGradient>
        </defs>
      )}
      <path className="logo-hex" d="M32 3 57 17.5v29L32 61 7 46.5v-29z" fill="none" stroke={paint} strokeWidth="4" strokeLinejoin="round" />
      <path className="logo-wing" d="M18 40 L32 22 L46 40 L38 36 L32 44 L26 36 Z" fill={paint} />
    </svg>
  );
}
