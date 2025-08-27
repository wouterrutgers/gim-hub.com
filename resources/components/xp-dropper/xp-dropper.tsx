import { type ReactElement } from "react";
import type * as Member from "../../game/member";
import { SkillIconsBySkill } from "../../game/skill";
import { CachedImage } from "../cached-image/cached-image";

import "./xp-dropper.css";

/**
 * Displays rising XP drops in the style of OSRS.
 */
export const XpDropper = ({ xpDrops }: { xpDrops: Member.ExperienceDrop[] | undefined }): ReactElement => {
  return (
    <div className="xp-dropper">
      {xpDrops?.map(({ id, amounts, creationTimeMS }) => {
        const elements = [];
        for (const { skill, amount } of amounts) {
          elements.push(
            <div className="xp-dropper-drop" key={`${skill}-${amount}`}>
              <CachedImage alt={skill} src={SkillIconsBySkill.get(skill)?.href ?? ""} />
              {amount}
            </div>,
          );
        }
        return (
          <div className="xp-dropper-drop-cluster" key={`${id}-${creationTimeMS}`}>
            {elements}
          </div>
        );
      })}
    </div>
  );
};
