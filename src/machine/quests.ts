// Испытания (достижения): цели для посетителя — от первого запуска до «сломать» компьютер разными способами.
// Прогресс хранится в браузере (kestrel.quests); при получении показывается тост поверх любого экрана.
import { create } from "zustand";
import { l, type L } from "./i18n";

export interface Quest { id: string; title: L; desc: L; hint: L; glyph: string }

const q = (id: string, glyph: string, title: L, desc: L, hint: L): Quest => ({ id, glyph, title, desc, hint });

export const QUESTS: Quest[] = [
  q("boot", "M5 12l4.5 4.5L19 7", l("Hello, Kestrel", "Привет, Kestrel"), l("Boot all the way to the desktop.", "Дойти до рабочего стола."),
    l("Press the power button and wait.", "Нажмите кнопку питания и подождите.")),
  q("bios", "M7 7h10v10H7zM10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4", l("Under the hood", "Под капотом"), l("Enter UEFI Setup.", "Зайти в UEFI Setup."),
    l("Press DEL while the logo is on screen.", "Нажмите DEL, пока виден логотип.")),
  q("oc5", "M13 2 4 14h7l-1 8 9-12h-7z", l("Five gigahertz", "Пять гигагерц"), l("Run the CPU at 5.0 GHz or more and reach the desktop without a crash.", "Разогнать процессор до 5,0 ГГц и дойти до рабочего стола без сбоя."),
    l("Raise CPU Ratio and give it enough CPU Core Voltage.", "Поднимите множитель и дайте достаточно напряжения ядра.")),
  q("crash", "M12 3 2 21h20zM12 10v5M12 18h.01", l("Blue screen? Black screen!", "Кернел-паника"), l("Crash the OS with an unstable overclock.", "Уронить систему нестабильным разгоном."),
    l("High ratio, slightly too little voltage.", "Высокий множитель и чуть-чуть не хватает напряжения.")),
  q("hot", "M12 3a3 3 0 0 0-3 3v8a5 5 0 1 0 6 0V6a3 3 0 0 0-3-3zM12 11v6", l("Too hot to handle", "Горячо!"), l("Make the CPU throttle or overheat.", "Довести процессор до троттлинга или перегрева."),
    l("Silent fans, high ratio, `stress` in Terminal.", "Тихие вентиляторы, высокий множитель, `stress` в Терминале.")),
  q("memfail", "M3 8h18v8H3zM7 11v2M11 11v2M15 11v2", l("Memory lane", "Память не прошла"), l("Fail memory training.", "Провалить тренировку памяти."),
    l("Pick an XMP profile with too little DRAM voltage — or tight timings.", "Включите XMP при слишком низком напряжении DRAM — или зажмите тайминги.")),
  q("linux", "M8 21h8M12 17v4M6 3h12v14H6z", l("Live and let boot", "Живой Linux"), l("Boot Live Linux from the USB stick.", "Загрузить Live Linux с флешки."),
    l("Secure Boot must be off and USB first in Boot Priority (or F11).", "Secure Boot выключен, флешка первая в порядке загрузки (или F11).")),
  q("secureboot", "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l6 0", l("Access denied", "Доступ запрещён"), l("Get a Secure Boot Violation.", "Получить Secure Boot Violation."),
    l("Try to boot the unsigned USB stick with Secure Boot on.", "Загрузите неподписанную флешку при включённом Secure Boot.")),
  q("raid", "M4 6h16v5H4zM4 13h16v5H4zM8 8.5h.01M8 15.5h.01", l("Inaccessible", "Диск потерялся"), l("Get INACCESSIBLE_BOOT_DEVICE.", "Получить INACCESSIBLE_BOOT_DEVICE."),
    l("Switch SATA Mode to RAID.", "Переключите режим SATA в RAID.")),
  q("nodev", "M4 4l16 16M9 9H4v10h10v-5M14 4h6v6", l("Nothing to boot", "Не с чего грузиться"), l("See “Reboot and Select proper Boot device”.", "Увидеть «Reboot and Select proper Boot device»."),
    l("Leave only devices that cannot boot.", "Оставьте в порядке загрузки только то, что не загружается.")),
  q("offline", "M3 3l18 18M8.5 8.5A6 6 0 0 0 6 13M2 9a15 15 0 0 1 4-3M12 17h.01", l("Off the grid", "Без сети"), l("Boot the OS with the network card disabled.", "Загрузить систему с выключенной сетевой картой."),
    l("Disable Onboard LAN Controller in BIOS.", "Выключите встроенный сетевой контроллер в BIOS.")),
  q("vm", "M3 5h12v9H3zM9 10h12v9H9z", l("A PC inside a PC", "Компьютер в компьютере"), l("Boot a guest system in Kestrel VM.", "Загрузить гостевую систему в Kestrel VM."),
    l("Turn on SVM Mode (virtualization) in BIOS first.", "Сначала включите SVM (виртуализацию) в BIOS.")),
  q("stress", "M3 12h4l3-8 4 16 3-8h4", l("Stress test", "Стресс-тест"), l("Load all CPU cores from Terminal.", "Нагрузить все ядра из Терминала."),
    l("Type `stress` in Terminal.", "Наберите `stress` в Терминале.")),
  q("flash", "M12 3v12M7 10l5 5 5-5M4 21h16", l("Fresh firmware", "Свежая прошивка"), l("Update the BIOS.", "Обновить BIOS."),
    l("BIOS → Tool → Instant Flash, or Settings → Software Update.", "BIOS → Tool → Instant Flash или Настройки → Обновление ПО.")),
  q("profile", "M5 4h11l3 3v13H5zM8 4v5h7V4M8 14h8", l("Saved for later", "На потом"), l("Save an overclocking profile in BIOS.", "Сохранить профиль разгона в BIOS."),
    l("BIOS → Tool → OC Profiles.", "BIOS → Tool → OC Profiles.")),
  q("password", "M6 11h12v9H6zM9 11V8a3 3 0 0 1 6 0v3", l("Locked down", "На замке"), l("Set a BIOS Setup password.", "Поставить пароль на BIOS Setup."),
    l("BIOS → Security → Administrator Password. Clear CMOS removes it.", "BIOS → Security → Administrator Password. Clear CMOS его сбросит.")),
  q("share", "M15 8a3 3 0 1 0-2.8-4M9 12a3 3 0 1 0 0 .01M15 16a3 3 0 1 0 0 .01M11.7 10.6l2.6-1.5M11.7 13.4l2.6 1.5", l("Show-off", "Поделиться"), l("Share your BIOS configuration as a link.", "Поделиться настройками BIOS ссылкой."),
    l("BIOS → Tool → Share Configuration.", "BIOS → Tool → Share Configuration.")),
];

const KEY = "kestrel.quests";

function load(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "{}") ?? {}; } catch { return {}; }
}

interface QuestState {
  done: Record<string, number>;
  /** только что полученное испытание (тост) */
  fresh: string | null;
}
export const useQuests = create<QuestState>(() => ({ done: load(), fresh: null }));

type Listener = (q: Quest) => void;
const listeners = new Set<Listener>();
/** ОС подписывается, чтобы добавить испытание в уведомления. */
export const onQuest = (fn: Listener) => { listeners.add(fn); return () => { listeners.delete(fn); }; };

let freshTimer = 0;
/** Отметить испытание выполненным (повторно — ничего не происходит). */
export function unlock(id: string) {
  const quest = QUESTS.find((x) => x.id === id);
  const s = useQuests.getState();
  if (!quest || s.done[id]) return;
  const done = { ...s.done, [id]: Date.now() };
  try { localStorage.setItem(KEY, JSON.stringify(done)); } catch { /* хранилище недоступно */ }
  useQuests.setState({ done, fresh: id });
  window.clearTimeout(freshTimer);
  freshTimer = window.setTimeout(() => useQuests.setState({ fresh: null }), 5200);
  listeners.forEach((fn) => fn(quest));
}

export function resetQuests() {
  try { localStorage.removeItem(KEY); } catch { /* хранилище недоступно */ }
  useQuests.setState({ done: {}, fresh: null });
}
