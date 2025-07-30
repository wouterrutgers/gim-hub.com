import { Navigate } from "react-router-dom";
import { useContext, useEffect, type ReactElement } from "react";
import { Context as APIContext } from "../../context/api-context";

export const LogoutPage = (): ReactElement => {
  const { logOut } = useContext(APIContext);

  useEffect(() => {
    logOut?.();
  }, [logOut]);

  return <Navigate to="/" />;
};
