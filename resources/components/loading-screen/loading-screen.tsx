import type { ReactElement } from "react";

import "./loading-screen.css";

export const LoadingScreen = (): ReactElement => {
  return (
    <div className="loader-shell">
      <div className="loader" aria-hidden="true">
        <div></div>
        <div></div>
        <div></div>
        <div></div>
      </div>
    </div>
  );
};
