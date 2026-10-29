# BIOS (прошивка)

Всё, что видно до загрузки ОС.

| Папка / файл | Что внутри |
|---|---|
| `post/PowerScreen.tsx` | выключенный ПК и кнопка питания |
| `post/Post.tsx` | экран включения: логотип, `DEL` — Setup, `F11` — Boot Menu |
| `post/BootScreen.tsx` | текст POST, перебор устройств, ошибки загрузки, передача управления ОС |
| `setup/Setup.tsx` | корень BIOS Setup и горячие клавиши |
| `setup/Header.tsx` | шапка: часы, температуры, Boot Priority (перетаскивание) |
| `setup/EzMode.tsx`, `setup/ezKeys.ts` | EZ Mode и навигация в нём с клавиатуры |
| `setup/Advanced.tsx`, `setup/menus.ts` | Advanced Mode (`F7`) и дерево его страниц |
| `setup/FanCurve.tsx` | редактор кривой вентилятора |
| `setup/actions.tsx` | окна BIOS: изменение параметров, сохранение, выход, Boot Override |
| `ui/` | общие элементы BIOS: окно-диалог, иконки, кнопка звука |
| `bios.css` | стили BIOS |

Параметры BIOS, сенсоры и логика загрузки живут не здесь, а в `src/machine` — их читает и ОС.
