import type { CSSProperties, ChangeEvent, KeyboardEvent, Ref } from "react";

interface InputProps {
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  autoFocus?: boolean;
  title?: string;
  style?: CSSProperties;
  inputRef?: Ref<HTMLInputElement>;
  "data-testid"?: string;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
}

const BASE: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  fontSize: "var(--text-sm)",
  padding: "5px 8px",
  border: "1px solid var(--border-mid)",
  borderRadius: "var(--r-md)",
  background: "#fff",
  color: "var(--text-1)",
  fontFamily: "var(--font-sans)",
  outline: "none",
  transition: "border-color 0.1s",
};

export function Input({
  value,
  defaultValue,
  placeholder,
  disabled,
  readOnly,
  autoFocus,
  title,
  style,
  inputRef,
  "data-testid": dataTestId,
  onChange,
  onKeyDown,
  onFocus,
  onBlur,
}: InputProps) {
  return (
    <input
      ref={inputRef}
      value={value}
      defaultValue={defaultValue}
      placeholder={placeholder}
      disabled={disabled}
      readOnly={readOnly}
      autoFocus={autoFocus}
      title={title}
      data-testid={dataTestId}
      style={{ ...BASE, ...style }}
      onChange={onChange}
      onKeyDown={onKeyDown}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = "var(--accent)";
        onFocus?.(e);
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = "var(--border-mid)";
        onBlur?.(e);
      }}
    />
  );
}
