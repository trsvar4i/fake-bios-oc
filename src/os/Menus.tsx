// Общий вид меню: выпадающие меню строки меню, контекстные меню, меню дока.
import { useEffect, useRef, useState } from "react";
import { useOs, type MenuItem } from "./osStore";
import { usePresence } from "./util";

/** Список пунктов: галочка, название, сочетание клавиш справа. */
export function MenuList({ items, onPick }: { items: MenuItem[]; onPick?: () => void }) {
  return (
    <>
      {items.map((it, i) =>
        it === "sep" ? <div key={i} className="dd-sep" /> : (
          <button
            key={i}
            className={"dd-item" + (it.danger ? " danger" : "")}
            disabled={it.disabled}
            // пункт меню не забирает фокус: «Правка» должна работать с полем, где стоит курсор
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => { useOs.getState().dismiss(); onPick?.(); it.run?.(); }}
          >
            <span className="dd-check">{it.check ? "✓" : ""}</span>
            <span className="dd-label">{it.label}</span>
            {it.shortcut && <span className="dd-key">{it.shortcut}</span>}
          </button>
        ),
      )}
    </>
  );
}

/** Контекстное меню по правой кнопке; у дока — над иконкой. */
export function ContextMenuLayer() {
  const ctx = useOs((s) => s.ctx);
  const [shown, setShown] = useState(ctx);
  const ref = useRef<HTMLDivElement>(null);
  const [shift, setShift] = useState({ x: 0, y: 0 });
  useEffect(() => { if (ctx) { setShown(ctx); setShift({ x: 0, y: 0 }); } }, [ctx]);
  const { mounted, closing } = usePresence(!!ctx, 160);

  // меню не должно вылезать за край экрана
  useEffect(() => {
    const el = ref.current;
    if (!el || !shown) return;
    const w = el.offsetWidth, h = el.offsetHeight;
    const x = shown.above ? shown.x - w / 2 : shown.x;
    setShift({
      x: Math.min(0, 1920 - 8 - (x + w)) + Math.max(0, 8 - x),
      y: shown.above ? 0 : Math.min(0, 1080 - 8 - (shown.y + h)),
    });
  }, [shown]);

  if (!mounted || !shown) return null;
  return (
    <div
      ref={ref}
      className={"dropdown ctxmenu" + (shown.above ? " above" : "") + (closing ? " closing" : "")}
      style={{ left: shown.x + shift.x, top: shown.y + shift.y }}
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <MenuList items={shown.items} />
    </div>
  );
}
