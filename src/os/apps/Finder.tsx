import { useEffect, useRef, useState } from "react";
import { useStore, useLang } from "../../machine/store";
import { isAvailable, useOs, type MenuItem } from "../osStore";
import { HOME, TRASH, isTrashed, join, nameOf, parentOf, useFs } from "../fs";
import { AppIcon } from "../AppIcon";
import { stageScale } from "../util";
import "./Finder.css";

/** Что делает двойной щелчок по объекту: папку открывает, файл — в TextEdit. */
export const isImage = (p: string) => /\.png$/i.test(p);

export function openPath(path: string, winId?: number) {
  const fs = useFs.getState();
  if (fs.isDir(path)) {
    if (winId !== undefined) useOs.getState().update(winId, { arg: path });
    else useOs.getState().open("finder", path);
  } else if (!isTrashed(path)) {
    if (isImage(path)) {
      const app = isAvailable("preview") ? "preview" : isAvailable("paint") ? "paint" : null;
      if (app) useOs.getState().open(app, path);
      else useOs.getState().notify("appstore", "Preview", path.split("/").pop() + " — install Preview from the App Store");
    } else useOs.getState().open("textedit", path);
  }
}

/** Пункты контекстного меню для файла или папки (Finder и рабочий стол). */
export function itemMenu(path: string, t: (en: string, ru: string) => string, rename: () => void, winId?: number): MenuItem[] {
  const fs = useFs.getState();
  if (isTrashed(path)) {
    return [
      { label: t("Put Back", "Вернуть"), run: () => fs.putBack(path) },
      { label: t("Delete Immediately…", "Удалить сразу…"), run: () => fs.remove(path), danger: true },
    ];
  }
  return [
    { label: t("Open", "Открыть"), run: () => openPath(path, winId) },
    "sep",
    { label: t("Rename", "Переименовать"), run: rename },
    { label: t("Move to Trash", "Переместить в Корзину"), run: () => fs.trash(path) },
  ];
}

/** Меню при щелчке правой кнопкой мыши. Координаты — в системе сцены 1920×1080. */
export function ctxAt(e: React.MouseEvent, items: MenuItem[]) {
  e.preventDefault();
  e.stopPropagation();
  const { k, left, top } = stageScale();
  useOs.getState().openCtx({ x: (e.clientX - left) / k, y: (e.clientY - top) / k, items });
}

const DRAG = "text/kestrel-path";

/**
 * Цель для перетаскивания файлов: папка, боковая панель, рабочий стол, Корзина.
 * Возвращает обработчики и флаг подсветки.
 */
export function useDrop(dir: string | null) {
  const [over, setOver] = useState(false);
  const ok = (e: React.DragEvent) => !!dir && e.dataTransfer.types.includes(DRAG);
  return {
    over,
    props: {
      onDragOver: (e: React.DragEvent) => { if (!ok(e)) return; e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = "move"; setOver(true); },
      onDragLeave: () => setOver(false),
      onDrop: (e: React.DragEvent) => {
        setOver(false);
        if (!ok(e)) return;
        e.preventDefault();
        e.stopPropagation();
        const src = e.dataTransfer.getData(DRAG);
        if (src && dir) useFs.getState().move(src, dir);
      },
    },
  };
}

const DRIVES = [
  { name: "Kestrel NV2 1TB (NVMe)", total: 931, used: 412 },
  { name: "DataVault HDD 2TB", total: 1863, used: 1204 },
];

/** Файловый менеджер: боковая панель, навигация назад/вперёд, переименование, корзина. */
export function Finder({ winId }: { winId: number }) {
  const { t } = useLang();
  const fs = useFs();
  const os = useOs();
  const usb = useStore((s) => s.saved.usbStorage);
  const win = os.windows.find((w) => w.id === winId);
  const path = win?.arg ?? HOME;
  const [back, setBack] = useState<string[]>([]);
  const [fwd, setFwd] = useState<string[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const prev = useRef(path);

  // путь меняется из боковой панели, двойного щелчка или меню — ведём историю
  useEffect(() => {
    if (prev.current !== path) {
      setBack((b) => [...b, prev.current]);
      setFwd([]);
      prev.current = path;
      setSel(null);
      setQ("");
    }
  }, [path]);

  const go = (p: string) => os.update(winId, { arg: p });
  const goBack = () => {
    const p = back[back.length - 1];
    if (!p) return;
    setBack(back.slice(0, -1));
    setFwd([path, ...fwd]);
    prev.current = p;
    go(p);
  };
  const goFwd = () => {
    const [p, ...rest] = fwd;
    if (!p) return;
    setFwd(rest);
    setBack([...back, path]);
    prev.current = p;
    go(p);
  };

  const user = os.prefs.userName;
  const label = (p: string) => (p === HOME ? user : p === TRASH ? t("Trash", "Корзина") : nameOf(p));
  const isDisk = path === "disk";
  const exists = isDisk || fs.isDir(path);
  const items = exists && !isDisk ? fs.list(path).filter((n) => n.toLowerCase().includes(q.toLowerCase())) : [];

  const gridDrop = useDrop(exists && !isDisk ? path : null);

  const newFolder = () => {
    const name = fs.freeName(path, t("untitled folder", "новая папка"));
    if (fs.mkdir(join(path, name))) { setSel(join(path, name)); setRenaming(join(path, name)); }
  };
  const newFile = () => {
    const name = fs.freeName(path, t("untitled", "без названия"), ".txt");
    if (fs.write(join(path, name), "")) { setSel(join(path, name)); setRenaming(join(path, name)); }
  };

  const side: [string, string, string][] = [
    [HOME, user, "home"], [`${HOME}/Desktop`, t("Desktop", "Рабочий стол"), "desktop"],
    [`${HOME}/Documents`, t("Documents", "Документы"), "doc"], [`${HOME}/Downloads`, t("Downloads", "Загрузки"), "down"],
  ];

  return (
    <div
      className="finder"
      tabIndex={-1}
      onKeyDown={(e) => {
        if (renaming || (e.target as HTMLElement).tagName === "INPUT") return;
        if (sel && e.key === "Enter") { e.preventDefault(); setRenaming(sel); }
        if (sel && (e.key === "Delete" || e.key === "Backspace")) { isTrashed(sel) ? fs.remove(sel) : fs.trash(sel); setSel(null); }
        if (sel && e.key === "ArrowDown" && e.altKey) openPath(sel, winId);
      }}
    >
      <aside className="fd-side">
        <div className="fd-group">{t("Favorites", "Избранное")}</div>
        {side.map(([p, name, ic]) => <SideLink key={p} dir={p} on={path === p} onClick={() => go(p)}><SideIcon kind={ic} />{name}</SideLink>)}
        <div className="fd-group">{t("Locations", "Места")}</div>
        <button className={"fd-link" + (isDisk ? " on" : "")} onClick={() => go("disk")}><SideIcon kind="disk" />Kestrel HD</button>
        <SideLink dir={TRASH} on={path === TRASH} onClick={() => go(TRASH)}><SideIcon kind="trash" />{t("Trash", "Корзина")}</SideLink>
      </aside>

      <section className="fd-main">
        <div className="fd-bar">
          <button className="fd-nav" disabled={!back.length} onClick={goBack} title={t("Back", "Назад")}>
            <svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" /></svg>
          </button>
          <button className="fd-nav" disabled={!fwd.length} onClick={goFwd} title={t("Forward", "Вперёд")}>
            <svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" /></svg>
          </button>
          <div className="fd-title">{isDisk ? "Kestrel HD" : label(path)}</div>
          {path === TRASH ? (
            <button className="set-btn" disabled={!items.length} onClick={() => fs.emptyTrash()}>{t("Empty", "Очистить")}</button>
          ) : !isDisk && (
            <button className="fd-nav" onClick={newFolder} title={t("New Folder", "Новая папка")}>
              <svg viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M12 10v6M9 13h6" /></svg>
            </button>
          )}
          {!isDisk && <input className="fd-search" placeholder={t("Search", "Поиск")} value={q} onChange={(e) => setQ(e.target.value)} />}
        </div>

        {isDisk ? (
          <div className="fd-disk">
            {[...DRIVES, ...(usb ? [{ name: "USB Flash Drive", total: 29, used: 4 }] : [])].map((d) => (
              <div className="drive" key={d.name}>
                <AppIcon name="disk" size={56} />
                <div className="drive-info">
                  <div className="drive-name">{d.name}</div>
                  <div className="bar"><i style={{ width: `${(d.used / d.total) * 100}%` }} /></div>
                  <div className="drive-free">{d.total - d.used} {t("GB available of", "ГБ доступно из")} {d.total} {t("GB", "ГБ")}</div>
                </div>
              </div>
            ))}
          </div>
        ) : !exists ? (
          <div className="fd-empty">{t("This folder no longer exists.", "Этой папки больше нет.")}</div>
        ) : (
          <div
            className={"fd-grid" + (gridDrop.over ? " drop" : "")}
            {...gridDrop.props}
            onPointerDown={(e) => { if (e.target === e.currentTarget) setSel(null); }}
            onContextMenu={(e) => ctxAt(e, path === TRASH
              ? [{ label: t("Empty Trash", "Очистить Корзину"), run: () => fs.emptyTrash(), disabled: !items.length }]
              : [{ label: t("New Folder", "Новая папка"), run: newFolder }, { label: t("New Text Document", "Новый текстовый документ"), run: newFile }])}
          >
            {items.map((n) => {
              const p = join(path, n);
              return (
                <FileItem
                  key={p} path={p} selected={sel === p} renaming={renaming === p}
                  onSelect={() => setSel(p)}
                  onOpen={() => openPath(p, winId)}
                  onRenamed={(to) => { setRenaming(null); if (to) setSel(to); }}
                  onMenu={(e) => { setSel(p); ctxAt(e, itemMenu(p, t, () => setRenaming(p), winId)); }}
                />
              );
            })}
            {!items.length && <div className="fd-empty">{q ? t("No results", "Ничего не найдено") : path === TRASH ? t("Trash is empty", "Корзина пуста") : t("Empty folder", "Папка пуста")}</div>}
          </div>
        )}
        <div className="fd-status">
          {isDisk ? "Kestrel HD" : `${items.length} ${t("items", "объектов")}`}
          {path !== HOME && !isDisk && exists && <span className="fd-path">{label(parentOf(path))} › {label(path)}</span>}
        </div>
      </section>
    </div>
  );
}

/** Значок файла или папки с подписью; подпись превращается в поле при переименовании. */
export function FileItem({ path, selected, renaming, onSelect, onOpen, onRenamed, onMenu, className = "" }: {
  path: string; selected: boolean; renaming: boolean; className?: string;
  onSelect: () => void; onOpen: () => void; onRenamed: (to: string | null) => void; onMenu: (e: React.MouseEvent) => void;
}) {
  const fs = useFs();
  const [name, setName] = useState(nameOf(path));
  const drop = useDrop(fs.isDir(path) && !isTrashed(path) ? path : null);
  useEffect(() => { if (renaming) setName(nameOf(path)); }, [renaming, path]);
  const commit = () => onRenamed(name.trim() ? fs.rename(path, name) : null);
  return (
    <div
      className={"fd-item " + className + (selected ? " sel" : "") + (drop.over ? " drop" : "")}
      draggable={!renaming}
      onDragStart={(e) => { e.dataTransfer.setData(DRAG, path); e.dataTransfer.effectAllowed = "move"; }}
      {...drop.props}
      onPointerDown={(e) => { e.stopPropagation(); onSelect(); }}
      onDoubleClick={onOpen}
      onContextMenu={onMenu}
    >
      {isImage(path) && fs.read(path)?.startsWith("data:image")
        ? <img className="fd-thumb" src={fs.read(path)!} alt="" draggable={false} />
        : <AppIcon name={fs.isDir(path) ? "folder" : isImage(path) ? "image" : "file"} size={64} />}
      {renaming ? (
        <input
          className="fd-rename"
          autoFocus
          value={name}
          onFocus={(e) => e.target.setSelectionRange(0, name.lastIndexOf(".") > 0 ? name.lastIndexOf(".") : name.length)}
          onChange={(e) => setName(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") commit(); if (e.key === "Escape") onRenamed(path); }}
        />
      ) : (
        <span className="fd-name">{nameOf(path)}</span>
      )}
    </div>
  );
}

function SideLink({ dir, on, onClick, children }: { dir: string; on: boolean; onClick: () => void; children: React.ReactNode }) {
  const drop = useDrop(dir);
  return <button className={"fd-link" + (on ? " on" : "") + (drop.over ? " drop" : "")} onClick={onClick} {...drop.props}>{children}</button>;
}

function SideIcon({ kind }: { kind: string }) {
  const d: Record<string, string> = {
    home: "M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z",
    desktop: "M3 5h18v11H3zM8 20h8M12 16v4",
    doc: "M7 3h7l4 4v14H7zM14 3v4h4",
    down: "M12 4v11M7 10l5 5 5-5M5 20h14",
    disk: "M3 8h18v8H3zM6 12h2",
    trash: "M5 7h14l-1.2 13H6.2zM4 7h16M10 7V4h4v3",
  };
  return <svg className="fd-ico" viewBox="0 0 24 24"><path d={d[kind]} /></svg>;
}
