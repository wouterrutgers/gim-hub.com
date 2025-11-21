import type { ReactElement } from "react";
import { CachedImage } from "../cached-image/cached-image";
import { formatTitle } from "../../ts/format-title";
import "./social-links.css";

export const SocialLinks = (): ReactElement => {
  return (
    <>
      <div id="top-left-links">
        <div className="social-links rsbackground rsborder-tiny">
          <a
            className="homepage-link"
            href="https://github.com/wouterrutgers/gim-hub.com"
            title={formatTitle("GitHub")}
            target="_blank"
          >
            <CachedImage alt={formatTitle("GitHub logo")} src="/images/GitHub-Mark-Light-64px.png" height="24" />
            {formatTitle("GitHub")}
          </a>
        </div>
        <div className="social-links rsbackground rsborder-tiny">
          <a
            className="homepage-link"
            href="https://discord.gg/ZwzW6yYD8V"
            title={formatTitle("Discord")}
            target="_blank"
          >
            <CachedImage alt={formatTitle("Discord logo")} src="/images/discord-light.png" height="24" />
            {formatTitle("Discord")}
          </a>
        </div>
      </div>

      <div id="bottom-right-links">
        <div className="social-links rsbackground rsborder-tiny">
          <a
            className="homepage-link"
            href="https://x.com/nin_tan_"
            title={formatTitle("Logo by @nin_tan_ on X.com")}
            target="_blank"
          >
            <CachedImage alt={formatTitle("X logo")} src="/images/x-white.png" height="16" />
            {formatTitle("Logo by @nin_tan_")}
          </a>
        </div>

        <div className="social-links rsbackground rsborder-tiny">
          <a
            className="homepage-link"
            href="https://github.com/christoabrown/group-ironmen-tracker"
            title={formatTitle("Original creator's GitHub")}
            target="_blank"
          >
            <CachedImage alt={formatTitle("GitHub logo")} src="/images/GitHub-Mark-Light-64px.png" height="16" />
            {formatTitle("Original creator's GitHub")}
          </a>
        </div>
      </div>
    </>
  );
};
