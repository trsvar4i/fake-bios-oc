import { useState } from "react";
import { useStore, useLang } from "../../machine/store";
import { useOs } from "../osStore";
import { APP_META } from "./meta";
import { AppIcon } from "../AppIcon";
import { music } from "../music";
import "./AppStore.css";

/** Установка: имитация загрузки, затем программа появляется в «Гнезде», «Броске» и Терминале. */
function install(id: string, title: string, note: string, done: () => void) {
  window.setTimeout(() => {
    const os = useOs.getState();
    os.setPref("installed", [...new Set([...os.prefs.installed, id])]);
    os.notify(id, title, note);
    done();
  }, 1800);
}
function uninstall(id: string) {
  const os = useOs.getState();
  os.quit(id);
  if (id === "music") music.pause();
  os.setPref("installed", os.prefs.installed.filter((a) => a !== id));
  os.setPref("dock", os.prefs.dock.filter((a) => a !== id));
}

/** Магазин приложений: карточки и одна кнопка — никаких команд в терминале. */
export function AppStore() {
  const { t, lang } = useLang();
  const installed = useOs((s) => s.prefs.installed);
  const online = useStore((s) => s.saved.lanController);
  const [busy, setBusy] = useState<string | null>(null);
  const apps = Object.values(APP_META).filter((m) => m.store);

  return (
    <div className="appstore">
      <div className="as-hero">
        <div className="as-kicker">{t("Kestrel App Store", "Магазин Kestrel")}</div>
        <h1>{t("Everything installs with one button.", "Всё ставится одной кнопкой.")}</h1>
        <p>{t("No terminal, no package names — pick an app and press Get.", "Без терминала и названий пакетов — выберите программу и нажмите «Загрузить».")}</p>
      </div>
      {!online && (
        <div className="set-warn as-offline">
          {t("No network: the network card is disabled in BIOS. Turn on LAN Controller to download apps.", "Нет сети: сетевая карта выключена в BIOS. Включите LAN Controller, чтобы загружать программы.")}
        </div>
      )}
      <div className="as-grid">
        {apps.map((m) => {
          const has = installed.includes(m.id);
          const loading = busy === m.id;
          return (
            <div key={m.id} className="as-card">
              <AppIcon name={m.icon} size={84} />
              <div className="as-info">
                <div className="as-name">{m.title[lang]}</div>
                <div className="as-desc">{m.store!.desc[lang]}</div>
                <div className="as-size">{m.store!.size}</div>
              </div>
              <div className="as-actions">
                {has ? (
                  <>
                    <button className="as-get" onClick={() => useOs.getState().open(m.id)}>{t("Open", "Открыть")}</button>
                    <button className="as-del" onClick={() => uninstall(m.id)}>{t("Uninstall", "Удалить")}</button>
                  </>
                ) : loading ? (
                  <span className="as-ring" aria-label="Installing" />
                ) : (
                  <button className="as-get" disabled={!online || !!busy} onClick={() => { setBusy(m.id); install(m.id, m.title[lang], t("Installed — find it in the Nest (Alt+L)", "Установлено — ищите в «Гнезде» (Alt+L)"), () => setBusy(null)); }}>
                    {t("Get", "Загрузить")}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
