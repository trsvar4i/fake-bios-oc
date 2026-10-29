const PATHS: Record<string, string> = {
  nvme: '<rect x="3" y="11" width="26" height="10" rx="1"/><rect x="7" y="13" width="5" height="6"/><rect x="14" y="13" width="5" height="6"/><circle cx="25" cy="16" r="1.5"/>',
  hdd: '<rect x="6" y="4" width="20" height="24" rx="2"/><circle cx="16" cy="14" r="6"/><circle cx="16" cy="14" r="1.5"/><line x1="10" y1="24" x2="14" y2="24"/>',
  dvd: '<circle cx="16" cy="16" r="12"/><circle cx="16" cy="16" r="3"/><path d="M16 7a9 9 0 0 1 9 9"/>',
  usb: '<rect x="10" y="12" width="12" height="17" rx="2"/><rect x="12" y="4" width="8" height="8"/><line x1="14.5" y1="7" x2="14.5" y2="9"/><line x1="17.5" y1="7" x2="17.5" y2="9"/>',
  lan: '<rect x="5" y="8" width="22" height="16" rx="1"/><path d="M11 24v-5h10v5M13 12v3M16 12v3M19 12v3"/>',
  cpu: '<rect x="9" y="9" width="14" height="14"/><rect x="13" y="13" width="6" height="6"/><path d="M12 9V5M16 9V5M20 9V5M12 27v-4M16 27v-4M20 27v-4M9 12H5M9 16H5M9 20H5M27 12h-4M27 16h-4M27 20h-4"/>',
  memory: '<rect x="3" y="10" width="26" height="11"/><path d="M7 13v5M11 13v5M15 13v5M19 13v5M23 13v5M5 21v3M27 21v3"/>',
  storage: '<rect x="5" y="6" width="22" height="8" rx="1"/><rect x="5" y="18" width="22" height="8" rx="1"/><circle cx="23" cy="10" r="1"/><circle cx="23" cy="22" r="1"/>',
  fan: '<circle cx="16" cy="16" r="12"/><circle cx="16" cy="16" r="2.5"/><path d="M16 13.5c0-4 1-7 4-7s2 5-2 7.5M18.5 16c4 0 7 1 7 4s-5 2-7.5-2M16 18.5c0 4-1 7-4 7s-2-5 2-7.5M13.5 16c-4 0-7-1-7-4s5-2 7.5 2"/>',
  help: '<rect x="5" y="5" width="22" height="22" rx="2"/><path d="M12.5 12.5a3.5 3.5 0 1 1 5 3.2c-1 .5-1.5 1.3-1.5 2.3v1"/><circle cx="16" cy="22.5" r=".8"/>',
  flash: '<path d="M16 4v16M10 14l6 6 6-6M6 26h20"/>',
  star: '<path d="M16 4l3.6 7.6 8.4 1-6.2 5.8 1.6 8.3L16 22.6l-7.4 4.1 1.6-8.3L4 12.6l8.4-1z"/>',
  monitor: '<path d="M3 18h6l3-8 4 14 4-10 2 4h7"/>',
};

export function Icon({ name }: { name: string }) {
  return <svg className="icon" viewBox="0 0 32 32" dangerouslySetInnerHTML={{ __html: PATHS[name] ?? "" }} />;
}
