import { Fragment, useCallback, useContext, useRef, useState, type ReactElement } from "react";
import { SettingsContext } from "../../context/settings-context";
import { SidebarPosition, SiteTheme } from "../../context/settings-types";
import { Context as APIContext } from "../../context/api-context";
import * as Member from "../../game/member";
import { MemberNameSchema } from "../create-group-page/schemas";
import * as z from "zod/v4";
import { LoadingScreen } from "../loading-screen/loading-screen";
import { PlayerIcon } from "../player-icon/player-icon";
import { useModal } from "../modal/modal";
import { GroupMemberColorsContext, GroupMemberNamesContext, memberColorHues } from "../../context/group-context";
import { formatTitle } from "../../ts/format-title";

import "./settings.css";
import { CachedImage } from "../cached-image/cached-image";

const PendingOverlay = ({ show }: { show: boolean }): ReactElement | undefined =>
  show ? (
    <div className="group-settings-pending-overlay">
      <LoadingScreen />
    </div>
  ) : undefined;

const ErrorList = ({ id, errors }: { id: string; errors?: string[] }): ReactElement => (
  <div id={id} className="validation-error">
    {errors?.map((error, index) => (
      <Fragment key={error}>
        {index > 0 ? <br /> : undefined}
        {error}
      </Fragment>
    ))}
  </div>
);

const labels: Record<SiteTheme | SidebarPosition, string> = {
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

  const [pendingRename, setPendingRename] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);

  const [errors, setErrors] = useState<string[]>();
  const { deleteMember, renameMember, updateMemberColor } = useContext(APIContext)?.api ?? {};
  const { colors: allMemberColors, updateColors: updateMemberColors } = useContext(GroupMemberColorsContext);
  const { open, modal: removeConfirmationModal } = useModal(RemoveConfirmationWindow);

  const hueDegrees = allMemberColors.get(member)?.hueDegrees;

  const pending = pendingDelete || !!pendingRename;

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

    setPendingRename(true);
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
          setPendingRename(false);
          return;
        }

        // Don't stop pending on success, since this element should be disappear
        // once the member is renamed. This avoids the pending overlay flashing off early.
        setErrors(undefined);
      })
      .catch((reason) => {
        console.error("Rename Member Failed:", reason);
        setErrors(["Failed to rename. Is the name already in use?"]);
        setPendingRename(false);
      });
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
          setPendingDelete(false);
          return;
        }

        // Don't stop pending on success, since this element should be disappear
        // once the member is deleted. This avoids the pending overlay flashing off early.
        setErrors(undefined);
      })
      .catch((reason) => {
        console.error("Delete Member Failed:", reason);
        setErrors(["Unknown error."]);
        setPendingDelete(false);
      });
  }, [pendingDelete, deleteMember, member]);

  const errorID = `edit-member-errors-${member}`;
  const invalid = (errors?.length ?? 0) > 0;

  return (
    <div className="group-settings-member-section rsborder-tiny">
      <div className="group-settings-member-title">
        <h3>
          <PlayerIcon name={member} />
          {member}
        </h3>
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
      <div className="group-settings-member-name">
        <label htmlFor={id}>New name</label>
        <div className="group-settings-member-name-input">
          <input
            aria-describedby={errorID}
            disabled={pending}
            ref={nameInputRef}
            id={id}
            className={invalid ? "invalid" : "valid"}
            defaultValue={member}
            maxLength={12}
            onBlur={(e) => {
              e.target.value = e.target.value.trim();
            }}
          />
          <button disabled={pending} className="men-button small" onClick={onRename}>
            Rename
          </button>
        </div>
        {errors && errors.length > 0 && <ErrorList id={errorID} errors={errors} />}
      </div>

      <div className="group-settings-member-color">
        <label>Color</label>
        <div
          className="group-settings-member-color-options"
          role="group"
          aria-label="Member color"
        >
          {memberColorHues.map((hue) => {
            const isSelected = hueDegrees === hue;
            const isTaken =
              !isSelected &&
              [...allMemberColors.entries()].some(
                ([otherName, { hueDegrees: h }]) =>
                  h === hue && otherName !== member && otherName !== ("@SHARED" as Member.Name),
              );
            return (
              <button
                key={hue}
                className={`group-settings-member-color-option ${isSelected ? "selected" : ""} ${isTaken ? "taken" : ""}`}
                onClick={() => {
                  if (!updateMemberColor || !updateMemberColors) return;
                  updateMemberColor({ memberName: member, colorHueDegrees: hue })
                    .then((response) => {
                      if (response.status === "error") {
                        return;
                      }
                      const updates: Array<{ name: Member.Name; hueDegrees: number }> = [
                        { name: member, hueDegrees: response.updated.color_hue_degrees },
                      ];
                      if (response.swapped) {
                        updates.push({
                          name: response.swapped.name as Member.Name,
                          hueDegrees: response.swapped.color_hue_degrees,
                        });
                      }
                      updateMemberColors(updates);
                    })
                }}
                aria-pressed={isSelected}
              >
                <CachedImage
                  alt={`Player icon for ${member}`}
                  src="/ui/player-icon.webp"
                  style={{ filter: `hue-rotate(${hue}deg) saturate(100%)` }}
                  width="12"
                  height="15"
                />
              </button>
            );
          })}
        </div>
      </div>

      <PendingOverlay show={pending} />
      {removeConfirmationModal}
    </div>
  );
};

/**
 * A component that contains fields for tweaking site settings such as sidebar position, and group settings like member names.
 */
export const SettingsPage = (): ReactElement => {
  const {
    siteTheme,
    setSiteTheme,
    sidebarPosition,
    setSidebarPosition,
    enableRecentActivity,
    setEnableRecentActivity,
    enableVirtualLevels,
    setEnableVirtualLevels,
    enableSkillProgressBars,
    setEnableSkillProgressBars,
  } = useContext(SettingsContext);
  const members = useContext(GroupMemberNamesContext);
  const [addMemberErrors, setAddMemberErrors] = useState<string[]>();
  const addMemberInputRef = useRef<HTMLInputElement>(null);
  const { addMember } = useContext(APIContext)?.api ?? {};
  const [pendingAddMember, setPendingAddMember] = useState(false);

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
        <div className="group-settings-member-name">
          <label htmlFor="add-member-input">Name for new member</label>
          <div className="group-settings-member-name-input">
            <input
              aria-describedby="add-member-errors"
              ref={addMemberInputRef}
              disabled={pendingAddMember}
              className={invalid ? "invalid" : "valid"}
              id="add-member-input"
              maxLength={12}
              onBlur={(e) => {
                e.target.value = e.target.value.trim();
              }}
            />
            <button
              disabled={pendingAddMember}
              key="add-member"
              className="edit-member__add men-button small"
              onClick={onAdd}
            >
              Add member
            </button>
          </div>
        </div>
        {invalid && <ErrorList id="add-member-errors" errors={addMemberErrors} />}

        <PendingOverlay show={pendingAddMember} />
      </div>,
    );
  }

  return (
    <div id="settings-page">
      <div className="group-settings-container rsborder rsbackground">
        <h2>{formatTitle("Member settings")}</h2>
        <div>
          These <span className="emphasize">do</span> need to match the in-game names.
        </div>
        {memberElements}
      </div>

      <div className="group-settings-container rsborder rsbackground">
        <h2>{formatTitle("Appearance settings")}</h2>
        <fieldset
          onChange={(e) => {
            const selected = (e.target as Partial<HTMLInputElement>).value;
            const position = SidebarPosition.find((position) => position === selected);
            if (!position) return;

            setSidebarPosition?.(position);
          }}
        >
          <legend>{formatTitle("Player panels")}</legend>
          {SidebarPosition.map((position) => {
            return (
              <div className="settings-page-radio-item" key={position}>
                <input
                  id={`panel-dock-${position}`}
                  value={position}
                  type="radio"
                  readOnly
                  checked={sidebarPosition === position}
                />
                <label htmlFor={`panel-dock-${position}`}>{labels[position]}</label>
              </div>
            );
          })}

          <fieldset className="setting-group">
            <legend className="setting-title">Skills</legend>
            <div className="settings-page-radio-item">
              <input
                id="enable-virtual-levels-input"
                type="checkbox"
                checked={enableVirtualLevels}
                onChange={(e) => setEnableVirtualLevels?.(e.target.checked)}
              />
              <label htmlFor="enable-virtual-levels-input">Show virtual levels</label>
            </div>
            <div className="settings-page-radio-item">
              <input
                id="enable-skill-progress-bars-input"
                type="checkbox"
                checked={enableSkillProgressBars}
                onChange={(e) => setEnableSkillProgressBars?.(e.target.checked)}
              />
              <label htmlFor="enable-skill-progress-bars-input">Show skill progress bars</label>
            </div>
          </fieldset>

          <fieldset className="setting-group">
            <legend className="setting-title">Recent activity</legend>
            <div className="settings-page-radio-item">
              <input
                id="enable-recent-activity-input"
                type="checkbox"
                checked={enableRecentActivity}
                onChange={(e) => setEnableRecentActivity?.(e.target.checked)}
              />
              <label htmlFor="enable-recent-activity-input">Show recent activity summaries on player panels</label>
            </div>
          </fieldset>
        </fieldset>

        <fieldset
          onChange={(e) => {
            const selected = (e.target as Partial<HTMLInputElement>).value;
            const theme = SiteTheme.find((theme) => theme === selected);
            if (!theme) return;

            setSiteTheme?.(theme);
          }}
        >
          <legend>{formatTitle("Style")}</legend>
          {SiteTheme.map((theme) => {
            const id = `style-${theme}`;
            return (
              <div className="settings-page-radio-item" key={theme}>
                <input id={id} readOnly value={theme} type="radio" checked={siteTheme === theme} />
                <label htmlFor={id} key={theme}>
                  {labels[theme]}
                </label>
              </div>
            );
          })}
        </fieldset>
      </div>
    </div>
  );
};
