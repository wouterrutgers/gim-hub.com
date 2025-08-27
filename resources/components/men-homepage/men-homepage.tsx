import { MenLink } from "../men-link/men-link.tsx";
import { SocialLinks } from "../social-links/social-links.tsx";
import { CachedImage } from "../cached-image/cached-image";
import { useContext, type ReactElement } from "react";
import { Context as APIContext } from "../../context/api-context.tsx";

import "./men-homepage.css";

export const MenHomepage = (): ReactElement => {
  const { credentials } = useContext(APIContext);
  const hasLogin = !!credentials;

  const groupLink = <MenLink href="/group">Go to group</MenLink>;
  const loginLink = <MenLink href="/login">Login</MenLink>;

  return (
    <div id="men-homepage">
      <SocialLinks />
      <CachedImage className="logo" alt="GIM hub" src="/images/logo.png" />
      <div id="men-homepage-links">
        <MenLink href="/create-group">Get started</MenLink>
        {hasLogin ? groupLink : loginLink}
      </div>
    </div>
  );
};
