import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { type ReactElement } from "react";
import { UnauthedLayout, AuthedLayout } from "../layout/layout";
import { Homepage } from "../homepage/homepage";
import { SetupInstructions } from "../setup-instructions/setup-instructions";
import { LoginPage } from "../login-page/login-page";
import { LogoutPage } from "../logout-page/logout-page";
import { CanvasMap } from "../canvas-map/canvas-map";
import { ItemsPage } from "../items-page/items-page";
import { Tooltip } from "../tooltip/tooltip";
import { PanelsPage } from "../panels-page/panels-page";
import { SkillGraph } from "../skill-graph/skill-graph";
import { CreateGroupPage } from "../create-group-page/create-group-page";
import { SettingsPage } from "../settings/settings";

import "./app.css";

export const App = (): ReactElement => {
  const location = useLocation();

  return (
    <>
      <CanvasMap interactive={location.pathname === "/group/map"} />
      <Routes>
        <Route
          index
          element={
            <UnauthedLayout>
              <Homepage />
            </UnauthedLayout>
          }
        />
        <Route
          path="/create-group"
          element={
            <UnauthedLayout>
              <CreateGroupPage />
            </UnauthedLayout>
          }
        />
        <Route
          path="/setup-instructions"
          element={
            <UnauthedLayout>
              <SetupInstructions />
            </UnauthedLayout>
          }
        />
        <Route
          path="/login"
          element={
            <UnauthedLayout>
              <LoginPage />
            </UnauthedLayout>
          }
        />
        <Route path="/logout" element={<LogoutPage />} />
        <Route path="/group">
          <Route index element={<Navigate to="items" replace />} />
          <Route
            path="items"
            element={
              <AuthedLayout showPanels={true}>
                <ItemsPage />
              </AuthedLayout>
            }
          />
          <Route path="map" element={<AuthedLayout showPanels={true} />} />
          <Route
            path="graphs"
            element={
              <AuthedLayout showPanels={true}>
                <SkillGraph />
              </AuthedLayout>
            }
          />
          <Route
            path="panels"
            element={
              <AuthedLayout showPanels={false}>
                <PanelsPage />
              </AuthedLayout>
            }
          />
          <Route
            path="settings"
            element={
              <AuthedLayout showPanels={true}>
                <SettingsPage />
              </AuthedLayout>
            }
          />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Tooltip />
    </>
  );
};
