import { useContext, type ReactElement } from "react";
import { PlayerPanel } from "../player-panel/player-panel";
import { GroupMemberNamesContext } from "../../context/group-context";

import "./panels-page.css";

export const PanelsPage = (): ReactElement => {
  const groupMembers = useContext(GroupMemberNamesContext);

  const panels = groupMembers
    .values()
    .filter((member) => member !== "@SHARED")
    .toArray()
    .map<ReactElement>((member) => <PlayerPanel key={member} member={member} />);

  return <div id="panels-page-container">{panels}</div>;
};
