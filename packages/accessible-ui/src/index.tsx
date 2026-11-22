import React, { useEffect, useId, useRef, useState } from "react";
import type { AccessibilityProfile, SemanticPage } from "@adaptui/shared-types";
import {
  validateAccessibleUISpec,
  type AccessibleUISpec,
  type UIComponentNode,
} from "@adaptui/ui-schema";

export interface ActionDispatchPayload {
  actionId: string;
  value?: string;
  checked?: boolean;
}

export type OnActionHandler = (payload: ActionDispatchPayload) => void | Promise<void>;

export function profileToCssVariables(profile: AccessibilityProfile): React.CSSProperties {
  return {
    "--aui-text-scale": String(profile.presentation.textScale),
    "--aui-line-height": String(profile.presentation.lineHeight),
    "--aui-letter-spacing": `${profile.presentation.letterSpacing}em`,
    "--aui-min-target": `${profile.interaction.minimumTargetSize}px`,
    "--aui-control-spacing": `${profile.interaction.controlSpacing}px`,
  } as React.CSSProperties;
}

export const AccessiblePage: React.FC<{
  title: string;
  summary?: string;
  profile: AccessibilityProfile;
  children: React.ReactNode;
}> = ({ title, summary, profile, children }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Switch-compatible scanning mode: cycles focus across interactive controls when enabled
  useEffect(() => {
    if (!profile.interaction.scanningMode) return;
    const container = containerRef.current;
    if (!container) return;

    let currentIdx = -1;
    let lastHighlighted: HTMLElement | null = null;

    const getControls = () =>
      Array.from(
        container.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])'
        )
      );

    const stepScan = () => {
      const controls = getControls();
      if (controls.length === 0) return;
      lastHighlighted?.classList.remove("aui-scan-highlight");
      currentIdx = (currentIdx + 1) % controls.length;
      const target = controls[currentIdx]!;
      target.classList.add("aui-scan-highlight");
      target.focus({ preventScroll: false });
      lastHighlighted = target;
    };

    const timer = window.setInterval(stepScan, profile.interaction.scanIntervalMs);
    return () => {
      window.clearInterval(timer);
      lastHighlighted?.classList.remove("aui-scan-highlight");
    };
  }, [profile.interaction.scanningMode, profile.interaction.scanIntervalMs]);

  return (
    <div
      ref={containerRef}
      className="aui-root"
      style={profileToCssVariables(profile)}
      data-contrast={profile.presentation.contrast}
      data-density={profile.presentation.density}
      data-reduced-motion={String(profile.presentation.reducedMotion)}
      data-eye-gaze={String(profile.interaction.eyeGazeMode)}
      data-scanning={String(profile.interaction.scanningMode)}
    >
      <article className="aui-page" aria-label={title}>
        <header className="aui-page-header">
          <h1 className="aui-page-title">{title}</h1>
          {summary && <p className="aui-page-summary">{summary}</p>}
        </header>
        {children}
      </article>
    </div>
  );
};

export const AccessibleSection: React.FC<{
  title: string;
  children: React.ReactNode;
}> = ({ title, children }) => {
  const headingId = useId();
  return (
    <section className="aui-section" aria-labelledby={headingId}>
      <h2 id={headingId} className="aui-section-title">
        {title}
      </h2>
      {children}
    </section>
  );
};

export const AccessibleHeading: React.FC<{
  level: number;
  text: string;
}> = ({ level, text }) => {
  const clamped = Math.min(6, Math.max(2, level));
  if (clamped === 2) return <h2 className="aui-heading">{text}</h2>;
  if (clamped === 3) return <h3 className="aui-heading">{text}</h3>;
  if (clamped === 4) return <h4 className="aui-heading">{text}</h4>;
  if (clamped === 5) return <h5 className="aui-heading">{text}</h5>;
  return <h6 className="aui-heading">{text}</h6>;
};

export const AccessibleText: React.FC<{ text: string }> = ({ text }) => (
  <p className="aui-text">{text}</p>
);

export const AccessibleImage: React.FC<{
  src: string;
  alt: string;
  caption?: string;
}> = ({ src, alt, caption }) => (
  <figure className="aui-media-figure">
    <img className="aui-image" src={src} alt={alt} loading="lazy" />
    {caption && <figcaption className="aui-media-caption">{caption}</figcaption>}
  </figure>
);

export const AccessibleVideo: React.FC<{
  src: string;
  poster?: string;
  title: string;
  caption?: string;
}> = ({ src, poster, title, caption }) => (
  <figure className="aui-media-figure">
    <video
      className="aui-video"
      controls
      preload="metadata"
      playsInline
      poster={poster}
      aria-label={title}
    >
      <source src={src} />
      Your browser does not support video playback.
    </video>
    {caption && <figcaption className="aui-media-caption">{caption}</figcaption>}
  </figure>
);

export const AccessibleLink: React.FC<{
  label: string;
  onActivate: () => void;
}> = ({ label, onActivate }) => (
  <button type="button" className="aui-link-button" onClick={onActivate}>
    {label}
  </button>
);

export const AccessibleButton: React.FC<{
  label: string;
  variant?: "primary" | "secondary" | "danger";
  requiresConfirmation?: boolean;
  disabled?: boolean;
  onActivate: () => void;
}> = ({ label, variant = "secondary", requiresConfirmation, disabled, onActivate }) => {
  const cls =
    variant === "primary"
      ? "aui-button aui-button-primary"
      : variant === "danger"
      ? "aui-button aui-button-danger"
      : "aui-button";
  return (
    <button
      type="button"
      className={cls}
      disabled={disabled}
      onClick={onActivate}
      aria-description={requiresConfirmation ? "Requires confirmation before executing" : undefined}
    >
      {label}
      {requiresConfirmation ? " (Confirm)" : ""}
    </button>
  );
};

export const AccessibleInput: React.FC<{
  label: string;
  inputType?: string;
  initialValue?: string;
  required?: boolean;
  errorMessage?: string;
  sensitive?: boolean;
  onCommit: (value: string) => void;
  onDictate?: (label: string, applyText: (text: string) => void) => void;
}> = ({
  label,
  inputType = "text",
  initialValue = "",
  required,
  errorMessage,
  sensitive,
  onCommit,
  onDictate,
}) => {
  const id = useId();
  const errId = useId();
  const [val, setVal] = useState(initialValue);

  useEffect(() => {
    setVal(initialValue);
  }, [initialValue]);

  return (
    <div className="aui-field">
      <label htmlFor={id} className="aui-label">
        {label}
        {required && <span className="aui-required-badge">(Required)</span>}
      </label>
      <div className="aui-input-row">
        <input
          id={id}
          className="aui-input"
          type={sensitive ? "password" : inputType}
          value={val}
          required={required}
          aria-required={required}
          aria-invalid={Boolean(errorMessage)}
          aria-describedby={errorMessage ? errId : undefined}
          onChange={(e) => {
            const next = e.target.value;
            setVal(next);
            onCommit(next);
          }}
        />
        {!sensitive && onDictate && (
          <button
            type="button"
            className="aui-button"
            aria-label={`Dictate ${label}`}
            onClick={() =>
              onDictate(label, (text) => {
                setVal(text);
                onCommit(text);
              })
            }
          >
            Dictate
          </button>
        )}
      </div>
      {errorMessage && (
        <div id={errId} role="alert" className="aui-error">
          {errorMessage}
        </div>
      )}
    </div>
  );
};

export const AccessibleSelect: React.FC<{
  label: string;
  initialValue?: string;
  required?: boolean;
  options: Array<{ value: string; label: string }>;
  onCommit: (value: string) => void;
}> = ({ label, initialValue = "", required, options, onCommit }) => {
  const id = useId();
  const [val, setVal] = useState(initialValue);

  useEffect(() => {
    setVal(initialValue);
  }, [initialValue]);

  return (
    <div className="aui-field">
      <label htmlFor={id} className="aui-label">
        {label}
        {required && <span className="aui-required-badge">(Required)</span>}
      </label>
      <select
        id={id}
        className="aui-select"
        value={val}
        required={required}
        aria-required={required}
        onChange={(e) => {
          const next = e.target.value;
          setVal(next);
          onCommit(next);
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
};

export const AccessibleCheckbox: React.FC<{
  label: string;
  checked?: boolean;
  required?: boolean;
  errorMessage?: string;
  onToggle: (checked: boolean) => void;
}> = ({ label, checked = false, required, errorMessage, onToggle }) => {
  const errId = useId();
  const [isChecked, setIsChecked] = useState(checked);

  useEffect(() => {
    setIsChecked(checked);
  }, [checked]);

  return (
    <div className="aui-field">
      <label className="aui-checkbox-label">
        <input
          type="checkbox"
          checked={isChecked}
          required={required}
          aria-required={required}
          aria-invalid={Boolean(errorMessage)}
          aria-describedby={errorMessage ? errId : undefined}
          onChange={(e) => {
            const next = e.target.checked;
            setIsChecked(next);
            onToggle(next);
          }}
        />
        <span>
          {label}
          {required && <span className="aui-required-badge">(Required)</span>}
        </span>
      </label>
      {errorMessage && (
        <div id={errId} role="alert" className="aui-error">
          {errorMessage}
        </div>
      )}
    </div>
  );
};

export const AccessibleRadioGroup: React.FC<{
  label: string;
  name: string;
  options: Array<{ label: string; value: string; actionId: string; checked?: boolean }>;
  onSelect: (actionId: string) => void;
}> = ({ label, name, options, onSelect }) => (
  <fieldset className="aui-fieldset">
    <legend className="aui-label">{label}</legend>
    {options.map((opt) => (
      <label key={opt.actionId} className="aui-radio-label">
        <input
          type="radio"
          name={name}
          value={opt.value}
          defaultChecked={opt.checked}
          onChange={() => onSelect(opt.actionId)}
        />
        <span>{opt.label}</span>
      </label>
    ))}
  </fieldset>
);

export const AccessibleForm: React.FC<{
  title: string;
  children: React.ReactNode;
}> = ({ title, children }) => {
  const headingId = useId();
  return (
    <section className="aui-form" aria-labelledby={headingId}>
      <h2 id={headingId} className="aui-section-title">
        {title}
      </h2>
      {children}
    </section>
  );
};

export const AccessibleTable: React.FC<{
  caption?: string;
  headers: string[];
  rows: string[][];
}> = ({ caption, headers, rows }) => (
  <div className="aui-table-wrap">
    <table className="aui-table">
      {caption && <caption>{caption}</caption>}
      {headers.length > 0 && (
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
      )}
      <tbody>
        {rows.map((row, rIdx) => (
          <tr key={rIdx}>
            {row.map((cell, cIdx) => (
              <td key={cIdx}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export const AccessibleList: React.FC<{
  ordered?: boolean;
  items: string[];
}> = ({ ordered, items }) => {
  const Tag = ordered ? "ol" : "ul";
  return (
    <Tag className="aui-list">
      {items.map((item, idx) => (
        <li key={idx}>{item}</li>
      ))}
    </Tag>
  );
};

export const AccessibleDialog: React.FC<{
  title: string;
  description?: string;
  open: boolean;
  onClose?: () => void;
  children: React.ReactNode;
}> = ({ title, description, open, onClose, children }) => {
  const titleId = useId();
  const descId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    dialogRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && onClose) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="aui-dialog-backdrop">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className="aui-dialog"
      >
        <h2 id={titleId} className="aui-section-title">
          {title}
        </h2>
        {description && (
          <p id={descId} className="aui-text">
            {description}
          </p>
        )}
        {children}
      </div>
    </div>
  );
};

export const AccessibleStatus: React.FC<{
  message: string;
  tone?: "info" | "success" | "warning";
}> = ({ message, tone = "info" }) => (
  <div
    role="status"
    aria-live="polite"
    className={`aui-status ${tone === "success" ? "aui-status-success" : tone === "warning" ? "aui-status-warning" : ""}`}
  >
    {message}
  </div>
);

export const AccessibleError: React.FC<{ message: string }> = ({ message }) => (
  <div role="alert" aria-live="assertive" className="aui-error">
    {message}
  </div>
);

export const AccessibleTaskStep: React.FC<{
  stepNumber: number;
  totalSteps: number;
  title: string;
  description?: string;
  children: React.ReactNode;
}> = ({ stepNumber, totalSteps, title, description, children }) => (
  <div className="aui-task-step" role="group" aria-label={`Step ${stepNumber} of ${totalSteps}: ${title}`}>
    <div className="aui-task-step-header">
      <span className="aui-step-badge">
        Step {stepNumber} of {totalSteps}
      </span>
      {description && <span className="aui-page-summary">{description}</span>}
    </div>
    {children}
  </div>
);

export const AccessibleNavigation: React.FC<{
  label: string;
  links: Array<{ id: string; label: string; actionId: string }>;
  onAction: OnActionHandler;
}> = ({ label, links, onAction }) => (
  <nav className="aui-nav" aria-label={label}>
    <strong className="aui-label">{label}</strong>
    <ul className="aui-nav-list">
      {links.map((link) => (
        <li key={link.id}>
          <AccessibleLink
            label={link.label}
            onActivate={() => onAction({ actionId: link.actionId })}
          />
        </li>
      ))}
    </ul>
  </nav>
);

export type OnDictateHandler = (label: string, applyText: (text: string) => void) => void;

function renderNode(
  node: UIComponentNode,
  onAction: OnActionHandler,
  onDictate?: OnDictateHandler
): React.ReactNode {
  switch (node.type) {
    case "heading":
      return <AccessibleHeading key={node.id} level={node.level} text={node.text} />;
    case "text":
      return <AccessibleText key={node.id} text={node.text} />;
    case "image":
      return (
        <AccessibleImage
          key={node.id}
          src={node.src}
          alt={node.alt}
          caption={node.caption}
        />
      );
    case "video":
      return (
        <AccessibleVideo
          key={node.id}
          src={node.src}
          poster={node.poster}
          title={node.title}
          caption={node.caption}
        />
      );
    case "link":
      return (
        <AccessibleLink
          key={node.id}
          label={node.label}
          onActivate={() => onAction({ actionId: node.actionId })}
        />
      );
    case "button":
      return (
        <AccessibleButton
          key={node.id}
          label={node.label}
          variant={node.variant}
          requiresConfirmation={node.requiresConfirmation}
          onActivate={() => onAction({ actionId: node.actionId })}
        />
      );
    case "input":
      return (
        <AccessibleInput
          key={node.id}
          label={node.label}
          inputType={node.inputType}
          initialValue={node.value}
          required={node.required}
          errorMessage={node.errorMessage}
          sensitive={node.sensitive}
          onCommit={(value) => onAction({ actionId: node.actionId, value })}
          onDictate={onDictate}
        />
      );
    case "select":
      return (
        <AccessibleSelect
          key={node.id}
          label={node.label}
          initialValue={node.value}
          required={node.required}
          options={node.options}
          onCommit={(value) => onAction({ actionId: node.actionId, value })}
        />
      );
    case "checkbox":
      return (
        <AccessibleCheckbox
          key={node.id}
          label={node.label}
          checked={node.checked}
          required={node.required}
          errorMessage={node.errorMessage}
          onToggle={(checked) => onAction({ actionId: node.actionId, checked })}
        />
      );
    case "radioGroup":
      return (
        <AccessibleRadioGroup
          key={node.id}
          label={node.label}
          name={node.name}
          options={node.options}
          onSelect={(actionId) => onAction({ actionId, checked: true })}
        />
      );
    case "table":
      return (
        <AccessibleTable
          key={node.id}
          caption={node.caption}
          headers={node.headers}
          rows={node.rows}
        />
      );
    case "list":
      return <AccessibleList key={node.id} ordered={node.ordered} items={node.items} />;
    case "status":
      return <AccessibleStatus key={node.id} message={node.message} tone={node.tone} />;
    case "error":
      return <AccessibleError key={node.id} message={node.message} />;
    case "navigation":
      return (
        <AccessibleNavigation
          key={node.id}
          label={node.label}
          links={node.links}
          onAction={onAction}
        />
      );
    case "section":
      return (
        <AccessibleSection key={node.id} title={node.title}>
          {node.children.map((c) => renderNode(c, onAction, onDictate))}
        </AccessibleSection>
      );
    case "form":
      return (
        <AccessibleForm key={node.id} title={node.title}>
          {node.children.map((c) => renderNode(c, onAction, onDictate))}
        </AccessibleForm>
      );
    case "taskStep":
      return (
        <AccessibleTaskStep
          key={node.id}
          stepNumber={node.stepNumber}
          totalSteps={node.totalSteps}
          title={node.title}
          description={node.description}
        >
          {node.children.map((c) => renderNode(c, onAction, onDictate))}
        </AccessibleTaskStep>
      );
    case "dialog":
      return (
        <AccessibleDialog key={node.id} title={node.title} description={node.description} open={true}>
          {node.children.map((c) => renderNode(c, onAction, onDictate))}
        </AccessibleDialog>
      );
    default:
      return null;
  }
}

export const AccessibleUIRenderer: React.FC<{
  spec: unknown;
  semanticPage: SemanticPage;
  profile: AccessibilityProfile;
  onAction: OnActionHandler;
  onDictate?: OnDictateHandler;
  onSwitchToOriginal: () => void;
}> = ({ spec, semanticPage, profile, onAction, onDictate, onSwitchToOriginal }) => {
  const validation = validateAccessibleUISpec(spec, semanticPage);

  if (!validation.valid || !validation.spec) {
    return (
      <AccessiblePage title="Reconstruction Validation Error" profile={profile}>
        <AccessibleError
          message={`The generated interface specification was rejected for safety and completeness: ${validation.errors.join(
            " | "
          )}`}
        />
        <AccessibleButton
          label="Switch to Original Website"
          variant="primary"
          onActivate={onSwitchToOriginal}
        />
      </AccessiblePage>
    );
  }

  const validSpec: AccessibleUISpec = validation.spec;

  return (
    <AccessiblePage title={validSpec.title} summary={validSpec.summary} profile={profile}>
      {validSpec.securityNotice && (
        <AccessibleStatus message={validSpec.securityNotice} tone="warning" />
      )}
      {validSpec.incompleteNotice && (
        <AccessibleStatus message={validSpec.incompleteNotice} tone="warning" />
      )}
      {validSpec.components.map((node) => renderNode(node, onAction, onDictate))}
    </AccessiblePage>
  );
};
