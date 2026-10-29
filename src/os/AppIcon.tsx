// Иконки Kestrel OS: цветная плитка со своим символом.
const ICONS: Record<string, { bg: string; path: string }> = {
  pc: { bg: "linear-gradient(135deg,#4aa3ff,#1f5fd6)", path: '<rect x="6" y="7" width="20" height="13" rx="1.5"/><path d="M12 25h8M16 20v5"/>' },
  term: { bg: "linear-gradient(160deg,#3a3f4b,#111216)", path: '<path d="M8 11l5 5-5 5M15 22h9" stroke="#e8ecf4" style="filter:drop-shadow(0 0 2px rgba(120,255,170,.6))"/>' },
  notes: { bg: "linear-gradient(180deg,#fff7d6 0%,#fff 38%,#f4f1e6 100%)", path: '<rect x="3" y="3" width="26" height="8" fill="#ffcc33" stroke="none"/><g stroke="#d9d3bf" stroke-width="1.2"><path d="M7 16h18M7 20.5h18M7 25h12"/></g>' },
  taskmgr: { bg: "linear-gradient(135deg,#4fd18b,#13894b)", path: '<path d="M5 18h5l3-7 4 12 3-8 2 3h5"/>' },
  vm: { bg: "linear-gradient(135deg,#a77bff,#5b2fd1)", path: '<rect x="5" y="8" width="16" height="12" rx="1.5"/><rect x="11" y="13" width="16" height="12" rx="1.5"/>' },
  launchpad: { bg: "linear-gradient(135deg,#f5f6fa,#c9ccd6)", path: '<g fill="#5b6275" stroke="none"><rect x="7" y="7" width="5" height="5" rx="1.4"/><rect x="13.5" y="7" width="5" height="5" rx="1.4" fill="#ff6b5b"/><rect x="20" y="7" width="5" height="5" rx="1.4" fill="#ffb340"/><rect x="7" y="13.5" width="5" height="5" rx="1.4" fill="#3fc76d"/><rect x="13.5" y="13.5" width="5" height="5" rx="1.4" fill="#2f8cff"/><rect x="20" y="13.5" width="5" height="5" rx="1.4" fill="#a066ff"/><rect x="7" y="20" width="5" height="5" rx="1.4" fill="#ff5f9e"/><rect x="13.5" y="20" width="5" height="5" rx="1.4" fill="#2fc7c7"/><rect x="20" y="20" width="5" height="5" rx="1.4"/></g>' },
  disk: { bg: "linear-gradient(180deg,#e9ebf0,#a9aeba)", path: '<g stroke="#4b5263"><rect x="5" y="11" width="22" height="11" rx="2"/><path d="M9 18h2"/></g><circle cx="23" cy="18" r="1" fill="#3fd66d" stroke="none"/>' },
  finder: { bg: "linear-gradient(160deg,#6cc1ff,#1a6cf0)", path: '<path d="M6 10.5a2 2 0 0 1 2-2h5l2 2.5h9a2 2 0 0 1 2 2V22a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z" fill="rgba(255,255,255,.22)"/><path d="M6 14h20"/><path d="M13 18.5h6" stroke-width="1.6"/>' },
  reminders: { bg: "linear-gradient(180deg,#ffffff,#e4e6ec)", path: '<g stroke="none"><circle cx="9" cy="10" r="2.6" fill="#2f8cff"/><circle cx="9" cy="16" r="2.6" fill="#ff9f0a"/><circle cx="9" cy="22" r="2.6" fill="#ff453a"/></g><g stroke="#b8bcc6" stroke-width="1.6"><path d="M14 10h11M14 16h11M14 22h9"/></g>' },
  calculator: { bg: "linear-gradient(180deg,#5a5d66,#2a2c32)", path: '<g stroke="none"><rect x="6" y="6" width="9" height="9" rx="2" fill="#a5a8b0"/><rect x="17" y="6" width="9" height="9" rx="2" fill="#ff9f0a"/><rect x="6" y="17" width="9" height="9" rx="2" fill="#7a7d86"/><rect x="17" y="17" width="9" height="9" rx="2" fill="#ff9f0a"/></g><path d="M8.5 10.5h4M19.5 10.5h4M21.5 8.5v4M8.5 21.5h4M19.5 20h4M19.5 23h4" stroke-width="1.6"/>' },
  clock: { bg: "linear-gradient(180deg,#2a2c32,#0e0f12)", path: '<circle cx="16" cy="16" r="11" fill="#fff" stroke="none"/><g stroke="#16181d" stroke-width="1.8"><path d="M16 16V9.5M16 16l4.5 3"/></g><path d="M16 16l-5 4" stroke="#ff9f0a" stroke-width="1.2"/><circle cx="16" cy="16" r="1.3" fill="#ff9f0a" stroke="none"/>' },
  textedit: { bg: "linear-gradient(180deg,#f4f5f8,#cfd3dc)", path: '<rect x="8" y="5" width="16" height="22" rx="1.5" fill="#fff" stroke="#b8bcc6" stroke-width="1.2"/><g stroke="#8a8f9c" stroke-width="1.3"><path d="M11 10h10M11 13.5h10M11 17h7"/></g><path d="M17 25l8-8 2 2-8 8h-2z" fill="#ff9f0a" stroke="#c46a00" stroke-width="1"/>' },
  trash: { bg: "linear-gradient(180deg,rgba(255,255,255,.35),rgba(255,255,255,.12))", path: '<path d="M9 9h14l-1.4 16a2 2 0 0 1-2 1.8h-7.2a2 2 0 0 1-2-1.8z" fill="rgba(255,255,255,.25)"/><path d="M7.5 9h17M13 9V7h6v2M13.5 13v10M18.5 13v10" stroke-width="1.5"/>' },
  trashFull: { bg: "linear-gradient(180deg,rgba(255,255,255,.35),rgba(255,255,255,.12))", path: '<path d="M9 9h14l-1.4 16a2 2 0 0 1-2 1.8h-7.2a2 2 0 0 1-2-1.8z" fill="rgba(255,255,255,.25)"/><path d="M11 9l3-4 3 3 4-3 1 4" fill="#e9ebf0" stroke="#b8bcc6" stroke-width="1"/><path d="M7.5 9h17M13.5 13v10M18.5 13v10" stroke-width="1.5"/>' },
  folder: { bg: "transparent", path: '<path d="M3 9a2 2 0 0 1 2-2h7l2.5 2.5H27a2 2 0 0 1 2 2V25a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="#4ab0ff" stroke="none"/><path d="M3 12.5h26V25a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="#6cc4ff" stroke="none"/>' },
  file: { bg: "transparent", path: '<path d="M7 3h12l7 7v17a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" fill="#fff" stroke="#c9ccd6" stroke-width="1"/><path d="M19 3v7h7" fill="#e4e6ec" stroke="#c9ccd6" stroke-width="1"/><g stroke="#a0a5b2" stroke-width="1.2"><path d="M9 15h13M9 18.5h13M9 22h9"/></g>' },
  settings: { bg: "linear-gradient(160deg,#b4bccb,#5d6577)", path: '<path d="M25.80,12.24 L26.50,15.72 L24.20,16.22 L23.66,18.94 L25.59,20.27 L23.62,23.23 L21.64,21.95 L19.34,23.49 L19.76,25.80 L16.28,26.50 L15.78,24.20 L13.06,23.66 L11.73,25.59 L8.77,23.62 L10.05,21.64 L8.51,19.34 L6.20,19.76 L5.50,16.28 L7.80,15.78 L8.34,13.06 L6.41,11.73 L8.38,8.77 L10.36,10.05 L12.66,8.51 L12.24,6.20 L15.72,5.50 L16.22,7.80 L18.94,8.34 L20.27,6.41 L23.23,8.38 L21.95,10.36 L23.49,12.66Z" fill="rgba(255,255,255,.92)" stroke="none"/><circle cx="16" cy="16" r="4.2" fill="#6b7385" stroke="none"/><circle cx="16" cy="16" r="2" fill="rgba(255,255,255,.92)" stroke="none"/>' },
};

/** Календарь показывает сегодняшнее число, как настоящий. */
function calendarIcon(): { bg: string; path: string } {
  const d = new Date();
  const wd = d.toLocaleDateString("en-GB", { weekday: "short" }).toUpperCase();
  return {
    bg: "linear-gradient(180deg,#ffffff,#eceef2)",
    path: `<text x="16" y="10" text-anchor="middle" font-size="6" font-weight="700" fill="#ff3b30" stroke="none" font-family="-apple-system,Inter,sans-serif">${wd}</text>` +
      `<text x="16" y="26" text-anchor="middle" font-size="16" font-weight="400" fill="#1d1d1f" stroke="none" font-family="-apple-system,Inter,sans-serif">${d.getDate()}</text>`,
  };
}

/** Иконки без плитки: папки и документы в Finder и на рабочем столе. */
const BARE = new Set(["folder", "file"]);

export function AppIcon({ name, size = 40 }: { name: string; size?: number }) {
  const ic = name === "calendar" ? calendarIcon() : ICONS[name] ?? ICONS.pc;
  if (BARE.has(name)) {
    return <svg className="file-icon" viewBox="0 0 32 32" width={size} height={size} dangerouslySetInnerHTML={{ __html: ic.path }} />;
  }
  return (
    <span className="app-icon" style={{ width: size, height: size, background: ic.bg, borderRadius: size * 0.22 }}>
      <svg viewBox="0 0 32 32" width={size * 0.72} height={size * 0.72} dangerouslySetInnerHTML={{ __html: ic.path }} />
    </span>
  );
}

/** Логотип Kestrel OS: шестиугольник с крылом. */
export function OsLogo({ size = 120 }: { size?: number }) {
  return (
    <svg className="os-logo" viewBox="0 0 64 64" width={size} height={size}>
      <defs>
        <linearGradient id="osg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7cc4ff" />
          <stop offset="1" stopColor="#2f6bff" />
        </linearGradient>
      </defs>
      <path d="M32 3 57 17.5v29L32 61 7 46.5v-29z" fill="none" stroke="url(#osg)" strokeWidth="4" />
      <path d="M18 40 L32 22 L46 40 L38 36 L32 44 L26 36 Z" fill="url(#osg)" />
    </svg>
  );
}
