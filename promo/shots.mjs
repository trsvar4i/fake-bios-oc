// Настоящие кадры сайта для ролика: локальный dev-сервер (npm run dev в корне) + установленный Chrome, 1920×1080.
// Состояния выставляются через те же модули, что и в приложении (Vite отдаёт их по /src/...).
// Учитель: тестовая учётная запись dev-базы (TEACHER_LOGIN / TEACHER_PASSWORD), демо-класс — node seed-demo.mjs.
import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";

const CHROME = process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const SITE = "http://localhost:8137/";
const TEACHER_SITE = "http://teacher.localhost:8137/";
const OUT = "public/shots";
mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--window-size=1920,1080", "--hide-scrollbars", "--mute-audio"] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Чистая вкладка: без тура и приветствия, русский язык по умолчанию. */
async function fresh(url = SITE) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument(() => { localStorage.setItem("kestrel.tour", "1"); });
  await page.goto(url, { waitUntil: "networkidle0" });
  await sleep(800);
  return page;
}
const shot = async (page, name) => { await page.screenshot({ path: `${OUT}/${name}.png` }); console.log("✓", name); };
/** Код в контексте страницы с модулями приложения. */
const app = (page, fn, arg) => page.evaluate(fn, arg);

// 1–4: питание, POST, BIOS
{
  const page = await fresh();
  await shot(page, "01-power");
  await page.click(".power-btn");
  await sleep(700);
  await shot(page, "02-post");
  for (let i = 0; i < 4; i++) { await page.keyboard.press("Delete"); await sleep(250); }
  await sleep(2600);
  // значок «испытание пройдено» закрывает шапку BIOS — в этом кадре он не нужен
  await page.addStyleTag({ content: ".quest-toast { display: none !important; }" });
  await shot(page, "03-bios-ez");
  await page.keyboard.press("F7");
  await sleep(500);
  for (let i = 0; i < 2; i++) { await page.keyboard.press("ArrowRight"); await sleep(250); }
  await sleep(300);
  // множитель вверх — значения и подсказка «нужное напряжение» меняются вживую
  await app(page, async () => {
    const { useStore } = await import("/src/machine/store.ts");
    useStore.getState().setParam("cpuRatio", 52);
  });
  await sleep(700);
  await shot(page, "04-bios-tweaker");
}

// 5: сбой ОС после нестабильного разгона
{
  const page = await fresh();
  await app(page, async () => {
    const { useStore } = await import("/src/machine/store.ts");
    useStore.getState().importConfig({ cpuRatio: 50, cpuVcore: 1220 });
    useStore.setState({ phase: "os", osUnstable: true });
  });
  await sleep(4500);
  await shot(page, "05-crash");
}

// 6–7: рабочий стол с программами; уроки и «Случайные поломки»
{
  const page = await fresh();
  await app(page, async () => {
    const { useStore } = await import("/src/machine/store.ts");
    const { useOs } = await import("/src/os/osStore.ts");
    useStore.setState({ phase: "os", osUnstable: false });
    useOs.setState((s) => ({ prefs: { ...s.prefs, welcomed: true } }));
  });
  await sleep(1500);
  await app(page, async () => {
    const { useOs } = await import("/src/os/osStore.ts");
    useOs.getState().setStage("desktop");
  });
  await sleep(1800);
  await app(page, async () => {
    const { useOs } = await import("/src/os/osStore.ts");
    const os = useOs.getState();
    os.open("taskmgr"); os.open("vm"); os.open("terminal");
  });
  await sleep(1800);
  await shot(page, "06-desktop");
  await app(page, async () => {
    const { useOs } = await import("/src/os/osStore.ts");
    const { useLearn } = await import("/src/learn/store.ts");
    useOs.setState({ windows: [] });
    useOs.getState().open("learn");
    useLearn.setState({ drill: { queue: ["hot", "raid", "oc", "rescue", "mute"], i: 1, started: Date.now() - 47000, hints: 1,
      results: [{ id: "hot", ms: 62000, points: 278, hints: 0, gaveUp: false }], solved: null, over: false } });
  });
  await sleep(1800);
  await shot(page, "07-learn");
}

// 8–9: кабинет учителя (dev-база) — живые экраны класса, удалённое управление, библиотека заданий
{
  const page = await fresh(TEACHER_SITE);
  const login = await page.evaluate(async (creds) => {
    const r = await fetch("./api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(creds) });
    return r.status;
  }, { login: process.env.TEACHER_LOGIN, password: process.env.TEACHER_PASSWORD });
  if (login !== 200) throw new Error(`teacher login failed: ${login}`);
  await page.goto(`${TEACHER_SITE}#teacher`, { waitUntil: "networkidle0" });
  await sleep(2500);
  await page.evaluate(() => {
    const tab = [...document.querySelectorAll(".pt-tabs button")].find((b) => b.innerText.startsWith("8Б"));
    tab?.click();
  });
  await sleep(2500);
  // два ученика выбраны — видно, кому уйдёт команда
  await page.evaluate(() => { const c = document.querySelectorAll(".pt-student"); c[1]?.click(); c[3]?.click(); });
  await sleep(600);
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot(page, "08-teacher");
  await page.evaluate(() => {
    const seg = [...document.querySelectorAll(".pt-seg button")].find((b) => b.innerText.startsWith("Сложный"));
    seg?.click();
    const ans = [...document.querySelectorAll(".pt-check input")].find((i) => i.parentElement.innerText.includes("ответы"));
    if (ans && !ans.checked) ans.click();
  });
  await sleep(600);
  await page.evaluate(() => {
    const lib = [...document.querySelectorAll(".pt-card h2")].find((h) => h.innerText.startsWith("Библиотека"));
    window.scrollTo(0, lib.getBoundingClientRect().top + window.scrollY - 90);
  });
  await sleep(900);
  await shot(page, "09-library");
}

await browser.close();
