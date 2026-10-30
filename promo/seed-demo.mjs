// Демо-класс для съёмки кабинета учителя — ТОЛЬКО на dev-базе (DATABASE_URL из ../.env.local).
// Ученики регистрируются через локальный API и присылают «живые» экраны, как настоящие.
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const env = Object.fromEntries(readFileSync("../.env.local", "utf8").split(/\r?\n/).filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const sql = neon(env.DATABASE_URL);
const API = "http://localhost:8137/api";

const [klass] = await sql`SELECT c.id, c.code, c.teacher_id FROM classes c JOIN users t ON t.id = c.teacher_id WHERE t.login = 'test.teacher' ORDER BY c.id LIMIT 1`;
await sql`UPDATE users SET max_students = 40 WHERE id = ${klass.teacher_id}`;
await sql`UPDATE classes SET name = '8Б', open = true WHERE id = ${klass.id}`;

const kids = [
  ["anya.k", "Аня Ковалёва", { phase: "setup", screen: "adv", ghz: 5.0, temp: 61, app: null, activity: { kind: "task", title: "Нестабильный разгон", assignment: null, done: false }, locked: false }],
  ["misha.r", "Миша Романов", { phase: "os", screen: "crash", ghz: 5.0, temp: 71, app: null, activity: { kind: "task", title: "Нестабильный разгон", assignment: null, done: false }, locked: false }],
  ["liza.m", "Лиза Морозова", { phase: "os", screen: "desktop", ghz: 4.5, temp: 44, app: "vm", activity: { kind: "lesson", id: "virtualization", step: 3 }, locked: false }],
  ["sasha.p", "Саша Петров", { phase: "boot", screen: "boot", ghz: 4.5, temp: 49, app: null, activity: { kind: "task", title: "Диск «пропал»", assignment: null, done: false }, locked: false, error: "INACCESSIBLE_BOOT_DEVICE" }],
  ["vova.n", "Вова Николаев", { phase: "os", screen: "desktop", ghz: 4.5, temp: 46, app: "taskmgr", activity: { kind: "drill", i: 3, of: 5, score: 512 }, locked: false }],
  ["katya.s", "Катя Смирнова", { phase: "setup", screen: "ez", ghz: 4.5, temp: 48, app: null, activity: { kind: "task", title: "Нет интернета", assignment: null, done: true }, locked: false }],
  ["petya.s", null, { phase: "os", screen: "desktop", ghz: 4.5, temp: 45, app: "learn", activity: { kind: "lesson", id: "overclock", step: 2 }, locked: false }],
];

const post = async (route, body, cookie) => {
  const r = await fetch(`${API}/${route}`, { method: "POST", headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) });
  return { status: r.status, cookie: (r.headers.get("set-cookie") ?? "").split(";")[0], json: await r.json() };
};

for (const [login, name, state] of kids) {
  let s = name ? await post("auth/register", { login, name, password: "demo-pass-1", code: klass.code }) : { status: 409 };
  if (s.status !== 200) s = await post("auth/login", { login, password: login === "petya.s" ? "student-test-1" : "demo-pass-1" });
  if (s.status !== 200) { console.log("skip", login, s.json); continue; }
  await sql`UPDATE users SET class_id = ${klass.id}, teacher_id = ${klass.teacher_id} WHERE login = ${login}`;
  const lessons = Object.fromEntries(["bios-tour", "boot-order", "secure-boot", "overclock", "cooling"].slice(0, 1 + (login.length % 5)).map((k) => [k, 1]));
  const r = await post("sync", { state, progress: { lessons, drillBest: 200 + login.length * 61 } }, s.cookie);
  console.log(login, r.status);
}
