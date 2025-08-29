import type { ReactElement, ReactNode } from "react";
import { Link as RouterLink } from "react-router";

import "./app-link.css";

export interface AppLinkProps {
  children: ReactNode;
  href: string;
  selected?: boolean;
  className?: string;
}

export const AppLink = (props: AppLinkProps): ReactElement => {
  return (
    <RouterLink
      className={`app-link men-button ${props.selected ? "active" : ""} ${props.className ?? ""}`}
      to={props.href}
    >
      {props.children}
    </RouterLink>
  );
};
