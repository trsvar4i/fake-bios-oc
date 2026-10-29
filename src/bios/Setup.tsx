import { useEffect } from "react";
import { useStore } from "../machine/store";
import { Header } from "./Header";
import { EzMode } from "./EzMode";
import { Advanced, advKey } from "./Advanced";
import { ezKey } from "./ezKeys";
import { confirmDefaults, confirmExit, confirmSave, openFavorites, toggleMode } from "./actions";

export function Setup() {
  const mode = useStore((s) => s.mode);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useStore.getState();
      if (s.dialog) return;
      const hot: Record<string, () => void> = {
        F1: () => s.patch({ mode: "ez", ezTab: "help" }),
        F3: openFavorites,
        F6: confirmDefaults,
        F7: toggleMode,
        F10: confirmSave,
      };
      if (hot[e.key]) { e.preventDefault(); hot[e.key](); return; }
      if (s.mode === "adv" && advKey(e)) { e.preventDefault(); return; }
      if (s.mode === "ez" && ezKey(e)) { e.preventDefault(); return; }
      if (e.key === "Escape") { e.preventDefault(); confirmExit(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="bios">
      <Header />
      {mode === "ez" ? <EzMode /> : <Advanced />}
    </div>
  );
}
