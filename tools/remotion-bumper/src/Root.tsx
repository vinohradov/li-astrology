import { Composition } from "remotion";
import { Bumper, bumperSchema } from "./Bumper";
import { LeadMagnet, leadMagnetSchema, LEAD_MAGNET_DURATION } from "./LeadMagnet";
import { Reel } from "./Reel";
import { COPY } from "./brand";

// 9:16 vertical, Instagram Reels native size.
const WIDTH = 1080;
const HEIGHT = 1920;
const FPS = 30;
const DURATION = 90; // 3.0s

// Footage IMG_9659.MOV: source is 131.4s but the lavalier audio drops out at
// 81.7s; we cut the reel on the last clean sentence (~77.3s) @ 30fps.
const REEL_DURATION = 2319;

export const RemotionRoot: React.FC = () => {
  return (
    <>
    <Composition
      id="Bumper"
      component={Bumper}
      durationInFrames={DURATION}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      schema={bumperSchema}
      defaultProps={{
        brand: COPY.brand,
        tagline: COPY.tagline,
        cta: COPY.cta,
        handle: COPY.handle,
        url: COPY.url,
      }}
    />
    <Composition
      id="LeadMagnet"
      component={LeadMagnet}
      durationInFrames={LEAD_MAGNET_DURATION}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      schema={leadMagnetSchema}
      defaultProps={{}}
    />
    <Composition
      id="Reel"
      component={Reel}
      durationInFrames={REEL_DURATION}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
    </>
  );
};
