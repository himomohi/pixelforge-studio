import {Composition} from "remotion";
import {PixelForgeDemo} from "./PixelForgeDemo";

export const Root = () => (
  <Composition
    id="PixelForgeDemo"
    component={PixelForgeDemo}
    durationInFrames={1890}
    fps={30}
    width={1920}
    height={1080}
  />
);
