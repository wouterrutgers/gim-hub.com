import { Fragment, type ReactElement } from "react";
import { AppLink } from "../app-link/app-link";
import { useLocation } from "react-router-dom";
import { CachedImage } from "../cached-image/cached-image";

import "./app-navigation.css";

export const AppNavigation = ({ groupName }: { groupName: string }): ReactElement => {
  const location = useLocation();

  const mainLinks = [
    { label: "Items", href: "/group/items", mobileIconSource: "/ui/777-0.png" },
    { label: "Map", href: "/group/map", mobileIconSource: "/ui/1698-0.png" },
    { label: "Graphs", href: "/group/graphs", mobileIconSource: "/ui/3579-0.png" },
    { label: "Panels", href: "/group/panels", mobileIconSource: "/ui/1707-0.png" },
    { label: "Settings", href: "/group/settings", mobileIconSource: "/ui/785-0.png" },
  ];

  const rightAlignedLinks = [
    {
      label: "GitHub",
      href: "https://github.com/wouterrutgers/gim-hub.com",
      mobileIconSource: "/images/GitHub-Mark-Light-64px.png",
      isExternal: true,
    },
    { label: "Setup", href: "/group/setup-instructions", mobileIconSource: "/ui/1094-0.png" },
    { label: "Logout", href: "/logout", mobileIconSource: "/ui/225-0.png" },
  ];

  const renderLinks = (
    links: { label: string; href: string; mobileIconSource: string; isExternal?: boolean }[],
  ): ReactElement[] =>
    links.map(({ label, href, mobileIconSource, isExternal }) => (
      <Fragment key={label}>
        <span className="desktop">
          {isExternal ? (
            <a href={href} target="_blank" rel="noopener noreferrer" className="app-link men-button">
              <CachedImage alt={label} src={mobileIconSource} height="16" style={{ marginRight: "8px" }} />
              {label}
            </a>
          ) : (
            <AppLink href={href} selected={location.pathname === href}>
              {label}
            </AppLink>
          )}
        </span>
        <span className="mobile">
          {isExternal ? (
            <a href={href} target="_blank" rel="noopener noreferrer" className="app-link men-button">
              <CachedImage alt={label} src={mobileIconSource} />
            </a>
          ) : (
            <AppLink href={href} selected={location.pathname === href}>
              <CachedImage alt={label} src={mobileIconSource} />
            </AppLink>
          )}
        </span>
      </Fragment>
    ));

  const elements = [
    ...renderLinks(mainLinks),
    <span key="spacer" id="app-navigation-spacer" className="desktop" />,
    ...renderLinks(rightAlignedLinks),
  ];

  return (
    <div id="app-navigation" className="rsborder-tiny rsbackground">
      <h4 id="app-navigation-group-name">{groupName}</h4>
      <nav id="app-navigation-nav">{elements}</nav>
    </div>
  );
};
