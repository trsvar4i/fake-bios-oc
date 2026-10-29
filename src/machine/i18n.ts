export type Lang = "en" | "ru";
export type L = { en: string; ru: string };

export const l = (en: string, ru: string): L => ({ en, ru });
