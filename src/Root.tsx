import React from "react";
import { Composition } from "remotion";
import { AdVideo } from "./AdVideo";
import { CampanhaDemo } from "./CampanhaDemo";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="AdVideo"
        component={AdVideo}
        durationInFrames={450}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="CampanhaDemo"
        component={CampanhaDemo}
        durationInFrames={450}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};
