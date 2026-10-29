import { useOs } from "./osStore";
import { Crash, Leaving, LockScreen, Splash } from "./Screens";
import { Desktop } from "./Desktop";
import "./os.css";

export function Os() {
  const stage = useOs((s) => s.stage);
  return (
    <div className="os">
      {stage === "splash" && <Splash />}
      {stage === "lock" && <LockScreen />}
      {stage === "desktop" && <Desktop />}
      {stage === "crash" && <Crash />}
      {stage === "leaving" && <Leaving />}
    </div>
  );
}
