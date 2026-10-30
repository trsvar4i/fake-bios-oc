// Создать учителя из консоли (без веб-панели администратора):
//   node --env-file=.env.local scripts/teacher.mjs <логин> "<Имя>" <лимит учеников>
// Пароль спрашивается в консоли (не попадает в историю команд); можно передать через TEACHER_PASSWORD.
import { randomBytes, scrypt } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { neon } from "@neondatabase/serverless";

const [login, name, max = "30"] = process.argv.slice(2);
if (!login || !name) {
  console.log('usage: node --env-file=.env.local scripts/teacher.mjs <login> "<Name>" [maxStudents]');
  process.exit(1);
}
if (!/^[a-z0-9_.-]{3,32}$/.test(login)) throw new Error("login: 3–32 of a-z 0-9 _ . -");

let password = process.env.TEACHER_PASSWORD;
if (!password) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  password = await rl.question("Password (6+ chars): ");
  rl.close();
}
if (!password || password.length < 6) throw new Error("password: 6+ characters");

// тот же формат, что api/_lib/auth.ts: scrypt$соль$хеш
const salt = randomBytes(16);
const key = await new Promise((ok, no) => scrypt(password.normalize("NFKC"), salt, 64, { N: 16384, r: 8, p: 1 }, (e, k) => (e ? no(e) : ok(k))));
const hash = `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
const abc = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const code = Array.from(randomBytes(6), (b) => abc[b % abc.length]).join("");

const sql = neon(process.env.DATABASE_URL);
const rows = await sql`INSERT INTO users (login, name, role, pass_hash, class_code, max_students)
  VALUES (${login}, ${name}, 'teacher', ${hash}, ${code}, ${Number(max)}) ON CONFLICT (login) DO NOTHING RETURNING id`;
console.log(rows[0] ? `teacher created: ${login}, class code ${code}, up to ${max} students` : `login "${login}" is taken`);
