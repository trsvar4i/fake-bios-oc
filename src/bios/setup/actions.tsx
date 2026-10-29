// Действия BIOS, которые открывают окна. Вызываются и из EZ, и из Advanced, и с клавиатуры.
import { useStore, changedIds } from "../../machine/store";
import { PARAMS, formatValue, isDisabled, normalizeNumber } from "../../machine/params";
import { DEVICES, DEVICE_IDS, FW_LATEST, HW, flashFirmware, type DeviceId } from "../../machine/hardware";
import { cpuGhz, memOf } from "../../machine/sensors";
import { OC_KEYS, loadProfiles, saveProfile, shareLink } from "../../machine/profiles";
import { unlock } from "../../machine/quests";
import { deviceAvailable } from "../../machine/boot";
import type { Lang } from "../../machine/i18n";

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
  if (p.type === "password") return editPassword(id);
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

/** Пароль: новый, затем подтверждение. Пустой — снять пароль. */
function editPassword(id: string) {
  const s = st();
  s.openDialog({
    title: tr("Create New Password", "Новый пароль"),
    password: {
      hint: tr("Up to 20 characters. Leave empty to remove the password.", "До 20 символов. Пустое поле — снять пароль."),
      onSubmit: (first) => {
        if (!first) { st().setParam(id, ""); return true; }
        st().openDialog({
          title: tr("Confirm New Password", "Подтвердите пароль"),
          password: {
            hint: tr("Type the same password again", "Введите тот же пароль ещё раз"),
            onSubmit: (again) => {
              if (again !== first) return false;
              st().setParam(id, first);
              unlock("password");
              return true;
            },
          },
        });
        return true;
      },
    },
  });
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
  const favs = ["xmp", "fanProfile", "cpuRatio", "cpuVcore", "virtualization", "secureBoot", "csm", "fastBoot", "sataMode"];
  st().openDialog({
    title: tr("Favorites", "Избранное"),
    list: favs.map((id) => ({ label: `${PARAMS[id].label[lang()]}:  ${formatValue(id, st().pending[id], lang())}`, value: id })),
    onPick: (id: string) => editParam(id),
  });
}

/** Instant Flash: поиск образа на флешке, подтверждение, запись с прогрессом, перезагрузка. */
export function openFlash() {
  const s = st();
  const usb = s.saved.usbStorage;
  const fresh = HW.bios === FW_LATEST.bios;
  const file = "fs0:\\KS7E26." + FW_LATEST.bios.split(".")[1];
  s.openDialog({
    title: "Kestrel Instant Flash",
    body: (
      <>
        <table className="flash-info"><tbody>
          <tr><td>{tr("Platform", "Платформа")}</td><td>{HW.product}</td></tr>
          <tr><td>{tr("Current version", "Текущая версия")}</td><td>{HW.bios} ({HW.buildDate})</td></tr>
          <tr><td>{tr("Drive", "Накопитель")}</td><td>{usb ? "USB Flash Drive 32GB (FAT32)" : tr("No USB storage found", "USB-накопитель не найден")}</td></tr>
          {usb && <tr><td>{tr("Image", "Образ")}</td><td>{file} ({FW_LATEST.bios}, {FW_LATEST.buildDate})</td></tr>}
        </tbody></table>
        {!usb && <p className="crit">{tr("Enable USB Mass Storage Driver Support (Advanced → USB Configuration), save and try again.", "Включите поддержку USB-накопителей (Advanced → USB Configuration), сохраните и попробуйте снова.")}</p>}
        {usb && fresh && <p className="ok">{tr("The installed BIOS is already the latest version.", "Установлена последняя версия BIOS.")}</p>}
        {usb && !fresh && <p>{tr("A newer BIOS image was found. Update now?", "Найден более новый образ BIOS. Обновить?")}</p>}
      </>
    ),
    buttons: usb && !fresh
      ? [{ label: tr("Update", "Обновить"), run: confirmFlash }, { label: tr("Cancel", "Отмена"), run: () => {} }]
      : usb ? [{ label: "OK", run: () => {} }, { label: tr("Flash anyway", "Прошить заново"), run: confirmFlash }]
        : [{ label: "OK", run: () => {} }],
  });
}

function confirmFlash() {
  st().openDialog({
    title: "Kestrel Instant Flash",
    body: <p className="warnline">{tr("Do not turn off the power or reset the system during the update.", "Не выключайте питание и не перезагружайте компьютер во время обновления.")}</p>,
    buttons: yesNo(runFlash),
  });
}

function runFlash() {
  let pct = 0;
  const step = () => {
    pct = Math.min(100, pct + 1.2 + Math.random() * 2.4);
    const stage = pct < 18 ? tr("Erasing", "Стирание") : pct < 82 ? tr("Writing", "Запись") : tr("Verifying", "Проверка");
    if (pct < 100) {
      st().openDialog({ title: `Kestrel Instant Flash — ${stage}`, progress: pct });
      window.setTimeout(step, 90);
      return;
    }
    flashFirmware(FW_LATEST);
    st().openDialog({
      title: "Kestrel Instant Flash",
      body: <p className="ok">{tr(`Update complete: ${FW_LATEST.bios}. The system will now restart.`, `Обновление завершено: ${FW_LATEST.bios}. Система перезагрузится.`)}</p>,
      buttons: [{ label: "OK", run: () => st().restart() }],
    });
  };
  window.setTimeout(step, 0);
}

/** Ссылка на конфигурацию: в буфер обмена и на экран. */
export function openShare() {
  const link = shareLink(st().pending);
  void navigator.clipboard?.writeText(link).catch(() => {});
  unlock("share");
  st().openDialog({
    title: tr("Share Configuration", "Поделиться настройками"),
    body: (
      <>
        <p>{tr("Link copied to the clipboard. Whoever opens it will be offered to apply your settings:", "Ссылка скопирована в буфер обмена. Тому, кто её откроет, предложат применить ваши настройки:")}</p>
        <div className="share-link">{link}</div>
        <p className="dlg-muted">{tr("Unsaved changes are included. The Setup password is never shared.", "Несохранённые изменения входят в ссылку. Пароль Setup не передаётся.")}</p>
      </>
    ),
    buttons: [{ label: "OK", run: () => {} }],
  });
}

/** Слот профиля разгона: сохранить текущие настройки или загрузить сохранённые (до F10). */
export function openProfile(slot: number) {
  const prof = loadProfiles()[slot];
  const s = st();
  const name = `${cpuGhz(s.pending).toFixed(2)} GHz · DDR5-${memOf(s.pending).freq}`;
  const save = () => { saveProfile(slot, name, st().pending); unlock("profile"); };
  const load = () => { for (const k of OC_KEYS) if (prof && k in prof.cfg) st().setParam(k, structuredClone(prof.cfg[k])); };
  s.openDialog({
    title: `OC Profile ${slot + 1}`,
    body: prof
      ? <p>{tr("Saved", "Сохранён")}: <b>{prof.name}</b> ({new Date(prof.date).toLocaleDateString("en-GB")})</p>
      : <p className="dlg-muted">{tr("Empty slot.", "Пустой слот.")}</p>,
    buttons: [
      ...(prof ? [{ label: tr("Load", "Загрузить"), run: load }] : []),
      { label: prof ? tr("Overwrite", "Перезаписать") : tr("Save current", "Сохранить текущие"), run: save },
      { label: tr("Cancel", "Отмена"), run: () => {} },
    ],
  });
}

export const toggleMode = () => st().patch({ mode: st().mode === "ez" ? "adv" : "ez" });

export type ActionId = "save" | "discardExit" | "discard" | "defaults" | "clearCmos" | "flash" | "share";
export const ACTIONS: Record<ActionId, () => void> = {
  flash: openFlash,
  share: openShare,
  save: confirmSave,
  discardExit: confirmDiscardExit,
  discard: confirmDiscard,
  defaults: confirmDefaults,
  clearCmos: confirmClearCmos,
};
