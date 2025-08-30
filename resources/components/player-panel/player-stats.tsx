import { useContext, type ReactElement, type ReactNode } from "react";
import { StatBar } from "./stat-bar";
import * as Member from "../../game/member";
import { PlayerIcon } from "../player-icon/player-icon";
import { XpDropper } from "../xp-dropper/xp-dropper";
import {
  GroupXPDropsContext,
  useMemberInteractingContext,
  useMemberLastUpdatedContext,
  useMemberStatsContext,
} from "../../context/group-context";

import "./player-stats.css";

/**
 * Time in milliseconds before a player is considered offline/inactive.
 * When that is, they are displayed as all grey.
 */
const INACTIVE_TIMER_MS = 300 * 1000;
/**
 * Time in milliseconds before an npc interaction is considered stale and shouldn't be shown.
 */
const INTERACTION_TIMER_MS = 30 * 1000;
/**
 * Static colors to use for various stat bars.
 */
const COLORS = {
  player: {
    hitpoints: "#157145",
    hitpointsBG: "#073823",
    prayer: "#336699",
    prayerBG: "#112233",
    energy: "#a9a9a9",
    energyBG: "#383838",
  },
  interaction: {
    combat: "#A41623",
    combatBG: "#383838",
    nonCombat: "#333355",
  },
};

// Shows what the player is interacting with, like attacking/talking to an npc
const PlayerInteracting = ({ npcName, healthRatio }: { npcName: string; healthRatio?: number }): ReactElement => {
  const isNonCombatNPC = healthRatio === undefined;

  return (
    <div className="player-interacting">
      <StatBar
        color={isNonCombatNPC ? COLORS.interaction.nonCombat : COLORS.interaction.combat}
        bgColor={isNonCombatNPC ? COLORS.interaction.nonCombat : COLORS.interaction.combatBG}
        ratio={healthRatio}
      />
      <div className="player-interacting-name">{npcName}</div>
    </div>
  );
};

const PlayerStatsImpl = ({
  name,
  health,
  prayer,
  run,
  status,
  children,
}: {
  name: Member.Name;
  health: { current: number; max: number };
  prayer: { current: number; max: number };
  run: { current: number; max: number };
  status: { online: true; world?: number; interacting?: Member.NPCInteraction } | { online: false; lastUpdated?: Date };
  children?: ReactNode;
}): ReactElement => {
  let interactionBar: ReactNode = undefined;
  let statusOverlay: ReactNode = undefined;
  if (status.online) {
    if (status.interacting) {
      const { healthRatio, name } = status.interacting;
      interactionBar = <PlayerInteracting healthRatio={healthRatio} npcName={name} />;
    }
    if (status.world !== undefined) {
      statusOverlay = (
        <>
          - <span className="player-stats-world">{`W${status.world}`}</span>
        </>
      );
    }
  } else if (status.lastUpdated && status.lastUpdated?.getTime() > 0) {
    statusOverlay = <> - {status.lastUpdated?.toLocaleString()}</>;
  }

  const healthRatio = health.current / health.max;
  const prayerRatio = prayer.current / prayer.max;
  const runRatio = run.current / run.max;

  return (
    <div className={`player-stats ${status.online ? "" : "player-stats-inactive"}`}>
      {children}
      <div className="player-stats-hitpoints">
        <StatBar
          className="player-stats-hitpoints-bar"
          color={COLORS.player.hitpoints}
          bgColor={COLORS.player.hitpointsBG}
          ratio={healthRatio}
        />
        {interactionBar}
        <div className="player-stats-name">
          <PlayerIcon name={name} /> {name} {statusOverlay}
        </div>
        <div className="player-stats-hitpoints-numbers">{`${health.current} / ${health.max}`}</div>
      </div>
      <div className="player-stats-prayer">
        <StatBar
          className="player-stats-prayer-bar"
          color={COLORS.player.prayer}
          bgColor={COLORS.player.prayerBG}
          ratio={prayerRatio}
        />
        <div className="player-stats-prayer-numbers">{`${prayer.current} / ${prayer.max}`}</div>
      </div>
      <div className="player-stats-energy">
        <StatBar
          className="player-stats-energy-bar"
          color={COLORS.player.energy}
          bgColor={COLORS.player.energyBG}
          ratio={runRatio}
        />
      </div>
    </div>
  );
};

export const PlayerStatsPlaceholder = (): ReactElement => {
  return (
    <PlayerStatsImpl
      name={"" as Member.Name}
      health={{ current: 10, max: 10 }}
      prayer={{ current: 1, max: 1 }}
      run={{ current: 1, max: 1 }}
      status={{ online: false }}
    />
  );
};

export const PlayerStats = ({ member }: { member: Member.Name }): ReactElement => {
  const interacting = useMemberInteractingContext(member);
  const stats = useMemberStatsContext(member);
  const lastUpdated = useMemberLastUpdatedContext(member);
  const xpDrops = useContext(GroupXPDropsContext);

  const now = new Date();
  const online = now.getTime() - (lastUpdated ?? new Date(0)).getTime() < INACTIVE_TIMER_MS;
  const isInteractingRecent = interacting && now.getTime() - interacting?.lastUpdated.getTime() < INTERACTION_TIMER_MS;

  return (
    <PlayerStatsImpl
      name={member}
      health={stats?.health ?? { current: 10, max: 10 }}
      prayer={stats?.prayer ?? { current: 1, max: 1 }}
      run={stats?.run ?? { current: 1, max: 1 }}
      status={
        online
          ? { online: true, interacting: isInteractingRecent ? interacting : undefined, world: stats?.world }
          : { online: false, lastUpdated }
      }
      children={<XpDropper xpDrops={xpDrops.get(member)} />}
    />
  );
};
