import { useContext, useEffect, type ReactElement, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { AppNavigation } from "../app-navigation/app-navigation.tsx";
import { PlayerPanel } from "../player-panel/player-panel.tsx";
import { Context as APIContext } from "../../context/api-context.tsx";
import { SettingsContext as SettingsContext } from "../../context/settings-context.tsx";
import { GroupMemberNamesContext } from "../../context/group-context.tsx";
import { LoadingScreen } from "../loading-screen/loading-screen.tsx";

import "./layout.css";

export const UnauthedLayout = ({ children }: { children?: ReactNode }): ReactElement => {
  return (
    <>
      <div id="unauthed-content">{children}</div>
    </>
  );
};

const SidePanels = (): ReactNode => {
  const groupMembers = useContext(GroupMemberNamesContext);

  if (groupMembers.size <= 0) {
    return (
      <div id="side-panels-container">
        <div style={{ position: "relative" }}>
          <PlayerPanel />
          <div style={{ position: "absolute", background: "rgba(0 0 0 / 60%)", inset: 0 }}>
            <LoadingScreen />
          </div>
        </div>
        <div style={{ position: "relative" }}>
          <PlayerPanel />
          <div style={{ position: "absolute", background: "rgba(0 0 0 / 60%)", inset: 0 }}>
            <LoadingScreen />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="side-panels-container">
      {groupMembers
        .values()
        .filter((member) => member !== "@SHARED")
        .toArray()
        .sort((a, b) => a.localeCompare(b))
        .map<ReactElement>((member) => (
          <PlayerPanel key={member} member={member} />
        ))}
    </div>
  );
};

export const AuthedLayout = ({
  children,
  showPanels,
  hideHeader,
}: {
  children?: ReactNode;
  showPanels?: boolean;
  hideHeader?: boolean;
}): ReactElement => {
  const { logInLive, api } = useContext(APIContext) ?? {};
  const { sidebarPosition, siteTheme } = useContext(SettingsContext);
  const navigate = useNavigate();

  if (siteTheme === "dark") {
    document.documentElement.classList.add("dark-mode");
  } else {
    document.documentElement.classList.remove("dark-mode");
  }

  useEffect(() => {
    if (api) return;

    logInLive!().catch(() => {
      return navigate("/", { replace: true });
    });
  }, [logInLive, api, navigate]);

  const mainContent = (
    <div id="main-content" className="pointer-passthrough">
      {hideHeader ? undefined : <AppNavigation groupName={api?.getCredentials().name ?? "Group Name"} />}
      {children}
    </div>
  );

  if (sidebarPosition === "right") {
    return (
      <>
        {mainContent}
        {showPanels ? <SidePanels /> : undefined}
      </>
    );
  } else {
    return (
      <>
        {showPanels ? <SidePanels /> : undefined}
        {mainContent}
      </>
    );
  }
};
