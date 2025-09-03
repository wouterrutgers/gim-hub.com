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
  const { logIn, credentials } = useContext(APIContext);
  const [nameError, setNameError] = useState<string[]>();
  const [tokenError, setTokenError] = useState<string[]>();
  const [serverError, setServerError] = useState<string[]>();
  const [pending, setPending] = useState<boolean>(false);
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
    if (credentials === undefined) return;

    console.info("Found valid credentials, redirecting...");
    void navigate("/group");
  }, [credentials, navigate]);

  const tryLogin = useCallback(
    async (formData: FormData): Promise<void> => {
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

      setNameError(undefined);
      setTokenError(undefined);
      return Api.fetchAmILoggedIn(credentials)
        .then((response) => new Promise<typeof response>((resolve) => setTimeout(() => resolve(response), 500)))
        .then((response) => {
          if (response.ok) {
            logIn?.(credentials);
            void navigate("/group");
            return;
          }

          if (response.status === 401) {
            setServerError(["Name or token is invalid."]);
            return;
          }

          throw new Error(`Unexpected status code: ${response.status}`);
        });
    },
    [navigate, logIn],
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

  const pendingOverlay = pending ? (
    <div id="login-page-loading-overlay">
      <LoadingScreen />
    </div>
  ) : undefined;

  return (
    <div id="login-page-container">
      <form
        ref={formRef}
        id="login-page-window"
        className="rsborder rsbackground"
        action={(formData) => {
          setPending(true);
          void tryLogin(formData)
            .catch((reason) => {
              setServerError(["Unknown error."]);
              console.error("login-page login failed:", reason);
            })
            .finally(() => {
              setPending(false);
            });
        }}
      >
        <div className="login-page-step">
          <label htmlFor="login-group-name">Group Name</label>
          <br />
          <input
            aria-required
            id="login-group-name"
            className={nameError ? "invalid" : "valid"}
            name="login-group-name"
            placeholder="Group Name"
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
          <label htmlFor="login-group-token">Group Token</label>
          <br />
          <input
            aria-required
            id="login-group-token"
            className={tokenError ? "invalid" : "valid"}
            name="login-group-token"
            placeholder="Group Token"
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
