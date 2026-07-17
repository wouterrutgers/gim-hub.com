import { useContext, type ReactElement } from "react";
import * as Member from "../../game/member";
import { CachedImage } from "../cached-image/cached-image";
import { GroupMemberColorsContext } from "../../context/group-context";

export const PlayerIcon = ({ name }: { name: Member.Name }): ReactElement => {
  const hueDegrees = useContext(GroupMemberColorsContext).colors.get(name)?.hueDegrees ?? 0;

  return (
    <CachedImage
      alt={`Player icon for ${name}`}
      src="/ui/player-icon.webp"
      style={{ filter: `hue-rotate(${hueDegrees}deg) saturate(100%)` }}
      width="12"
      height="15"
    />
  );
};
