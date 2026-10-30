// API класса. Один обработчик на всё: /api/<маршрут>. Web Request → Response, поэтому один и тот же код
// работает в функции Vercel, в dev-сервере Vite и в тестах.
import { neon } from "@neondatabase/serverless";
import { check, hashPassword, newClassCode, newToken, normLogin, readCookie, sameSecret, sessionCookie, sha256, verifyPassword, SESSION_DAYS } from "./auth.js";
import { configSolves, goalValid } from "../../src/learn/goals.js";

type Sql = ReturnType<typeof neon>;
type Row = Record<string, any>;

interface User { id: number; login: string; name: string; role: "teacher" | "student"; teacher_id: number | null; class_id: number | null; max_students: number | null }

/** Команды удалённого управления. */
const COMMANDS = ["message", "lock", "unlock", "assign", "restart", "shutdown", "reset"];
/** Ученик «в сети», если синхронизировался за последние N секунд. */
const ONLINE_SEC = 45;
/** Как часто ученику синхронизироваться: часто — пока учитель смотрит кабинет класса, иначе редко. */
const SYNC_FAST = 4;
const SYNC_SLOW = 20;
/** Защита: неудачные входы, регистрации, классы. */
const FAILS_PER_LOGIN_IP = 8;
const FAILS_PER_LOGIN = 40;
const REG_PER_IP_HOUR = 15;
const MAX_CLASSES = 20;
/** Решение быстрее этого — подозрительно (вручную столько не успеть). */
const MIN_SOLVE_MS = 8000;
/** Запас к лимиту времени на сеть и перезагрузку. */
const TIME_GRACE_MS = 30000;

class HttpError extends Error {
  constructor(public status: number, public code: string) { super(code); }
}
const fail = (status: number, code: string): never => { throw new HttpError(status, code); };

const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers } });

let cached: Sql | null = null;
const db = (): Sql => (cached ??= neon(process.env.DATABASE_URL ?? fail(500, "no_database")));

/** Запрос с параметрами: q(sql)`SELECT … ${value}` → строки. */
const q = (sql: Sql) => async (text: TemplateStringsArray, ...values: unknown[]) => (await sql(text, ...values)) as Row[];

function publicUser(u: User) {
  return { id: u.id, login: u.login, name: u.name, role: u.role, ...(u.role === "teacher" ? { maxStudents: u.max_students } : {}) };
}

/** Адрес клиента: на Vercel — первый из x-forwarded-for. */
const clientIp = (req: Request) => (req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "").split(",")[0].trim().slice(0, 64) || "unknown";

async function currentUser(sql: Sql, req: Request): Promise<User | null> {
  const token = readCookie(req.headers.get("cookie"));
  if (!token) return null;
  const rows = await q(sql)`SELECT u.id, u.login, u.name, u.role, u.teacher_id, u.class_id, u.max_students
    FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ${sha256(token)} AND s.expires_at > now()`;
  return (rows[0] as User) ?? null;
}

async function startSession(sql: Sql, userId: number, secure: boolean) {
  const token = newToken();
  await q(sql)`INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (${sha256(token)}, ${userId}, now() + make_interval(days => ${SESSION_DAYS}))`;
  // заодно убрать просроченные
  await q(sql)`DELETE FROM sessions WHERE expires_at < now()`;
  return sessionCookie(token, secure);
}

/** Класс по коду, если набор открыт и у учителя есть свободные места. */
async function classByCode(sql: Sql, code: unknown) {
  const c = typeof code === "string" ? code.trim().toUpperCase() : "";
  if (!/^[A-Z0-9]{6}$/.test(c)) fail(400, "bad_code");
  const rows = await q(sql)`SELECT c.id, c.name, c.open, c.teacher_id, t.name AS teacher_name, t.max_students,
      (SELECT count(*)::int FROM users s WHERE s.teacher_id = t.id) AS used
    FROM classes c JOIN users t ON t.id = c.teacher_id WHERE c.code = ${c}`;
  const k = rows[0] ?? fail(404, "no_class");
  if (!k.open) fail(403, "class_closed");
  if (k.used >= k.max_students) fail(409, "class_full");
  return k as { id: number; name: string; teacher_id: number; teacher_name: string };
}

/** Новый класс с уникальным кодом. */
async function createClass(sql: Sql, teacherId: number, name: string) {
  for (let i = 0; i < 6; i++) {
    const rows = await q(sql)`INSERT INTO classes (teacher_id, name, code) VALUES (${teacherId}, ${name}, ${newClassCode()})
      ON CONFLICT (code) DO NOTHING RETURNING id, code`;
    if (rows[0]) return rows[0] as { id: number; code: string };
  }
  return fail(500, "code_failed");
}

const limitJson = (v: unknown, max: number) => {
  const s = JSON.stringify(v ?? {});
  if (s.length > max) fail(413, "too_large");
  return s;
};

/** Объект (не массив), иначе ошибка. */
const obj = (v: unknown): Row => (v && typeof v === "object" && !Array.isArray(v) ? (v as Row) : fail(400, "bad_input"));
/**
 * Состояние экрана ученика приходит из браузера — оставляем только известные поля нужных типов,
 * чтобы подделанный запрос не мог сломать кабинет учителя.
 */
export function cleanState(raw: unknown) {
  const s = raw && typeof raw === "object" ? (raw as Row) : {};
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : null);
  const num = (v: unknown, lo: number, hi: number) => (typeof v === "number" && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : 0);
  const a = s.activity && typeof s.activity === "object" ? (s.activity as Row) : null;
  let activity = null;
  if (a?.kind === "lesson") activity = { kind: "lesson", id: str(a.id, 40) ?? "", step: num(a.step, 0, 50) };
  else if (a?.kind === "task") activity = { kind: "task", title: str(a.title, 120) ?? "", assignment: typeof a.assignment === "number" ? a.assignment : null, done: !!a.done };
  else if (a?.kind === "drill") activity = { kind: "drill", i: num(a.i, 0, 50), of: num(a.of, 0, 50), score: num(a.score, 0, 100000) };
  return {
    phase: ["off", "post", "setup", "boot", "os"].includes(s.phase) ? s.phase : "off",
    screen: str(s.screen, 16) ?? "",
    ghz: num(s.ghz, 0, 10),
    temp: num(s.temp, 0, 150),
    app: str(s.app, 24),
    activity,
    locked: !!s.locked,
    ...(str(s.error, 60) ? { error: str(s.error, 60) } : {}),
  };
}

const className = (v: unknown) => { const s = String(v ?? "").trim().slice(0, 40); return s || fail(400, "bad_class_name"); };

type Ctx = { sql: Sql; req: Request; url: URL; body: Row; secure: boolean };
type Route = (c: Ctx) => Promise<Response>;

async function needUser(c: Ctx, role?: User["role"]) {
  const u = await currentUser(c.sql, c.req);
  if (!u) fail(401, "not_logged_in");
  if (role && u!.role !== role) fail(403, "forbidden");
  return u!;
}

function needAdmin(c: Ctx) {
  const key = process.env.ADMIN_KEY;
  const got = c.req.headers.get("x-admin-key") ?? "";
  if (!key || key.length < 16) fail(503, "admin_disabled");
  if (!got || !sameSecret(got, key!)) fail(403, "bad_admin_key");
}

/** Класс этого учителя. */
async function ownClass(c: Ctx, teacherId: number, classId: unknown) {
  const rows = await q(c.sql)`SELECT id, name, code, open FROM classes WHERE id = ${Number(classId)} AND teacher_id = ${teacherId}`;
  return rows[0] ?? fail(404, "no_class");
}

/** Ученик этого учителя. */
async function ownStudent(c: Ctx, teacherId: number, studentId: unknown) {
  const id = Number(studentId);
  const rows = await q(c.sql)`SELECT id FROM users WHERE id = ${id} AND teacher_id = ${teacherId} AND role = 'student'`;
  if (!rows[0]) fail(404, "no_student");
  return id;
}

const routes: Record<string, Route> = {
  // ——— вход и регистрация ———
  "GET me": async (c) => {
    const u = await currentUser(c.sql, c.req);
    if (!u) return json({ user: null });
    let klass = null;
    if (u.role === "student" && u.class_id) {
      klass = (await q(c.sql)`SELECT c.name, t.name AS teacher FROM classes c JOIN users t ON t.id = c.teacher_id WHERE c.id = ${u.class_id}`)[0] ?? null;
    }
    return json({ user: publicUser(u), teacher: klass ? { name: klass.teacher } : null, class: klass ? { name: klass.name } : null });
  },

  "POST auth/register": async (c) => {
    const login = normLogin(c.body.login);
    const err = check.login(login) ?? check.name(c.body.name) ?? check.password(c.body.password);
    if (err) fail(400, `bad_${err}`);
    const ip = clientIp(c.req);
    const recent = await q(c.sql)`SELECT count(*)::int AS n FROM reg_log WHERE ip = ${ip} AND at > now() - interval '1 hour'`;
    if (recent[0].n >= REG_PER_IP_HOUR) fail(429, "too_many_registrations");
    const k = await classByCode(c.sql, c.body.code);
    const hash = await hashPassword(c.body.password);
    const rows = await q(c.sql)`INSERT INTO users (login, name, role, pass_hash, teacher_id, class_id)
      VALUES (${login}, ${String(c.body.name).trim()}, 'student', ${hash}, ${k.teacher_id}, ${k.id}) ON CONFLICT (login) DO NOTHING RETURNING id`;
    if (!rows[0]) fail(409, "login_taken");
    await q(c.sql)`INSERT INTO reg_log (ip) VALUES (${ip})`;
    await q(c.sql)`DELETE FROM reg_log WHERE at < now() - interval '1 day'`;
    return json({ ok: true }, 200, { "set-cookie": await startSession(c.sql, rows[0].id, c.secure) });
  },

  "POST auth/login": async (c) => {
    const login = normLogin(c.body.login);
    const ip = clientIp(c.req);
    // блокировка по паре «логин + адрес»: чужой компьютер не «запрёт» ученика; общий потолок — от перебора с многих адресов
    const fails = await q(c.sql)`SELECT count(*) FILTER (WHERE ip = ${ip})::int AS mine, count(*)::int AS total
      FROM login_fails WHERE login = ${login} AND at > now() - interval '15 minutes'`;
    if (fails[0].mine >= FAILS_PER_LOGIN_IP || fails[0].total >= FAILS_PER_LOGIN) fail(429, "too_many_attempts");
    const rows = await q(c.sql)`SELECT id, pass_hash FROM users WHERE login = ${login}`;
    // хеш считаем всегда, чтобы по времени ответа нельзя было узнать, есть ли такой логин
    const ok = await verifyPassword(String(c.body.password ?? ""), rows[0]?.pass_hash ?? "scrypt$AAAAAAAAAAAAAAAAAAAAAA==$AAAA");
    if (!rows[0] || !ok) {
      await q(c.sql)`INSERT INTO login_fails (login, ip) VALUES (${login}, ${ip})`;
      await q(c.sql)`DELETE FROM login_fails WHERE at < now() - interval '1 day'`;
      fail(401, "bad_credentials");
    }
    return json({ ok: true }, 200, { "set-cookie": await startSession(c.sql, rows[0].id, c.secure) });
  },

  "POST auth/logout": async (c) => {
    const token = readCookie(c.req.headers.get("cookie"));
    if (token) await q(c.sql)`DELETE FROM sessions WHERE token_hash = ${sha256(token)}`;
    return json({ ok: true }, 200, { "set-cookie": sessionCookie("", c.secure, 0) });
  },

  "POST me/password": async (c) => {
    const u = await needUser(c);
    if (check.password(c.body.password)) fail(400, "bad_password");
    const row = (await q(c.sql)`SELECT pass_hash FROM users WHERE id = ${u.id}`)[0];
    if (!(await verifyPassword(String(c.body.old ?? ""), row.pass_hash))) fail(401, "bad_credentials");
    await q(c.sql)`UPDATE users SET pass_hash = ${await hashPassword(c.body.password)} WHERE id = ${u.id}`;
    // выйти на остальных устройствах
    const token = readCookie(c.req.headers.get("cookie"));
    await q(c.sql)`DELETE FROM sessions WHERE user_id = ${u.id} AND token_hash <> ${sha256(token ?? "")}`;
    return json({ ok: true });
  },

  /** Ученик удаляет свой аккаунт и все свои данные (нужно подтвердить паролем). */
  "POST me/delete": async (c) => {
    const u = await needUser(c, "student");
    const row = (await q(c.sql)`SELECT pass_hash FROM users WHERE id = ${u.id}`)[0];
    if (!(await verifyPassword(String(c.body.password ?? ""), row.pass_hash))) fail(401, "bad_credentials");
    await q(c.sql)`DELETE FROM users WHERE id = ${u.id}`;
    return json({ ok: true }, 200, { "set-cookie": sessionCookie("", c.secure, 0) });
  },

  // ——— ученик ———
  "POST class/join": async (c) => {
    const u = await needUser(c, "student");
    const k = await classByCode(c.sql, c.body.code);
    await q(c.sql)`UPDATE users SET teacher_id = ${k.teacher_id}, class_id = ${k.id} WHERE id = ${u.id}`;
    await q(c.sql)`DELETE FROM commands WHERE student_id = ${u.id}`;
    return json({ ok: true, teacher: { name: k.teacher_name }, class: { name: k.name } });
  },

  "POST class/leave": async (c) => {
    const u = await needUser(c, "student");
    await q(c.sql)`UPDATE users SET teacher_id = NULL, class_id = NULL WHERE id = ${u.id}`;
    await q(c.sql)`DELETE FROM commands WHERE student_id = ${u.id}`;
    return json({ ok: true });
  },

  /** Регулярно: «что у меня на экране» → команды учителя, задания класса и через сколько синхронизироваться снова. */
  "POST sync": async (c) => {
    const u = await needUser(c, "student");
    const state = limitJson(cleanState(c.body.state), 2000);
    await q(c.sql)`INSERT INTO presence (student_id, state, seen_at) VALUES (${u.id}, ${state}::jsonb, now())
      ON CONFLICT (student_id) DO UPDATE SET state = EXCLUDED.state, seen_at = now()`;
    if (c.body.progress) {
      const p = obj(c.body.progress);
      const lessons = limitJson(obj(p.lessons ?? {}), 2000);
      const best = Math.max(0, Math.min(100000, Math.floor(Number(p.drillBest) || 0)));
      await q(c.sql)`INSERT INTO progress (student_id, lessons, drill_best) VALUES (${u.id}, ${lessons}::jsonb, ${best})
        ON CONFLICT (student_id) DO UPDATE SET lessons = EXCLUDED.lessons, drill_best = GREATEST(progress.drill_best, EXCLUDED.drill_best), updated_at = now()`;
    }
    if (!u.class_id) return json({ commands: [], assignments: [], interval: SYNC_SLOW });
    const commands = await q(c.sql)`UPDATE commands SET taken_at = now()
      WHERE student_id = ${u.id} AND taken_at IS NULL AND created_at > now() - interval '10 minutes'
      RETURNING id, kind, payload`;
    const assignments = await q(c.sql)`SELECT a.id, a.title, a.descr, a.goal, a.cfg, a.minutes, a.level, s.ms AS done_ms,
        (extract(epoch FROM (now() - t.started_at)) * 1000)::bigint AS elapsed_ms
      FROM assignments a
      LEFT JOIN submissions s ON s.assignment_id = a.id AND s.student_id = ${u.id}
      LEFT JOIN attempts t ON t.assignment_id = a.id AND t.student_id = ${u.id}
      WHERE a.class_id = ${u.class_id} AND NOT a.archived ORDER BY a.id DESC`;
    const watched = await q(c.sql)`SELECT (watched_at > now() - interval '30 seconds') AS on FROM classes WHERE id = ${u.class_id}`;
    return json({ commands: commands.sort((a, b) => a.id - b.id), assignments, interval: watched[0]?.on ? SYNC_FAST : SYNC_SLOW });
  },

  /** Ученик начал задание: время считает сервер. Повторный старт время не сбрасывает. */
  "POST attempt/start": async (c) => {
    const u = await needUser(c, "student");
    const a = (await q(c.sql)`SELECT id FROM assignments WHERE id = ${Number(c.body.assignment)} AND class_id = ${u.class_id} AND NOT archived`)[0];
    if (!a) fail(404, "no_assignment");
    await q(c.sql)`INSERT INTO attempts (assignment_id, student_id) VALUES (${a.id}, ${u.id}) ON CONFLICT DO NOTHING`;
    const t = (await q(c.sql)`SELECT (extract(epoch FROM (now() - started_at)) * 1000)::bigint AS elapsed_ms FROM attempts WHERE assignment_id = ${a.id} AND student_id = ${u.id}`)[0];
    return json({ elapsedMs: Number(t.elapsed_ms) });
  },

  /**
   * Сдать задание: ученик присылает свою конфигурацию BIOS, сервер прогоняет её через модель компьютера
   * (src/learn/goals.ts) — засчитывается, только если она действительно решает задачу. Время — серверное.
   */
  "POST submit": async (c) => {
    const u = await needUser(c, "student");
    const a = (await q(c.sql)`SELECT a.id, a.goal, a.minutes, (extract(epoch FROM (now() - t.started_at)) * 1000)::bigint AS elapsed_ms
      FROM assignments a JOIN attempts t ON t.assignment_id = a.id AND t.student_id = ${u.id}
      WHERE a.id = ${Number(c.body.assignment)} AND a.class_id = ${u.class_id}`)[0];
    if (!a) fail(404, "no_attempt");
    const ms = Number(a.elapsed_ms);
    if (ms < MIN_SOLVE_MS) fail(422, "too_fast");
    if (a.minutes && ms > a.minutes * 60000 + TIME_GRACE_MS) fail(422, "time_up");
    limitJson(obj(c.body.config), 6000);
    if (!configSolves(a.goal, c.body.config)) fail(422, "not_solved");
    await q(c.sql)`INSERT INTO submissions (assignment_id, student_id, ms) VALUES (${a.id}, ${u.id}, ${ms}) ON CONFLICT DO NOTHING`;
    return json({ ok: true, ms });
  },

  // ——— учитель ———
  "GET teacher/class": async (c) => {
    const t = await needUser(c, "teacher");
    const classes = await q(c.sql)`SELECT c.id, c.name, c.code, c.open, (SELECT count(*)::int FROM users s WHERE s.class_id = c.id) AS students
      FROM classes c WHERE c.teacher_id = ${t.id} ORDER BY c.created_at`;
    const used = (await q(c.sql)`SELECT count(*)::int AS n FROM users WHERE teacher_id = ${t.id} AND role = 'student'`)[0].n;
    const wanted = Number(c.url.searchParams.get("class"));
    const current = classes.find((k) => k.id === wanted) ?? classes[0] ?? null;
    if (!current) return json({ teacher: { ...publicUser(t), used }, classes, current: null, students: [], assignments: [], submissions: [] });
    await q(c.sql)`UPDATE classes SET watched_at = now() WHERE id = ${current.id}`;
    const students = await q(c.sql)`SELECT u.id, u.login, u.name, u.created_at, p.state, p.seen_at,
        (p.seen_at > now() - make_interval(secs => ${ONLINE_SEC})) AS online,
        coalesce(g.lessons, '{}') AS lessons, coalesce(g.drill_best, 0) AS drill_best
      FROM users u LEFT JOIN presence p ON p.student_id = u.id LEFT JOIN progress g ON g.student_id = u.id
      WHERE u.class_id = ${current.id} AND u.role = 'student' ORDER BY u.name`;
    const assignments = await q(c.sql)`SELECT id, title, descr, goal, cfg, minutes, level, archived, created_at FROM assignments
      WHERE class_id = ${current.id} ORDER BY id DESC`;
    const subs = await q(c.sql)`SELECT s.assignment_id, s.student_id, s.ms, s.done_at FROM submissions s
      JOIN assignments a ON a.id = s.assignment_id WHERE a.class_id = ${current.id}`;
    return json({ teacher: { ...publicUser(t), used }, classes, current, students, assignments, submissions: subs });
  },

  "POST teacher/classes": async (c) => {
    const t = await needUser(c, "teacher");
    const n = (await q(c.sql)`SELECT count(*)::int AS n FROM classes WHERE teacher_id = ${t.id}`)[0].n;
    if (n >= MAX_CLASSES) fail(409, "too_many_classes");
    return json(await createClass(c.sql, t.id, className(c.body.name)));
  },

  "POST teacher/classes/update": async (c) => {
    const t = await needUser(c, "teacher");
    const k = await ownClass(c, t.id, c.body.id);
    if (c.body.name !== undefined) await q(c.sql)`UPDATE classes SET name = ${className(c.body.name)} WHERE id = ${k.id}`;
    if (c.body.open !== undefined) await q(c.sql)`UPDATE classes SET open = ${!!c.body.open} WHERE id = ${k.id}`;
    if (c.body.newCode) {
      // код уникален в базе: при совпадении UPDATE падает — пробуем другой
      for (let i = 0; i < 6; i++) {
        const done = await q(c.sql)`UPDATE classes SET code = ${newClassCode()} WHERE id = ${k.id} RETURNING code`.then(() => true, () => false);
        if (done) break;
      }
    }
    return json({ ok: true });
  },

  /** Удалить класс: ученики остаются без класса, задания класса удаляются. */
  "POST teacher/classes/delete": async (c) => {
    const t = await needUser(c, "teacher");
    const k = await ownClass(c, t.id, c.body.id);
    await q(c.sql)`UPDATE users SET class_id = NULL, teacher_id = NULL WHERE class_id = ${k.id}`;
    await q(c.sql)`DELETE FROM classes WHERE id = ${k.id}`;
    return json({ ok: true });
  },

  "POST teacher/assignments": async (c) => {
    const t = await needUser(c, "teacher");
    const k = await ownClass(c, t.id, c.body.class);
    const title = String(c.body.title ?? "").trim().slice(0, 120);
    if (!title) fail(400, "bad_title");
    if (!goalValid(c.body.goal)) fail(400, "bad_goal");
    const cfg = limitJson(obj(c.body.cfg ?? {}), 4000);
    const minutes = c.body.minutes ? Math.floor(Number(c.body.minutes)) : null;
    if (minutes !== null && !(minutes >= 1 && minutes <= 180)) fail(400, "bad_minutes");
    const level = [1, 2, 3].includes(Number(c.body.level)) ? Number(c.body.level) : null;
    const rows = await q(c.sql)`INSERT INTO assignments (teacher_id, class_id, title, descr, goal, cfg, minutes, level)
      VALUES (${t.id}, ${k.id}, ${title}, ${String(c.body.descr ?? "").slice(0, 600)}, ${c.body.goal}, ${cfg}::jsonb, ${minutes}, ${level}) RETURNING id`;
    return json({ id: rows[0].id });
  },

  "POST teacher/assignments/archive": async (c) => {
    const t = await needUser(c, "teacher");
    await q(c.sql)`UPDATE assignments SET archived = ${!!c.body.archived} WHERE id = ${Number(c.body.id)} AND teacher_id = ${t.id}`;
    return json({ ok: true });
  },

  /** Удалённое управление: команда одному, нескольким или всем ученикам класса. */
  "POST teacher/command": async (c) => {
    const t = await needUser(c, "teacher");
    const k = await ownClass(c, t.id, c.body.class);
    const kind = String(c.body.kind);
    if (!COMMANDS.includes(kind)) fail(400, "bad_command");
    const payload = obj(c.body.payload ?? {});
    if (kind === "message" || kind === "lock") payload.text = String(payload.text ?? "").slice(0, 300);
    const all = (await q(c.sql)`SELECT id FROM users WHERE class_id = ${k.id} AND role = 'student'`).map((r) => r.id as number);
    const target = c.body.students === "all" ? all : Array.isArray(c.body.students) ? c.body.students.map(Number).filter((id: number) => all.includes(id)) : [];
    if (!target.length) fail(400, "no_students");
    if (kind === "assign") {
      const a = (await q(c.sql)`SELECT id, title, descr, goal, cfg, minutes FROM assignments WHERE id = ${Number(payload.id)} AND class_id = ${k.id}`)[0];
      if (!a) fail(404, "no_assignment");
      payload.assignment = a;
      // выдача заново — время для тех, кто ещё не сдал, начинается сначала
      await q(c.sql)`DELETE FROM attempts t WHERE t.assignment_id = ${a!.id} AND t.student_id = ANY(${target})
        AND NOT EXISTS (SELECT 1 FROM submissions s WHERE s.assignment_id = t.assignment_id AND s.student_id = t.student_id)`;
    }
    // повторная команда того же вида заменяет ещё не полученную
    await q(c.sql)`DELETE FROM commands WHERE student_id = ANY(${target}) AND kind = ${kind} AND taken_at IS NULL`;
    const p = limitJson(payload, 6000);
    await q(c.sql)`INSERT INTO commands (student_id, kind, payload) SELECT unnest(${target}::int[]), ${kind}, ${p}::jsonb`;
    await q(c.sql)`UPDATE classes SET watched_at = now() WHERE id = ${k.id}`;
    return json({ ok: true, sent: target.length });
  },

  "POST teacher/student/remove": async (c) => {
    const t = await needUser(c, "teacher");
    const id = await ownStudent(c, t.id, c.body.id);
    await q(c.sql)`UPDATE users SET teacher_id = NULL, class_id = NULL WHERE id = ${id}`;
    await q(c.sql)`DELETE FROM commands WHERE student_id = ${id}`;
    return json({ ok: true });
  },

  /** Перевести ученика в другой свой класс. */
  "POST teacher/student/move": async (c) => {
    const t = await needUser(c, "teacher");
    const id = await ownStudent(c, t.id, c.body.id);
    const k = await ownClass(c, t.id, c.body.class);
    await q(c.sql)`UPDATE users SET class_id = ${k.id} WHERE id = ${id}`;
    return json({ ok: true });
  },

  /** Ученик забыл пароль — учитель задаёт новый. */
  "POST teacher/student/password": async (c) => {
    const t = await needUser(c, "teacher");
    const id = await ownStudent(c, t.id, c.body.id);
    if (check.password(c.body.password)) fail(400, "bad_password");
    await q(c.sql)`UPDATE users SET pass_hash = ${await hashPassword(c.body.password)} WHERE id = ${id}`;
    await q(c.sql)`DELETE FROM sessions WHERE user_id = ${id}`;
    return json({ ok: true });
  },

  // ——— администратор (владелец сайта): учётные записи учителей ———
  "GET admin/teachers": async (c) => {
    needAdmin(c);
    const rows = await q(c.sql)`SELECT t.id, t.login, t.name, t.max_students, t.created_at,
        (SELECT count(*)::int FROM users s WHERE s.teacher_id = t.id) AS students,
        (SELECT string_agg(c.code, ', ' ORDER BY c.created_at) FROM classes c WHERE c.teacher_id = t.id) AS codes
      FROM users t WHERE t.role = 'teacher' ORDER BY t.created_at DESC`;
    return json({ teachers: rows });
  },

  "POST admin/teachers": async (c) => {
    needAdmin(c);
    const login = normLogin(c.body.login);
    const err = check.login(login) ?? check.name(c.body.name) ?? check.password(c.body.password);
    if (err) fail(400, `bad_${err}`);
    const max = Math.floor(Number(c.body.maxStudents));
    if (!(max >= 1 && max <= 500)) fail(400, "bad_max");
    const rows = await q(c.sql)`INSERT INTO users (login, name, role, pass_hash, max_students)
      VALUES (${login}, ${String(c.body.name).trim()}, 'teacher', ${await hashPassword(c.body.password)}, ${max})
      ON CONFLICT (login) DO NOTHING RETURNING id`;
    if (!rows[0]) fail(409, "login_taken");
    const k = await createClass(c.sql, rows[0].id, "Мой класс");
    return json({ id: rows[0].id, classCode: k.code });
  },

  "POST admin/teachers/update": async (c) => {
    needAdmin(c);
    const id = Number(c.body.id);
    if (c.body.maxStudents !== undefined) {
      const max = Math.floor(Number(c.body.maxStudents));
      if (!(max >= 1 && max <= 500)) fail(400, "bad_max");
      await q(c.sql)`UPDATE users SET max_students = ${max} WHERE id = ${id} AND role = 'teacher'`;
    }
    if (c.body.password !== undefined) {
      if (check.password(c.body.password)) fail(400, "bad_password");
      await q(c.sql)`UPDATE users SET pass_hash = ${await hashPassword(c.body.password)} WHERE id = ${id} AND role = 'teacher'`;
      await q(c.sql)`DELETE FROM sessions WHERE user_id = ${id}`;
    }
    return json({ ok: true });
  },

  "POST admin/teachers/delete": async (c) => {
    needAdmin(c);
    // ученики остаются, но без класса; классы и задания учителя удаляются каскадом
    await q(c.sql)`UPDATE users SET teacher_id = NULL, class_id = NULL WHERE teacher_id = ${Number(c.body.id)} AND role = 'student'`;
    await q(c.sql)`DELETE FROM users WHERE id = ${Number(c.body.id)} AND role = 'teacher'`;
    return json({ ok: true });
  },
};

export async function handle(req: Request, sql?: Sql): Promise<Response> {
  const url = new URL(req.url);
  const route = (url.searchParams.get("route") ?? url.pathname.replace(/^\/api\/?/, "")).replace(/^\/+|\/+$/g, "");
  const fn = routes[`${req.method} ${route}`];
  if (!fn) return json({ error: "not_found" }, 404);
  try {
    let body: Row = {};
    if (req.method === "POST") {
      // только JSON: обычная HTML-форма с чужого сайта так не отправит (защита от CSRF вместе с SameSite)
      if (!(req.headers.get("content-type") ?? "").includes("application/json")) fail(415, "json_only");
      const text = await req.text();
      if (text.length > 20000) fail(413, "too_large");
      body = text ? obj(JSON.parse(text)) : {};
    }
    const secure = url.protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
    return await fn({ sql: sql ?? db(), req, url, body, secure });
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.code }, e.status);
    if (e instanceof SyntaxError) return json({ error: "bad_json" }, 400);
    console.error(e);
    return json({ error: "server_error" }, 500);
  }
}
