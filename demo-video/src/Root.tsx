import {Composition} from "remotion";
import {PixelForgeDemo, PixelForgeThumbnail} from "./PixelForgeDemo";

export const Root = () => (
  <>
    <Composition
      id="PixelForgeDemo"
      component={PixelForgeDemo}
      durationInFrames={3240}
      fps={30}
      width={1920}
      height={1080}
    />
    <Composition
      id="PixelForgeThumbnail"
      component={PixelForgeThumbnail}
      durationInFrames={1}
      fps={30}
      width={1280}
      height={720}
    />
  </>
);
