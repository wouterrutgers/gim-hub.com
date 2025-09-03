import { type ReactElement } from "react";
import { type Experience, Skill, SkillIconsBySkill, decomposeExperience } from "../../game/skill";
import { useSkillTooltip } from "../tooltip/skill-tooltip";
import type * as Member from "../../game/member";
import { useMemberSkillsContext } from "../../context/group-context";
import { CachedImage } from "../cached-image/cached-image";

import "./player-skills.css";

const SkillsInOSRSDisplayOrder: Skill[] = [
  "Attack",
  "Hitpoints",
  "Mining",
  "Strength",
  "Agility",
  "Smithing",
  "Defence",
  "Herblore",
  "Fishing",
  "Ranged",
  "Thieving",
  "Cooking",
  "Prayer",
  "Crafting",
  "Firemaking",
  "Magic",
  "Fletching",
  "Woodcutting",
  "Runecraft",
  "Slayer",
  "Farming",
  "Construction",
  "Hunter",
];

export const PlayerSkills = ({ member }: { member: Member.Name }): ReactElement => {
  const { tooltipElement, hideTooltip, showTooltip } = useSkillTooltip();
  const skills = useMemberSkillsContext(member);

  let levelTotal = 0;
  let xpTotal = 0;

  return (
    <div className="player-skills" onPointerLeave={hideTooltip}>
      {tooltipElement}
      {SkillsInOSRSDisplayOrder.map((skill) => {
        const xp = skills?.[skill] ?? (0 as Experience);
        xpTotal += xp;

        const { xpDeltaFromMax, levelReal, levelVirtual, xpMilestoneOfNext } = decomposeExperience(xp);

        levelTotal += levelReal;

        const wikiURLRaw = `https://oldschool.runescape.wiki/w/${skill}`;
        const iconURLRaw = SkillIconsBySkill[skill];

        return (
          <a
            href={URL.parse(wikiURLRaw)?.href ?? undefined}
            target="_blank"
            rel="noopener noreferrer"
            key={skill}
            className="skill-box"
            onPointerEnter={() =>
              showTooltip({
                style: "Individual",
                xp,
                levelVirtual,
                untilMax: Math.max(0, xpDeltaFromMax - xp) as Experience,
                untilMaxRatio: Math.min(xp / xpDeltaFromMax, 1.0),
                untilNext: (xpMilestoneOfNext - xp) as Experience,
                untilNextRatio: Math.min(xp / xpMilestoneOfNext, 1.0),
              })
            }
          >
            <div className="skill-box-left">
              <CachedImage alt={`osrs ${skill} icon`} className="skill-box__icon" src={iconURLRaw ?? ""} />
            </div>
            <div className="skill-box-right">
              <div className="skill-box-current-level">{levelReal}</div>
              <div className="skill-box-baseline-level">{levelReal}</div>
            </div>
            <div className="skill-box-progress">
              <div className="skill-box-progress-bar" style={{}}></div>
            </div>
          </a>
        );
      })}
      <div
        className="total-level-box"
        onPointerEnter={() => showTooltip({ style: "Total", xp: xpTotal as Experience })}
      >
        <CachedImage alt="osrs total level" className="total-level-box-image" src="/ui/183-0.png" />
        <CachedImage alt="osrs total level" className="total-level-box-image" src="/ui/184-0.png" />
        <div className="total-level-box-content">
          <span>Total level:</span>
          <span className="total-level-box__level">{levelTotal}</span>
        </div>
      </div>
    </div>
  );
};
