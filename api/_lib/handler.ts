// API класса. Один обработчик на всё: /api/<маршрут>. Web Request → Response, поэтому один и тот же код
// работает в функции Vercel, в dev-сервере Vite и в тестах.
import { neon } from "@neondatabase/serverless";
import { COOKIE, SESSION_DAYS, check, hashPassword, newClassCode, newToken, normLogin, readCookie, sameSecret, sessionCookie, sha256, verifyPassword } from "./auth.js";

type Sql = ReturnType<typeof neon>;
type Row = Record<string, any>;

interface User { id: number; login: string; name: string; role: "teacher" | "student"; teacher_id: number | null; class_code: string | null; max_students: number | null }

/** Цели заданий — те же ключи, что GOALS в src/learn/tasks.ts. */
const GOAL_IDS = ["boot", "online", "sound", "safeboot", "linux", "vm", "oc5"];
/** Команды удалённого управления. */
const COMMANDS = ["message", "lock", "unlock", "assign", "restart", "shutdown", "reset"];
/** Ученик «в сети», если синхронизировался за последние N секунд. */
const ONLINE_SEC = 20;

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
  return { id: u.id, login: u.login, name: u.name, role: u.role, ...(u.role === "teacher" ? { classCode: u.class_code, maxStudents: u.max_students } : {}) };
}

async function currentUser(sql: Sql, req: Request): Promise<User | null> {
  const token = readCookie(req.headers.get("cookie"));
  if (!token) return null;
  const rows = await q(sql)`SELECT u.id, u.login, u.name, u.role, u.teacher_id, u.class_code, u.max_students
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

/** Учитель по коду класса, если в классе есть место. */
async function classByCode(sql: Sql, code: unknown) {
  const c = typeof code === "string" ? code.trim().toUpperCase() : "";
  if (!/^[A-Z0-9]{6}$/.test(c)) fail(400, "bad_code");
  const rows = await q(sql)`SELECT t.id, t.name, t.max_students, (SELECT count(*)::int FROM users s WHERE s.teacher_id = t.id) AS used
    FROM users t WHERE t.class_code = ${c} AND t.role = 'teacher'`;
  const t = rows[0] ?? fail(404, "no_class");
  if (t.used >= t.max_students) fail(409, "class_full");
  return t as { id: number; name: string };
}

const limitJson = (v: unknown, max: number) => {
  const s = JSON.stringify(v ?? {});
  if (s.length > max) fail(413, "too_large");
  return s;
};

/** Объект (не массив), иначе ошибка. */
const obj = (v: unknown): Row => (v && typeof v === "object" && !Array.isArray(v) ? (v as Row) : fail(400, "bad_input"));

type Ctx = { sql: Sql; req: Request; body: Row; secure: boolean };
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

/** Ученик этого учителя? */
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
    let teacher = null;
    if (u.role === "student" && u.teacher_id) teacher = (await q(c.sql)`SELECT name FROM users WHERE id = ${u.teacher_id}`)[0] ?? null;
    return json({ user: publicUser(u), teacher });
  },

  "POST auth/register": async (c) => {
    const login = normLogin(c.body.login);
    const err = check.login(login) ?? check.name(c.body.name) ?? check.password(c.body.password);
    if (err) fail(400, `bad_${err}`);
    const t = await classByCode(c.sql, c.body.code);
    const hash = await hashPassword(c.body.password);
    const rows = await q(c.sql)`INSERT INTO users (login, name, role, pass_hash, teacher_id)
      VALUES (${login}, ${String(c.body.name).trim()}, 'student', ${hash}, ${t.id}) ON CONFLICT (login) DO NOTHING RETURNING id`;
    if (!rows[0]) fail(409, "login_taken");
    return json({ ok: true }, 200, { "set-cookie": await startSession(c.sql, rows[0].id, c.secure) });
  },

  "POST auth/login": async (c) => {
    const login = normLogin(c.body.login);
    const fails = await q(c.sql)`SELECT count(*)::int AS n FROM login_fails WHERE login = ${login} AND at > now() - interval '15 minutes'`;
    if (fails[0].n >= 8) fail(429, "too_many_attempts");
    const rows = await q(c.sql)`SELECT id, pass_hash FROM users WHERE login = ${login}`;
    // хеш считаем всегда, чтобы по времени ответа нельзя было узнать, есть ли такой логин
    const ok = await verifyPassword(String(c.body.password ?? ""), rows[0]?.pass_hash ?? "scrypt$AAAAAAAAAAAAAAAAAAAAAA==$AAAA");
    if (!rows[0] || !ok) {
      await q(c.sql)`INSERT INTO login_fails (login) VALUES (${login})`;
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

  // ——— ученик ———
  "POST class/join": async (c) => {
    const u = await needUser(c, "student");
    const t = await classByCode(c.sql, c.body.code);
    await q(c.sql)`UPDATE users SET teacher_id = ${t.id} WHERE id = ${u.id}`;
    await q(c.sql)`DELETE FROM commands WHERE student_id = ${u.id}`;
    return json({ ok: true, teacher: { name: t.name } });
  },

  "POST class/leave": async (c) => {
    const u = await needUser(c, "student");
    await q(c.sql)`UPDATE users SET teacher_id = NULL WHERE id = ${u.id}`;
    await q(c.sql)`DELETE FROM commands WHERE student_id = ${u.id}`;
    return json({ ok: true });
  },

  /** Каждые несколько секунд: «что у меня на экране» → команды учителя и задания класса. */
  "POST sync": async (c) => {
    const u = await needUser(c, "student");
    const state = limitJson(obj(c.body.state ?? {}), 2000);
    await q(c.sql)`INSERT INTO presence (student_id, state, seen_at) VALUES (${u.id}, ${state}::jsonb, now())
      ON CONFLICT (student_id) DO UPDATE SET state = EXCLUDED.state, seen_at = now()`;
    if (c.body.progress) {
      const p = obj(c.body.progress);
      const lessons = limitJson(obj(p.lessons ?? {}), 2000);
      const best = Math.max(0, Math.min(100000, Math.floor(Number(p.drillBest) || 0)));
      await q(c.sql)`INSERT INTO progress (student_id, lessons, drill_best) VALUES (${u.id}, ${lessons}::jsonb, ${best})
        ON CONFLICT (student_id) DO UPDATE SET lessons = EXCLUDED.lessons, drill_best = GREATEST(progress.drill_best, EXCLUDED.drill_best), updated_at = now()`;
    }
    if (!u.teacher_id) return json({ commands: [], assignments: [] });
    const commands = await q(c.sql)`UPDATE commands SET taken_at = now()
      WHERE student_id = ${u.id} AND taken_at IS NULL AND created_at > now() - interval '10 minutes'
      RETURNING id, kind, payload`;
    const assignments = await q(c.sql)`SELECT a.id, a.title, a.descr, a.goal, a.cfg, s.ms AS done_ms
      FROM assignments a LEFT JOIN submissions s ON s.assignment_id = a.id AND s.student_id = ${u.id}
      WHERE a.teacher_id = ${u.teacher_id} AND NOT a.archived ORDER BY a.id DESC`;
    return json({ commands: commands.sort((a, b) => a.id - b.id), assignments });
  },

  "POST submit": async (c) => {
    const u = await needUser(c, "student");
    const id = Number(c.body.assignment);
    const ms = Math.max(0, Math.min(86_400_000, Math.floor(Number(c.body.ms) || 0)));
    const rows = await q(c.sql)`SELECT id FROM assignments WHERE id = ${id} AND teacher_id = ${u.teacher_id}`;
    if (!rows[0]) fail(404, "no_assignment");
    await q(c.sql)`INSERT INTO submissions (assignment_id, student_id, ms) VALUES (${id}, ${u.id}, ${ms}) ON CONFLICT DO NOTHING`;
    return json({ ok: true });
  },

  // ——— учитель ———
  "GET teacher/class": async (c) => {
    const t = await needUser(c, "teacher");
    const students = await q(c.sql)`SELECT u.id, u.login, u.name, u.created_at, p.state, p.seen_at,
        (p.seen_at > now() - make_interval(secs => ${ONLINE_SEC})) AS online,
        coalesce(g.lessons, '{}') AS lessons, coalesce(g.drill_best, 0) AS drill_best
      FROM users u LEFT JOIN presence p ON p.student_id = u.id LEFT JOIN progress g ON g.student_id = u.id
      WHERE u.teacher_id = ${t.id} AND u.role = 'student' ORDER BY u.name`;
    const assignments = await q(c.sql)`SELECT id, title, descr, goal, cfg, archived, created_at FROM assignments WHERE teacher_id = ${t.id} ORDER BY id DESC`;
    const subs = await q(c.sql)`SELECT s.assignment_id, s.student_id, s.ms, s.done_at FROM submissions s
      JOIN assignments a ON a.id = s.assignment_id WHERE a.teacher_id = ${t.id}`;
    return json({ teacher: publicUser(t), students, assignments, submissions: subs });
  },

  "POST teacher/assignments": async (c) => {
    const t = await needUser(c, "teacher");
    const title = String(c.body.title ?? "").trim().slice(0, 120);
    if (!title) fail(400, "bad_title");
    if (!GOAL_IDS.includes(c.body.goal)) fail(400, "bad_goal");
    const cfg = limitJson(obj(c.body.cfg ?? {}), 4000);
    const rows = await q(c.sql)`INSERT INTO assignments (teacher_id, title, descr, goal, cfg)
      VALUES (${t.id}, ${title}, ${String(c.body.descr ?? "").slice(0, 600)}, ${c.body.goal}, ${cfg}::jsonb) RETURNING id`;
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
    const kind = String(c.body.kind);
    if (!COMMANDS.includes(kind)) fail(400, "bad_command");
    const payload = obj(c.body.payload ?? {});
    if (kind === "message" || kind === "lock") payload.text = String(payload.text ?? "").slice(0, 300);
    if (kind === "assign") {
      const a = (await q(c.sql)`SELECT id, title, descr, goal, cfg FROM assignments WHERE id = ${Number(payload.id)} AND teacher_id = ${t.id}`)[0];
      if (!a) fail(404, "no_assignment");
      payload.assignment = a;
    }
    const all = (await q(c.sql)`SELECT id FROM users WHERE teacher_id = ${t.id} AND role = 'student'`).map((r) => r.id as number);
    const target = c.body.students === "all" ? all : Array.isArray(c.body.students) ? c.body.students.map(Number).filter((id: number) => all.includes(id)) : [];
    if (!target.length) fail(400, "no_students");
    // повторная команда того же вида заменяет ещё не полученную
    await q(c.sql)`DELETE FROM commands WHERE student_id = ANY(${target}) AND kind = ${kind} AND taken_at IS NULL`;
    const p = limitJson(payload, 6000);
    await q(c.sql)`INSERT INTO commands (student_id, kind, payload) SELECT unnest(${target}::int[]), ${kind}, ${p}::jsonb`;
    return json({ ok: true, sent: target.length });
  },

  "POST teacher/code": async (c) => {
    const t = await needUser(c, "teacher");
    for (let i = 0; i < 5; i++) {
      const code = newClassCode();
      const rows = await q(c.sql)`UPDATE users SET class_code = ${code} WHERE id = ${t.id} AND NOT EXISTS (SELECT 1 FROM users WHERE class_code = ${code}) RETURNING class_code`;
      if (rows[0]) return json({ classCode: code });
    }
    return fail(500, "code_failed");
  },

  "POST teacher/student/remove": async (c) => {
    const t = await needUser(c, "teacher");
    const id = await ownStudent(c, t.id, c.body.id);
    await q(c.sql)`UPDATE users SET teacher_id = NULL WHERE id = ${id}`;
    await q(c.sql)`DELETE FROM commands WHERE student_id = ${id}`;
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
    const rows = await q(c.sql)`SELECT t.id, t.login, t.name, t.class_code, t.max_students, t.created_at,
        (SELECT count(*)::int FROM users s WHERE s.teacher_id = t.id) AS students
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
    const hash = await hashPassword(c.body.password);
    for (let i = 0; i < 5; i++) {
      const rows = await q(c.sql)`INSERT INTO users (login, name, role, pass_hash, class_code, max_students)
        SELECT ${login}, ${String(c.body.name).trim()}, 'teacher', ${hash}, ${newClassCode()}, ${max}
        WHERE NOT EXISTS (SELECT 1 FROM users WHERE login = ${login})
        ON CONFLICT (class_code) DO NOTHING RETURNING id, class_code`;
      if (rows[0]) return json({ id: rows[0].id, classCode: rows[0].class_code });
      if ((await q(c.sql)`SELECT 1 FROM users WHERE login = ${login}`)[0]) fail(409, "login_taken");
    }
    return fail(500, "code_failed");
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
    // ученики остаются, но без класса; задания учителя удаляются каскадом
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
    return await fn({ sql: sql ?? db(), req, body, secure });
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.code }, e.status);
    if (e instanceof SyntaxError) return json({ error: "bad_json" }, 400);
    console.error(e);
    return json({ error: "server_error" }, 500);
  }
}

export { COOKIE };
