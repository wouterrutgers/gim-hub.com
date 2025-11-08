import { type ReactElement } from "react";
import "./migration-notice.css";

export const MigrationNotice = (): ReactElement => {
  return (
    <div className="migration-notice">
      <div className="migration-notice-content">
        <span className="migration-notice-icon">⚠️</span>
        <span className="migration-notice-text">
          We're migrating to Laravel Octane for better performance. Please migrate before November 23, 2025.{" "}
          <a
            href="https://github.com/wouterrutgers/gim-hub.com/blob/octane/self-host.md#migrating-from-php-fpm-to-octane"
            target="_blank"
            rel="noopener noreferrer"
            className="migration-notice-link"
          >
            Learn more
          </a>
        </span>
      </div>
    </div>
  );
};
