import { useEffect, useRef, useState } from "react";
import { useStore } from "../../machine/store";
import { HW } from "../../machine/hardware";
import { readings } from "../../machine/sensors";
import { useOs } from "../osStore";
import { osPower } from "../power";

const BANNER = ["Kestrel Shell 1.0", "(c) Kestrel Systems. Type \"help\" to see commands.", ""];
const PROMPT = "C:\\Users\\User>";

/** Командная строка. Команды читают состояние машины: сеть, сенсоры, прошивку. */
export function Terminal({ winId }: { winId: number }) {
  const [lines, setLines] = useState<string[]>(BANNER);
  const [input, setInput] = useState("");
  const history = useRef<string[]>([]);
  const hi = useRef(0);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [lines]);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const exec = (raw: string): string[] | "cls" | "exit" => {
    const s = useStore.getState();
    const c = s.saved;
    const [cmd, ...args] = raw.split(/\s+/);
    const arg = args.join(" ");
    switch (cmd.toLowerCase()) {
      case "": return [];
      case "help":
        return [
          "help        this list", "cls         clear the screen", "ver         OS version", "echo <text> print text",
          "date, time  current date/time", "whoami      current user", "hostname    computer name", "systeminfo  system summary",
          "sensors     temperatures and fans", "ipconfig    network adapters", "ping <host> test the network", "dir         list files",
          "tasklist    running apps", "shutdown /s | /r | /fw   shut down, restart, restart to UEFI", "exit        close the terminal",
        ];
      case "cls": case "clear": return "cls";
      case "exit": return "exit";
      case "ver": return ["Kestrel OS [Version 1.0.2611]"];
      case "echo": return [arg];
      case "date": return [new Date().toLocaleDateString("en-GB")];
      case "time": return [new Date().toLocaleTimeString("en-GB")];
      case "whoami": return [`kestrel-pc\\${useOs.getState().prefs.userName.toLowerCase()}`];
      case "hostname": return ["KESTREL-PC"];
      case "systeminfo": {
        const r = readings(c, s.thermal);
        return [
          "Host Name:              KESTREL-PC",
          "OS Name:                Kestrel OS 1.0",
          `System Model:           ${HW.product}`,
          `Processor:              ${HW.cpu} ~${r.freq} GHz`,
          `BIOS Version:           ${HW.bios}, ${HW.buildDate}`,
          "BIOS Mode:              UEFI",
          `Secure Boot:            ${c.secureBoot ? "On" : "Off"}`,
          `Total Physical Memory:  32,768 MB (DDR5-${r.dramFreq})`,
          `Virtualization:         ${c.virtualization ? "Enabled in firmware" : "Disabled in firmware"}`,
          `Network Card(s):        ${c.lanController ? "1 NIC(s) Installed." : "None"}`,
        ];
      }
      case "sensors": {
        const r = readings(c, s.thermal);
        return [
          `CPU Temp:   ${r.temp.toFixed(1)} °C`,
          `CPU Vcore:  ${r.vcore.toFixed(3)} V`,
          `CPU_FAN1:   ${r.rpm} RPM (${c.fanProfile})`,
          `SYS_FAN1:   ${r.sysRpm} RPM`,
        ];
      }
      case "ipconfig":
        if (!c.lanController) return ["Kestrel OS IP Configuration", "", "No network adapters found."];
        return [
          "Kestrel OS IP Configuration", "", "Ethernet adapter Ethernet:", "",
          "   IPv4 Address. . . . . . . : 192.168.1.42", "   Subnet Mask . . . . . . . : 255.255.255.0", "   Default Gateway . . . . . : 192.168.1.1",
        ];
      case "ping": {
        const host = args[0] || "kestrel.local";
        if (!c.lanController) return [`Pinging ${host}:`, "PING: transmit failed. General failure."];
        return [
          `Pinging ${host} [203.0.113.10] with 32 bytes of data:`,
          ...[14, 12, 15, 13].map((ms) => `Reply from 203.0.113.10: bytes=32 time=${ms}ms TTL=56`),
          "", "Packets: Sent = 4, Received = 4, Lost = 0 (0% loss)",
        ];
      }
      case "dir":
        return [
          " Directory of C:\\Users\\User", "",
          "29.10.2026  10:12    <DIR>          Desktop", "29.10.2026  10:12    <DIR>          Documents",
          "29.10.2026  10:12    <DIR>          Downloads", "29.10.2026  10:14             1 024 notes.txt",
          "               1 File(s)          1 024 bytes",
        ];
      case "tasklist":
        return ["Image Name                     PID", "========================= ========", "System                           4",
          ...useOs.getState().windows.map((w, i) => `${w.app}.exe`.padEnd(26) + String(1200 + i * 116).padStart(9))];
      case "shutdown":
        if (args[0] === "/s") { osPower.shutdown(); return ["Shutting down..."]; }
        if (args[0] === "/r") { osPower.restart(); return ["Restarting..."]; }
        if (args[0] === "/fw") { osPower.restartToFirmware(); return ["Restarting to UEFI firmware settings..."]; }
        return ["Usage: shutdown /s | /r | /fw"];
      default:
        return [`'${cmd}' is not recognized as a command. Type "help".`];
    }
  };

  const submit = () => {
    const raw = input.trim();
    if (raw) history.current.push(raw);
    hi.current = history.current.length;
    const out = exec(raw);
    setInput("");
    if (out === "cls") return setLines([]);
    if (out === "exit") return useOs.getState().close(winId);
    setLines((l) => [...l, PROMPT + input, ...out, ...(out.length ? [""] : [])]);
  };

  return (
    <div className="terminal" onClick={() => inputRef.current?.focus()}>
      {lines.map((ln, i) => <div key={i}>{ln || "\u00a0"}</div>)}
      <div className="term-input">
        <span>{PROMPT}</span>
        <input
          ref={inputRef}
          value={input}
          spellCheck={false}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "ArrowUp" && history.current.length) {
              hi.current = Math.max(0, hi.current - 1);
              setInput(history.current[hi.current]);
              e.preventDefault();
            }
            if (e.key === "ArrowDown") {
              hi.current = Math.min(history.current.length, hi.current + 1);
              setInput(history.current[hi.current] ?? "");
              e.preventDefault();
            }
          }}
        />
      </div>
      <div ref={endRef} />
    </div>
  );
}
