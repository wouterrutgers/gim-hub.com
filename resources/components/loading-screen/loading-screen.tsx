import type { ReactElement } from "react";

import "./loading-screen.css";

export const LoadingScreen = (): ReactElement => (
  <div className="loader">
    <div></div>
    <div></div>
    <div></div>
    <div></div>
  </div>
);
