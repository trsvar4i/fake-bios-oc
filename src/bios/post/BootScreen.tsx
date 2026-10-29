import { useEffect, useMemo, useState } from "react";
import { useStore, useLang } from "../../machine/store";
import { bootScript } from "../../machine/boot";
import { sound } from "../../machine/audio";
import { useOs } from "../../os/osStore";

/** Текст POST, перебор устройств и итог загрузки. Успешная загрузка Kestrel OS передаёт управление ОС. */
export function BootScreen() {
  const { lang } = useLang();
  const script = useMemo(() => {
    const s = useStore.getState();
    return bootScript(s.saved, s.override);
  }, []);
  const [shown, setShown] = useState(0);
  const [done, setDone] = useState(false);
  const { final } = script;

  useEffect(() => {
    const delay = useStore.getState().saved.fastBoot ? 90 : 220;
    const ids = script.lines.map((_, i) => window.setTimeout(() => setShown(i + 1), i * delay));
    ids.push(window.setTimeout(() => setDone(true), script.lines.length * delay + 400));
    return () => ids.forEach(clearTimeout);
  }, [script]);

  // звук устройств по мере появления строк
  useEffect(() => {
    const text = script.lines[shown - 1]?.text ?? "";
    if (text.startsWith("Detecting storage")) sound.hddSeek(6);
    if (text.startsWith("Booting from SATA1")) sound.hddSeek(4);
    if (text.startsWith("Booting from SATA3")) sound.dvdSpin();
  }, [shown, script]);

  useEffect(() => {
    if (!done) return;
    if (final.type === "os") {
      useOs.getState().reset();
      useStore.getState().patch({ phase: "os", osUnstable: !!final.unstable });
      return;
    }
    if (final.type === "ocfail") [0, 0.35, 0.7].forEach((at) => sound.beep(1000, 0.18, at));
    if (!final.alarm) return;
    sound.sirenStart();
    return () => sound.sirenStop();
  }, [done, final]);

  const restart = () => useStore.getState().restart();
  const shutdown = () => {
    sound.powerOff();
    useStore.getState().shutdown();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!done) return;
      if (final.type === "ocfail") {
        if (e.key === "F1") { e.preventDefault(); useStore.getState().enterSetup(); }
        if (e.key === "F2") { e.preventDefault(); useStore.getState().clearCmos(); }
        return;
      }
      if (e.key === "Delete") { e.preventDefault(); useStore.getState().enterSetup(); }
      if (e.key.toLowerCase() === "r") restart();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [done, final]);

  if (done && final.type === "ocfail") {
    return (
      <div className="boot ocfail">
        <div className="ocf-box">
          <div className="ocf-title">{final.title[lang]}</div>
          <p>{final.hint[lang]}</p>
          <p>{lang === "ru" ? "Войдите в Setup и измените настройки разгона." : "Please enter Setup to re-configure your system."}</p>
          <div className="boot-actions">
            <span onClick={() => useStore.getState().enterSetup()}>Press <b>F1</b> to Run SETUP</span>
            <span onClick={() => useStore.getState().clearCmos()}>Press <b>F2</b> to Load Default Values and Continue</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="boot">
      <pre className="boot-log">
        {script.lines.slice(0, shown).map((ln, i) => (
          <span key={i} className={ln.cls}>{ln.text + "\n"}</span>
        ))}
      </pre>
      {done && final.type !== "os" && (
        <>
          <div className={"boot-final " + final.type}>
            {final.title[lang]}
            <small>{final.hint[lang]}</small>
          </div>
          <div className="boot-actions">
            <span onClick={() => useStore.getState().enterSetup()}>Press <b>DEL</b> to enter Setup</span>
            <span onClick={restart}>Press <b>R</b> to restart</span>
            <span onClick={shutdown}>Hold <b>Power</b> to shut down</span>
          </div>
        </>
      )}
    </div>
  );
}
