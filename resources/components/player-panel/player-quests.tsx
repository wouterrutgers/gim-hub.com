import { useContext, useState, type ReactElement } from "react";
import type { QuestDifficulty, QuestStatus } from "../../game/quests";
import { SearchElement } from "../search-element/search-element";
import { GameDataContext } from "../../context/game-data-context";
import type * as Member from "../../game/member";
import { useMemberQuestsContext } from "../../context/group-context";
import { CachedImage } from "../cached-image/cached-image";

import "./player-quests.css";

const getQuestWikiLinkURL = (name: string): string => {
  const wikiName = name.replaceAll(" ", "_");
  return `https://oldschool.runescape.wiki/w/${wikiName}/Quick_guide`;
};

const getClassForQuestStatus = (status: QuestStatus): string => {
  switch (status) {
    case "NOT_STARTED":
      return "player-quests-not-started";
    case "IN_PROGRESS":
      return "player-quests-in-progress";
    case "FINISHED":
      return "player-quests-finished";
  }
};

export const PlayerQuests = ({ member }: { member: Member.Name }): ReactElement => {
  const [nameFilter, setNameFilter] = useState<string>("");
  const { quests: questData } = useContext(GameDataContext);
  const quests = useMemberQuestsContext(member);

  const getDifficultyIconURL = (difficulty: QuestDifficulty): string => {
    switch (difficulty) {
      case "Novice":
        return "/icons/3399-0.png";
      case "Intermediate":
        return "/icons/3400-0.png";
      case "Experienced":
        return "/icons/3402-0.png";
      case "Master":
        return "/icons/3403-0.png";
      case "Grandmaster":
        return "/icons/3404-0.png";
      case "Special":
        return "/icons/3404-0.png";
    }
  };

  let possiblePoints = 0;
  questData?.forEach(({ points }) => (possiblePoints += points));
  let currentPoints = 0;
  quests?.forEach((progress, id) => {
    if (progress !== "FINISHED") return;
    currentPoints += questData?.get(id)?.points ?? 0;
  });

  const questList = [
    ...(questData
      ?.entries()
      .filter(([, { name }]) => name.toLowerCase().includes(nameFilter?.toLowerCase()))
      .map(([id, { name, difficulty, member, miniquest }]) => {
        const status = quests?.get(id) ?? "NOT_STARTED";
        return {
          member,
          miniquest,
          element: (
            <a
              key={id}
              href={getQuestWikiLinkURL(name)}
              className={`player-quests-quest ${getClassForQuestStatus(status)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <CachedImage
                className="player-quests-difficulty-icon"
                src={getDifficultyIconURL(difficulty)}
                alt={difficulty}
              />
              {name}
            </a>
          ),
        };
      }) ?? []),
  ];

  const freeQuests = questList?.filter(({ member }) => !member).map(({ element }) => element);
  const membersQuests = questList
    ?.filter(({ member, miniquest }) => {
      return member && !miniquest;
    })
    .map(({ element }) => element);
  const miniquestQuests = questList?.filter(({ miniquest }) => !!miniquest).map(({ element }) => element);

  return (
    <div className="player-quests">
      <div className="player-quests-top">
        <SearchElement className="player-quests-filter" onChange={setNameFilter} placeholder="Filter Quests" />
        <div className="player-quests-points">
          <span className="player-quests-current-points">{currentPoints}</span> / {possiblePoints}
        </div>
      </div>
      <div className="player-quests-list">
        <h4 className="player-quests-section-header">Free Quests</h4>
        {freeQuests}
        <h4 className="player-quests-section-header">Members' Quests</h4>
        {membersQuests}
        <h4 className="player-quests-section-header">Miniquests</h4>
        {miniquestQuests}
      </div>
    </div>
  );
};
