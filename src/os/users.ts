// Учётные записи: у каждого пользователя свои настройки (обои, пароль, виджеты, док) и свои файлы.
// Первый пользователь хранится под старыми ключами — данные, созданные до появления учётных записей, не теряются.
const USERS_KEY = "kestrel.users";
const CURRENT_KEY = "kestrel.user";

export interface User { id: string; name: string }

const read = <T,>(key: string, fallback: T): T => {
  try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; }
};
const write = (key: string, v: unknown) => {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* хранилище недоступно */ }
};

export const listUsers = (): User[] => read<User[]>(USERS_KEY, [{ id: "u1", name: "User" }]);
export const saveUsers = (users: User[]) => write(USERS_KEY, users);
export const currentUser = (): string => {
  const id = read<string>(CURRENT_KEY, "u1");
  return listUsers().some((u) => u.id === id) ? id : listUsers()[0].id;
};
export const setCurrentUser = (id: string) => write(CURRENT_KEY, id);

/** Ключи хранилища пользователя: у первого — прежние, без суффикса. */
export const prefsKey = (id = currentUser()) => (id === "u1" ? "kestrel.os" : `kestrel.os.${id}`);
export const filesKey = (id = currentUser()) => (id === "u1" ? "kestrel.fs" : `kestrel.fs.${id}`);

export function removeUserData(id: string) {
  try { localStorage.removeItem(prefsKey(id)); localStorage.removeItem(filesKey(id)); } catch { /* хранилище недоступно */ }
}

/** Настройки другого пользователя без переключения (для экрана входа: аватар, имя, пароль). */
export const peekPrefs = (id: string): { userName?: string; password?: string; passwordHint?: string; wallpaper?: string } => read(prefsKey(id), {});
