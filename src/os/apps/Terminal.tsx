import { useEffect, useRef, useState } from "react";
import { useStore } from "../../machine/store";
import { HW } from "../../machine/hardware";
import { readings } from "../../machine/sensors";
import { useOs } from "../osStore";
import { APP_META } from "./meta";
import { osPower } from "../power";
import { HOME, join, nameOf, parentOf, resolvePath as resolve, useFs } from "../fs";
import { openPath } from "./Finder";

const HOST = "Kestrel";
const BOOTED = Date.now();

const COMMANDS = [
  "help", "clear", "exit", "echo", "date", "whoami", "hostname", "uname", "sw_vers", "uptime", "pwd", "ls", "cd", "cat",
  "open", "ps", "top", "sensors", "ifconfig", "ping", "history", "sudo", "neofetch", "system_profiler",
  "mkdir", "touch", "rm", "mv",
];

/** Дата как в macOS: "Thu Oct 29 20:27:05". */
const stamp = (d: Date) => {
  const [wd, mon, day, , time] = d.toString().split(" ");
  return `${wd} ${mon} ${day} ${time}`;
};

const userOf = () => useOs.getState().prefs.userName.toLowerCase().replace(/\s+/g, "") || "user";

type Line = { text: string; kind?: "prompt" | "err" | "dim" };
type Pending = { cmd: string; run: () => Line[] };

/** Терминал в духе macOS (zsh). Команды читают состояние машины: сеть, сенсоры, прошивку. */
export function Terminal({ winId }: { winId: number }) {
  const [lines, setLines] = useState<Line[]>(() => [
    { text: `Last login: ${stamp(new Date(BOOTED))} on ttys000`, kind: "dim" },
  ]);
  const [input, setInput] = useState("");
  const [cwd, setCwd] = useState("~");
  // sudo ждёт пароль: ввод скрыт, как в настоящем терминале
  const [sudo, setSudo] = useState<Pending | null>(null);
  const history = useRef<string[]>([]);
  const hi = useRef(0);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [lines, sudo]);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const prompt = (dir = cwd) => `${userOf()}@${HOST} ${dir === "~" ? "~" : dir.split("/").pop()} % `;
  const out = (...t: string[]): Line[] => t.map((text) => ({ text }));
  const err = (text: string): Line[] => [{ text, kind: "err" }];

  /** Действия под sudo: выключение, перезагрузка, вход в UEFI. */
  const privileged = (args: string[]): Line[] | Pending => {
    const line = args.join(" ");
    if (/^(shutdown -h now|poweroff|halt)$/.test(line)) return { cmd: line, run: () => { osPower.shutdown(); return out("Shutting down…"); } };
    if (/^(shutdown -r now|reboot)$/.test(line)) return { cmd: line, run: () => { osPower.restart(); return out("Restarting…"); } };
    if (line === "systemctl reboot --firmware-setup") return { cmd: line, run: () => { osPower.restartToFirmware(); return out("Rebooting into UEFI firmware settings…"); } };
    if (!args.length) return out("usage: sudo command");
    if (args[0] === "shutdown") return out("usage: sudo shutdown -h now | -r now");
    if (COMMANDS.includes(args[0])) return run(line);
    return err(`sudo: ${args[0]}: command not found`);
  };

  const run = (raw: string): Line[] => {
    const fs = useFs.getState();
    const s = useStore.getState();
    const c = s.saved;
    const [cmd, ...args] = raw.trim().split(/\s+/);
    const arg = args.join(" ");
    switch (cmd) {
      case "": return [];
      case "help":
        return out(
          "Kestrel OS uses zsh. Available commands:", "",
          "  ls [dir]          list files            cd <dir>        change directory",
          "  cat <file>        print a file          pwd             current directory",
          "  mkdir, touch      create folder, file   rm [-r], mv     delete, rename",
          "  echo text > file  write to a file       open <file>     open in Finder / TextEdit",
          "  open -a <App>     open an application   echo <text>     print text",
          "  date, uptime      time and uptime       whoami          current user",
          "  uname -a          kernel                sw_vers         OS version",
          "  sensors           temperatures, fans    neofetch        system summary",
          "  ifconfig          network               ping <host>     test the network",
          "  ps, top           running processes     history         previous commands",
          "  clear             clear the screen      exit            close the window",
          "",
          "  sudo shutdown -h now | sudo reboot | sudo systemctl reboot --firmware-setup",
        );
      case "echo": {
        // echo текст > файл — записать в файл (>> — дописать)
        const m = arg.match(/^(.*?)\s*(>>?)\s*(\S+)$/);
        const text = (m ? m[1] : arg).replace(/^["']|["']$/g, "").replace(/\$USER/g, userOf());
        if (!m) return out(text);
        const path = resolve(cwd, m[3]);
        const prev = m[2] === ">>" ? (fs.read(path) ?? "") : "";
        return fs.write(path, prev + text + "\n") ? [] : err(`zsh: no such file or directory: ${m[3]}`);
      }
      case "date": return out(`${stamp(new Date())} ${new Date().getFullYear()}`);
      case "whoami": return out(userOf());
      case "hostname": return out(`${HOST}.local`);
      case "pwd": return out(cwd === "~" ? `/home/${userOf()}` : `/home/${userOf()}/${cwd.slice(2)}`);
      case "uname":
        return out(args[0] === "-a" ? `Linux ${HOST} 6.11.0-kestrel #1 SMP PREEMPT_DYNAMIC x86_64 GNU/Linux` : "Linux");
      case "sw_vers": return out("ProductName:\t\tKestrel OS", "ProductVersion:\t\t1.0", "BuildVersion:\t\t2611");
      case "uptime": {
        const min = Math.floor((Date.now() - BOOTED) / 60000);
        return out(`${new Date().toTimeString().slice(0, 5)}  up ${min} min, 1 user, load averages: 0.42 0.35 0.31`);
      }
      case "history": return out(...history.current.map((h, i) => `${String(i + 1).padStart(5)}  ${h}`));
      case "ls": {
        const target = args.filter((a) => !a.startsWith("-"))[0];
        const dir = resolve(cwd, target ?? ".");
        if (!fs.isDir(dir)) return fs.exists(dir) ? out(nameOf(dir)) : err(`ls: ${target}: No such file or directory`);
        const items = fs.list(dir);
        if (args.some((a) => /^-\w*l/.test(a))) {
          return out(`total ${items.length * 8}`, ...items.map((n) => {
            const node = fs.nodes[join(dir, n)];
            const size = node.type === "dir" ? 64 : (node.content ?? "").length;
            const d = new Date(node.mtime);
            const when = `${d.toLocaleDateString("en-US", { month: "short" })} ${String(d.getDate()).padStart(2)} ${d.toTimeString().slice(0, 5)}`;
            return `${node.type === "dir" ? "drwxr-xr-x" : "-rw-r--r--"}  1 ${userOf()}  staff  ${String(size).padStart(5)} ${when} ${n}`;
          }));
        }
        return items.length ? out(items.join("    ")) : [];
      }
      case "cd": {
        const dir = resolve(cwd, arg);
        if (fs.exists(dir) && !fs.isDir(dir)) return err(`cd: not a directory: ${arg}`);
        if (!fs.isDir(dir)) return err(`cd: no such file or directory: ${arg}`);
        setCwd(dir);
        return [];
      }
      case "cat": {
        if (!arg) return [];
        const path = resolve(cwd, arg);
        const text = fs.read(path);
        if (text === null) return err(fs.isDir(path) ? `cat: ${arg}: Is a directory` : `cat: ${arg}: No such file or directory`);
        return text ? out(...text.replace(/\n$/, "").split("\n")) : [];
      }
      case "mkdir": {
        const names = args.filter((a) => !a.startsWith("-"));
        if (!names.length) return out("usage: mkdir directory ...");
        return names.flatMap((n) => (fs.mkdir(resolve(cwd, n)) ? [] : err(`mkdir: ${n}: ${fs.exists(resolve(cwd, n)) ? "File exists" : "No such file or directory"}`)));
      }
      case "touch": {
        if (!args.length) return out("usage: touch file ...");
        return args.flatMap((n) => {
          const p = resolve(cwd, n);
          if (fs.exists(p)) return [];
          return fs.write(p, "") ? [] : err(`touch: ${n}: No such file or directory`);
        });
      }
      case "rm": {
        const recursive = args.some((a) => /^-\w*r/i.test(a));
        const names = args.filter((a) => !a.startsWith("-"));
        if (!names.length) return out("usage: rm [-r] file ...");
        return names.flatMap((n) => {
          const p = resolve(cwd, n);
          if (!fs.exists(p) || p === HOME) return err(`rm: ${n}: No such file or directory`);
          if (fs.isDir(p) && !recursive) return err(`rm: ${n}: is a directory`);
          if (cwd === p || cwd.startsWith(p + "/")) setCwd(parentOf(p));
          fs.remove(p);
          return [];
        });
      }
      case "mv": {
        const [from, to] = args;
        if (!from || !to) return out("usage: mv source target");
        const src = resolve(cwd, from);
        if (!fs.exists(src)) return err(`mv: rename ${from} to ${to}: No such file or directory`);
        const dest = resolve(cwd, to);
        // в существующую папку — перенос; иначе — переименование (и перенос, если путь в другой папке)
        if (fs.isDir(dest)) return fs.move(src, dest) ? [] : err(`mv: cannot move ${from} into ${to}`);
        if (!fs.isDir(parentOf(dest))) return err(`mv: ${to}: No such file or directory`);
        if (fs.exists(dest)) return err(`mv: ${to}: File exists`);
        const moved = parentOf(dest) === parentOf(src) ? src : fs.move(src, parentOf(dest));
        return moved && fs.rename(moved, nameOf(dest)) ? [] : err(`mv: cannot move ${from}`);
      }
      case "open": {
        const name = (args[0] === "-a" ? args.slice(1) : args).join(" ").toLowerCase();
        if (!name || name === ".") { useOs.getState().open("finder", cwd); return []; }
        if (args[0] !== "-a" && fs.exists(resolve(cwd, args.join(" ")))) { openPath(resolve(cwd, args.join(" "))); return []; }
        const app = Object.values(APP_META).find((m) => m.title.en.toLowerCase() === name || m.title.ru.toLowerCase() === name || m.id === name);
        if (!app) return err(`Unable to find application named '${args.slice(args[0] === "-a" ? 1 : 0).join(" ")}'`);
        useOs.getState().open(app.id);
        return [];
      }
      case "ps": case "top": {
        const ws = useOs.getState().windows;
        const rows = [
          ["1", "systemd"], ["412", "kestrel-shell"], ["588", "windowserver"],
          ...(c.hdAudio ? [["640", "audiod"]] : []), ...(c.lanController ? [["702", "networkd"]] : []),
          ...ws.map((w, i) => [String(1200 + i * 116), APP_META[w.app].title.en]),
        ];
        if (cmd === "top") {
          const r = readings(c, s.thermal);
          return out(
            `Processes: ${rows.length} total. CPU ${r.freq} GHz, ${r.temp.toFixed(0)}°C. PhysMem: 4.1G used, 27.9G unused.`, "",
            "PID    COMMAND              %CPU  MEM", ...rows.map(([pid, name], i) => `${pid.padEnd(6)} ${name.padEnd(20)} ${(0.3 + ((i * 7) % 5) * 0.6).toFixed(1).padStart(4)}  ${12 + i * 37}M`),
          );
        }
        return out("  PID TTY           TIME CMD", ...rows.map(([pid, name]) => `${pid.padStart(5)} ttys000    0:00.12 ${name}`));
      }
      case "sensors": {
        const r = readings(c, s.thermal);
        return out(
          "k10temp-pci-00c3", `Tctl:         +${r.temp.toFixed(1)}°C`, "",
          "nct6799-isa-0290", `Vcore:         ${r.vcore.toFixed(3)} V`, `CPU_FAN1:      ${r.rpm} RPM  (${c.fanProfile})`, `SYS_FAN1:      ${r.sysRpm} RPM`,
        );
      }
      case "neofetch": case "system_profiler": {
        const r = readings(c, s.thermal);
        return out(
          `${userOf()}@${HOST}`, "-".repeat(userOf().length + HOST.length + 1),
          "OS:             Kestrel OS 1.0 x86_64",
          `Host:           ${HW.product}`,
          "Kernel:         6.11.0-kestrel",
          "Shell:          zsh 5.9",
          `CPU:            ${HW.cpu} @ ${r.freq} GHz`,
          `Memory:         4.1 GiB / 32 GiB (DDR5-${r.dramFreq})`,
          `Firmware:       UEFI ${HW.bios} (${HW.buildDate}), Secure Boot ${c.secureBoot ? "on" : "off"}`,
          `Virtualization: ${c.virtualization ? "AMD-V enabled" : "disabled in firmware"}`,
          `Network:        ${c.lanController ? "en0 (Ethernet), 1 Gbit/s" : "no network adapters"}`,
        );
      }
      case "ifconfig":
        if (!c.lanController) return out("lo0: flags=8049<UP,LOOPBACK,RUNNING,MULTICAST> mtu 16384", "\tinet 127.0.0.1 netmask 0xff000000");
        return out(
          "lo0: flags=8049<UP,LOOPBACK,RUNNING,MULTICAST> mtu 16384", "\tinet 127.0.0.1 netmask 0xff000000",
          "en0: flags=8863<UP,BROADCAST,SMART,RUNNING,SIMPLEX,MULTICAST> mtu 1500", "\tether 3c:7c:3f:a2:41:0e",
          "\tinet 192.168.1.42 netmask 0xffffff00 broadcast 192.168.1.255", "\tmedia: autoselect (1000baseT <full-duplex>)", "\tstatus: active",
        );
      case "ping": {
        const host = args.filter((a) => !a.startsWith("-"))[0];
        if (!host) return out("usage: ping host");
        if (!c.lanController) return err(`ping: cannot resolve ${host}: Unknown host`);
        const times = [14.2, 12.8, 15.1, 13.4];
        return out(
          `PING ${host} (203.0.113.10): 56 data bytes`,
          ...times.map((t, i) => `64 bytes from 203.0.113.10: icmp_seq=${i} ttl=56 time=${t.toFixed(3)} ms`),
          "", `--- ${host} ping statistics ---`, "4 packets transmitted, 4 packets received, 0.0% packet loss",
          "round-trip min/avg/max/stddev = 12.800/13.875/15.100/0.873 ms",
        );
      }
      case "shutdown": case "reboot": case "poweroff": case "systemctl":
        return err(`${cmd}: must be run as root. Try: sudo ${raw.trim()}`);
      default:
        return err(`zsh: command not found: ${cmd}`);
    }
  };

  const submit = () => {
    const raw = input;
    setInput("");

    // ввод пароля для sudo
    if (sudo) {
      const pw = useOs.getState().prefs.password;
      setSudo(null);
      if (pw && raw !== pw) return setLines((l) => [...l, { text: "Password:" }, ...err("sudo: incorrect password")]);
      const result = sudo.run();
      return setLines((l) => [...l, { text: "Password:" }, ...result]);
    }

    const cmd = raw.trim();
    if (cmd) history.current.push(cmd);
    hi.current = history.current.length;
    const echo: Line = { text: prompt() + raw, kind: "prompt" };

    if (cmd === "clear") return setLines([]);
    if (cmd === "exit") return useOs.getState().close(winId);
    if (cmd.split(/\s+/)[0] === "sudo") {
      const res = privileged(cmd.split(/\s+/).slice(1));
      if (Array.isArray(res)) return setLines((l) => [...l, echo, ...res]);
      setLines((l) => [...l, echo]);
      return setSudo(res);
    }
    // команда выполняется один раз, вне функции обновления состояния (React может вызвать её дважды)
    const result = run(cmd);
    setLines((l) => [...l, echo, ...result]);
  };

  /** Tab: дополнение команды или имени файла. */
  const complete = () => {
    const parts = input.split(" ");
    const last = parts[parts.length - 1];
    const pool = parts.length === 1 ? COMMANDS : useFs.getState().list(cwd);
    const hits = pool.filter((x) => x.startsWith(last));
    if (hits.length === 1) setInput([...parts.slice(0, -1), hits[0]].join(" ") + (parts.length === 1 ? " " : ""));
    else if (hits.length > 1) setLines((l) => [...l, { text: prompt() + input, kind: "prompt" }, ...out(hits.join("    "))]);
  };

  return (
    <div className="terminal" onClick={() => window.getSelection()?.isCollapsed && inputRef.current?.focus()}>
      {lines.map((ln, i) => <div key={i} className={ln.kind ? "t-" + ln.kind : undefined}>{ln.text || " "}</div>)}
      <div className="term-input">
        <span>{sudo ? "Password:" : prompt()}</span>
        <input
          ref={inputRef}
          type={sudo ? "password" : "text"}
          className={sudo ? "secret" : undefined}
          value={input}
          spellCheck={false}
          autoComplete="off"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            else if (e.key === "Tab") { e.preventDefault(); if (!sudo) complete(); }
            else if (e.ctrlKey && e.key.toLowerCase() === "c") {
              e.preventDefault();
              setLines((l) => [...l, { text: (sudo ? "Password:" : prompt()) + (sudo ? "" : input) + "^C", kind: "prompt" }]);
              setInput(""); setSudo(null);
            } else if (e.ctrlKey && e.key.toLowerCase() === "l") { e.preventDefault(); setLines([]); }
            else if (e.key === "ArrowUp" && !sudo && history.current.length) {
              hi.current = Math.max(0, hi.current - 1);
              setInput(history.current[hi.current]);
              e.preventDefault();
            } else if (e.key === "ArrowDown" && !sudo) {
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
