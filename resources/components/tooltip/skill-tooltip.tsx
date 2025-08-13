import { useRef, useState, type ReactElement } from "react";

import "./tooltip.css";
import { createPortal } from "react-dom";
import { type Experience } from "../../game/skill";
import { StatBar } from "../player-panel/stat-bar";

export type SkillTooltipProps =
  | {
      style: "Total";
      xp: Experience;
    }
  | {
      style: "Individual";
      levelVirtual: number;
      xp: Experience;
      untilNextRatio: number;
      untilNext: Experience;
      untilMaxRatio: number;
      untilMax: Experience;
    };

/**
 * A hook to utilize the global tooltip with experience data, such as name, current level, remaining xp, etc.
 */
export const useSkillTooltip = (): {
  tooltipElement: ReactElement;
  hideTooltip: () => void;
  showTooltip: (item: SkillTooltipProps) => void;
} => {
  const [skillProps, setSkillProps] = useState<SkillTooltipProps>();
  const tooltipRef = useRef<HTMLDivElement>(document.body.querySelector<HTMLDivElement>("div#tooltip")!);

  const hideTooltip = (): void => {
    setSkillProps(undefined);
    tooltipRef.current.style.visibility = "hidden";
  };
  const showTooltip = (item: SkillTooltipProps): void => {
    setSkillProps(item);
    tooltipRef.current.style.visibility = "visible";
  };

  let element = undefined;
  if (skillProps?.style === "Total") {
    element = <>Total XP: {skillProps.xp.toLocaleString()}</>;
  } else if (skillProps?.style === "Individual") {
    element = (
      <>
        Level: {skillProps.levelVirtual.toLocaleString()}
        <br />
        Total XP: {skillProps.xp.toLocaleString()}
        <br />
        Until Level: {skillProps.untilNext.toLocaleString()}
        <StatBar
          color={`hsl(${107 * skillProps.untilNextRatio}, 100%, 41%)`}
          bgColor="#222222"
          ratio={skillProps.untilNextRatio}
        />
        Until Max: {skillProps.untilMax.toLocaleString()}
        <StatBar
          color={`hsl(${107 * skillProps.untilMaxRatio}, 100%, 41%)`}
          bgColor="#222222"
          ratio={skillProps.untilMaxRatio}
        />
      </>
    );
  }

  const tooltipElement = createPortal(element, tooltipRef.current);

  return { tooltipElement, hideTooltip, showTooltip };
};
