import { useEffect, useState, type ReactElement } from "react";
import { AppLink } from "../app-link/app-link";
import { fetchChangelog, type Response as ChangelogResponse } from "../../api/requests/changelog";

import "./changelog-page.css";

export const ChangelogPage = ({ backHref, backLabel }: { backHref: string; backLabel: string }): ReactElement => {
  const [entries, setEntries] = useState<ChangelogResponse>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    fetchChangelog({ baseURL: __API_URL__ })
      .then((response) => setEntries(response))
      .catch((reason) => {
        console.error("Failed to load changelog:", reason);
        setError("Failed to load changelog.");
      });
  }, []);

  return (
    <div id="changelog-page">
      <div id="changelog-header" className="rsbackground rsborder">
        <h2>Changelog</h2>
        <div className="changelog-actions">
          <AppLink href={backHref} className="small">
            {backLabel}
          </AppLink>
        </div>
      </div>

      {error ? (
        <div className="rsbackground rsborder changelog-entry">
          <p>{error}</p>
        </div>
      ) : null}

      {!entries && !error ? (
        <div className="rsbackground rsborder changelog-entry">
          <p>Loading…</p>
        </div>
      ) : null}

      {entries?.map((entry) => (
        <div key={entry.id} className="rsbackground rsborder changelog-entry">
          <div className="changelog-meta">
            <div className="changelog-title">{entry.title}</div>
            <div className="changelog-date">{entry.date}</div>
          </div>
          <div className="changelog-markdown" dangerouslySetInnerHTML={{ __html: entry.html }} />
        </div>
      ))}
    </div>
  );
};
