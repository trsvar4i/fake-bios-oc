import { Composition } from "remotion";
import { Promo, FPS, TOTAL_FRAMES } from "./Promo";

export const Root = () => (
  <Composition id="Promo" component={Promo} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1920} height={1080} />
);
