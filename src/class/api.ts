// Клиент API класса (/api/*, сервер — api/_lib/handler.ts). На GitHub Pages сервера нет — тогда класс недоступен.
import { l, type L } from "../machine/i18n";

export class ApiError extends Error {
  constructor(public code: string, public status: number) { super(code); }
}

export async function api<T = any>(route: string, body?: unknown, headers: Record<string, string> = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`./api/${route}`, {
      method: body === undefined ? "GET" : "POST",
      credentials: "same-origin",
      headers: body === undefined ? headers : { "content-type": "application/json", ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("network", 0);
  }
  const type = res.headers.get("content-type") ?? "";
  // статический хостинг вернёт HTML или 404 — значит, сервера класса здесь нет
  if (!type.includes("application/json")) throw new ApiError("no_server", res.status);
  const data = await res.json();
  if (!res.ok) throw new ApiError(data.error ?? "server_error", res.status);
  return data as T;
}

const MESSAGES: Record<string, L> = {
  network: l("No connection to the server.", "Нет связи с сервером."),
  no_server: l("Classes work on the full version of the site.", "Класс работает только на полной версии сайта."),
  bad_login: l("Login: 3–32 latin letters, digits, dot, dash or underscore.", "Логин: 3–32 латинские буквы, цифры, точка, дефис или подчёркивание."),
  bad_name: l("Enter your name (2–60 characters).", "Введите имя (от 2 до 60 символов)."),
  bad_password: l("Password: at least 6 characters.", "Пароль: не короче 6 символов."),
  bad_code: l("The class code is 6 characters.", "Код класса — 6 символов."),
  class_full: l("The class is full. Ask your teacher.", "В классе нет свободных мест. Обратитесь к учителю."),
  login_taken: l("This login is taken.", "Такой логин уже занят."),
  bad_credentials: l("Wrong login or password.", "Неверный логин или пароль."),
  too_many_attempts: l("Too many attempts. Try again in 15 minutes.", "Слишком много попыток. Попробуйте через 15 минут."),
  not_logged_in: l("Please sign in.", "Войдите в аккаунт."),
  forbidden: l("Not allowed.", "Нет доступа."),
  bad_admin_key: l("Wrong admin key.", "Неверный ключ администратора."),
  admin_disabled: l("Admin key is not configured on the server.", "Ключ администратора не настроен на сервере."),
  bad_max: l("Student limit: 1–500.", "Лимит учеников: от 1 до 500."),
  bad_title: l("Enter a title.", "Введите название."),
  no_students: l("Select students first.", "Сначала выберите учеников."),
  class_closed: l("Enrollment in this class is closed. Ask your teacher.", "Набор в этот класс закрыт. Обратитесь к учителю."),
  too_many_registrations: l("Too many sign-ups from this network. Try again in an hour.", "Слишком много регистраций из этой сети. Попробуйте через час."),
  too_many_classes: l("At most 20 classes.", "Не больше 20 классов."),
  bad_class_name: l("Enter the class name.", "Введите название класса."),
  bad_minutes: l("Time limit: 1–180 minutes.", "Лимит времени: от 1 до 180 минут."),
  bad_goal: l("Unknown goal.", "Неизвестная цель."),
  no_class: l("There is no class with this code.", "Класса с таким кодом нет."),
};

export const errorText = (e: unknown, lang: "en" | "ru") => {
  const code = e instanceof ApiError ? e.code : "server_error";
  return MESSAGES[code]?.[lang] ?? (lang === "ru" ? `Ошибка сервера (${code}).` : `Server error (${code}).`);
};
