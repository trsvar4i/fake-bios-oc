// Сервер класса без базы: пароли, cookie, коды, маршрутизация и защита. Запросы к базе подменяются.
import { afterEach, describe, expect, it } from "vitest";
import { check, hashPassword, newClassCode, readCookie, sessionCookie, verifyPassword } from "./auth.js";
import { cleanState, handle } from "./handler.js";

describe("пароли и сессии", () => {
  it("scrypt: верный пароль подходит, неверный — нет, соль каждый раз своя", async () => {
    const a = await hashPassword("пароль-123");
    const b = await hashPassword("пароль-123");
    expect(a).not.toBe(b);
    expect(await verifyPassword("пароль-123", a)).toBe(true);
    expect(await verifyPassword("пароль-124", a)).toBe(false);
    expect(await verifyPassword("x", "мусор")).toBe(false);
  });
  it("cookie: HttpOnly, SameSite, Secure только на https", () => {
    const c = sessionCookie("tok", true);
    expect(c).toMatch(/^kp_sid=tok; Path=\/; HttpOnly; SameSite=Lax; Max-Age=\d+; Secure$/);
    expect(sessionCookie("tok", false)).not.toContain("Secure");
    expect(readCookie("a=1; kp_sid=abc; b=2")).toBe("abc");
    expect(readCookie(null)).toBeNull();
  });
  it("код класса — 6 символов без похожих букв", () => {
    for (let i = 0; i < 50; i++) expect(newClassCode()).toMatch(/^[A-HJKMNP-Z2-9]{6}$/);
  });
  it("проверка полей", () => {
    expect(check.login("ivan.petrov")).toBeNull();
    expect(check.login("Иван")).toBe("login");
    expect(check.login("ab")).toBe("login");
    expect(check.password("12345")).toBe("password");
    expect(check.name(" Я ")).toBe("name");
  });
});

/** Подмена базы: записывает запросы и отвечает по очереди. */
function fakeSql(...answers: unknown[][]) {
  const calls: string[] = [];
  const sql = (text: TemplateStringsArray) => { calls.push(text.join("?")); return Promise.resolve(answers.shift() ?? []); };
  return { sql: sql as never, calls };
}

const post = (route: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`https://x.test/api/${route}`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });

describe("API", () => {
  afterEach(() => { delete process.env.ADMIN_KEY; });

  it("неизвестный маршрут — 404; маршрут из ?route= (как после rewrite в vercel.json)", async () => {
    expect((await handle(new Request("https://x.test/api/nope"), fakeSql().sql)).status).toBe(404);
    const r = await handle(new Request("https://x.test/api/main?route=me"), fakeSql().sql);
    expect(await r.json()).toEqual({ user: null });
  });

  it("POST только с JSON — обычная форма с чужого сайта не пройдёт", async () => {
    const r = await handle(new Request("https://x.test/api/auth/login", { method: "POST", body: "login=a&password=b", headers: { "content-type": "application/x-www-form-urlencoded" } }), fakeSql().sql);
    expect(r.status).toBe(415);
  });

  it("без входа учительские и ученические маршруты закрыты", async () => {
    for (const route of ["teacher/command", "sync", "submit", "class/join"]) {
      expect((await handle(post(route, {}), fakeSql().sql)).status, route).toBe(401);
    }
  });

  it("админ: без ключа на сервере — выключено, с неверным ключом — 403, с верным — пускает", async () => {
    expect((await handle(new Request("https://x.test/api/admin/teachers"), fakeSql().sql)).status).toBe(503);
    process.env.ADMIN_KEY = "k".repeat(32);
    const bad = await handle(new Request("https://x.test/api/admin/teachers", { headers: { "x-admin-key": "nope" } }), fakeSql().sql);
    expect(bad.status).toBe(403);
    const ok = await handle(new Request("https://x.test/api/admin/teachers", { headers: { "x-admin-key": "k".repeat(32) } }), fakeSql([{ id: 1 }]).sql);
    expect(await ok.json()).toEqual({ teachers: [{ id: 1 }] });
  });

  it("регистрация проверяет поля до обращения к базе", async () => {
    const { sql, calls } = fakeSql();
    const r = await handle(post("auth/register", { login: "Иван", name: "Иван", password: "123456", code: "ABCDEF" }), sql);
    expect(await r.json()).toEqual({ error: "bad_login" });
    expect(calls).toHaveLength(0);
  });

  it("регистрация в полный класс отклоняется", async () => {
    const { sql } = fakeSql([{ n: 0 }], [{ id: 7, name: "T", open: true, teacher_id: 1, max_students: 2, used: 2 }]);
    const r = await handle(post("auth/register", { login: "ivan", name: "Иван", password: "123456", code: "abcdef" }), sql);
    expect(r.status).toBe(409);
    expect(await r.json()).toEqual({ error: "class_full" });
  });

  it("закрытый набор — регистрация по коду не проходит", async () => {
    const { sql } = fakeSql([{ n: 0 }], [{ id: 7, name: "T", open: false, teacher_id: 1, max_students: 30, used: 2 }]);
    const r = await handle(post("auth/register", { login: "ivan", name: "Иван", password: "123456", code: "abcdef" }), sql);
    expect(await r.json()).toEqual({ error: "class_closed" });
  });

  it("с одного адреса не больше 15 регистраций в час", async () => {
    const { sql, calls } = fakeSql([{ n: 15 }]);
    const r = await handle(post("auth/register", { login: "ivan", name: "Иван", password: "123456", code: "abcdef" }, { "x-forwarded-for": "1.2.3.4, 10.0.0.1" }), sql);
    expect(r.status).toBe(429);
    expect(calls).toHaveLength(1);
  });

  it("вход: 8 неудач с этого адреса — 429; с другого адреса тот же логин не заблокирован", async () => {
    const { sql, calls } = fakeSql([{ mine: 8, total: 8 }]);
    const r = await handle(post("auth/login", { login: "ivan", password: "x" }), sql);
    expect(r.status).toBe(429);
    expect(calls).toHaveLength(1);
  });

  it("неверный пароль — 401 и попытка записывается", async () => {
    const hash = await hashPassword("right-pass");
    const { sql, calls } = fakeSql([{ mine: 0, total: 0 }], [{ id: 1, pass_hash: hash }]);
    const r = await handle(post("auth/login", { login: "ivan", password: "wrong-pass" }), sql);
    expect(r.status).toBe(401);
    expect(calls.some((c) => c.includes("INSERT INTO login_fails"))).toBe(true);
  });

  it("верный пароль — cookie сессии", async () => {
    const hash = await hashPassword("right-pass");
    const { sql } = fakeSql([{ mine: 3, total: 39 }], [{ id: 1, pass_hash: hash }]);
    const r = await handle(post("auth/login", { login: "IVAN ", password: "right-pass" }), sql);
    expect(r.status).toBe(200);
    expect(r.headers.get("set-cookie")).toMatch(/^kp_sid=[\w-]{40,}; Path=\/; HttpOnly; SameSite=Lax; Max-Age=\d+; Secure$/);
  });
});

describe("сдача задания: сервер сам проверяет решение по модели", () => {
  const student = { id: 5, login: "ivan", name: "Иван", role: "student", teacher_id: 1, class_id: 3, max_students: null };
  const submit = (config: unknown, attempt: Record<string, unknown>) => {
    const { sql, calls } = fakeSql([student], [{ id: 9, goal: "boot+lan", minutes: 10, ...attempt }]);
    return { calls, res: handle(post("submit", { assignment: 9, config }, { cookie: "kp_sid=tok" }), sql) };
  };

  it("верная конфигурация — засчитано, время серверное", async () => {
    const { res, calls } = submit({ lanController: true }, { elapsed_ms: 95000 });
    const r = await res;
    expect(await r.json()).toEqual({ ok: true, ms: 95000 });
    expect(calls.some((c) => c.includes("INSERT INTO submissions"))).toBe(true);
  });
  it("конфигурация не решает задачу — не засчитано", async () => {
    const r = await submit({ lanController: false }, { elapsed_ms: 95000 }).res;
    expect(await r.json()).toEqual({ error: "not_solved" });
  });
  it("слишком быстро — подозрительно", async () => {
    const r = await submit({ lanController: true }, { elapsed_ms: 2000 }).res;
    expect(await r.json()).toEqual({ error: "too_fast" });
  });
  it("время вышло", async () => {
    const r = await submit({ lanController: true }, { elapsed_ms: 11 * 60000 }).res;
    expect(await r.json()).toEqual({ error: "time_up" });
  });
  it("без начатой попытки — нечего сдавать", async () => {
    const { sql } = fakeSql([student], []);
    const r = await handle(post("submit", { assignment: 9, config: {} }, { cookie: "kp_sid=tok" }), sql);
    expect(await r.json()).toEqual({ error: "no_attempt" });
  });
});

describe("состояние экрана ученика", () => {
  it("подделка приводится к безопасному виду", () => {
    expect(cleanState({ phase: "<script>", ghz: "9000", temp: 1e9, app: { x: 1 }, activity: { kind: "evil" }, extra: "x".repeat(5000) }))
      .toEqual({ phase: "off", screen: "", ghz: 0, temp: 150, app: null, activity: null, locked: false });
    expect(cleanState({ phase: "os", screen: "desktop", ghz: 4.5, temp: 49, app: "learn", activity: { kind: "task", title: "Диск", assignment: 3, done: true }, locked: true, error: "INACCESSIBLE_BOOT_DEVICE" }))
      .toEqual({ phase: "os", screen: "desktop", ghz: 4.5, temp: 49, app: "learn", activity: { kind: "task", title: "Диск", assignment: 3, done: true }, locked: true, error: "INACCESSIBLE_BOOT_DEVICE" });
    expect(cleanState(null).phase).toBe("off");
  });
});
