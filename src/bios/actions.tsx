// Действия BIOS, которые открывают окна. Вызываются и из EZ, и из Advanced, и с клавиатуры.
import { useStore, changedIds } from "../machine/store";
import { PARAMS, formatValue, isDisabled, normalizeNumber } from "../machine/params";
import { DEVICES, DEVICE_IDS, HW, type DeviceId } from "../machine/hardware";
import { deviceAvailable } from "../machine/boot";
import type { Lang } from "../machine/i18n";

const st = () => useStore.getState();
const lang = (): Lang => (st().pending.language === "Русский" ? "ru" : "en");
const tr = (en: string, ru: string) => (lang() === "ru" ? ru : en);
const yesNo = (onYes: () => void) => [
  { label: tr("Yes", "Да"), run: onYes },
  { label: tr("No", "Нет"), run: () => {} },
];

export function editParam(id: string) {
  const s = st();
  const p = PARAMS[id];
  if (isDisabled(id, s.pending)) return;
  if (p.type === "number") {
    s.openDialog({
      title: p.label[lang()],
      number: {
        value: s.pending[id], min: p.min!, max: p.max!, step: p.step!,
        hint: p.autoZero
          ? tr(`0 = Auto or ${p.autoZero}–${p.max} mV. +/− to adjust`, `0 = Auto или ${p.autoZero}–${p.max} мВ. +/− для изменения`)
          : tr(`Range ${p.min}–${p.max}. 0 = Auto. +/− to adjust`, `Диапазон ${p.min}–${p.max}. 0 = Auto. +/− для изменения`),
        onApply: (v) => st().setParam(id, normalizeNumber(p, v)),
      },
    });
    return;
  }
  if (p.type !== "toggle" && p.type !== "select") return;
  const list = p.type === "toggle"
    ? [true, false].map((v) => ({ label: formatValue(id, v, lang()), value: v }))
    : p.options!.map((o) => ({ label: o, value: o }));
  s.openDialog({ title: p.label[lang()], list, current: s.pending[id], onPick: (v) => st().setParam(id, v) });
}

/** +/− в Advanced: следующее/предыдущее значение без окна. */
export function cycleParam(id: string, dir: number) {
  const s = st();
  const p = PARAMS[id];
  if (isDisabled(id, s.pending)) return;
  const v = s.pending[id];
  if (p.type === "toggle") s.setParam(id, !v);
  if (p.type === "select") {
    const o = p.options!;
    s.setParam(id, o[(o.indexOf(v) + dir + o.length) % o.length]);
  }
  if (p.type === "number") s.setParam(id, normalizeNumber(p, v + dir * p.step!, dir));
}

export function pickBootSlot(index: number) {
  const s = st();
  s.openDialog({
    title: `Boot Option #${index + 1}`,
    list: DEVICE_IDS.map((d) => ({ label: DEVICES[d].name, value: d })),
    current: s.pending.bootOrder[index],
    onPick: (dev: DeviceId) => st().swapBoot(index, dev),
  });
}

function changesTable() {
  const s = st();
  const ids = changedIds(s);
  if (!ids.length) return <div className="dlg-muted">{tr("No changes.", "Изменений нет.")}</div>;
  return (
    <table className="changes">
      <thead>
        <tr><th>{tr("Setting", "Параметр")}</th><th>{tr("Old", "Было")}</th><th>{tr("New", "Стало")}</th></tr>
      </thead>
      <tbody>
        {ids.map((id) => (
          <tr key={id}>
            <td>{PARAMS[id].label[lang()]}</td>
            <td className="old">{formatValue(id, s.saved[id], lang())}</td>
            <td className="new">{formatValue(id, s.pending[id], lang())}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function confirmSave() {
  st().openDialog({
    title: tr("Save & Exit Setup", "Сохранить и выйти"),
    body: (
      <>
        <p>{tr("Save configuration and reset?", "Сохранить конфигурацию и перезагрузить?")}</p>
        {st().pending.biosLog && changesTable()}
      </>
    ),
    buttons: yesNo(() => st().saveAndReset()),
  });
}

export function confirmDiscardExit() {
  st().openDialog({
    title: tr("Exit Without Saving", "Выйти без сохранения"),
    body: <p>{tr("Quit without saving changes?", "Выйти, не сохраняя изменения?")}</p>,
    buttons: yesNo(() => st().discardAndExit()),
  });
}

export function confirmDiscard() {
  st().openDialog({
    title: tr("Discard Changes", "Отменить изменения"),
    body: <><p>{tr("Discard all changes?", "Отменить все изменения?")}</p>{changesTable()}</>,
    buttons: yesNo(() => st().discard()),
  });
}

export function confirmDefaults() {
  st().openDialog({
    title: tr("Load Optimized Defaults", "Загрузить заводские настройки"),
    body: <p>{tr("Load optimized defaults?", "Загрузить оптимальные заводские настройки?")}</p>,
    buttons: yesNo(() => st().loadDefaults()),
  });
}

export function confirmClearCmos() {
  st().openDialog({
    title: "Clear CMOS",
    body: <p>{tr("All saved BIOS settings will be erased and the system will restart.", "Все сохранённые настройки BIOS будут стёрты, система перезагрузится.")}</p>,
    buttons: yesNo(() => st().clearCmos()),
  });
}

export function confirmExit() {
  const n = changedIds(st()).length;
  st().openDialog({
    title: tr("Exit Setup", "Выход из Setup"),
    body: <p>{n ? tr(`There are ${n} unsaved changes.`, `Несохранённых изменений: ${n}.`) : tr("Exit Setup and boot the system?", "Выйти из Setup и загрузить систему?")}</p>,
    buttons: [
      { label: tr("Save & Reset", "Сохранить и перезагрузить"), run: () => confirmSave() },
      { label: tr("Exit Without Saving", "Выйти без сохранения"), run: () => st().discardAndExit() },
      { label: tr("Cancel", "Отмена"), run: () => {} },
    ],
  });
}

export function confirmOverride(dev: DeviceId) {
  if (!deviceAvailable(st().pending, dev)) return;
  st().openDialog({
    title: "Boot Override",
    body: <p>{tr(`Boot from ${DEVICES[dev].name} once? Unsaved changes will be lost.`, `Загрузиться один раз с ${DEVICES[dev].name}? Несохранённые изменения будут потеряны.`)}</p>,
    buttons: yesNo(() => st().boot(dev)),
  });
}

export function openFavorites() {
  const favs = ["xmp", "fanProfile", "cpuRatio", "virtualization", "secureBoot", "fastBoot", "sataMode"];
  st().openDialog({
    title: tr("Favorites", "Избранное"),
    list: favs.map((id) => ({ label: `${PARAMS[id].label[lang()]}:  ${formatValue(id, st().pending[id], lang())}`, value: id })),
    onPick: (id: string) => editParam(id),
  });
}

export function openFlash() {
  st().openDialog({
    title: "Flash BIOS",
    body: (
      <>
        <p>{tr("Current version", "Текущая версия")}: <b>{HW.bios}</b> ({HW.buildDate})</p>
        <p>{tr("Searching USB drives for BIOS image...", "Поиск файла прошивки на USB-накопителях...")}</p>
        <p className="crit">{tr("No BIOS image found.", "Файл прошивки не найден.")}</p>
      </>
    ),
    buttons: [{ label: "OK", run: () => {} }],
  });
}

export const toggleMode = () => st().patch({ mode: st().mode === "ez" ? "adv" : "ez" });

export type ActionId = "save" | "discardExit" | "discard" | "defaults" | "clearCmos";
export const ACTIONS: Record<ActionId, () => void> = {
  save: confirmSave,
  discardExit: confirmDiscardExit,
  discard: confirmDiscard,
  defaults: confirmDefaults,
  clearCmos: confirmClearCmos,
};
