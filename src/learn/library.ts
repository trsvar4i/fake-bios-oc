// Готовые задания для учителя: 30 неисправностей трёх уровней. Каждое проверено тестом по модели:
// «сломанная» конфигурация цель не решает, а эталонное решение (fix) — решает.
import { l, type L } from "../machine/i18n.js";
import type { Config } from "../machine/params.js";

export interface LibraryTask {
  id: string;
  level: 1 | 2 | 3;
  title: L;
  /** что видит ученик: жалоба, без причины */
  descr: L;
  goal: string;
  cfg: Config;
  /** эталонное решение: что поменять (для тестов и подсказки учителю) */
  fix: Config;
  answer: L;
  /** рекомендуемый лимит времени, минуты */
  minutes: number;
}

const USB_FIRST = ["USB", "DVD", "HDD", "PXE", "OS"];
const STOCK_ORDER = ["OS", "USB", "DVD", "HDD", "PXE"];

export const LEVELS: Record<1 | 2 | 3, L> = { 1: l("Easy", "Лёгкий"), 2: l("Medium", "Средний"), 3: l("Hard", "Сложный") };

export const LIBRARY: LibraryTask[] = [
  // ——— лёгкие: одна причина, одна настройка ———
  { id: "e-raid", level: 1, minutes: 5, goal: "boot", cfg: { sataMode: "RAID" }, fix: { sataMode: "AHCI" },
    title: l("The disk is “missing”", "Диск «пропал»"),
    descr: l("The PC shows INACCESSIBLE_BOOT_DEVICE. Make it boot again.", "Компьютер показывает INACCESSIBLE_BOOT_DEVICE. Сделайте так, чтобы он снова загружался."),
    answer: l("Advanced → Integrated Peripherals → SATA Mode: AHCI.", "Расширенные → Встроенные устройства → Режим SATA: AHCI.") },
  { id: "e-lan", level: 1, minutes: 5, goal: "boot+lan", cfg: { lanController: false }, fix: { lanController: true },
    title: l("No internet", "Нет интернета"),
    descr: l("The Store and Browser say there is no connection. The cable is fine.", "Магазин и Браузер пишут, что нет подключения. Кабель в порядке."),
    answer: l("Integrated Peripherals → Onboard LAN Controller: Enabled.", "Встроенные устройства → Встроенный сетевой контроллер: включить.") },
  { id: "e-audio", level: 1, minutes: 5, goal: "boot+audio", cfg: { hdAudio: false }, fix: { hdAudio: true },
    title: l("No sound", "Нет звука"),
    descr: l("The PC is silent, though the speakers work.", "Компьютер молчит, хотя колонки исправны."),
    answer: l("Integrated Peripherals → HD Audio Controller: Enabled.", "Встроенные устройства → Звуковой контроллер HD Audio: включить.") },
  { id: "e-svm", level: 1, minutes: 5, goal: "vm", cfg: {}, fix: { virtualization: true },
    title: l("Virtual lab", "Виртуальная лаборатория"),
    descr: l("Start a guest system in Kestrel VM. It says virtualization is unavailable.", "Запустите гостевую систему в Kestrel VM. Программа пишет, что виртуализация недоступна."),
    answer: l("Advanced → CPU Configuration → SVM Mode: Enabled, then start a VM.", "Расширенные → Конфигурация CPU → SVM: включить, затем запустить машину.") },
  { id: "e-usb-first", level: 1, minutes: 5, goal: "boot+secure", cfg: { bootOrder: USB_FIRST }, fix: { bootOrder: STOCK_ORDER },
    title: l("Locked out by Secure Boot", "Secure Boot не пускает"),
    descr: l("The PC shows Secure Boot Violation. Get to Kestrel OS without turning protection off.", "Компьютер пишет Secure Boot Violation. Вернитесь в Kestrel OS, не выключая защиту."),
    answer: l("Boot → Boot Option Priorities: Kestrel OS first.", "Загрузка → Порядок загрузки: Kestrel OS первой.") },
  { id: "e-csm", level: 1, minutes: 5, goal: "boot+secure", cfg: { csm: true }, fix: { csm: false },
    title: l("Protection is off", "Защита не работает"),
    descr: l("The system says Secure Boot is not active. Turn the protection back on.", "Система сообщает, что Secure Boot не активен. Включите защиту обратно."),
    answer: l("Boot → Launch CSM: Disabled (Secure Boot works only without CSM).", "Загрузка → Запуск CSM: выключить (Secure Boot работает только без CSM).") },
  { id: "e-usb", level: 1, minutes: 5, goal: "boot+usb", cfg: { usbStorage: false }, fix: { usbStorage: true },
    title: l("USB stick is invisible", "Флешка не видна"),
    descr: l("The PC ignores USB drives. Mouse and keyboard work.", "Компьютер не видит флешки. Мышь и клавиатура работают."),
    answer: l("Advanced → USB Configuration → USB Mass Storage Driver Support: Enabled.", "Расширенные → Настройки USB → Поддержка USB-накопителей: включить.") },
  { id: "e-smt", level: 1, minutes: 5, goal: "boot+smt", cfg: { smt: false }, fix: { smt: true },
    title: l("Half the threads", "Половина потоков"),
    descr: l("Task Manager shows 8 logical processors instead of 16.", "Диспетчер задач показывает 8 логических процессоров вместо 16."),
    answer: l("Advanced → CPU Configuration → SMT Mode: Enabled.", "Расширенные → Конфигурация CPU → SMT: включить.") },
  { id: "e-xmp", level: 1, minutes: 5, goal: "boot+xmp", cfg: {}, fix: { xmp: "Profile 1" },
    title: l("Slow memory", "Медленная память"),
    descr: l("The memory was bought as fast, but runs at base 4800 MT/s.", "Память покупали быструю, а работает она на базовых 4800 МТ/с."),
    answer: l("Tweaker → XMP: Profile 1 or Profile 2.", "Разгон → XMP: Profile 1 или Profile 2.") },
  { id: "e-loud", level: 1, minutes: 5, goal: "boot+silent", cfg: { fanProfile: "Full Speed" }, fix: { fanProfile: "Silent" },
    title: l("Loud as a vacuum cleaner", "Шумит как пылесос"),
    descr: l("The fans always run at full speed. Make the PC quiet.", "Вентиляторы всегда крутятся на полную. Сделайте компьютер тихим."),
    answer: l("Monitor → CPU Fan Mode: Silent.", "Мониторинг → Режим вентилятора CPU: Silent.") },

  // ——— средние: нужно понять, как связаны настройки ———
  { id: "m-oc", level: 2, minutes: 10, goal: "boot+oc5", cfg: { cpuRatio: 50, cpuVcore: 1220 }, fix: { cpuVcore: 0 },
    title: l("Unstable overclock", "Нестабильный разгон"),
    descr: l("The system crashes at the login screen. Keep the CPU at 5 GHz.", "Система падает на экране входа. Процессор должен остаться на 5 ГГц."),
    answer: l("Tweaker → CPU Core Voltage: Auto or about 1.25 V (or LLC Level 5).", "Разгон → Напряжение ядра: Auto или около 1,25 В (или LLC Level 5).") },
  { id: "m-oc-post", level: 2, minutes: 10, goal: "boot+oc5", cfg: { cpuRatio: 52, cpuVcore: 1150 }, fix: { cpuVcore: 0 },
    title: l("Overclocking Failed", "Ошибка разгона"),
    descr: l("POST stops with Overclocking Failed. Keep at least 5 GHz.", "POST останавливается с Overclocking Failed. Оставьте не меньше 5 ГГц."),
    answer: l("Tweaker → CPU Core Voltage: Auto (5.2 GHz needs ~1.31 V).", "Разгон → Напряжение ядра: Auto (для 5,2 ГГц нужно ~1,31 В).") },
  { id: "m-mem", level: 2, minutes: 10, goal: "boot+xmp", cfg: { xmp: "Profile 2", dramVoltage: 1200 }, fix: { dramVoltage: 0 },
    title: l("Memory won’t train", "Память не тренируется"),
    descr: l("After turning on fast memory, POST says Overclocking Failed. Keep XMP on.", "После включения быстрой памяти POST пишет Overclocking Failed. XMP должен остаться включённым."),
    answer: l("Tweaker → DRAM Voltage: Auto (the profile sets 1.35 V).", "Разгон → Напряжение DRAM: Auto (профиль сам выставит 1,35 В).") },
  { id: "m-dram", level: 2, minutes: 10, goal: "boot", cfg: { dramFreq: "DDR5-6800" }, fix: { dramVoltage: 1300 },
    title: l("Manual memory frequency", "Ручная частота памяти"),
    descr: l("Someone set the memory to 6800 by hand, and the PC stopped booting.", "Кто-то вручную выставил память на 6800, и компьютер перестал загружаться."),
    answer: l("DRAM Voltage ≥ 1.30 V, or DRAM Frequency: Auto.", "Напряжение DRAM не меньше 1,30 В или Частота DRAM: Auto.") },
  { id: "m-bclk", level: 2, minutes: 10, goal: "boot", cfg: { bclk: 10350 }, fix: { bclk: 0 },
    title: l("Stock ratio, still crashing", "Множитель заводской, а падает"),
    descr: l("Ratio and voltage are stock, but the system crashes at login.", "Множитель и напряжение заводские, но система падает на экране входа."),
    answer: l("Tweaker → BCLK: Auto (100 MHz). Above ~103 MHz the platform is unstable.", "Разгон → BCLK: Auto (100 МГц). Выше ~103 МГц нестабильна вся платформа.") },
  { id: "m-hot", level: 2, minutes: 10, goal: "boot", cfg: { cpuRatio: 55, fanProfile: "Silent" }, fix: { cpuRatio: 0 },
    title: l("CPU Over Temperature", "Перегрев процессора"),
    descr: l("The PC was made “quieter and faster” and now stops with CPU Over Temperature.", "Компьютер сделали «тише и быстрее», и теперь он останавливается с CPU Over Temperature."),
    answer: l("Tweaker → CPU Ratio: 54 or lower (fans alone won’t help at 55).", "Разгон → Множитель CPU: 54 или ниже (при 55 одни вентиляторы не спасут).") },
  { id: "m-rescue", level: 2, minutes: 10, goal: "linux", cfg: {}, fix: { secureBoot: false },
    title: l("Boot the rescue stick", "Загрузить спасательную флешку"),
    descr: l("Start Live Linux from the USB stick.", "Запустите Live Linux с флешки."),
    answer: l("Security → Secure Boot: off; then F11 → USB (or USB first in Boot).", "Безопасность → Secure Boot: выключить; затем F11 → USB (или флешка первой в «Загрузке»).") },
  { id: "m-csm-usb", level: 2, minutes: 10, goal: "boot+secure", cfg: { csm: true, bootOrder: USB_FIRST }, fix: { csm: false, bootOrder: STOCK_ORDER },
    title: l("Linux instead of the system", "Вместо системы — Linux"),
    descr: l("Instead of Kestrel OS some Linux starts. Return the system and its protection.", "Вместо Kestrel OS запускается какой-то Linux. Верните систему и её защиту."),
    answer: l("Boot order: Kestrel OS first; Launch CSM: off (it disabled Secure Boot).", "Порядок загрузки: Kestrel OS первой; Запуск CSM: выключить (он отключал Secure Boot).") },
  { id: "m-raid-audio", level: 2, minutes: 10, goal: "boot+audio", cfg: { sataMode: "RAID", hdAudio: false }, fix: { sataMode: "AHCI", hdAudio: true },
    title: l("After the “cleanup”", "После «чистки»"),
    descr: l("After a BIOS “cleanup” the PC doesn’t boot. And the sound was gone before that.", "После «чистки» BIOS компьютер не загружается. А ещё раньше пропал звук."),
    answer: l("SATA Mode: AHCI; HD Audio Controller: Enabled.", "Режим SATA: AHCI; Звуковой контроллер HD Audio: включить.") },
  { id: "m-lan-csm", level: 2, minutes: 10, goal: "boot+secure+lan", cfg: { lanController: false, csm: true }, fix: { lanController: true, csm: false },
    title: l("Office PC", "Офисный компьютер"),
    descr: l("An office PC: no network, and the security scan says Secure Boot is off.", "Офисный ПК: нет сети, а проверка безопасности пишет, что Secure Boot не работает."),
    answer: l("Onboard LAN Controller: Enabled; Launch CSM: off.", "Встроенный сетевой контроллер: включить; Запуск CSM: выключить.") },

  // ——— сложные: несколько причин или условие клиента ———
  { id: "h-rescue-usb", level: 3, minutes: 15, goal: "linux", cfg: { usbStorage: false }, fix: { usbStorage: true, secureBoot: false },
    title: l("The stick “isn’t there”", "Флешки «нет»"),
    descr: l("Boot Live Linux from USB. The PC acts as if the stick isn’t plugged in.", "Загрузите Live Linux с флешки. Компьютер ведёт себя так, будто её не вставили."),
    answer: l("USB Mass Storage: Enabled; Secure Boot: off; F11 → USB.", "Поддержка USB-накопителей: включить; Secure Boot: выключить; F11 → USB.") },
  { id: "h-triple", level: 3, minutes: 15, goal: "boot+lan+audio", cfg: { sataMode: "RAID", lanController: false, hdAudio: false }, fix: { sataMode: "AHCI", lanController: true, hdAudio: true },
    title: l("Back from a “repair shop”", "Вернули из «ремонта»"),
    descr: l("Blue screen at boot. The owner says network and sound were broken too.", "Синий экран при загрузке. Владелец говорит, что сеть и звук тоже не работали."),
    answer: l("SATA: AHCI; LAN Controller and HD Audio: Enabled.", "SATA: AHCI; сетевой контроллер и HD Audio: включить.") },
  { id: "h-oc-mute", level: 3, minutes: 15, goal: "boot+oc5+audio", cfg: { cpuRatio: 50, cpuVcore: 1220, hdAudio: false }, fix: { cpuVcore: 0, hdAudio: true },
    title: l("A gamer friend’s tuning", "Настройка от друга-геймера"),
    descr: l("It crashes at login and there’s no sound. Keep the friend’s 5 GHz.", "Падает на экране входа, и нет звука. 5 ГГц от друга нужно сохранить."),
    answer: l("CPU Core Voltage: Auto or ~1.25 V; HD Audio: Enabled.", "Напряжение ядра: Auto или ~1,25 В; HD Audio: включить.") },
  { id: "h-hot-quiet", level: 3, minutes: 15, goal: "boot+oc5+silent", cfg: { cpuRatio: 55, fanProfile: "Silent" }, fix: { cpuRatio: 50 },
    title: l("Fast and quiet", "Быстро и тихо"),
    descr: l("Overheats at boot. The owner wants it quiet (Silent fans) and still at 5 GHz or more.", "Перегревается при загрузке. Владелец хочет тишины (вентиляторы Silent) и не меньше 5 ГГц."),
    answer: l("CPU Ratio 50–54 with Silent fans; voltage Auto.", "Множитель 50–54 при вентиляторах Silent; напряжение Auto.") },
  { id: "h-max", level: 3, minutes: 15, goal: "boot+oc5+xmp", cfg: { xmp: "Profile 2", dramVoltage: 1200, cpuRatio: 50, cpuVcore: 1220 }, fix: { dramVoltage: 0, cpuVcore: 0 },
    title: l("Maximum performance", "Максимальная производительность"),
    descr: l("Overclocked CPU and memory, and it fails. Keep 5 GHz and XMP.", "Разогнали процессор и память — и всё сломалось. Оставьте 5 ГГц и XMP."),
    answer: l("DRAM Voltage: Auto (fixes memory training); CPU Core Voltage: Auto (fixes the crash).", "Напряжение DRAM: Auto (лечит тренировку памяти); напряжение ядра: Auto (лечит падение).") },
  { id: "h-bclk-xmp", level: 3, minutes: 15, goal: "boot+xmp", cfg: { bclk: 10450, xmp: "Profile 1" }, fix: { bclk: 0 },
    title: l("Fast memory, no POST", "Быстрая память без POST"),
    descr: l("XMP is on and the voltage is right, but memory training fails. Keep XMP.", "XMP включён, напряжение правильное, но тренировка памяти не проходит. XMP оставить."),
    answer: l("BCLK: Auto. 104.5 MHz overclocks the memory beyond the profile.", "BCLK: Auto. 104,5 МГц разгоняет и память — сверх профиля.") },
  { id: "h-vm-lab", level: 3, minutes: 15, goal: "vm+smt", cfg: { sataMode: "RAID", smt: false }, fix: { sataMode: "AHCI", smt: true, virtualization: true },
    title: l("A server for the lab", "Сервер для лаборатории"),
    descr: l("The PC must run virtual machines on all 16 threads. Right now it doesn’t even boot.", "Компьютер должен запускать виртуальные машины на всех 16 потоках. Сейчас он даже не загружается."),
    answer: l("SATA: AHCI; SMT: Enabled; SVM: Enabled; start a VM.", "SATA: AHCI; SMT: включить; SVM: включить; запустить машину.") },
  { id: "h-tight-mem", level: 3, minutes: 15, goal: "boot+mem6000", cfg: { dramFreq: "DDR5-6400", tCL: 28 }, fix: { dramVoltage: 1420 },
    title: l("Enthusiast timings", "Тайминги энтузиаста"),
    descr: l("Memory at 6400 CL28 won’t train. Keep memory at 6000 MT/s or faster.", "Память 6400 CL28 не тренируется. Частота памяти должна остаться не ниже 6000 МТ/с."),
    answer: l("DRAM Voltage ≈ 1.42 V for 6400 CL28, or XMP Profile 2 (6000) with Auto frequency and timings.", "Напряжение DRAM ≈ 1,42 В для 6400 CL28 или XMP Profile 2 (6000) с частотой и таймингами Auto.") },
  { id: "h-secure-full", level: 3, minutes: 15, goal: "boot+secure+lan+audio", cfg: { csm: true, bootOrder: USB_FIRST, lanController: false, hdAudio: false },
    fix: { csm: false, bootOrder: STOCK_ORDER, lanController: true, hdAudio: true },
    title: l("Prepare a school PC", "Подготовить школьный ПК"),
    descr: l("Linux starts instead of the system, no network, no sound. Make it a proper protected school PC.", "Вместо системы стартует Linux, нет сети и звука. Сделайте нормальный защищённый школьный компьютер."),
    answer: l("Kestrel OS first; CSM off; LAN and HD Audio on.", "Kestrel OS первой; CSM выключить; сеть и HD Audio включить.") },
  { id: "h-all-wrong", level: 3, minutes: 15, goal: "boot+secure+usb", cfg: { sataMode: "RAID", csm: true, usbStorage: false }, fix: { sataMode: "AHCI", csm: false, usbStorage: true },
    title: l("Everything is wrong", "Всё не так"),
    descr: l("Doesn’t boot, protection is off, USB sticks are not seen. Fix all three.", "Не загружается, защита выключена, флешки не видны. Исправьте все три."),
    answer: l("SATA: AHCI; CSM: off; USB Mass Storage: Enabled.", "SATA: AHCI; CSM: выключить; поддержка USB-накопителей: включить.") },
];

export const libraryTask = (id: string) => LIBRARY.find((x) => x.id === id);
