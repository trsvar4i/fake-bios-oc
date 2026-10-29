// Иконки Kestrel OS: цветная плитка со своим символом.
const ICONS: Record<string, { bg: string; path: string }> = {
  pc: { bg: "linear-gradient(135deg,#4aa3ff,#1f5fd6)", path: '<rect x="6" y="7" width="20" height="13" rx="1.5"/><path d="M12 25h8M16 20v5"/>' },
  term: { bg: "linear-gradient(135deg,#3a3f4b,#16181d)", path: '<path d="M8 11l5 5-5 5M15 22h9"/>' },
  notes: { bg: "linear-gradient(135deg,#ffd75e,#f0a500)", path: '<rect x="8" y="6" width="16" height="20" rx="1.5"/><path d="M12 12h8M12 16h8M12 20h5"/>' },
  taskmgr: { bg: "linear-gradient(135deg,#4fd18b,#13894b)", path: '<path d="M5 18h5l3-7 4 12 3-8 2 3h5"/>' },
  vm: { bg: "linear-gradient(135deg,#a77bff,#5b2fd1)", path: '<rect x="5" y="8" width="16" height="12" rx="1.5"/><rect x="11" y="13" width="16" height="12" rx="1.5"/>' },
  settings: { bg: "linear-gradient(135deg,#9aa3b5,#4b5263)", path: '<circle cx="16" cy="16" r="4"/><path d="M16 5v4M16 23v4M5 16h4M23 16h4M8.2 8.2l2.8 2.8M21 21l2.8 2.8M8.2 23.8l2.8-2.8M21 11l2.8-2.8"/>' },
};

export function AppIcon({ name, size = 40 }: { name: string; size?: number }) {
  const ic = ICONS[name] ?? ICONS.pc;
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
