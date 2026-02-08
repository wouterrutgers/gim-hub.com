import { useContext, useEffect, useState, type ReactElement } from "react";
import { Context as APIContext } from "../../context/api-context";
import { AuthedLayout, UnauthedLayout } from "../layout/layout";
import { ChangelogPage } from "./changelog-page";

export const ChangelogRoute = (): ReactElement => {
  const { api, logInLive } = useContext(APIContext) ?? {};
  const [loginAttempted, setLoginAttempted] = useState(false);

  useEffect(() => {
    if (api || loginAttempted || !logInLive) return;

    logInLive()
      .catch(() => undefined)
      .finally(() => setLoginAttempted(true));
  }, [api, loginAttempted, logInLive]);

  const loggedIn = !!api;
  const page = <ChangelogPage backHref={loggedIn ? "/group" : "/"} backLabel={loggedIn ? "Go to group" : "Back"} />;

  return loggedIn ? <AuthedLayout showPanels={false}>{page}</AuthedLayout> : <UnauthedLayout>{page}</UnauthedLayout>;
};
