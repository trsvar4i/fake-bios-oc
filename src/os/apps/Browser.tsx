// Браузер Kestrel: вкладки, история, адресная строка и встроенные страницы «интернета» kestrel.os.
// Без сетевой карты (выключена в BIOS) сайты не открываются — только страница «Нет подключения».
import { useState, type ReactNode } from "react";
import { useStore, useLang } from "../../machine/store";
import { useOs } from "../osStore";
import { osPower } from "../power";
import { OsLogo } from "../AppIcon";
import "./Browser.css";

const HOME = "kestrel.os";
const SITES = ["kestrel.os", "kestrel.os/help", "kestrel.os/about", "kestrel.os/changelog"];
const REPO = "https://github.com/trsvar4i/fake-bios-oc";

interface Tab { id: number; history: string[]; idx: number; loading: number }

/** Адрес из того, что набрал человек: без протокола и завершающей косой черты. */
const normalize = (raw: string) => raw.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/+$/, "") || HOME;

export function Browser() {
  const { t } = useLang();
  const [tabs, setTabs] = useState<Tab[]>([{ id: 1, history: [HOME], idx: 0, loading: 0 }]);
  const [cur, setCur] = useState(1);
  const [field, setField] = useState<string | null>(null);
  const tab = tabs.find((x) => x.id === cur) ?? tabs[0];
  const url = tab.history[tab.idx];

  const patch = (id: number, p: Partial<Tab>) => setTabs((ts) => ts.map((x) => (x.id === id ? { ...x, ...p } : x)));
  /** короткая полоса загрузки: страница «грузится» из сети */
  const load = (id: number) => {
    const stamp = Date.now();
    patch(id, { loading: stamp });
    window.setTimeout(() => setTabs((ts) => ts.map((x) => (x.id === id && x.loading === stamp ? { ...x, loading: 0 } : x))), 520);
  };
  const go = (raw: string) => {
    const to = normalize(raw);
    const history = [...tab.history.slice(0, tab.idx + 1), to];
    patch(tab.id, { history, idx: history.length - 1 });
    setField(null);
    load(tab.id);
  };
  const step = (d: number) => { const idx = Math.max(0, Math.min(tab.history.length - 1, tab.idx + d)); patch(tab.id, { idx }); load(tab.id); };
  const newTab = () => {
    const id = Math.max(...tabs.map((x) => x.id)) + 1;
    setTabs([...tabs, { id, history: [HOME], idx: 0, loading: 0 }]);
    setCur(id);
    load(id);
  };
  const closeTab = (id: number) => {
    if (tabs.length === 1) return;
    const i = tabs.findIndex((x) => x.id === id);
    const rest = tabs.filter((x) => x.id !== id);
    setTabs(rest);
    if (id === cur) setCur(rest[Math.max(0, i - 1)].id);
  };

  return (
    <div className="browser">
      <div className="br-tabs">
        {tabs.map((x) => (
          <div key={x.id} className={"br-tab" + (x.id === cur ? " on" : "")} onClick={() => setCur(x.id)}>
            <span className="br-fav"><OsLogo size={14} mono /></span>
            <span className="br-tab-name">{titleOf(x.history[x.idx], t)}</span>
            {tabs.length > 1 && <button onClick={(e) => { e.stopPropagation(); closeTab(x.id); }} aria-label={t("Close tab", "Закрыть вкладку")}>×</button>}
          </div>
        ))}
        <button className="br-new" onClick={newTab} aria-label={t("New tab", "Новая вкладка")}>+</button>
      </div>
      <div className="br-bar">
        <button className="br-nav" disabled={tab.idx === 0} onClick={() => step(-1)} aria-label={t("Back", "Назад")}><svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6" /></svg></button>
        <button className="br-nav" disabled={tab.idx === tab.history.length - 1} onClick={() => step(1)} aria-label={t("Forward", "Вперёд")}><svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6" /></svg></button>
        <button className="br-nav" onClick={() => load(tab.id)} aria-label={t("Reload", "Обновить")}><svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v4.5h-4.5" /></svg></button>
        <form className="br-url" onSubmit={(e) => { e.preventDefault(); go(field ?? url); }}>
          <svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
          <input value={field ?? url} onFocus={(e) => { setField(url); e.currentTarget.select(); }} onBlur={() => setField(null)} onChange={(e) => setField(e.target.value)} spellCheck={false} />
        </form>
        <button className="br-nav" onClick={() => go(HOME)} aria-label={t("Home", "Домой")}><svg viewBox="0 0 24 24"><path d="M4 11l8-7 8 7M6 9.5V20h12V9.5" /></svg></button>
        {tab.loading > 0 && <i className="br-progress" key={tab.loading} />}
      </div>
      <div className="br-page" key={url + tab.idx}>
        {tab.loading > 0 ? <div className="br-blank" /> : <Page url={url} go={go} />}
      </div>
    </div>
  );
}

function titleOf(url: string, t: (en: string, ru?: string) => string) {
  const map: Record<string, string> = {
    "kestrel.os": "Kestrel", "kestrel.os/help": t("Help", "Справка"), "kestrel.os/about": t("About", "О проекте"), "kestrel.os/changelog": t("What's new", "Что нового"),
  };
  return map[url] ?? url;
}

function Page({ url, go }: { url: string; go: (u: string) => void }) {
  const { t } = useLang();
  const online = useStore((s) => s.saved.lanController);
  if (!online) {
    return (
      <div className="br-error">
        <svg viewBox="0 0 24 24"><path d="M3 3l18 18M8.5 8.5A6 6 0 0 0 6 13M2 9a15 15 0 0 1 4-3M10.7 5.1A15 15 0 0 1 22 9M17.8 13a6 6 0 0 0-2.2-3M12 17h.01" /></svg>
        <h2>{t("No internet connection", "Нет подключения к интернету")}</h2>
        <p>{t("The network card is disabled in the firmware, so the system has no network at all.", "Сетевая карта выключена в прошивке, поэтому у системы нет сети вообще.")}</p>
        <code>ERR_INTERNET_DISCONNECTED</code>
        <div className="br-actions">
          <button className="set-btn primary" onClick={osPower.restartToFirmware}>{t("Restart to BIOS", "Перезагрузить в BIOS")}</button>
        </div>
        <small>{t("BIOS → Advanced → Integrated Peripherals → Onboard LAN Controller", "BIOS → Advanced → Integrated Peripherals → Onboard LAN Controller")}</small>
      </div>
    );
  }
  if (!SITES.includes(url)) {
    return (
      <div className="br-error">
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M9 9l6 6M15 9l-6 6" /></svg>
        <h2>{t("This site can’t be reached", "Не удаётся открыть сайт")}</h2>
        <p>{t(`The simulated internet of this PC only knows ${HOME}.`, `Виртуальный интернет этого ПК знает только ${HOME}.`)}</p>
        <code>DNS_PROBE_FINISHED_NXDOMAIN · {url}</code>
        <div className="br-actions"><button className="set-btn primary" onClick={() => go(HOME)}>{t("Go to Kestrel", "На главную")}</button></div>
      </div>
    );
  }
  const L = ({ to, children }: { to: string; children: ReactNode }) => <a className="br-link" onClick={() => go(to)}>{children}</a>;
  const nav = (
    <nav className="site-nav">
      <span className="site-brand" onClick={() => go(HOME)}><OsLogo size={26} /> Kestrel</span>
      <L to="kestrel.os/help">{t("Help", "Справка")}</L>
      <L to="kestrel.os/changelog">{t("What's new", "Что нового")}</L>
      <L to="kestrel.os/about">{t("About", "О проекте")}</L>
    </nav>
  );
  if (url === HOME) {
    return (
      <div className="site">
        {nav}
        <section className="site-hero">
          <OsLogo size={92} />
          <h1>{t("A whole PC in your browser", "Целый компьютер в браузере")}</h1>
          <p>{t("Power button, POST, a UEFI BIOS whose settings really matter, and Kestrel OS on top.", "Кнопка питания, POST, UEFI BIOS, настройки которого действительно важны, и Kestrel OS сверху.")}</p>
          <div className="br-actions">
            <button className="set-btn primary" onClick={() => go("kestrel.os/help")}>{t("What can I break?", "Что можно сломать?")}</button>
            <button className="set-btn" onClick={() => useOs.getState().open("quests")}>{t("Open Challenges", "Открыть испытания")}</button>
          </div>
        </section>
        <section className="site-cards">
          {[
            [t("Overclock", "Разгон"), t("CPU ratio, BCLK, LLC and voltage in Tweaker. Too little voltage — the OS crashes.", "Множитель, BCLK, LLC и напряжение в Tweaker. Мало напряжения — система падает.")],
            [t("Cooling", "Охлаждение"), t("Fan curves change temperature, noise and throttling in the OS.", "Кривые вентиляторов меняют температуру, шум и троттлинг в системе.")],
            [t("Devices", "Устройства"), t("No LAN — no internet and no Store. No HD Audio — silence.", "Нет LAN — нет интернета и Магазина. Нет HD Audio — тишина.")],
            [t("Boot", "Загрузка"), t("Secure Boot, CSM, USB and boot order lead to different outcomes.", "Secure Boot, CSM, USB и порядок загрузки дают разные исходы.")],
          ].map(([h, p]) => <div key={h} className="site-card"><b>{h}</b><span>{p}</span></div>)}
        </section>
      </div>
    );
  }
  if (url === "kestrel.os/help") {
    const rows: [string, string][] = [
      [t("Enter BIOS", "Войти в BIOS"), t("Press DEL while the logo is shown. F11 opens the Boot Menu. In the OS: Nest → power → Restart to BIOS.", "DEL на логотипе. F11 — меню загрузки. Из системы: «Гнездо» → питание → «В BIOS».")],
      [t("Crash the OS", "Уронить систему"), t("Tweaker: CPU Ratio 52 with Vcore a bit lower than required. POST passes, the OS panics.", "Tweaker: множитель 52, Vcore чуть ниже нужного. POST пройдёт, система упадёт.")],
      [t("Fail POST", "Не пройти POST"), t("Voltage far too low, or XMP with low DRAM voltage → “Overclocking Failed”.", "Напряжение сильно ниже нужного или XMP с низким DRAM → «Overclocking Failed».")],
      [t("Overheat", "Перегреть"), t("Fan mode Silent + high ratio. Run `stress` in Terminal and watch System Monitor.", "Режим вентилятора Silent + высокий множитель. `stress` в Терминале, смотрите Мониторинг.")],
      [t("Boot Linux", "Загрузить Linux"), t("Disable Secure Boot (or enable CSM), put USB first or pick it in F11.", "Выключите Secure Boot (или включите CSM), поставьте USB первым или выберите в F11.")],
      [t("Lose the disk", "Потерять диск"), t("SATA Mode → RAID gives INACCESSIBLE_BOOT_DEVICE.", "SATA Mode → RAID даёт INACCESSIBLE_BOOT_DEVICE.")],
      [t("Virtual machines", "Виртуальные машины"), t("SVM Mode must be enabled for Kestrel VM.", "Для Kestrel VM нужен включённый SVM.")],
      [t("Lock the BIOS", "Запереть BIOS"), t("Security → Administrator Password. Forgot it? Clear CMOS on the POST error screen.", "Security → Administrator Password. Забыли? Clear CMOS на экране ошибки POST.")],
    ];
    return (
      <div className="site">
        {nav}
        <article className="site-article">
          <h1>{t("How the BIOS shapes this PC", "Как BIOS управляет этим ПК")}</h1>
          <p className="site-lead">{t("Every setting is saved to CMOS and read by the OS on boot.", "Каждая настройка записывается в CMOS и читается системой при загрузке.")}</p>
          <dl className="site-dl">{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
        </article>
      </div>
    );
  }
  if (url === "kestrel.os/changelog") {
    const items: [string, string, string[]][] = [
      ["2.0", t("October 2026", "Октябрь 2026"), [
        t("New Kestrel interface: Perch, Hub, Nest and Swoop instead of the old macOS-like shell", "Новый интерфейс Kestrel: «Насест», «Хаб», «Гнездо» и «Бросок» вместо прежней оболочки в духе macOS"),
        t("UEFI BIOS: Tweaker with BCLK, LLC, PBO and memory timings, Hardware Monitor graphs, Tool tab with Instant Flash and OC profiles, Setup password", "UEFI BIOS: Tweaker с BCLK, LLC, PBO и таймингами памяти, графики мониторинга, вкладка Tool с Instant Flash и профилями разгона, пароль на Setup"),
        t("Challenges, configuration links, Browser, guest system in Kestrel VM", "Испытания, ссылки на конфигурацию, Браузер, гостевая система в Kestrel VM"),
        t("Lite mode and reduced motion", "Облегчённый режим и «меньше движения»"),
      ]],
      ["1.2", t("October 2026", "Октябрь 2026"), [t("Desktops, users, onboarding, phones", "Рабочие столы, пользователи, знакомство, телефоны")]],
      ["1.0", t("September 2026", "Сентябрь 2026"), [t("First release: POST, BIOS, Kestrel OS", "Первый выпуск: POST, BIOS, Kestrel OS")]],
    ];
    return (
      <div className="site">
        {nav}
        <article className="site-article">
          <h1>{t("What's new", "Что нового")}</h1>
          {items.map(([v, d, list]) => (
            <section key={v} className="site-release">
              <h3>Kestrel {v} <small>{d}</small></h3>
              <ul>{list.map((x) => <li key={x}>{x}</li>)}</ul>
            </section>
          ))}
        </article>
      </div>
    );
  }
  return (
    <div className="site">
      {nav}
      <article className="site-article">
        <h1>{t("About the project", "О проекте")}</h1>
        <p className="site-lead">{t("Kestrel PC is a PC simulator: firmware, boot and an operating system written from scratch for the web.", "Kestrel PC — симулятор ПК: прошивка, загрузка и операционная система, написанные с нуля для веба.")}</p>
        <p>{t("Built with Vite, React, TypeScript and zustand. Sounds are synthesized with Web Audio — no samples.", "Сделано на Vite, React, TypeScript и zustand. Звуки синтезируются Web Audio — без сэмплов.")}</p>
        <p>{t("Kestrel is a small falcon — hence the hexagon with a wing, the Perch and the Nest.", "Kestrel — пустельга, маленький сокол: отсюда шестиугольник с крылом, «Насест» и «Гнездо».")}</p>
        <p><a className="br-link" href={REPO} target="_blank" rel="noreferrer">{REPO.replace("https://", "")}</a></p>
      </article>
    </div>
  );
}
