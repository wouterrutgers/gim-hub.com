import { AppLink } from "../app-link/app-link";
import { SocialLinks } from "../social-links/social-links.tsx";
import { CachedImage } from "../cached-image/cached-image";
import { useContext, type ReactElement } from "react";
import { Context as APIContext } from "../../context/api-context.tsx";

import "./homepage.css";

export const Homepage = (): ReactElement => {
  const { credentials } = useContext(APIContext);
  const hasLogin = !!credentials;

  const groupLink = <AppLink href="/group">Go to group</AppLink>;
  const loginLink = <AppLink href="/login">Login</AppLink>;

  return (
    <div id="homepage">
      <SocialLinks />
      <CachedImage className="logo" alt="GIM hub" src="/images/logo.png" />
      <div id="homepage-links">
        <AppLink href="/create-group">Get started</AppLink>
        {hasLogin ? groupLink : loginLink}
      </div>
    </div>
  );
};
