import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { type ReactElement, Suspense, lazy } from "react";
import { UnauthedLayout, AuthedLayout } from "../layout/layout";
import { LoadingScreen } from "../loading-screen/loading-screen";
import { Tooltip } from "../tooltip/tooltip";
import { DemoPage } from "../demo-page/demo-page";

// Lazy load components that are not immediately needed
const Homepage = lazy(() => import("../homepage/homepage").then((m) => ({ default: m.Homepage })));
const SetupInstructions = lazy(() =>
  import("../setup-instructions/setup-instructions").then((m) => ({ default: m.SetupInstructions })),
);
const LoginPage = lazy(() => import("../login-page/login-page").then((m) => ({ default: m.LoginPage })));
const LogoutPage = lazy(() => import("../logout-page/logout-page").then((m) => ({ default: m.LogoutPage })));
const CanvasMap = lazy(() => import("../canvas-map/canvas-map").then((m) => ({ default: m.CanvasMap })));
const ItemsPage = lazy(() => import("../items-page/items-page").then((m) => ({ default: m.ItemsPage })));
const PanelsPage = lazy(() => import("../panels-page/panels-page").then((m) => ({ default: m.PanelsPage })));
const SkillGraph = lazy(() => import("../skill-graph/skill-graph").then((m) => ({ default: m.SkillGraph })));
const CreateGroupPage = lazy(() =>
  import("../create-group-page/create-group-page").then((m) => ({ default: m.CreateGroupPage })),
);
const SettingsPage = lazy(() => import("../settings/settings").then((m) => ({ default: m.SettingsPage })));

import "./app.css";

export const App = (): ReactElement => {
  const location = useLocation();

  return (
    <>
      <Suspense fallback={<></>}>
        <CanvasMap interactive={location.pathname === "/group/map"} />
      </Suspense>
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route
            index
            element={
              <UnauthedLayout>
                <Homepage />
              </UnauthedLayout>
            }
          />
          <Route path="/demo" element={<DemoPage />} />
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
              path="setup-instructions"
              element={
                <AuthedLayout showPanels={false} hideHeader>
                  <SetupInstructions />
                </AuthedLayout>
              }
            />
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
      </Suspense>
      <Tooltip />
    </>
  );
};
