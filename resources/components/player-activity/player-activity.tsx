import { useContext, type ReactElement } from "react";
import { GameDataContext } from "../../context/game-data-context";
import { DiaryRegion, DiaryTier } from "../../game/diaries";
import type * as Member from "../../game/member";
import { SkillIconsBySkill } from "../../game/skill";
import type { PlayerActivity } from "../../hooks/player-snapshot";
import { formatTitle } from "../../ts/format-title";
import { CachedImage } from "../cached-image/cached-image";
import mappings from "../collection-log/mappings.json";

import "./player-activity.css";

const formatNumber = (n: number): string => n.toLocaleString();

const formatRelativeTime = (timestamp: number): string => {
  const diffMs = Date.now() - timestamp;
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  if (diffMins > 0) return `${diffMins}m ago`;
  return "just now";
};

type MappingEntry = "kills" | { label: string; lookupKey: string }[] | [];

export const BOSS_KC_KEYS: Set<string> = new Set(
  Object.entries(mappings as Record<string, MappingEntry>).flatMap(([pageName, entry]) => {
    if (entry === "kills") return [pageName];
    if (Array.isArray(entry)) return entry.map((e) => e.lookupKey);
    return [];
  }),
);

export interface PlayerActivityWindowProps {
  player: Member.Name;
  activity: PlayerActivity;
  currentHiscores?: Map<string, number>;
  onClearSnapshot?: () => void;
  onCloseModal: () => void;
}

export const PlayerActivityWindow = ({
  player,
  activity,
  currentHiscores,
  onClearSnapshot,
  onCloseModal,
}: PlayerActivityWindowProps): ReactElement => {
  const { quests: questData, diaries: diaryData, items: itemData } = useContext(GameDataContext);

  const { skillChanges, questChanges, diaryChanges, collectionChanges, bossKcBefore } = activity;
  const levelUps = skillChanges.filter((c) => c.levelAfter > c.levelBefore);

  const sortedDiaryChanges = [...diaryChanges].sort((a, b) => {
    const regionDiff = DiaryRegion.indexOf(a.region) - DiaryRegion.indexOf(b.region);
    if (regionDiff !== 0) return regionDiff;
    return DiaryTier.indexOf(a.tier) - DiaryTier.indexOf(b.tier);
  });

  // Compute boss KC changes once current hiscores have loaded.
  const hasBossKcBefore = Object.keys(bossKcBefore).length > 0;
  const bossKcChanges: { boss: string; before: number; after: number }[] | undefined =
    currentHiscores === undefined
      ? undefined
      : Object.entries(bossKcBefore)
          .filter(([key]) => BOSS_KC_KEYS.has(key))
          .flatMap(([key, before]) => {
            const after = currentHiscores.get(key) ?? 0;
            return after > before ? [{ boss: key, before, after }] : [];
          })
          .sort((a, b) => b.after - b.before - (a.after - a.before));

  const handleClear = (): void => {
    onClearSnapshot?.();
    onCloseModal();
  };

  const hasChanges =
    skillChanges.length > 0 || questChanges.length > 0 || diaryChanges.length > 0 || collectionChanges.length > 0;

  return (
    <div className="player-activity rsborder rsbackground">
      <div className="player-activity-header">
        <h2>{formatTitle(`${player}'s Recent Activity`)}</h2>
        <button className="player-activity-close dialog-close" onClick={onCloseModal} aria-label="Close">
          <CachedImage src="/ui/1731-0.png" alt="Close dialog" title="Close dialog" />
        </button>
      </div>
      <p className="player-activity-since">
        Since {formatRelativeTime(activity.snapshotTimestamp)} - {new Date(activity.snapshotTimestamp).toLocaleString()}
      </p>
      {!hasChanges && !hasBossKcBefore && <p className="player-activity-empty">No activity recorded.</p>}

      <div className="player-activity-body">
        {/* XP gains and level ups */}
        {skillChanges.length > 0 && (
          <section className="player-activity-section">
            <h3 className="player-activity-section-title">{formatTitle("Skills")}</h3>
            {levelUps.length > 0 && (
              <div className="player-activity-subsection">
                <h4 className="player-activity-subsection-title">Level ups</h4>
                <div className="player-activity-levelups">
                  {levelUps.map((change) => (
                    <div key={change.skill} className="player-activity-levelup">
                      <CachedImage
                        alt={`${change.skill} icon`}
                        src={SkillIconsBySkill[change.skill] ?? ""}
                        className="player-activity-skill-icon"
                      />
                      <span className="player-activity-skill-name">{change.skill}</span>
                      <span className="player-activity-level-change player-activity-counter">
                        <span>{change.levelBefore}</span>
                        <span className="arrow">→</span>
                        <span>{change.levelAfter}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="player-activity-subsection">
              <h4 className="player-activity-subsection-title">XP gained</h4>
              <div className="player-activity-xp-list">
                {skillChanges.map((change) => (
                  <div key={change.skill} className="player-activity-xp-row">
                    <CachedImage
                      alt={`${change.skill} icon`}
                      src={SkillIconsBySkill[change.skill] ?? ""}
                      className="player-activity-skill-icon"
                    />
                    <span className="player-activity-skill-name">{change.skill}</span>
                    <span className="player-activity-xp-gained">+{formatNumber(change.xpAfter - change.xpBefore)}</span>
                    <span className="player-activity-xp-total">{formatNumber(change.xpAfter)}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Quest changes */}
        {questChanges.length > 0 && (
          <section className="player-activity-section">
            <h3 className="player-activity-section-title">{formatTitle("Quests")}</h3>
            <div className="player-activity-quest-list">
              {questChanges.map((change) => {
                const questName = questData?.get(change.questId)?.name ?? `Quest #${change.questId}`;
                const statusLabel =
                  change.statusAfter === "FINISHED"
                    ? "Completed"
                    : change.statusAfter === "IN_PROGRESS"
                      ? "Started"
                      : "Not started";
                const statusClass =
                  change.statusAfter === "FINISHED"
                    ? "player-activity-quest-finished"
                    : change.statusAfter === "IN_PROGRESS"
                      ? "player-activity-quest-in-progress"
                      : "player-activity-quest-not-started";

                return (
                  <div key={String(change.questId)} className={`player-activity-quest-row ${statusClass}`}>
                    <span className="player-activity-quest-status">{statusLabel}</span>
                    <span className="player-activity-quest-name">{questName}</span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Diary changes */}
        {diaryChanges.length > 0 && (
          <section className="player-activity-section">
            <h3 className="player-activity-section-title">{formatTitle("Achievement diaries")}</h3>
            <div className="player-activity-diary-list">
              {sortedDiaryChanges.map((change) => {
                const regionTasks = diaryData?.get(change.region)?.get(change.tier);
                return (
                  <div key={`${change.region}-${change.tier}`} className="player-activity-diary-region">
                    <span className="player-activity-diary-header">
                      {change.region} - {change.tier}
                      <span className="player-activity-diary-count">
                        +{change.newlyCompletedIndices.length} task
                        {change.newlyCompletedIndices.length !== 1 ? "s" : ""}
                      </span>
                    </span>
                    {regionTasks && (
                      <ul className="player-activity-diary-tasks">
                        {change.newlyCompletedIndices.map((idx) => (
                          <li key={idx}>{regionTasks[idx]?.task ?? `Task #${idx + 1}`}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Collection log changes */}
        {collectionChanges.length > 0 && (
          <section className="player-activity-section">
            <h3 className="player-activity-section-title">{formatTitle("Collection log")}</h3>
            <div className="player-activity-collection-list">
              {collectionChanges.map((change) => {
                const itemName = itemData?.get(change.itemId)?.name ?? `Item #${change.itemId}`;
                const isNew = change.quantityBefore === 0;
                return (
                  <div key={String(change.itemId)} className="player-activity-collection-row">
                    <a
                      href={`https://oldschool.runescape.wiki/w/Special:Lookup?type=item&id=${change.itemId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="player-activity-collection-item"
                    >
                      <CachedImage
                        alt={itemName}
                        src={`/item-icons/${change.itemId}.webp`}
                        className="player-activity-collection-icon"
                      />
                      <span className="player-activity-collection-name">{itemName}</span>
                      {isNew ? (
                        <span className="player-activity-collection-new">New!</span>
                      ) : (
                        <div className="player-activity-collection-qty player-activity-counter">
                          <span>{change.quantityBefore}</span>
                          <span className="arrow">→</span>
                          <span>{change.quantityAfter}</span>
                        </div>
                      )}
                    </a>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Boss kill counts */}
        {hasBossKcBefore && bossKcChanges !== undefined && bossKcChanges.length > 0 && (
          <section className="player-activity-section">
            <h3 className="player-activity-section-title">{formatTitle("Boss kills")}</h3>
            <div className="player-activity-bosskc-list">
              {bossKcChanges.map(({ boss, before, after }) => (
                <div key={boss} className="player-activity-bosskc-row">
                  <span className="player-activity-bosskc-name">{boss}</span>
                  <span className="player-activity-bosskc-change player-activity-counter">
                    <span>{formatNumber(before)}</span>
                    <span className="arrow">→</span>
                    <span>{formatNumber(after)}</span>
                  </span>
                  <span className="player-activity-bosskc-gained">+{formatNumber(after - before)}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {onClearSnapshot && (
        <div className="player-activity-footer">
          <button className="player-activity-dismiss men-button small" type="button" onClick={handleClear}>
            Clear Activity
          </button>
        </div>
      )}
    </div>
  );
};
