// Клавиатура в EZ Mode: Tab переключает зоны, стрелки двигают фокус внутри зоны, Enter/Space — действие.
import { useStore } from "../../machine/store";
import { DEVICES, FAN_PRESETS, XMP, type DeviceId } from "../../machine/hardware";
import { PARAMS } from "../../machine/params";
import { openFavorites, openFlash } from "./actions";

type S = ReturnType<typeof useStore.getState>;
export type Zone = "nav" | "seg" | "tools" | "tiles" | "boot";

export const EZ_TABS = ["cpu", "memory", "storage", "fan", "help"];
export const TILE_IDS = ["lanRom", "hdAudio", "fanFailWarn", "fastBoot", "sataMode", "biosLog", "secureBoot", "virtualization", "erp"];

export const TOOLS: (() => void)[] = [
  openFlash,
  openFavorites,
  () => useStore.getState().patch({ mode: "adv", advTab: 4, advPath: [] }),
];

/** Переключатель профиля на вкладке (XMP или вентилятор). */
export function segOptions(tab: string): { param: string; values: string[] } | null {
  if (tab === "memory") return { param: "xmp", values: Object.keys(XMP) };
  if (tab === "fan") return { param: "fanProfile", values: [...Object.keys(FAN_PRESETS), "Custom"] };
  return null;
}

export function toggleTile(id: string) {
  const s = useStore.getState();
  const v = s.pending[id];
  s.setParam(id, id === "sataMode" ? (v === "RAID" ? "AHCI" : "RAID") : !v);
}

/** CSS-класс фокуса для элемента зоны. */
export const kf = (s: { mode: string; ezZone: string; ezIdx: number }, zone: Zone, i: number) =>
  s.mode === "ez" && s.ezZone === zone && s.ezIdx === i ? " kfocus" : "";

const zonesFor = (tab: string): Zone[] => ["nav", ...(segOptions(tab) ? ["seg" as Zone] : []), "tools", "tiles", "boot"];

function initialIdx(s: S, z: Zone) {
  if (z === "nav") return EZ_TABS.indexOf(s.ezTab);
  if (z === "seg") {
    const so = segOptions(s.ezTab)!;
    return Math.max(0, so.values.indexOf(s.pending[so.param]));
  }
  return 0;
}

function hintFor(s: S, z: Zone, i: number) {
  const lang = s.pending.language === "Русский" ? "ru" : "en";
  if (z === "tiles") return PARAMS[TILE_IDS[i]].help[lang];
  if (z === "seg") return PARAMS[segOptions(s.ezTab)!.param].help[lang];
  if (z === "boot") return `Boot #${i + 1}: ${DEVICES[s.pending.bootOrder[i] as DeviceId].name}  (+/−)`;
  return "";
}

export function ezKey(e: KeyboardEvent): boolean {
  const s = useStore.getState();
  const zones = zonesFor(s.ezTab);
  const zone = (zones.includes(s.ezZone as Zone) ? s.ezZone : "nav") as Zone;
  const i = s.ezIdx;
  const focus = (z: Zone, idx: number) => {
    const st = useStore.getState();
    st.patch({ ezZone: z, ezIdx: idx, hint: hintFor(st, z, idx) });
  };
  const k = e.key;
  const activate = k === "Enter" || k === " ";

  if (k === "Tab") {
    const n = zones.length;
    const z = zones[(zones.indexOf(zone) + (e.shiftKey ? n - 1 : 1)) % n];
    focus(z, initialIdx(s, z));
    return true;
  }

  switch (zone) {
    case "nav": {
      if (k !== "ArrowUp" && k !== "ArrowDown") return activate;
      const ni = (EZ_TABS.indexOf(s.ezTab) + (k === "ArrowDown" ? 1 : EZ_TABS.length - 1)) % EZ_TABS.length;
      s.patch({ ezTab: EZ_TABS[ni] });
      focus("nav", ni);
      return true;
    }
    case "seg": {
      const so = segOptions(s.ezTab)!;
      if (k === "ArrowLeft") focus("seg", (i - 1 + so.values.length) % so.values.length);
      else if (k === "ArrowRight") focus("seg", (i + 1) % so.values.length);
      else if (activate) s.setParam(so.param, so.values[i]);
      else return false;
      return true;
    }
    case "tools": {
      if (k === "ArrowUp") focus("tools", (i + 2) % 3);
      else if (k === "ArrowDown") focus("tools", (i + 1) % 3);
      else if (activate) TOOLS[i]();
      else return false;
      return true;
    }
    case "tiles": {
      const n = TILE_IDS.length;
      if (k === "ArrowLeft") focus("tiles", (i - 1 + n) % n);
      else if (k === "ArrowRight") focus("tiles", (i + 1) % n);
      else if (k === "ArrowUp") focus("tiles", (i - 3 + n) % n);
      else if (k === "ArrowDown") focus("tiles", (i + 3) % n);
      else if (activate) toggleTile(TILE_IDS[i]);
      else return false;
      return true;
    }
    case "boot": {
      const n = s.pending.bootOrder.length;
      if (k === "ArrowLeft") focus("boot", (i - 1 + n) % n);
      else if (k === "ArrowRight") focus("boot", (i + 1) % n);
      else if ((k === "+" || k === "-") && n > 1) {
        const j = k === "+" ? Math.min(n - 1, i + 1) : Math.max(0, i - 1);
        if (j !== i) s.moveBoot(i, j > i ? j + 1 : j);
        focus("boot", j);
      } else return activate;
      return true;
    }
  }
  return false;
}
