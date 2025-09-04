import { useContext, useEffect, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Context as APIContext } from "../../context/api-context";

export const DemoPage = (): ReactNode => {
  const { logInDemo } = useContext(APIContext) ?? {};
  const navigate = useNavigate();

  useEffect(() => {
    if (!logInDemo) return;

    logInDemo()
      .then((successful) => {
        if (!successful) return;

        return navigate("/group/items", { replace: true });
      })
      .catch((reason) => {
        console.error("DemoPage: Error while redirecting:", reason);
      });
  }, [logInDemo, navigate]);

  return <></>;
};
