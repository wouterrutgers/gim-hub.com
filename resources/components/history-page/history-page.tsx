import { useContext, useEffect, useState, type ReactElement } from "react";
import { Context as APIContext } from "../../context/api-context";
import { GroupMemberNamesContext, GroupMemberStatesContext } from "../../context/group-context";
import { SnapshotContext } from "../../context/snapshot-context-value";
import type * as Member from "../../game/member";
import { activityHasChanges, computeActivity } from "../../hooks/player-snapshot";
import { useModal } from "../modal/modal";
import { PlayerActivityWindow, type PlayerActivityWindowProps } from "../player-activity/player-activity";
import { PlayerIcon } from "../player-icon/player-icon";
import { SkillGraph } from "../skill-graph/skill-graph";

import "./history-page.css";

type HistoryActivityWindowProps = Omit<PlayerActivityWindowProps, "currentHiscores">;

function HistoryActivityWindow({ player, onClearSnapshot, onCloseModal }: HistoryActivityWindowProps): ReactElement {
  const { fetchMemberHiscores } = useContext(APIContext)?.api ?? {};
  const [hiscores, setHiscores] = useState<Map<string, number>>();

  useEffect(() => {
    let cancelled = false;

    if (!fetchMemberHiscores) return;

    fetchMemberHiscores(player)
      .then((currentHiscores) => {
        if (!cancelled) setHiscores(currentHiscores);
      })
      .catch(() => {
        if (!cancelled) setHiscores(new Map());
      });

    return (): void => {
      cancelled = true;
    };
  }, [fetchMemberHiscores, player]);

  return (
    <PlayerActivityWindow
      player={player}
      currentHiscores={hiscores}
      onClearSnapshot={onClearSnapshot}
      onCloseModal={onCloseModal}
    />
  );
}

export function HistoryPage(): ReactElement {
  const groupMembers = useContext(GroupMemberNamesContext);
  const memberStates = useContext(GroupMemberStatesContext);
  const { getBaselineSnapshot, clearBaselineSnapshot } = useContext(SnapshotContext);
  const { open: openActivityModal, modal: activityModal } = useModal(HistoryActivityWindow);

  const members = groupMembers
    .values()
    .filter((member) => member !== "@SHARED")
    .toArray()
    .sort((firstMember, secondMember) => firstMember.localeCompare(secondMember));

  async function clearMemberActivity(member: Member.Name): Promise<void> {
    try {
      await clearBaselineSnapshot(member);
    } catch (reason) {
      console.error("Failed to clear recent activity", reason);
      throw reason;
    }
  }

  function openMemberActivity(member: Member.Name): void {
    openActivityModal({
      player: member,
      onClearSnapshot: () => clearMemberActivity(member),
    });
  }

  return (
    <div id="history-page">
      {activityModal}
      <section className="history-page-activity rsborder rsbackground" aria-labelledby="recent-activity-heading">
        <div className="history-page-activity-header">
          <div>
            <h1 id="recent-activity-heading">Recent activity</h1>
            <p>Choose a member to review their progress since your last visit or over the past week.</p>
          </div>
        </div>
        <div className="history-page-member-grid">
          {members.map((member) => {
            const baseline = getBaselineSnapshot(member);
            const currentState = memberStates.get(member);
            const activity = baseline && currentState ? computeActivity(baseline.snapshot, currentState) : undefined;
            const hasNewActivity = activity ? activityHasChanges(activity) : false;

            return (
              <button
                key={member}
                className="history-page-member rsborder-tiny rsbackground rsbackground-hover"
                type="button"
                aria-label={`View ${member}'s recent activity`}
                onClick={() => openMemberActivity(member)}
              >
                <span className="history-page-member-icon" aria-hidden="true">
                  <PlayerIcon name={member} />
                </span>
                <span className="history-page-member-details">
                  <strong>{member}</strong>
                  <span className={hasNewActivity ? "history-page-member-new" : undefined}>
                    {hasNewActivity ? "New activity" : "View recent activity"}
                  </span>
                </span>
                <span className="history-page-member-action" aria-hidden="true">
                  Open <span>›</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="history-page-skill-history" aria-labelledby="skill-history-heading">
        <h2 id="skill-history-heading">Skill history</h2>
        <SkillGraph />
      </section>
    </div>
  );
}
