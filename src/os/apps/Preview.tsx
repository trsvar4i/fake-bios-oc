import { useEffect, useState } from "react";
import { useLang } from "../../machine/store";
import { isAvailable, useOs } from "../osStore";
import { join, nameOf, parentOf, useFs } from "../fs";
import { isImage } from "./Finder";
import "./Preview.css";

/** Просмотр картинок: листание по папке стрелками, увеличение, «Изменить» в Рисовалке. */
export function Preview({ winId }: { winId: number }) {
  const { t } = useLang();
  const path = useOs((s) => s.windows.find((w) => w.id === winId)?.arg);
  const fs = useFs();
  const [zoom, setZoom] = useState(1);
  const dir = path ? parentOf(path) : null;
  const siblings = dir ? fs.list(dir).filter(isImage).map((n) => join(dir, n)) : [];
  const i = path ? siblings.indexOf(path) : -1;
  const data = path ? fs.read(path) : null;

  const go = (d: number) => {
    if (siblings.length < 2) return;
    useOs.getState().update(winId, { arg: siblings[(i + d + siblings.length) % siblings.length] });
    setZoom(1);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const top = useOs.getState().windows.filter((w) => !w.min).sort((a, b) => b.z - a.z)[0];
      if (top?.id !== winId) return;
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!path || !data?.startsWith("data:image")) {
    return <div className="pv-empty">{t("Open a picture from Files — for example one saved in Paint.", "Откройте картинку из «Файлов» — например, сохранённую в Рисовалке.")}</div>;
  }
  return (
    <div className="preview">
      <div className="pv-bar">
        <button className="fd-nav" disabled={siblings.length < 2} onClick={() => go(-1)} title={t("Previous", "Предыдущая")}><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" /></svg></button>
        <button className="fd-nav" disabled={siblings.length < 2} onClick={() => go(1)} title={t("Next", "Следующая")}><svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" /></svg></button>
        <span className="pv-count">{i + 1} / {siblings.length}</span>
        <div className="pt-spacer" />
        <button className="set-btn" onClick={() => setZoom(Math.max(0.25, zoom / 1.25))}>−</button>
        <span className="pv-zoom">{Math.round(zoom * 100)}%</span>
        <button className="set-btn" onClick={() => setZoom(Math.min(4, zoom * 1.25))}>+</button>
        {isAvailable("paint") && <button className="set-btn primary" onClick={() => useOs.getState().open("paint", path)}>{t("Edit in Paint", "Изменить в Рисовалке")}</button>}
      </div>
      <div className="pv-stage">
        <img key={path} src={data} alt={nameOf(path)} style={{ transform: `scale(${zoom})` }} draggable={false} />
      </div>
    </div>
  );
}
