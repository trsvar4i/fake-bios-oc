// Снимает кадры симулятора для промо-видео. Запускается в GitHub Actions против `vite dev`.
import { chromium } from "playwright";
import fs from "node:fs";
const BASE = "http://localhost:5173/";
const OUT = ".video/shots";
fs.mkdirSync(OUT, { recursive: true });
const log = [];
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, locale: "ru-RU", timezoneId: "Asia/Tashkent" });
await ctx.addInitScript(() => { try { localStorage.setItem("kestrel.tour", "1"); } catch {} });

const now = new Date().toISOString();
const students = ["Анна К.", "Тимур Р.", "Дильноза А.", "Максим П.", "Сабина Ю.", "Артём Л."].map((name, i) => ({
  id: i + 1, login: "s" + (i + 1), name, online: i !== 5, seen_at: now, drill_best: [420, 360, 510, 290, 470, 0][i],
  lessons: { "bios-tour": 1, "boot-order": i % 2 ? 1 : 0, overclock: i < 3 ? 1 : 0 },
  state: [
    { phase: "setup", screen: "adv", ghz: 4.9, temp: 71, app: null, activity: { kind: "task", title: "Разгон до 5 ГГц", assignment: 2, done: false }, locked: false },
    { phase: "os", screen: "desktop", ghz: 4.2, temp: 48, app: "taskmgr", activity: { kind: "lesson", id: "cooling", step: 2 }, locked: false },
    { phase: "boot", screen: "boot", ghz: 4.2, temp: 44, app: null, activity: { kind: "drill", i: 3, of: 8, score: 270 }, locked: false, error: "Boot Device Not Found" },
    { phase: "setup", screen: "ez", ghz: 4.2, temp: 42, app: null, activity: { kind: "task", title: "Разгон до 5 ГГц", assignment: 2, done: true }, locked: false },
    { phase: "os", screen: "crash", ghz: 5.4, temp: 88, app: null, activity: null, locked: false },
    null,
  ][i],
}));
const classData = {
  teacher: { name: "Ольга Сергеевна", maxStudents: 40, used: 6 },
  classes: [{ id: 1, name: "10-А, информатика", code: "K7Q2PX", open: true, students: 6 }, { id: 2, name: "Кружок «Железо»", code: "M3T9WB", open: false, students: 0 }],
  current: { id: 1, name: "10-А, информатика", code: "K7Q2PX", open: true, students: 6 },
  students,
  assignments: [
    { id: 1, title: "Включить виртуализацию", descr: "Включите SVM и запустите Kestrel VM", goal: "vm", cfg: {}, minutes: 10, level: 1, archived: false, created_at: now },
    { id: 2, title: "Разгон до 5 ГГц", descr: "Стабильная работа ОС на 5 ГГц", goal: "oc5", cfg: {}, minutes: 15, level: 2, archived: false, created_at: now },
  ],
  submissions: [{ assignment_id: 1, student_id: 1, ms: 312000 }, { assignment_id: 1, student_id: 2, ms: 405000 }, { assignment_id: 2, student_id: 4, ms: 541000 }],
};

const page = await ctx.newPage();
page.on("pageerror", (e) => log.push("pageerror: " + e.message));
const shot = async (name, ms = 900) => { await page.waitForTimeout(ms); await page.screenshot({ path: `${OUT}/${name}.jpg`, type: "jpeg", quality: 92 }); log.push("ok " + name); };
const run = (code) => page.evaluate(code);
const step = async (name, fn) => { try { await fn(); } catch (e) { log.push(`FAIL ${name}: ${e.message}`); } };

await page.goto(BASE, { waitUntil: "networkidle" });
const S = `const { useStore } = await import("/src/machine/store.ts"); const { useOs } = await import("/src/os/osStore.ts"); const L = await import("/src/learn/store.ts");`;
await run(`(async () => { ${S} useStore.getState().setLanguage("Русский"); })()`);

await step("power", () => shot("01_power", 1500));
await step("post", async () => { await run(`(async () => { ${S} useStore.getState().powerOn(); })()`); for (const t of [700, 900, 1200]) await shot("02_post_" + t, t); });
await step("ez", async () => { await run(`(async () => { ${S} useStore.getState().enterSetup(); useStore.getState().patch({ mode: "ez" }); })()`); await shot("03_ez", 2500); });
for (const [i, tab] of [[2, "tweaker"], [4, "monitor"], [5, "boot"], [3, "advanced"]]) {
  await step("adv " + tab, async () => { await run(`(async () => { ${S} useStore.getState().patch({ mode: "adv", advTab: ${i}, advPath: [] }); })()`); await shot("04_adv_" + tab, 2500); });
}
await step("lesson", async () => { await run(`(async () => { ${S} useStore.getState().patch({ mode: "ez" }); L.startLesson("overclock"); })()`); await shot("05_lesson", 1500); });
await step("leave", () => run(`(async () => { ${S} L.leave(true); useStore.getState().closeDialog(); })()`));
await step("boot", async () => { await run(`(async () => { ${S} useStore.getState().boot(); })()`); await shot("06_boot_a", 600); await shot("06_boot_b", 1200); });
await step("os", async () => {
  await page.waitForTimeout(4000);
  await run(`(async () => { ${S} useStore.getState().patch({ phase: "os" }); useOs.getState().setStage("desktop"); })()`);
  await shot("07_desktop", 2500);
  await run(`(async () => { ${S} const o = useOs.getState(); o.open("taskmgr"); o.open("terminal"); })()`);
  await shot("08_apps", 2000);
  await run(`(async () => { ${S} const o = useOs.getState(); o.windows.forEach(w => o.close(w.id)); })()`);
  await page.waitForTimeout(500);
  await run(`(async () => { ${S} useOs.getState().open("vm"); })()`);
  await shot("09_vm", 2000);
  await run(`(async () => { ${S} const o = useOs.getState(); o.windows.forEach(w => o.close(w.id)); o.open("settings"); })()`);
  await shot("10_settings", 2000);
  await run(`(async () => { ${S} const o = useOs.getState(); o.windows.forEach(w => o.close(w.id)); o.open("quests"); })()`);
  await shot("11_quests", 2000);
  await run(`(async () => { ${S} const o = useOs.getState(); o.windows.forEach(w => o.close(w.id)); o.open("learn"); })()`);
  await shot("12_learnapp", 2000);
  await run(`(async () => { ${S} const o = useOs.getState(); o.windows.forEach(w => o.close(w.id)); })()`);
});
await step("drill", async () => { await run(`(async () => { ${S} L.startDrill(); })()`); await shot("13_drill_a", 1500); await shot("13_drill_b", 4000); });
await step("crash", async () => { await run(`(async () => { ${S} L.leave(true); useStore.getState().patch({ phase: "os" }); useOs.getState().setStage("crash"); })()`); await shot("14_crash", 1500); });

// кабинет учителя с демо-данными
await step("teacher", async () => {
  const p2 = await ctx.newPage();
  await p2.route("**/api/**", (r) => {
    const u = r.request().url();
    const json = (b) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(b) });
    if (u.includes("/api/me")) return json({ user: { id: 99, login: "olga", name: "Ольга Сергеевна", role: "teacher", maxStudents: 40 }, teacher: null, class: null });
    if (u.includes("/api/teacher/class")) return json(classData);
    return json({ ok: true });
  });
  await p2.goto(BASE + "#teacher", { waitUntil: "networkidle" });
  await p2.waitForTimeout(2500);
  await p2.screenshot({ path: `${OUT}/15_teacher.jpg`, type: "jpeg", quality: 92 });
  await p2.mouse.wheel(0, 900); await p2.waitForTimeout(800);
  await p2.screenshot({ path: `${OUT}/15_teacher_b.jpg`, type: "jpeg", quality: 92 });
  await p2.screenshot({ path: `${OUT}/15_teacher_full.jpg`, type: "jpeg", quality: 92, fullPage: true });
  log.push("ok teacher");
});
fs.writeFileSync(`${OUT}/log.txt`, log.join("\n"));
await browser.close();
