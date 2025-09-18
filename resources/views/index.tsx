import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "../components/app/app";
import { APIProvider } from "../context/api-context";
import { GameDataProvider } from "../context/game-data-context";
import { SettingsProvider } from "../context/settings-context";
import { GroupProvider } from "../context/group-context";
import { ImageProvider } from "../context/image-provider";

import "../api/fetch-with-csrf";

const root = document.getElementById("root")!;

createRoot(root).render(
  <StrictMode>
    <APIProvider>
      <ImageProvider>
        <GameDataProvider>
          <GroupProvider>
            <SettingsProvider>
              <BrowserRouter>
                <App />
              </BrowserRouter>
            </SettingsProvider>
          </GroupProvider>
        </GameDataProvider>
      </ImageProvider>
    </APIProvider>
  </StrictMode>,
);
