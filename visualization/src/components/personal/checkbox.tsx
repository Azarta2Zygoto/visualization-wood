import React, { JSX } from "react";

import "./checkbox.css";

/**
 *
 * @param param - The properties for the Checkbox component.
 * @param param.id - The unique identifier for the checkbox.
 * @param param.label - The label text for the checkbox.
 * @param param.checked - The checked state of the checkbox.
 * @param param.className - Optional additional class name for custom styling.
 * @param param.name - Optional name attribute for the checkbox input.
 * @param param.side - Optional side for the checkbox ("left" or "right", default is "right").
 * @param param.sideOffset - Optional offset in pixels for the checkbox from the side (default is 0).
 * @param param.hideLabel - Optional boolean to hide the label (default is false).
 * @param param.disabled - Optional disabled state of the checkbox (default is false).
 * @param param.required - Optional required state of the checkbox (default is false).
 * @param param.style - Optional inline styles for the checkbox.
 * @param param.boxStyle - Optional inline styles for the checkbox container.
 * @param param.checkmark - Optional custom checkmark (React node or function returning a React node).
 * @param param.onChange - The change event handler for the checkbox.
 * @return A JSX element representing the Checkbox component.
 */

interface CheckboxProps {
    id: string;
    label: string;
    checked: boolean;
    className?: string;
    name?: string;
    side?: "left" | "right";
    sideOffset?: number;
    hideLabel?: boolean;
    disabled?: boolean;
    required?: boolean;
    style?: React.CSSProperties;
    boxStyle?: React.CSSProperties;
    checkmark?: React.ReactNode | ((checked: boolean) => React.ReactNode);
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function Checkbox({
    id,
    label,
    checked,
    className,
    name,
    side = "right",
    sideOffset = 0,
    hideLabel,
    disabled,
    required,
    checkmark,
    style,
    boxStyle,
    onChange,
}: CheckboxProps): JSX.Element {
    const renderedCheckmark =
        typeof checkmark === "function"
            ? (checkmark as (c: boolean) => React.ReactNode)(checked)
            : checkmark;

    return (
        <label
            className={`checkbox-container${disabled ? " disabled" : ""}${side === "left" ? " reverse" : ""}`}
            id={id + "-label"}
            style={boxStyle}
            htmlFor={id}
        >
            {!hideLabel ? label : null}
            {required && (
                <span
                    aria-hidden="true"
                    style={{ color: "red", margin: "0 5px" }}
                >
                    &nbsp;*
                </span>
            )}
            <input
                id={id}
                type="checkbox"
                checked={checked}
                disabled={disabled}
                name={name ?? id}
                required={required}
                aria-checked={checked}
                aria-required={required}
                aria-disabled={disabled}
                onChange={onChange}
                {...(hideLabel ? { "aria-label": label } : {})}
            />
            <span
                id={`${id}-checkmark`}
                className={
                    !renderedCheckmark
                        ? "checkbox-checkmark "
                        : "checkbox-placement" +
                          (className ? ` ${className}` : "")
                }
                aria-hidden="true"
                style={{
                    ...style,
                    right:
                        side === "right"
                            ? hideLabel
                                ? "50%"
                                : sideOffset + "px"
                            : undefined,
                    left:
                        side === "left"
                            ? hideLabel
                                ? "50%"
                                : sideOffset + "px"
                            : undefined,
                    transform: hideLabel
                        ? "translateX(50%) translateY(-50%)"
                        : undefined,
                }}
            >
                {renderedCheckmark ?? null}
            </span>
        </label>
    );
}
