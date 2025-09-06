import type { ReactElement } from "react";
import { CachedImage } from "../cached-image/cached-image";
import "./social-links.css";

export const SocialLinks = (): ReactElement => {
  return (
    <>
      <div id="top-left-links" className="social-links rsbackground rsborder-tiny">
        <a className="homepage-link" href="https://github.com/wouterrutgers/gim-hub.com" title="Github" target="_blank">
          <CachedImage alt="github logo" src="/images/GitHub-Mark-Light-64px.png" height="32" />
          GitHub
        </a>
      </div>

      <div id="bottom-right-links" className="social-links rsbackground rsborder-tiny">
        <a className="homepage-link" href="https://x.com/nin_tan_" title="Logo by @nin_tan_ on X.com" target="_blank">
          <CachedImage alt="x logo" src="/images/x-white.png" height="16" />
          Logo by @nin_tan_
        </a>

        <a
          className="homepage-link"
          href="https://github.com/christoabrown/group-ironmen-tracker"
          title="Original creator's GitHub"
          target="_blank"
        >
          <CachedImage alt="github logo" src="/images/GitHub-Mark-Light-64px.png" height="16" />
          Original creator's GitHub
        </a>
      </div>
    </>
  );
};
