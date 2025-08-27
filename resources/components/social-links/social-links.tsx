import type { ReactElement } from "react";
import { CachedImage } from "../cached-image/cached-image";
import "./social-links.css";

export const SocialLinks = (): ReactElement => {
  return (
    <>
      <ul id="social-links">
        <li>
          <a href="https://github.com/wouterrutgers/gim-hub.com" title="Github" target="_blank">
            <div>
              <CachedImage alt="github logo" loading="lazy" src="/images/github-light.webp" height="20" />
            </div>
            GIM hub GitHub
          </a>
        </li>
      </ul>

      <a
        id="original-creator-link"
        href="https://github.com/christoabrown/group-ironmen-tracker"
        title="Original creator's GitHub"
        target="_blank"
      >
        <div>
          <CachedImage alt="github logo" loading="lazy" src="/images/github-light.webp" height="16" />
        </div>
        Original creator's GitHub
      </a>
    </>
  );
};
