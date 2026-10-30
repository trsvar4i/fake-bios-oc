// Пароли, сессии, проверка ввода. Без внешних зависимостей: scrypt и случайные токены из node:crypto.
import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const KEYLEN = 64;

const scryptAsync = (password: string, salt: Buffer) =>
  new Promise<Buffer>((resolve, reject) => scrypt(password.normalize("NFKC"), salt, KEYLEN, { N: 16384, r: 8, p: 1 }, (e, key) => (e ? reject(e) : resolve(key))));

/** «scrypt$соль$хеш» в base64 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString("base64")}$${(await scryptAsync(password, salt)).toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [kind, salt, hash] = stored.split("$");
  if (kind !== "scrypt" || !salt || !hash) return false;
  const want = Buffer.from(hash, "base64");
  const got = await scryptAsync(password, Buffer.from(salt, "base64"));
  return want.length === got.length && timingSafeEqual(want, got);
}

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** Сравнение секретов без утечки по времени. */
export const sameSecret = (a: string, b: string) => timingSafeEqual(Buffer.from(sha256(a)), Buffer.from(sha256(b)));

export const newToken = () => randomBytes(32).toString("base64url");

/** Код класса: 6 символов без похожих (0/O, 1/I/L). */
export function newClassCode(): string {
  const abc = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(6);
  return Array.from(bytes, (b) => abc[b % abc.length]).join("");
}

export const SESSION_DAYS = 30;
export const COOKIE = "kp_sid";

export function sessionCookie(token: string, secure: boolean, maxAge = SESSION_DAYS * 86400) {
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
}

export function readCookie(header: string | null, name = COOKIE): string | null {
  for (const part of (header ?? "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=") || null;
  }
  return null;
}

/** Проверка полей. Возвращает текст ошибки или null. */
export const check = {
  login: (s: unknown) => (typeof s === "string" && /^[a-z0-9_.-]{3,32}$/.test(s) ? null : "login"),
  name: (s: unknown) => (typeof s === "string" && s.trim().length >= 2 && s.trim().length <= 60 ? null : "name"),
  password: (s: unknown) => (typeof s === "string" && s.length >= 6 && s.length <= 128 ? null : "password"),
};

export const normLogin = (s: unknown) => (typeof s === "string" ? s.trim().toLowerCase() : "");
