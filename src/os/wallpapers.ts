// Обои: одна композиция из плавных волн в нескольких цветовых вариантах.
// От обоев зависят акцент интерфейса и оттенок стекла (адаптивные акценты из os-design.md).
export interface Wallpaper {
  name: { en: string; ru: string };
  /** фон за волнами: сверху → снизу */
  sky: [string, string];
  /** волны от дальней к ближней: [светлый край, тёмная глубина] */
  waves: [string, string][];
  /** главный цвет обоев → цвет кнопок, переключателей, выделения */
  accent: string;
  /** оттенок матового стекла панелей и окон */
  glass: string;
}

export const WALLPAPERS: Record<string, Wallpaper> = {
  aurora: {
    name: { en: "Aurora", ru: "Сияние" },
    sky: ["#2a2f8a", "#0a0b2e"],
    waves: [["#4a5cff", "#20258c"], ["#6b4dff", "#2e1a96"], ["#9a5cff", "#4a1f9e"], ["#d06bff", "#6a1fa8"], ["#ff8ad8", "#a02a88"]],
    accent: "#8a8dff", glass: "rgba(34, 36, 78, 0.52)",
  },
  ocean: {
    name: { en: "Ocean", ru: "Океан" },
    sky: ["#0d4a9a", "#03112e"],
    waves: [["#2a7cff", "#0d3aa0"], ["#2ab0ff", "#0a5aa8"], ["#58d0ff", "#137ab8"], ["#1a5aff", "#0a248a"], ["#9ae6ff", "#2a90d0"]],
    accent: "#4aa8ff", glass: "rgba(16, 40, 80, 0.52)",
  },
  forest: {
    name: { en: "Lagoon", ru: "Лагуна" },
    sky: ["#0d5a5a", "#04191a"],
    waves: [["#2fc7a8", "#0d6a5a"], ["#1ab0c8", "#0a5a80"], ["#3fd6a0", "#13805a"], ["#6ae6c0", "#1e9a78"], ["#c0f5d8", "#48c090"]],
    accent: "#3fd6a0", glass: "rgba(14, 48, 46, 0.52)",
  },
  ember: {
    name: { en: "Sunset", ru: "Закат" },
    sky: ["#7a2a1a", "#1d0c10"],
    waves: [["#ff9a4a", "#b8401a"], ["#ff6a3c", "#a82a1a"], ["#ff4a5a", "#8a1430"], ["#ff3f7a", "#741040"], ["#ffc878", "#e07028"]],
    accent: "#ff7d57", glass: "rgba(64, 26, 30, 0.52)",
  },
  rose: {
    name: { en: "Bloom", ru: "Цветение" },
    sky: ["#6a1a50", "#1e0818"],
    waves: [["#ff7ab8", "#a8306e"], ["#e06bff", "#7a22b0"], ["#ff9ac8", "#c0407e"], ["#ff5f9e", "#901852"], ["#ffc4e0", "#e070a8"]],
    accent: "#ff7ab8", glass: "rgba(70, 22, 50, 0.52)",
  },
  graphite: {
    name: { en: "Graphite", ru: "Графит" },
    sky: ["#3a3d46", "#101114"],
    waves: [["#6b707c", "#30333a"], ["#8a8f9c", "#40434c"], ["#545864", "#24262c"], ["#a6abb8", "#5a5e6a"], ["#d0d4dc", "#7a7e8a"]],
    accent: "#a9b4c8", glass: "rgba(34, 36, 44, 0.56)",
  },
};

export const wallpaperOf = (id: string) => WALLPAPERS[id] ?? WALLPAPERS.aurora;
