import { useEffect, useState } from "react";
import { useLang } from "../../machine/store";
import { useOs } from "../osStore";
import { HOME, join, useFs } from "../fs";
import "./Notes.css";

/** Заметки живут обычными файлами в ~/Notes — их видно в «Файлах» и Терминале. */
export const NOTES_DIR = `${HOME}/Notes`;

/**
 * Папка заметок и перенос старой заметки: раньше текст хранился в настройках (prefs.notes),
 * теперь — файлом ~/Notes. Вызов повторно ничего не делает.
 */
export function ensureNotes(ru: boolean) {
  const fs = useFs.getState();
  if (!fs.exists(NOTES_DIR)) fs.mkdir(NOTES_DIR);
  const old = useOs.getState().prefs.notes;
  if (old.trim()) {
    fs.write(join(NOTES_DIR, fs.freeName(NOTES_DIR, ru ? "Заметка" : "Note", ".txt")), old);
    useOs.getState().setPref("notes", "");
  }
}

/** Все заметки, свежие первыми. */
export function useNoteFiles() {
  const nodes = useFs((s) => s.nodes);
  return Object.keys(nodes)
    .filter((p) => p.startsWith(NOTES_DIR + "/") && !p.slice(NOTES_DIR.length + 1).includes("/") && nodes[p].type === "file")
    .sort((a, b) => (nodes[b].mtime ?? 0) - (nodes[a].mtime ?? 0));
}

const titleOf = (path: string, text: string) => text.trim().split("\n")[0].slice(0, 40) || path.split("/").pop()!.replace(/\.txt$/, "");

/** Заметки: список слева, текст справа. Сохраняются автоматически. */
export function Notes() {
  const { t, lang } = useLang();
  const fs = useFs();
  const files = useNoteFiles();
  const [cur, setCur] = useState<string | null>(null);
  const [pos, setPos] = useState({ ln: 1, col: 1 });
  useEffect(() => ensureNotes(lang === "ru"), []);
  const path = cur && fs.exists(cur) ? cur : files[0] ?? null;
  const text = path ? fs.read(path) ?? "" : "";

  const track = (el: HTMLTextAreaElement) => {
    const lines = el.value.slice(0, el.selectionStart).split("\n");
    setPos({ ln: lines.length, col: lines[lines.length - 1].length + 1 });
  };
  const create = () => {
    ensureNotes(lang === "ru");
    const p = join(NOTES_DIR, fs.freeName(NOTES_DIR, t("Note", "Заметка"), ".txt"));
    fs.write(p, "");
    setCur(p);
  };
  const date = (p: string) => new Date(fs.nodes[p]?.mtime ?? Date.now()).toLocaleDateString(lang === "ru" ? "ru-RU" : "en-GB", { day: "numeric", month: "short" });

  return (
    <div className="notes">
      <aside className="notes-list">
        <div className="notes-bar">
          <span>{t("Notes", "Заметки")}</span>
          <button onClick={create} aria-label={t("New note", "Новая заметка")}>+</button>
        </div>
        {files.map((p) => (
          <button key={p} className={"note-item" + (p === path ? " on" : "")} onClick={() => setCur(p)}>
            <b>{titleOf(p, fs.read(p) ?? "")}</b>
            <small>{date(p)} · {(fs.read(p) ?? "").trim().split("\n")[1]?.slice(0, 30) || t("No more text", "Нет текста")}</small>
          </button>
        ))}
        {!files.length && <div className="notes-empty">{t("No notes yet", "Заметок пока нет")}</div>}
      </aside>
      <section className="notes-main">
        {path ? (
          <>
            <textarea
              key={path}
              value={text}
              autoFocus
              spellCheck={false}
              placeholder={t("Start typing…", "Начните печатать…")}
              onChange={(e) => { fs.write(path, e.target.value); track(e.target); }}
              onKeyUp={(e) => track(e.currentTarget)}
              onClick={(e) => track(e.currentTarget)}
            />
            <div className="notes-status">
              <span>~/Notes/{path.split("/").pop()}</span>
              <span>{t("Ln", "Стр")} {pos.ln}, {t("Col", "Стлб")} {pos.col} · {text.length} {t("characters", "символов")}</span>
              <button onClick={() => { fs.trash(path); setCur(null); }}>{t("Move to Trash", "В Корзину")}</button>
            </div>
          </>
        ) : (
          <div className="notes-empty big"><button className="set-btn primary" onClick={create}>{t("New note", "Новая заметка")}</button></div>
        )}
      </section>
    </div>
  );
}
