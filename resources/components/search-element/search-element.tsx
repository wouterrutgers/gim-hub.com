import type { ChangeEvent, ReactElement } from "react";

import "./search-element.css";

export const SearchElement = ({
  id,
  className,
  defaultValue,
  value,
  placeholder,
  onChange,
}: {
  id?: string;
  className?: string;
  defaultValue?: string;
  value?: string;
  placeholder: string;
  onChange: (value: string) => void;
}): ReactElement => {
  const inputProps = {
    className: `search-element-input ${className}`,
    placeholder: `${placeholder}`,
    type: "text" as const,
    tabIndex: 0,
    onChange: (e: ChangeEvent<HTMLInputElement>): void => onChange(e.target.value),
  };

  return (
    <div id={id}>
      {typeof value === "string" ? (
        <input {...inputProps} value={value} />
      ) : (
        <input {...inputProps} defaultValue={defaultValue} />
      )}
    </div>
  );
};
