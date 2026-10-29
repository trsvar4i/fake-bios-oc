import { useState } from "react";
import { useStore, useLang } from "../machine/store";
import { DEVICES } from "../machine/hardware";
import { useMuted, sound } from "../machine/audio";
import { useOs, topWindow } from "./osStore";
import { APP_META } from "./apps/meta";
import { AppIcon, OsLogo } from "./AppIcon";
import { Window } from "./Window";
import { osPower } from "./power";
import { stageScale, useNow } from "./util";

export function Desktop() {
  const os = useOs();
  const { lang, t } = useLang();
  const [ctx, setCtx] = useState<{ x: number; y: number } | null>(null);
  const top = topWindow(os.windows);

  return (
    <div
      className={"desktop wp-" + os.prefs.wallpaper}
      onPointerDown={() => { os.toggleStart(false); setCtx(null); useOs.setState({ selectedIcon: null }); }}
      onContextMenu={(e) => {
        e.preventDefault();
        const { k, left, top: tp } = stageScale();
        setCtx({ x: (e.clientX - left) / k, y: (e.clientY - tp) / k });
      }}
    >
      <div className="icons">
        {Object.values(APP_META).map((m) => (
          <div
            key={m.id}
            className={"dicon" + (os.selectedIcon === m.id ? " sel" : "")}
            onPointerDown={(e) => { e.stopPropagation(); setCtx(null); os.toggleStart(false); useOs.setState({ selectedIcon: m.id }); }}
            onDoubleClick={() => os.open(m.id)}
          >
            <AppIcon name={m.icon} size={60} />
            <span>{m.title[lang]}</span>
          </div>
        ))}
      </div>

      {os.windows.filter((w) => !w.min).map((w) => (
        <Window key={w.id} win={w} active={top?.id === w.id} />
      ))}

      {ctx && (
        <div className="ctxmenu" style={{ left: ctx.x, top: ctx.y }} onPointerDown={(e) => e.stopPropagation()}>
          <button onClick={() => { os.open("terminal"); setCtx(null); }}>{t("Open Terminal", "Открыть терминал")}</button>
          <button onClick={() => { os.open("settings"); setCtx(null); }}>{t("Personalize", "Персонализация")}</button>
          <button onClick={() => { os.open("thispc"); setCtx(null); }}>{t("System properties", "Свойства системы")}</button>
        </div>
      )}

      <StartMenu />
      <Taskbar />
    </div>
  );
}

function Taskbar() {
  const os = useOs();
  const saved = useStore((s) => s.saved);
  const { lang, t } = useLang();
  const muted = useMuted();
  const now = useNow();
  const top = topWindow(os.windows);
  const locale = lang === "ru" ? "ru-RU" : "en-GB";

  return (
    <div className="taskbar" onPointerDown={(e) => e.stopPropagation()}>
      <button className={"tb-start" + (os.startOpen ? " on" : "")} onClick={() => os.toggleStart()}>
        <OsLogo size={34} />
      </button>
      <div className="tb-apps">
        {os.windows.map((w) => (
          <button
            key={w.id}
            className={"tb-app" + (top?.id === w.id ? " active" : "") + (w.min ? " min" : "")}
            onClick={() => (top?.id === w.id ? os.minimize(w.id) : os.focus(w.id))}
          >
            <AppIcon name={APP_META[w.app].icon} size={30} />
            <span>{APP_META[w.app].title[lang]}</span>
          </button>
        ))}
      </div>
      <div className="tb-tray">
        <span className={"tray-ico" + (saved.lanController ? "" : " off")}>
          <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="12" rx="1" /><path d="M8 20h8M12 16v4" />{!saved.lanController && <path d="M4 3l16 18" />}</svg>
          <span>{saved.lanController ? t("Ethernet", "Ethernet") : t("No network", "Нет сети")}</span>
        </span>
        <button
          className={"tray-ico" + (!saved.hdAudio || muted ? " off" : "")}
          onClick={() => saved.hdAudio && sound.setMuted(!muted)}
        >
          <svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z" />{saved.hdAudio && !muted ? <path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11" /> : <path d="M16 9l5 6M21 9l-5 6" />}</svg>
          <span>{saved.hdAudio ? (muted ? t("Muted", "Без звука") : t("Sound", "Звук")) : t("No audio device", "Нет аудиоустройства")}</span>
        </button>
        <div className="tb-clock">
          <div>{now.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}</div>
          <div>{now.toLocaleDateString(locale)}</div>
        </div>
      </div>
    </div>
  );
}

function StartMenu() {
  const os = useOs();
  const { lang, t } = useLang();
  const [power, setPower] = useState(false);
  if (!os.startOpen) return null;

  return (
    <div className="start" onPointerDown={(e) => e.stopPropagation()}>
      <div className="start-head">
        <OsLogo size={30} />
        Kestrel OS
      </div>
      <div className="start-apps">
        {Object.values(APP_META).map((m) => (
          <button key={m.id} className="start-app" onClick={() => os.open(m.id)}>
            <AppIcon name={m.icon} size={44} />
            <span>{m.title[lang]}</span>
          </button>
        ))}
      </div>
      <div className="start-foot">
        <div className="start-user">
          <span className="avatar">{os.prefs.userName.slice(0, 1).toUpperCase()}</span>
          {os.prefs.userName}
        </div>
        <div className="start-power">
          <button className="pwr-btn" onClick={() => setPower(!power)}>
            <svg viewBox="0 0 24 24"><path d="M12 3v8M6.5 6.5a8 8 0 1 0 11 0" /></svg>
          </button>
          {power && (
            <div className="power-menu">
              <button onClick={osPower.lock}>{t("Lock", "Заблокировать")}</button>
              <button onClick={osPower.restartToFirmware}>{t("Restart to UEFI (BIOS)", "Перезагрузить в UEFI (BIOS)")}</button>
              <button onClick={osPower.restart}>{t("Restart", "Перезагрузка")}</button>
              <button onClick={osPower.shutdown}>{t("Shut down", "Завершение работы")}</button>
            </div>
          )}
        </div>
      </div>
      <div className="start-boot">{t("Booted from", "Загружено с")}: {DEVICES.OS.short}</div>
    </div>
  );
}
