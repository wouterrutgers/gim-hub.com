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
import * as Member from "../../game/member";
import type { GroupCredentials } from "../../api/credentials";
import z from "zod/v4";

import "./create-group-page.css";
import { LoadingScreen } from "../loading-screen/loading-screen";

/**
 * This page is where users can submit initial name and members for a group.
 */

const GroupNameSchema = z
  .string("Group name is required.")
  .refine((name) => name === name.trim(), { error: "Group name cannot begin or end with spaces." })
  .refine((name) => !/[^A-Za-z 0-9-_]/g.test(name), {
    error: "Group name must use characters 'A-Z', 'a-z', '0-9', and '-', '_', or ' '.",
  })
  .refine((name) => name.length >= 1 && name.length <= 16, {
    error: ({ input }) => {
      if ((input as string).length === 0) return "Group name is required.";
      return "Group name must be between 1 and 16 characters.";
    },
  })
  .transform((name) => name.trim());

export const MemberNameSchema = z
  .string("Member name is required.")
  .refine((name) => name === name.trim(), { error: "Member name cannot begin or end with spaces." })
  .refine((name) => !/[^A-Za-z 0-9-_]/g.test(name), {
    error: "Member name must use only characters 'A-Z', 'a-z', '0-9', and '-', '_', or ' '.",
  })
  .refine((name) => !/[ \-_]{2,}/g.test(name), {
    error: "Member name cannot contain more than 2 special characters '-', '_', or ' ' in a row.",
  })
  .refine((name) => name.length >= 1 && name.length <= 16, {
    error: ({ input }) => {
      if ((input as string).length === 0) return "Member name is required.";
      return "Member name must be between 1 and 16 characters.";
    },
  })
  .transform((name) => name.trim() as Member.Name);

const MemberNamesSchema = MemberNameSchema.array().nonempty();
const MemberCountSchema = z
  .string("Group size is required.")
  .transform((count) => parseInt(count))
  .refine((count) => Number.isSafeInteger(count))
  .refine((count) => count >= 2 && count <= 5, { error: "Group size must be between 2 and 5." });

type FormSubmissionResult =
  | {
      type: "Pending";
      groupNameErrors?: string[];
      memberErrors?: string[][];
      memberCountErrors?: string[];
      serverErrors?: string[];
    }
  | {
      type: "Success";
      credentials: GroupCredentials;
    };

const createGroupFormAction = async (formData: FormData): Promise<FormSubmissionResult> => {
  const groupNameRaw = formData.get("group-name");
  const memberNamesRaw = formData.getAll("member-name");
  const memberCountRaw = formData.get("group-member-count");

  const groupNameParsed = GroupNameSchema.safeParse(groupNameRaw);
  const memberCountParsed = MemberCountSchema.safeParse(memberCountRaw);
  const memberNamesParsed = MemberNamesSchema.safeParse(memberNamesRaw);

  if (!groupNameParsed.success || !memberCountParsed.success || !memberNamesParsed.success) {
    const errorResult: FormSubmissionResult = { type: "Pending" };
    if (!groupNameParsed.success) {
      errorResult.groupNameErrors = z.flattenError(groupNameParsed.error).formErrors;
    }
    if (!memberCountParsed.success) {
      errorResult.memberCountErrors = z.flattenError(memberCountParsed.error).formErrors;
    }
    if (!memberNamesParsed.success) {
      errorResult.memberErrors = Array(memberNamesRaw.length).fill([]);
      const members = z.treeifyError(memberNamesParsed.error).items;
      for (let i = 0; i < errorResult.memberErrors.length; i++) {
        const errors = members?.at(i)?.errors;
        if (!errors) continue;

        errorResult.memberErrors[i] = errors;
      }
    }

    return errorResult;
  }

  return Api.fetchCreateGroup(groupNameParsed.data, memberNamesParsed.data)
    .then((response) => new Promise<typeof response>((resolve) => setTimeout(() => resolve(response), 500)))
    .then((credentials) => {
      return { type: "Success", credentials } satisfies FormSubmissionResult;
    })
    .catch((reason) => {
      const error = reason instanceof Error ? reason.message : "Unknown error";
      return { type: "Pending", serverErrors: [error] };
    });
};

export const CreateGroupPage = (): ReactElement => {
  const navigate = useNavigate();
  const { logIn } = useContext(APIContext);
  const [memberCount, setMemberCount] = useState<number | undefined>(undefined);
  const [pending, setPending] = useState(false);
  const [formState, setFormState] = useState<FormSubmissionResult>({ type: "Pending" });

  const action = useCallback(
    (formData: FormData) => {
      setPending(true);
      if (formState?.type === "Pending") {
        setFormState({ ...formState, serverErrors: undefined });
      }
      createGroupFormAction(formData)
        .then((result) => {
          setFormState(result);
        })
        .catch((reason) => {
          console.error("Unexpected error during form submission:", reason);
        })
        .finally(() => {
          setPending(false);
        });
    },
    [formState],
  );

  /*
   * Intercept form reset, since for specifically <select> components, both
   * defaultValue and value are ignored upon the reset that occurs during form
   * submission.
   */
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
    if (formState?.type !== "Success") return;

    const credentials = formState.credentials;

    logIn?.(credentials);
    void navigate("/setup-instructions");
  }, [formState, navigate, logIn]);

  const groupNameInput = ((): ReactElement => {
    const groupNameErrors = formState?.type === "Pending" ? formState.groupNameErrors : undefined;
    const invalid = (groupNameErrors?.length ?? 0) > 0;

    return (
      <>
        <label htmlFor="create-group-group-name">Group name</label>
        <br />
        <input
          id="create-group-group-name"
          name="group-name"
          className={invalid ? "invalid" : "valid"}
          placeholder="Group name"
          maxLength={16}
        />
        <div className="validation-error">
          {groupNameErrors?.map((error, index) => (
            <Fragment key={error}>
              {index > 0 ? <br /> : undefined}
              {error}
            </Fragment>
          ))}
        </div>
      </>
    );
  })();

  const memberCountDropdown = ((): ReactElement => {
    const memberCountErrors = formState?.type === "Pending" ? formState.memberCountErrors : undefined;
    const invalid = (memberCountErrors?.length ?? 0) > 0;

    return (
      <>
        <label htmlFor="group-member-count">Group size</label>
        <br />
        <div className={`select-container rsborder-tiny rsbackground ${invalid ? "invalid" : "valid"}`}>
          <select
            id="group-member-count"
            name="group-member-count"
            defaultValue={0}
            onChange={({ target }) => {
              const newMemberCount = parseInt(target.options[target.selectedIndex].value);
              if (!Number.isSafeInteger(newMemberCount) || newMemberCount === memberCount) return;
              if (formState.type === "Pending") {
                const minSize = Math.min(memberCount ?? 0, newMemberCount);
                setFormState({ ...formState, memberErrors: formState.memberErrors?.slice(0, minSize) });
              }
              setMemberCount(newMemberCount);
            }}
          >
            <option value={0} disabled>
              Select an option
            </option>
            <option value={2}>2 Members</option>
            <option value={3}>3 Members</option>
            <option value={4}>4 Members</option>
            <option value={5}>5 Members</option>
          </select>
        </div>
        <div className="validation-error">
          {memberCountErrors?.map((error, index) => (
            <Fragment key={error}>
              {index > 0 ? <br /> : undefined}
              {error}
            </Fragment>
          ))}
        </div>
      </>
    );
  })();

  const memberNameInputs = [...Array(memberCount ?? 0).entries()].map((_, index) => {
    const errors = formState?.type === "Pending" ? formState?.memberErrors?.at(index) : undefined;
    const invalid = (errors?.length ?? 0) > 0;

    return (
      <Fragment key={index}>
        <label htmlFor={`create-group-member-name-${index}`}>Name for Member {index + 1}</label>
        <br />
        <input
          aria-required
          id={`create-group-member-name-${index}`}
          className={invalid ? "invalid" : "valid"}
          placeholder="Member name"
          name="member-name"
          maxLength={16}
        />
        <div className="validation-error">
          {errors?.map((string, index) => (
            <Fragment key={string}>
              {index > 0 ? <br /> : undefined}
              {string}
            </Fragment>
          ))}
        </div>
      </Fragment>
    );
  });

  const serverErrorsElement = ((): ReactNode => {
    if (formState.type !== "Pending" || (formState.serverErrors?.length ?? 0) < 1) return undefined;
    const errors = formState.serverErrors;
    return (
      <div className="validation-error">
        {" "}
        {errors?.map((string, index) => (
          <Fragment key={string}>
            {index > 0 ? <br /> : undefined}
            {string}
          </Fragment>
        ))}
      </div>
    );
  })();

  const pendingOverlay = pending ? (
    <div id="create-group-loading-overlay">
      <LoadingScreen />
    </div>
  ) : undefined;

  return (
    <div id="create-group-container">
      <form ref={formRef} id="create-group-window" className="rsborder rsbackground" action={action}>
        <div>
          <h3>Pick a name for your group</h3>
          <p>
            This does <span className="emphasize">not</span> need to be the in-game name.
          </p>
          {groupNameInput}
        </div>
        <div>
          <h3>What size is the group?</h3>
          <p>This can be changed later.</p>
          {memberCountDropdown}
        </div>
        {memberNameInputs.length > 0 ? (
          <div>
            <h3>Enter each members' name</h3>
            <p>
              This <span className="emphasize">does</span> need to match the in-game name. (Can be changed later)
            </p>
            {memberNameInputs}
          </div>
        ) : undefined}
        <button disabled={pending} className="men-button" type="submit">
          Create group
        </button>
        {serverErrorsElement}
        {pendingOverlay}
      </form>
    </div>
  );
};
