import { useLang } from "../../machine/store";
import { useOs } from "../osStore";
import { useFs } from "../fs";
import "./TextEdit.css";

/** Текстовый редактор файла из Finder. Изменения сохраняются сразу, как в macOS. */
export function TextEdit({ winId }: { winId: number }) {
  const { t } = useLang();
  const path = useOs((s) => s.windows.find((w) => w.id === winId)?.arg);
  const text = useFs((s) => (path && s.nodes[path]?.type === "file" ? s.nodes[path].content ?? "" : null));

  if (!path) return null;
  if (text === null) {
    return <div className="te-missing">{t("The document was moved or deleted.", "Документ перемещён или удалён.")}</div>;
  }
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  return (
    <div className="textedit">
      <textarea
        autoFocus
        value={text}
        spellCheck={false}
        placeholder={t("Start typing…", "Начните печатать…")}
        onChange={(e) => useFs.getState().write(path, e.target.value)}
      />
      <div className="te-status">{words} {t("words", "слов")} · {text.length} {t("characters", "символов")} · {t("Saved", "Сохранено")}</div>
    </div>
  );
}
