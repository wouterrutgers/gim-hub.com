import { type ReactElement, type ReactNode } from "react";
import { DiaryRegion, DiaryTier } from "../../game/diaries";
import { SkillIconsBySkill, type Level, type Skill } from "../../game/skill";
import type * as Member from "../../game/member";
import { CachedImage } from "../cached-image/cached-image";

import "./achievement-log.css";

export interface DiaryTaskProgress {
  complete: boolean;
  description: string;
  skills: { skill: Skill; required: Level; current: Level }[];
  quests: { name: string; complete: boolean }[];
}

interface DiaryRegionWindowProps {
  player: Member.Name;
  region: DiaryRegion;
  progress: [DiaryTier, DiaryTaskProgress[]][];
  onCloseModal: () => void;
}
export const DiaryRegionWindow = ({ region, player, progress, onCloseModal }: DiaryRegionWindowProps): ReactElement => {
  const regionHref = `https://oldschool.runescape.wiki/w/${region.replace(/ /g, "_")}_Diary`;

  const tierElements = progress.map(([tier, tierProgress]) => {
    const href = `${regionHref}#${tier}`;
    const complete = tierProgress.reduce((complete, task) => {
      return complete && task.complete;
    }, true);

    return (
      <div key={tier} className={`diary-dialog-section ${complete ? "diary-dialog-tier-complete" : ""}`}>
        <h2 className="diary-dialog-section-title">
          <a href={href} target="_blank" rel="noopener noreferrer">
            {tier}
          </a>
        </h2>
        <TierTasksDisplay tasks={tierProgress} />
      </div>
    );
  });

  return (
    <div className="diary-dialog-container metal-border rsbackground">
      <div className="diary-dialog-header">
        <h1>
          {`${player}'s `}
          <a className="diary-dialog-title" href={regionHref} target="_blank" rel="noopener noreferrer">
            {region} Achievement Diary
          </a>
        </h1>
        <button className="diary-dialog-close" onClick={onCloseModal}>
          <CachedImage src="/ui/1731-0.png" alt="Close dialog" title="Close dialog" />
        </button>
      </div>
      <div className="diary-dialog-title-border" />
      <div className="diary-dialog-scroll-container">{tierElements}</div>
    </div>
  );
};

const TierTasksDisplay = ({ tasks }: { tasks: DiaryTaskProgress[] }): ReactElement => {
  const elements = tasks.map(({ complete, description, quests, skills }) => {
    const skillElements = skills.map(({ skill, required, current }) => {
      const complete = current >= required;
      return (
        <span
          key={`${skill} ${required} ${current}`}
          className={`diary-dialog-skill-icon ${complete ? "diary-dialog-skill-complete" : ""}`}
        >
          {` ${current} / ${required} `}
          <CachedImage alt={skill} src={SkillIconsBySkill[skill]} />
        </span>
      );
    });

    const questElements = quests.map(({ name, complete }) => (
      <span
        key={`${name} ${complete}`}
        className={`diary-dialog-skill-icon ${complete ? "diary-dialog-skill-complete" : ""}`}
      >
        {name}
      </span>
    ));
    const allRequirements = [...skillElements, ...questElements];
    let withSeparators: ReactNode[] = allRequirements.flatMap((element, index) => {
      if (index < allRequirements.length - 1) {
        return [element, ","];
      }
      return [element];
    });
    if (withSeparators.length > 0) withSeparators = [" (", ...allRequirements, ")"];

    return (
      <div
        key={`${complete} ${description} ${quests.length} ${skills.length}`}
        className={`diary-dialog-task ${complete ? "diary-dialog-task-complete" : ""}`}
      >
        {description}
        {withSeparators}
      </div>
    );
  });

  return <>{elements}</>;
};
