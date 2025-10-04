import { useContext, type ReactElement } from "react";
import { StatBar } from "./stat-bar";
import { DiaryRegion, DiaryTier } from "../../game/diaries";
import { useModal } from "../modal/modal";
import { computeVirtualLevelFromXP, type Level } from "../../game/skill";
import { GameDataContext } from "../../context/game-data-context";
import type * as Member from "../../game/member";
import { useMemberDiariesContext, useMemberQuestsContext, useMemberSkillsContext } from "../../context/group-context";
import { DiaryRegionWindow, type DiaryTaskProgress } from "../achievement-diary/achievement-diary";
import { formatTitle } from "../../ts/format-title";

import "./player-diaries.css";

interface DiarySummaryProps {
  region: DiaryRegion;
  onClick: (region: DiaryRegion) => void;
  completionRatioRegion: { completed: number; total: number };
  completionRatioPerTier: number[];
}

const DiarySummary = ({
  region,
  onClick,
  completionRatioRegion,
  completionRatioPerTier,
}: DiarySummaryProps): ReactElement => {
  return (
    <>
      <button className={`rsborder-tiny diary-completion`} onClick={() => onClick(region)}>
        <div className="diary-completion-top">
          <span>{region}</span>
          <span>
            {completionRatioRegion.completed}/{completionRatioRegion.total}
          </span>
        </div>
        <div className="diary-completion-bottom">
          {completionRatioPerTier.map((ratio, index) => {
            /*
             * With CSS's HSL color model, 0-107 is a gradient from red, orange,
             * yellow, then green. So we can multiply the hue to get the effect
             * of more complete diaries becoming redder, assuming ratio is
             * between 0 and 1.
             */
            const hue = 107 * ratio;
            return (
              <StatBar
                key={`${ratio}-${index}`}
                color={`hsl(${hue}, 100%, 41%)`}
                bgColor="rgba(0, 0, 0, 0.5)"
                ratio={ratio}
              />
            );
          })}
        </div>
      </button>
    </>
  );
};

export const PlayerDiaries = ({ member }: { member: Member.Name }): ReactElement => {
  const { quests: questData, diaries: diaryData } = useContext(GameDataContext);
  const skills = useMemberSkillsContext(member);
  const diaries = useMemberDiariesContext(member);
  const quests = useMemberQuestsContext(member);

  const { open: openModal, modal } = useModal(DiaryRegionWindow);

  if (diaryData === undefined) return <></>;

  const summaryElements = [];
  for (const [region, tasksByTier] of diaryData) {
    const completionByTier = diaries?.[region];

    const detailedCompletionAllTiers: [DiaryTier, DiaryTaskProgress[]][] = [];
    const completionRatioForRegion = {
      completed: 0,
      total: 0,
    };
    const completionRatioPerTier: number[] = [];
    tasksByTier.forEach((tasks, tier) => {
      const completionPerTask = completionByTier?.[tier];
      const detailedCompletionForTier: DiaryTaskProgress[] = [];
      let completedTasksForTier = 0;
      let totalTasksForTier = 0;
      for (const [index, task] of tasks.entries()) {
        totalTasksForTier += 1;

        const completed = !!completionPerTask?.[index];
        if (completed) completedTasksForTier += 1;

        detailedCompletionForTier.push({
          complete: completed,
          description: task.task,
          quests: task.requirements.quests.map((id) => ({
            name: questData?.get(id)?.name ?? "Summer's End",
            complete: quests?.get(id) === "FINISHED",
          })),
          skills: task.requirements.skills.map(({ skill, level }) => ({
            skill,
            required: level as Level,
            current: computeVirtualLevelFromXP(skills?.[skill] ?? 0),
          })),
        });
      }

      completionRatioPerTier.push(completedTasksForTier / totalTasksForTier);
      completionRatioForRegion.completed += completedTasksForTier;
      completionRatioForRegion.total += totalTasksForTier;

      detailedCompletionAllTiers.push([tier, detailedCompletionForTier]);
    });

    summaryElements.push(
      <DiarySummary
        key={region}
        region={region}
        onClick={(region) => openModal({ region, player: member, progress: detailedCompletionAllTiers })}
        completionRatioRegion={completionRatioForRegion}
        completionRatioPerTier={completionRatioPerTier}
      />,
    );
  }

  return (
    <div className="player-diaries">
      <h2 className="player-diaries-title">{formatTitle("Achievement diaries")}</h2>
      <div className="player-diaries-completions">{summaryElements}</div>
      {modal}
    </div>
  );
};
