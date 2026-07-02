import "./index.css";
import React from "react";
import {Composition} from "remotion";
import {AkademiPromo} from "./video/AkademiPromo";
import {videoSpec} from "./video/theme";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="AkademiPromo"
      component={AkademiPromo}
      durationInFrames={videoSpec.durationInFrames}
      fps={videoSpec.fps}
      width={videoSpec.width}
      height={videoSpec.height}
    />
  );
};
