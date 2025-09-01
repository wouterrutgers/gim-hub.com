import { Fragment, useCallback, useContext, useEffect, useRef, useState, type ReactElement } from "react";
import * as SiteSettings from "../../context/settings-context";
import { Context as APIContext } from "../../context/api-context";
import * as Member from "../../game/member";
import { MemberNameSchema } from "../create-group-page/create-group-page";
import z from "zod/v4";
import { LoadingScreen } from "../loading-screen/loading-screen";
import { PlayerIcon } from "../player-icon/player-icon";
import { useModal } from "../modal/modal";
import { GroupMemberNamesContext } from "../../context/group-context";

import "./settings.css";

const labels: Record<SiteSettings.SiteTheme | SiteSettings.SidebarPosition, string> = {
  light: "Light",
  dark: "Dark",
  left: "Dock panels to the left",
  right: "Dock panels to the right",
};

const RemoveConfirmationWindow = ({
  member,
  onConfirm,
  onCloseModal,
}: {
  member: Member.Name;
  onConfirm: () => void;
  onCloseModal: () => void;
}): ReactElement => {
  const [input, setInput] = useState<string>();

  const inputMatchesMember = input?.trim() === member;

  return (
    <div id="group-settings-remove-confirmation" className="rsbackground rsborder">
      <h1>
        Delete
        <PlayerIcon name={member} />
        {member}?
      </h1>
      <p>All player data will be lost and cannot be recovered.</p>
      <label htmlFor="group-settings-remove-confirmation-input">
        Please type "{member}" below to proceed with deletion.
      </label>
      <br />
      <input
        id="group-settings-remove-confirmation-input"
        onChange={(e) => {
          setInput(e.target.value);
        }}
      />
      <button
        disabled={!inputMatchesMember}
        onClick={() => {
          if (!inputMatchesMember) return;

          onConfirm();
          onCloseModal();
        }}
        className="group-settings-member-remove men-button small"
      >
        Yes, delete {member} from the group.
      </button>
      <button onClick={onCloseModal} className="men-button small">
        No, do not delete {member}.
      </button>
    </div>
  );
};

const EditMemberInput = ({ member }: { member: Member.Name }): ReactElement => {
  const nameInputRef = useRef<HTMLInputElement>(null);
  const id = `edit-member-${member}`;
  const [pendingRename, setPendingRename] = useState<string | undefined>();
  const [pendingDelete, setPendingDelete] = useState(false);
  const [errors, setErrors] = useState<string[]>();
  const { deleteMember, renameMember } = useContext(APIContext);
  const { open, modal: removeConfirmationModal } = useModal(RemoveConfirmationWindow);

  const pending = pendingDelete || !!pendingRename;

  const pendingOverlay = pending ? (
    <div className="group-settings-pending-overlay">
      <LoadingScreen />
    </div>
  ) : undefined;
  useEffect(() => {
    if (member !== pendingRename) return;

    setPendingRename(undefined);
  }, [pendingRename, member]);

  const onRename = useCallback(() => {
    if (pendingRename || !renameMember || !nameInputRef.current) return;

    const newNameParsed = MemberNameSchema.safeParse(nameInputRef.current.value.trim());
    if (!newNameParsed.success) {
      setErrors(z.flattenError(newNameParsed.error).formErrors);
      return;
    }

    const newName = newNameParsed.data;
    if (newName === member) {
      setErrors(["New name must be different than the current one."]);
      return;
    }

    setPendingRename(newName);
    Promise.allSettled([
      renameMember({ oldName: member, newName: newName }),
      new Promise<void>((resolve) =>
        window.setTimeout(() => {
          resolve();
        }, 1000),
      ),
    ])
      .then(([result]) => {
        if (result.status === "rejected") {
          throw result.reason;
        }

        const response = result.value;
        if (response.status === "error") {
          setErrors([response.text]);
          return;
        }

        setErrors(undefined);
      })
      .catch((reason) => {
        console.error("Rename Member Failed:", reason);
        setErrors(["Failed to rename. Is the name already in use?"]);
        setPendingRename(undefined);
      });

    // Don't ever stop pending, since this element should be disappear once the member is renamed.
  }, [pendingRename, member, renameMember]);

  const onRemove = useCallback(() => {
    if (pendingDelete || !deleteMember) return;

    setPendingDelete(true);
    Promise.allSettled([
      deleteMember(member),
      new Promise<void>((resolve) =>
        window.setTimeout(() => {
          resolve();
        }, 1000),
      ),
    ])
      .then(([result]) => {
        if (result.status === "rejected") {
          throw result.reason;
        }

        const response = result.value;
        if (response.status === "error") {
          setErrors([response.text]);
          return;
        }

        setErrors(undefined);
      })
      .catch((reason) => {
        console.error("Delete Member Failed:", reason);
        setErrors(["Unknown error."]);
        setPendingDelete(false);
      });

    // Don't ever stop pending, since this element should be disappear once the member is deleted.
  }, [pendingDelete, deleteMember, member]);

  const errorID = `edit-member-errors-${member}`;
  const invalid = (errors?.length ?? 0) > 0;

  return (
    <div className="group-settings-member-section rsborder-tiny">
      <h3>
        <PlayerIcon name={member} />
        {member}
      </h3>
      <div>
        <label htmlFor={id}>New name</label>
        <br />
        <input
          aria-describedby={errorID}
          disabled={pending}
          ref={nameInputRef}
          id={id}
          className={invalid ? "invalid" : "valid"}
          defaultValue={member}
          maxLength={16}
          onBlur={(e) => {
            e.target.value = e.target.value.trim();
          }}
        />
        <br />
        <div id={errorID} className="validation-error">
          {errors?.map((error, index) => (
            <Fragment key={error}>
              {index > 0 ? <br /> : undefined}
              {error}
            </Fragment>
          ))}
        </div>
      </div>

      <div className="group-settings-member-buttons">
        <button disabled={pending} className="men-button small" onClick={onRename}>
          Rename
        </button>
        <button
          disabled={pending}
          className="group-settings-member-remove men-button small"
          onClick={() => {
            open({ member: member, onConfirm: onRemove });
          }}
        >
          Remove
        </button>
      </div>
      {pendingOverlay}
      {removeConfirmationModal}
    </div>
  );
};

/**
 * A component that contains fields for tweaking site settings such as sidebar position, and group settings like member names.
 */
export const SettingsPage = (): ReactElement => {
  const { siteTheme, setSiteTheme, sidebarPosition, setSidebarPosition } = useContext(SiteSettings.SettingsContext);
  const members = useContext(GroupMemberNamesContext);
  const [addMemberErrors, setAddMemberErrors] = useState<string[]>();
  const addMemberInputRef = useRef<HTMLInputElement>(null);
  const { addMember } = useContext(APIContext);
  const [pendingAddMember, setPendingAddMember] = useState(false);

  const pendingOverlay = pendingAddMember ? (
    <div className="group-settings-pending-overlay">
      <LoadingScreen />
    </div>
  ) : undefined;

  const memberElements = [];
  for (const member of members) {
    if (member === "@SHARED") {
      continue;
    }

    memberElements.push(<EditMemberInput member={member} key={`edit-member-${member}`} />);
  }

  const onAdd = useCallback(() => {
    if (pendingAddMember || !addMember || !addMemberInputRef.current) return;

    const nameParsed = MemberNameSchema.safeParse(addMemberInputRef.current.value.trim());
    if (!nameParsed.success) {
      setAddMemberErrors(z.flattenError(nameParsed.error).formErrors);
      return;
    }

    const newMember = nameParsed.data;

    setPendingAddMember(true);
    Promise.all([
      addMember(newMember),
      new Promise<void>((resolve) =>
        window.setTimeout(() => {
          resolve();
        }, 1000),
      ),
    ])
      .then(([response]) => {
        if (response.status === "error") {
          setAddMemberErrors([response.text]);
          return;
        }

        setAddMemberErrors(undefined);
      })
      .catch((reason) => {
        console.error("Add Member Failed:", reason);
        setAddMemberErrors(["Unknown error."]);
      })
      .finally(() => {
        setPendingAddMember(false);
      });
  }, [pendingAddMember, addMember]);

  const MEMBER_COUNT_MAX = 5;
  if (memberElements.length < MEMBER_COUNT_MAX) {
    const invalid = (addMemberErrors?.length ?? 0) > 0;
    memberElements.push(
      <div key="add-new-member-element" className="group-settings-member-section rsborder-tiny">
        <label htmlFor="add-member-input">Name for new member</label>
        <br />
        <input
          aria-describedby="add-member-errors"
          ref={addMemberInputRef}
          disabled={pendingAddMember}
          className={invalid ? "invalid" : "valid"}
          id="add-member-input"
          maxLength={16}
          onBlur={(e) => {
            e.target.value = e.target.value.trim();
          }}
        />
        <br />
        <div id="add-member-errors" className="validation-error">
          {addMemberErrors?.map((error, index) => (
            <Fragment key={error}>
              {index > 0 ? <br /> : undefined}
              {error}
            </Fragment>
          ))}
        </div>
        <button
          disabled={pendingAddMember}
          key="add-member"
          className="edit-member__add men-button small"
          onClick={onAdd}
        >
          Add member
        </button>
        {pendingOverlay}
      </div>,
    );
  }

  return (
    <div id="group-settings-container" className="rsborder rsbackground">
      <h2>Member settings</h2>
      <p>
        These <span className="emphasize">do</span> need to match the in-game names.
      </p>
      {memberElements}
      <h3>Appearance settings</h3>
      <fieldset
        onChange={(e) => {
          const selected = (e.target as Partial<HTMLInputElement>).value;
          const position = SiteSettings.SidebarPosition.find((position) => position === selected);
          if (!position) return;

          setSidebarPosition?.(position);
        }}
      >
        <legend>Player panels</legend>
        {SiteSettings.SidebarPosition.map((position) => {
          return (
            <Fragment key={position}>
              <input
                id={`panel-dock-${position}`}
                value={position}
                type="radio"
                name="panel-dock-side"
                readOnly
                checked={sidebarPosition === position}
              />
              <label htmlFor={`panel-dock-${position}`}>{labels[position]}</label>
            </Fragment>
          );
        })}
      </fieldset>

      <fieldset
        onChange={(e) => {
          const selected = (e.target as Partial<HTMLInputElement>).value;
          const theme = SiteSettings.SiteTheme.find((theme) => theme === selected);
          if (!theme) return;

          setSiteTheme?.(theme);
        }}
      >
        <legend>Style</legend>
        {SiteSettings.SiteTheme.map((theme) => {
          const id = `style-${theme}`;
          return (
            <Fragment key={theme}>
              <input
                id={id}
                readOnly
                value={theme}
                type="radio"
                name="appearance-style"
                checked={siteTheme === theme}
              />
              <label htmlFor={id}>{labels[theme]}</label>
            </Fragment>
          );
        })}
      </fieldset>
    </div>
  );
};
