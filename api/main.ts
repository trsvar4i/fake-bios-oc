// Функция Vercel: все запросы /api/* сюда (см. vercel.json). Логика — в _lib/handler.ts.
import { handle } from "./_lib/handler.js";

export const GET = (req: Request) => handle(req);
export const POST = (req: Request) => handle(req);
