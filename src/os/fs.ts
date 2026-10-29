// Файлы пользователя: общая файловая система для Finder, TextEdit, Терминала и рабочего стола.
// Пути относительно домашней папки: "~", "~/Documents/readme.txt". Корзина — "~/.Trash".
import { create } from "zustand";

export interface FsNode {
  type: "dir" | "file";
  content?: string;
  mtime: number;
  /** откуда объект попал в корзину — для «Вернуть» */
  from?: string;
}

export const HOME = "~";
export const TRASH = "~/.Trash";
const FS_KEY = "kestrel.fs";

const now = () => Date.now();
const DEFAULT_FS: Record<string, FsNode> = {
  "~": { type: "dir", mtime: now() },
  "~/Desktop": { type: "dir", mtime: now() },
  "~/Documents": { type: "dir", mtime: now() },
  "~/Downloads": { type: "dir", mtime: now() },
  "~/.Trash": { type: "dir", mtime: now() },
  "~/Documents/readme.txt": {
    type: "file", mtime: now(),
    content: "Kestrel OS — Linux for people.\nEverything you can do in the terminal can also be done with a mouse.\n",
  },
};

function load(): Record<string, FsNode> {
  try {
    const raw = localStorage.getItem(FS_KEY);
    return raw ? { ...DEFAULT_FS, ...JSON.parse(raw) } : { ...DEFAULT_FS };
  } catch {
    return { ...DEFAULT_FS };
  }
}

export const parentOf = (p: string) => (p === HOME ? HOME : p.slice(0, p.lastIndexOf("/")) || HOME);
export const nameOf = (p: string) => (p === HOME ? HOME : p.slice(p.lastIndexOf("/") + 1));
export const join = (dir: string, name: string) => `${dir}/${name}`;
export const isTrashed = (p: string) => p.startsWith(TRASH + "/");

/** Нормализовать путь относительно текущей папки: "..", ".", "~". */
export function resolvePath(cwd: string, arg: string): string {
  if (!arg || arg === "~") return HOME;
  const parts = (arg.startsWith("~") ? arg : cwd + "/" + arg).split("/").filter(Boolean);
  const out: string[] = [];
  for (const p of parts) {
    if (p === ".") continue;
    if (p === "..") { if (out.length > 1) out.pop(); continue; }
    out.push(p);
  }
  return out.join("/") || HOME;
}

interface FsState {
  nodes: Record<string, FsNode>;
  list: (dir: string) => string[];
  exists: (p: string) => boolean;
  isDir: (p: string) => boolean;
  read: (p: string) => string | null;
  write: (p: string, content: string) => boolean;
  mkdir: (p: string) => boolean;
  /** свободное имя в папке: "untitled folder", "untitled folder 2"… */
  freeName: (dir: string, base: string, ext?: string) => string;
  rename: (p: string, name: string) => string | null;
  /** переместить в другую папку; занятое имя получает номер. Возвращает новый путь */
  move: (p: string, dir: string) => string | null;
  /** переместить в корзину */
  trash: (p: string) => void;
  /** вернуть из корзины на прежнее место */
  putBack: (p: string) => void;
  /** удалить насовсем (вместе с содержимым) */
  remove: (p: string) => void;
  emptyTrash: () => void;
}

/** Переносит объект и всё, что в нём лежит, на новый путь. */
function moveTree(nodes: Record<string, FsNode>, from: string, to: string, patch: Partial<FsNode> = {}) {
  const out: Record<string, FsNode> = {};
  for (const [k, v] of Object.entries(nodes)) {
    if (k === from) out[to] = { ...v, ...patch, mtime: now() };
    else if (k.startsWith(from + "/")) out[to + k.slice(from.length)] = v;
    else out[k] = v;
  }
  return out;
}

export const useFs = create<FsState>((set, get) => {
  const commit = (nodes: Record<string, FsNode>) => {
    set({ nodes });
    try { localStorage.setItem(FS_KEY, JSON.stringify(nodes)); } catch { /* хранилище недоступно */ }
  };
  return {
    nodes: load(),
    list: (dir) => {
      const { nodes } = get();
      return Object.keys(nodes)
        .filter((k) => parentOf(k) === dir && k !== dir && k !== TRASH)
        .map(nameOf)
        .sort((a, b) => {
          const da = nodes[join(dir, a)].type === "dir", db = nodes[join(dir, b)].type === "dir";
          return da === db ? a.localeCompare(b) : da ? -1 : 1;
        });
    },
    exists: (p) => !!get().nodes[p],
    isDir: (p) => get().nodes[p]?.type === "dir",
    read: (p) => (get().nodes[p]?.type === "file" ? get().nodes[p].content ?? "" : null),
    write: (p, content) => {
      const { nodes } = get();
      if (nodes[p]?.type === "dir" || !get().isDir(parentOf(p))) return false;
      commit({ ...nodes, [p]: { type: "file", content, mtime: now() } });
      return true;
    },
    mkdir: (p) => {
      const { nodes } = get();
      if (nodes[p] || !get().isDir(parentOf(p))) return false;
      commit({ ...nodes, [p]: { type: "dir", mtime: now() } });
      return true;
    },
    freeName: (dir, base, ext = "") => {
      let name = base + ext;
      for (let i = 2; get().nodes[join(dir, name)]; i++) name = `${base} ${i}${ext}`;
      return name;
    },
    rename: (p, name) => {
      const clean = name.trim().replace(/\//g, ":");
      if (!clean || !get().nodes[p]) return null;
      const to = join(parentOf(p), clean);
      if (to === p) return p;
      if (get().nodes[to]) return null;
      commit(moveTree(get().nodes, p, to));
      return to;
    },
    move: (p, dir) => {
      const { nodes } = get();
      // нельзя переместить папку саму в себя или в свою же вложенную папку
      if (!nodes[p] || !get().isDir(dir) || p === HOME || dir === p || dir.startsWith(p + "/") || parentOf(p) === dir) return null;
      if (dir === TRASH || isTrashed(dir)) { get().trash(p); return null; }
      const to = join(dir, get().freeName(dir, nameOf(p)));
      commit(moveTree(nodes, p, to, { from: undefined }));
      return to;
    },
    trash: (p) => {
      if (!get().nodes[p] || p === HOME || isTrashed(p) || p === TRASH) return;
      const to = join(TRASH, get().freeName(TRASH, nameOf(p)));
      commit(moveTree(get().nodes, p, to, { from: p }));
    },
    putBack: (p) => {
      const node = get().nodes[p];
      if (!node?.from) return;
      let dest = node.from;
      if (!get().isDir(parentOf(dest))) dest = join(HOME, nameOf(dest));
      if (get().nodes[dest]) dest = join(parentOf(dest), get().freeName(parentOf(dest), nameOf(dest)));
      commit(moveTree(get().nodes, p, dest, { from: undefined }));
    },
    remove: (p) => {
      if (p === HOME || p === TRASH) return;
      commit(Object.fromEntries(Object.entries(get().nodes).filter(([k]) => k !== p && !k.startsWith(p + "/"))));
    },
    emptyTrash: () => commit(Object.fromEntries(Object.entries(get().nodes).filter(([k]) => !isTrashed(k)))),
  };
});
