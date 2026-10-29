import { useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { useStore } from "./machine/store";
import { Dialog } from "./bios/ui/Dialog";
import { Setup } from "./bios/setup/Setup";
import { Post } from "./bios/post/Post";
import { BootScreen } from "./bios/post/BootScreen";
import { PowerScreen } from "./bios/post/PowerScreen";
import { Os } from "./os/Os";

const STAGE_W = 1920;
const STAGE_H = 1080;

/** Фиксированный экран 1920×1080, масштабируется целиком под окно — как настоящий монитор. */
function Stage({ children }: { children: ReactNode }) {
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  return (
    <div className="viewport">
      <div className="stage" style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>
        {children}
      </div>
    </div>
  );
}

export function App() {
  const phase = useStore((s) => s.phase);

  // тепловая модель живёт всегда, даже на POST
  useEffect(() => {
    let last = performance.now();
    const id = setInterval(() => {
      const now = performance.now();
      const s = useStore.getState();
      s.tick((now - last) / 1000);
      last = now;
    }, 200);
    return () => clearInterval(id);
  }, []);

  return (
    <Stage>
      {phase === "off" && <PowerScreen />}
      {phase === "post" && <Post />}
      {phase === "setup" && <Setup />}
      {phase === "boot" && <BootScreen />}
      {phase === "os" && <Os />}
      <Dialog />
    </Stage>
  );
}
