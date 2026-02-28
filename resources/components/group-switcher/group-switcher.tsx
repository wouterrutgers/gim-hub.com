import { useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { useNavigate } from "react-router-dom";
import { Context as APIContext } from "../../context/api-context";
import { formatTitle } from "../../ts/format-title";

import "./group-switcher.css";

export const GroupSwitcher = ({ groupName }: { groupName: string }): ReactElement => {
  const { logInLive, savedGroups, removeSavedGroup } = useContext(APIContext) ?? {};
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const toggle = useCallback((): void => {
    setOpen((prev) => !prev);
  }, []);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent): void => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return (): void => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleSwitch = useCallback(
    (name: string, token: string): void => {
      if (!logInLive) return;

      setOpen(false);
      logInLive({ name, token }).catch(() => {
        if (removeSavedGroup) {
          removeSavedGroup(name);
        }
      });
    },
    [logInLive, removeSavedGroup],
  );

  const handleRemove = useCallback(
    (name: string): void => {
      if (!removeSavedGroup) return;
      removeSavedGroup(name);
    },
    [removeSavedGroup],
  );

  const handleAddNew = useCallback((): void => {
    setOpen(false);
    void navigate("/login", { state: { addGroup: true } });
  }, [navigate]);

  const sortedGroups = useMemo(
    () => (savedGroups ? [...savedGroups].sort((a, b) => a.name.localeCompare(b.name)) : []),
    [savedGroups],
  );

  return (
    <div id="group-switcher" ref={containerRef}>
      <button
        id="group-switcher-toggle"
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls="group-switcher-dropdown"
        onClick={toggle}
      >
        <span id="group-switcher-label">{formatTitle(groupName)}</span>
        <svg
          id="group-switcher-arrow"
          className={open ? "open" : ""}
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M2.5 4.5L6 8L9.5 4.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && (
        <div id="group-switcher-dropdown" className="rsborder rsbackground">
          {sortedGroups.map((group) => (
            <div key={group.name} className="group-switcher-item">
              <button
                type="button"
                className="group-switcher-item-button men-button"
                onClick={(): void => handleSwitch(group.name, group.token)}
              >
                {formatTitle(group.name)}
              </button>
              <button
                type="button"
                className="group-switcher-remove men-button"
                onClick={(): void => handleRemove(group.name)}
                title={`Remove ${group.name}`}
              >
                ✕
              </button>
            </div>
          ))}
          <button type="button" className="group-switcher-add men-button" onClick={handleAddNew}>
            + Add group
          </button>
        </div>
      )}
    </div>
  );
};
