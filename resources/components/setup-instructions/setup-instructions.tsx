import { useContext, useState, type ReactElement } from "react";
import { AppLink } from "../app-link/app-link";
import { Context as APIContext } from "../../context/api-context.tsx";
import { CachedImage } from "../cached-image/cached-image";
import { formatTitle } from "../../ts/format-title";

import "./setup-instructions.css";

export const SetupInstructions = (): ReactElement => {
  const [tokenVisible, setTokenVisible] = useState(false);
  const { api } = useContext(APIContext) ?? {};

  const credentials = api?.getCredentials();

  return (
    <div id="setup-instructions-container">
      <div id="setup-instructions" className="rsbackground rsborder">
        <div className="setup-block">
          <h3>{formatTitle("The group's login")}</h3>
          <p>Only share these with your group. You can't recover it so keep it safe!</p>
          <div className="setup-block">
            <h4>{formatTitle("Group name")}</h4>
            <div className="setup-credential rsborder-tiny rsbackground">{credentials?.name ?? "Group name"}</div>
          </div>

          <div className="setup-block">
            <h4>{formatTitle("Group token")}</h4>
            <div className="setup-credential rsborder-tiny rsbackground">
              {tokenVisible ? (
                (credentials?.token ?? "00000000-0000-0000-0000-000000000000")
              ) : (
                <>
                  <button
                    id="setup-credential-hide"
                    onClick={() => {
                      setTokenVisible(true);
                    }}
                  >
                    Click to show token
                  </button>
                  {"00000000-0000-0000-0000-000000000000"}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="setup-block">
          <h3>{formatTitle("Setup")}</h3>
          <p>
            This app requires each group member to install a runelite plugin from the Plugin Hub in order to track
            player information. Find it by searching "<span className="emphasize">GIM hub</span>" in the Runelite
            client.
          </p>
        </div>

        <div id="setup-config">
          <p>
            Use the provided credentials to fill in the <span className="emphasize">Group Config</span> section in the
            plugin's configuration.
          </p>
          <CachedImage alt="GIM Hub Runelite plugin screenshot" src="/images/plugin-screenshot.png" />
        </div>

        <div id="setup-go-to-group">
          <AppLink href="/group">Go to group</AppLink>
        </div>
      </div>
    </div>
  );
};
