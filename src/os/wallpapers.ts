// Обои и производные от них цвета: акцент интерфейса и оттенок стекла (адаптивные акценты из os-design.md).
export interface Wallpaper {
  name: { en: string; ru: string };
  /** главный цвет обоев → цвет кнопок, переключателей, выделения */
  accent: string;
  /** оттенок матового стекла панелей и окон */
  glass: string;
}

export const WALLPAPERS: Record<string, Wallpaper> = {
  aurora: { name: { en: "Aurora", ru: "Сияние" }, accent: "#8a8dff", glass: "rgba(34, 36, 78, 0.52)" },
  ember: { name: { en: "Ember", ru: "Угли" }, accent: "#ff7d57", glass: "rgba(64, 26, 30, 0.52)" },
  forest: { name: { en: "Forest", ru: "Лес" }, accent: "#3fd6a0", glass: "rgba(14, 48, 46, 0.52)" },
  graphite: { name: { en: "Graphite", ru: "Графит" }, accent: "#a9b4c8", glass: "rgba(34, 36, 44, 0.56)" },
};

export const wallpaperOf = (id: string) => WALLPAPERS[id] ?? WALLPAPERS.aurora;
