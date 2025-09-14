import {
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import Api from "../../api/api";
import { Context as APIContext } from "../../context/api-context";
import { useNavigate } from "react-router-dom";
import * as z from "zod/v4";
import { LoadingScreen } from "../loading-screen/loading-screen";

import "./login-page.css";

const NameSchema = z
  .string("Name is required.")
  .transform((name) => name.trim())
  .refine((name) => name.length > 0, {
    error: "Name is required.",
  });

const TokenSchema = z
  .string("Token is required.")
  .transform((name) => name.trim())
  .refine((name) => name.length > 0, {
    error: "Token is required.",
  });

export const LoginPage = (): ReactElement => {
  const { logInLive } = useContext(APIContext) ?? {};
  const [nameError, setNameError] = useState<string[]>();
  const [tokenError, setTokenError] = useState<string[]>();
  const [serverError, setServerError] = useState<string[]>();
  const [pendingSubmission, setPendingSubmission] = useState<boolean>(false);
  const navigate = useNavigate();

  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const watchReset = (e: Event): void => {
      e.preventDefault();
    };
    const form = formRef.current;
    if (!form) return;

    form.addEventListener("reset", watchReset);

    return (): void => {
      form.removeEventListener("reset", watchReset);
    };
  }, []);

  useEffect(() => {
    if (!logInLive) return;

    logInLive()
      .then(() => {
        return navigate("/group/items", { replace: true });
      })
      .catch((reason) => {
        console.error("LoginPage: Error while redirecting:", reason);
      });
  }, [logInLive, navigate]);

  const tryLogin = useCallback(
    (formData: FormData): void => {
      const groupNameParsed = NameSchema.safeParse(formData.get("login-group-name")?.valueOf());
      const groupTokenParsed = TokenSchema.safeParse(formData.get("login-group-token")?.valueOf());

      setServerError(undefined);

      if (!groupNameParsed.success || !groupTokenParsed.success) {
        if (!groupNameParsed.success) {
          setNameError(z.flattenError(groupNameParsed.error).formErrors);
        }
        if (!groupTokenParsed.success) {
          setTokenError(z.flattenError(groupTokenParsed.error).formErrors);
        }
        return;
      }

      const credentials = { name: groupNameParsed.data, token: groupTokenParsed.data };

      if (!logInLive) {
        console.error("LoginPage: LogInLive was undefined, but form was still submitted.");
        return;
      }

      setPendingSubmission(true);
      setNameError(undefined);
      setTokenError(undefined);
      Api.fetchAmILoggedIn(credentials)
        .then((response) => new Promise<typeof response>((resolve) => setTimeout(() => resolve(response), 500)))
        .then((response) => {
          if (response.ok) {
            return logInLive(credentials).then(() => navigate("/group"));
          }

          if (response.status === 401) {
            setServerError(["Name or token is invalid."]);
            return;
          }

          throw new Error(`Unexpected status code: ${response.status}`);
        })
        .catch((reason) => {
          console.error("LoginPage: Error during form submission:", reason);
        })
        .finally(() => {
          setPendingSubmission(false);
        });
    },
    [navigate, logInLive],
  );

  const serverErrorsElement = ((): ReactNode => {
    if ((serverError?.length ?? 0) < 1) {
      return undefined;
    }

    return (
      <div className="validation-error">
        {serverError?.map((string, index) => (
          <Fragment key={string}>
            {index > 0 ? <br /> : undefined}
            {string}
          </Fragment>
        ))}
      </div>
    );
  })();

  const pendingOverlay = pendingSubmission ? (
    <div id="login-page-loading-overlay">
      <LoadingScreen />
    </div>
  ) : undefined;

  const pending = pendingSubmission || !logInLive;
  return (
    <div id="login-page-container">
      <form ref={formRef} id="login-page-window" className="rsborder rsbackground" action={tryLogin}>
        <div className="login-page-step">
          <label htmlFor="login-group-name">Group name</label>
          <br />
          <input
            aria-required
            id="login-group-name"
            className={nameError ? "invalid" : "valid"}
            name="login-group-name"
            placeholder="Group name"
            maxLength={16}
          />
          <div className="validation-error">
            {nameError?.map((error, index) => (
              <Fragment key={error}>
                {index > 0 ? <br /> : undefined}
                {error}
              </Fragment>
            ))}
          </div>
        </div>
        <div className="login-page-step">
          <label htmlFor="login-group-token">Group token</label>
          <br />
          <input
            aria-required
            id="login-group-token"
            className={tokenError ? "invalid" : "valid"}
            name="login-group-token"
            placeholder="Group token"
            maxLength={60}
            type="password"
          />
          <div className="validation-error">
            {tokenError?.map((error, index) => (
              <Fragment key={error}>
                {index > 0 ? <br /> : undefined}
                {error}
              </Fragment>
            ))}
          </div>
        </div>
        <button disabled={pending} id="login-page-submit" className="men-button" type="submit">
          Login
        </button>
        {serverErrorsElement}
        {pendingOverlay}
      </form>
    </div>
  );
};
