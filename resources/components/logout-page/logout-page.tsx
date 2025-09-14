import { useNavigate } from "react-router-dom";
import { useContext, useEffect, type ReactElement } from "react";
import { Context as APIContext } from "../../context/api-context";

export const LogoutPage = (): ReactElement => {
  const { logOut } = useContext(APIContext) ?? {};
  const navigate = useNavigate();

  useEffect(() => {
    if (!logOut) return;

    logOut();
    void navigate("/");
  }, [logOut, navigate]);

  return <></>;
};
