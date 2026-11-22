import { z } from "zod";
import {
  SEMANTIC_SCHEMA_VERSION,
  type BrowserSnapshot,
  type ElementReference,
  type RawAxNode,
  type RawDomElement,
  type SemanticAction,
  type SemanticElement,
  type SemanticPage,
  type SemanticRegion,
  type SemanticRegionKind,
  type SemanticWorkflow,
} from "@adaptui/shared-types";
import {
  classifyActionRisk,
  detectAndSanitizePromptInjection,
  isSensitiveField,
  validateNavigationUrl,
} from "@adaptui/security";

export const ElementReferenceSchema = z.object({
  pageId: z.string().min(1),
  revision: z.number().int().positive(),
  backendNodeId: z.number().int().positive().optional(),
  locator: z.string().optional(),
  role: z.string().optional(),
  accessibleName: z.string().optional(),
  tagName: z.string().optional(),
  domId: z.string().optional(),
  nameAttr: z.string().optional(),
});

export const ValidationConstraintSchema = z.object({
  required: z.boolean().optional(),
  inputType: z.string().optional(),
  pattern: z.string().optional(),
  minLength: z.number().int().nonnegative().optional(),
  maxLength: z.number().int().nonnegative().optional(),
  errorMessage: z.string().optional(),
  describedByIds: z.array(z.string()).optional(),
});

export const ProvenanceInfoSchema = z.object({
  source: z.enum(["ax-tree", "dom", "merged"]),
  extractedAt: z.string(),
  confidence: z.number().min(0).max(1),
  sanitizedInjectionFlag: z.boolean().optional(),
});

export const SemanticRegionSchema = z.object({
  id: z.string().min(1),
  kind: z.enum([
    "main",
    "navigation",
    "search",
    "form",
    "complementary",
    "dialog",
    "status",
    "alert",
    "contentinfo",
    "banner",
    "section",
  ]),
  label: z.string(),
  primary: z.boolean(),
  elementIds: z.array(z.string()),
  parentRegionId: z.string().optional(),
});

export const SemanticElementSchema = z.object({
  id: z.string().min(1),
  role: z.string().min(1),
  name: z.string(),
  textContent: z.string().optional(),
  description: z.string().optional(),
  value: z.string().optional(),
  checked: z.boolean().optional(),
  selected: z.boolean().optional(),
  href: z.string().optional(),
  mediaSrc: z.string().optional(),
  posterSrc: z.string().optional(),
  mediaAlt: z.string().optional(),
  inputType: z.string().optional(),
  options: z
    .array(
      z.object({
        value: z.string(),
        label: z.string(),
        selected: z.boolean().optional(),
      })
    )
    .optional(),
  headingLevel: z.number().int().min(1).max(6).optional(),
  tableData: z
    .object({
      caption: z.string().optional(),
      headers: z.array(z.string()),
      rows: z.array(z.array(z.string())),
    })
    .optional(),
  listItems: z.array(z.string()).optional(),
  regionId: z.string().optional(),
  formId: z.string().optional(),
  labelForElementId: z.string().optional(),
  errorMessage: z.string().optional(),
  constraints: ValidationConstraintSchema.optional(),
  visible: z.boolean(),
  enabled: z.boolean(),
  sensitive: z.boolean().optional(),
  sourceRef: ElementReferenceSchema.optional(),
  provenance: ProvenanceInfoSchema,
});

export const SemanticActionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  kind: z.enum([
    "click",
    "fill",
    "select",
    "check",
    "navigate",
    "submit",
    "scroll",
    "back",
    "forward",
  ]),
  targetElementId: z.string().optional(),
  formId: z.string().optional(),
  href: z.string().optional(),
  requiresConfirmation: z.boolean(),
  riskLevel: z.enum(["safe", "moderate", "consequential"]),
  riskReasons: z.array(z.string()),
  preconditions: z.array(z.string()),
  expectedOutcome: z.string().optional(),
});

export const SemanticWorkflowStepSchema = z.object({
  stepNumber: z.number().int().positive(),
  title: z.string().min(1),
  description: z.string().optional(),
  elementIds: z.array(z.string()),
  actionIds: z.array(z.string()),
  required: z.boolean(),
});

export const SemanticWorkflowSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  kind: z.enum(["search", "form", "information", "navigation", "generic"]),
  formId: z.string().optional(),
  steps: z.array(SemanticWorkflowStepSchema),
  submitActionId: z.string().optional(),
});

export const SemanticPageSchema = z.object({
  schemaVersion: z.string(),
  pageId: z.string().min(1),
  url: z.string(),
  title: z.string(),
  purpose: z.string().optional(),
  revision: z.number().int().positive(),
  capturedAt: z.string(),
  regions: z.array(SemanticRegionSchema),
  elements: z.array(SemanticElementSchema),
  actions: z.array(SemanticActionSchema),
  workflows: z.array(SemanticWorkflowSchema),
  extractionWarnings: z.array(z.string()),
  unsupportedFeatures: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  incomplete: z.boolean(),
  securityFlags: z.object({
    promptInjectionDetected: z.boolean(),
    injectionDetections: z.array(z.string()),
    blockedLinksCount: z.number().int().nonnegative(),
    sensitiveFieldsRedacted: z.number().int().nonnegative(),
  }),
});

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42);
}

function normalizeRole(dom: RawDomElement, ax?: RawAxNode): string {
  const tag = dom.tagName.toLowerCase();
  if (tag === "img") return "img";
  if (tag === "video") return "video";
  if (ax?.role && ax.role !== "none" && ax.role !== "generic" && ax.role !== "RootWebArea") {
    return ax.role.toLowerCase();
  }
  if (dom.role) return dom.role.toLowerCase();
  if (tag === "a") return "link";
  if (tag === "button") return "button";
  if (tag === "select") return "combobox";
  if (tag === "textarea") return "textbox";
  if (tag === "table") return "table";
  if (tag === "ul" || tag === "ol") return "list";
  if (/^h[1-6]$/.test(tag)) return "heading";
  if (tag === "input") {
    const t = (dom.inputType || "text").toLowerCase();
    if (t === "search") return "searchbox";
    if (t === "checkbox") return "checkbox";
    if (t === "radio") return "radio";
    if (t === "submit" || t === "button" || t === "reset") return "button";
    return "textbox";
  }
  if (tag === "p") return "paragraph";
  return "text";
}

function resolveRegionKind(dom: RawDomElement): SemanticRegionKind {
  if (dom.regionHint) return dom.regionHint;
  if (dom.role === "alert") return "alert";
  if (dom.role === "status") return "status";
  if (dom.formId) return "form";
  return "main";
}

function isPrimaryRegion(kind: SemanticRegionKind): boolean {
  return (
    kind === "main" ||
    kind === "search" ||
    kind === "form" ||
    kind === "dialog" ||
    kind === "alert" ||
    kind === "status" ||
    kind === "section"
  );
}

export interface ExtractSemanticPageOptions {
  confirmationLevel?: "standard" | "enhanced";
}

export function extractSemanticPage(
  snapshot: BrowserSnapshot,
  previousPage?: SemanticPage | null,
  options?: ExtractSemanticPageOptions
): SemanticPage {
  const samePage = previousPage && previousPage.pageId === snapshot.pageId;
  const revision = samePage ? previousPage.revision + 1 : 1;

  // Map previous elements for stable ID continuity
  const prevIdBySignature = new Map<string, string>();
  if (samePage && previousPage) {
    for (const el of previousPage.elements) {
      const sig = `${el.role}|${el.name}|${el.formId ?? ""}|${el.sourceRef?.tagName ?? ""}|${el.sourceRef?.domId ?? ""}`;
      if (!prevIdBySignature.has(sig)) {
        prevIdBySignature.set(sig, el.id);
      }
    }
  }

  // Index AX nodes by backendDOMNodeId for deterministic merging
  const axByBackendId = new Map<number, RawAxNode>();
  for (const ax of snapshot.axNodes) {
    if (ax.backendDOMNodeId && !ax.ignored) {
      axByBackendId.set(ax.backendDOMNodeId, ax);
    }
  }

  const regionsMap = new Map<string, SemanticRegion>();
  const elements: SemanticElement[] = [];
  const actions: SemanticAction[] = [];
  const extractionWarnings: string[] = [];
  const injectionDetections = new Set<string>();
  let blockedLinksCount = 0;
  let sensitiveFieldsRedacted = 0;

  if (snapshot.loadError) {
    extractionWarnings.push(`Browser load issue: ${snapshot.loadError}`);
  }

  // Scan AX nodes for hidden injection attempts even if not rendered
  for (const ax of snapshot.axNodes) {
    const axText = `${ax.name ?? ""} ${ax.description ?? ""}`.trim();
    if (axText) {
      const scan = detectAndSanitizePromptInjection(axText);
      if (scan.detected) {
        scan.matches.forEach((m) => injectionDetections.add(m));
      }
    }
  }

  const usedIds = new Set<string>();
  const makeStableId = (prefix: string, base: string, sig?: string): string => {
    if (sig && prevIdBySignature.has(sig)) {
      const prevId = prevIdBySignature.get(sig)!;
      if (!usedIds.has(prevId)) {
        usedIds.add(prevId);
        return prevId;
      }
    }
    const slug = slugify(base) || "item";
    let candidate = `${prefix}-${slug}`;
    let counter = 2;
    while (usedIds.has(candidate)) {
      candidate = `${prefix}-${slug}-${counter++}`;
    }
    usedIds.add(candidate);
    return candidate;
  };

  const ensureRegion = (kind: SemanticRegionKind, label?: string): SemanticRegion => {
    const key = `${kind}:${label || kind}`;
    const existing = regionsMap.get(key);
    if (existing) return existing;
    const region: SemanticRegion = {
      id: `region-${slugify(key) || kind}-${regionsMap.size + 1}`,
      kind,
      label: label || kind.charAt(0).toUpperCase() + kind.slice(1),
      primary: isPrimaryRegion(kind),
      elementIds: [],
    };
    regionsMap.set(key, region);
    return region;
  };

  // Detect search forms by formId or role="search"
  const searchFormIds = new Set<string>();
  for (const dom of snapshot.domElements) {
    if (dom.formId && (dom.regionHint === "search" || dom.inputType === "search" || dom.role === "searchbox")) {
      searchFormIds.add(dom.formId);
    }
  }

  for (const dom of snapshot.domElements) {
    // Scan raw text even for hidden nodes to flag injection attempts
    const rawCombined = `${dom.accessibleName} ${dom.textContent} ${dom.description ?? ""}`;
    const scan = detectAndSanitizePromptInjection(rawCombined);
    if (scan.detected) {
      scan.matches.forEach((m) => injectionDetections.add(m));
    }

    if (!dom.visible) {
      continue;
    }

    const ax = dom.backendNodeId ? axByBackendId.get(dom.backendNodeId) : undefined;
    const role = normalizeRole(dom, ax);
    const rawName = (ax?.name || dom.accessibleName || dom.textContent || dom.placeholder || "").trim();
    const nameScan = detectAndSanitizePromptInjection(rawName);
    const textScan = detectAndSanitizePromptInjection(dom.textContent || "");
    const descScan = dom.description ? detectAndSanitizePromptInjection(dom.description) : null;

    if (nameScan.detected) nameScan.matches.forEach((m) => injectionDetections.add(m));
    if (textScan.detected) textScan.matches.forEach((m) => injectionDetections.add(m));
    if (descScan?.detected) descScan.matches.forEach((m) => injectionDetections.add(m));

    const cleanName = nameScan.sanitizedText || role;
    const cleanText = textScan.sanitizedText || undefined;

    // Validate links strictly
    let safeHref: string | undefined;
    if (role === "link" && dom.href) {
      const urlCheck = validateNavigationUrl(dom.href);
      if (!urlCheck.allowed) {
        blockedLinksCount += 1;
        extractionWarnings.push(
          `Blocked unsafe link "${cleanName}": ${urlCheck.reason ?? "unsafe URL"}`
        );
        continue;
      }
      safeHref = urlCheck.normalizedUrl;
    }

    // Validate image/video media URLs strictly (http/https only)
    let safeMediaSrc: string | undefined;
    let safePosterSrc: string | undefined;
    let cleanMediaAlt: string | undefined;
    if (role === "img" || role === "video") {
      if (!dom.mediaSrc) continue;
      const srcCheck = validateNavigationUrl(dom.mediaSrc);
      if (!srcCheck.allowed || !srcCheck.normalizedUrl) {
        blockedLinksCount += 1;
        extractionWarnings.push(
          `Blocked unsafe media source for "${cleanName}": ${srcCheck.reason ?? "unsafe URL"}`
        );
        continue;
      }
      safeMediaSrc = srcCheck.normalizedUrl;
      if (dom.posterSrc) {
        const posterCheck = validateNavigationUrl(dom.posterSrc);
        if (posterCheck.allowed && posterCheck.normalizedUrl) {
          safePosterSrc = posterCheck.normalizedUrl;
        }
      }
      const altScan = detectAndSanitizePromptInjection(dom.mediaAlt || cleanName);
      if (altScan.detected) altScan.matches.forEach((m) => injectionDetections.add(m));
      cleanMediaAlt = altScan.sanitizedText || (role === "video" ? "Embedded video" : "Image");
    }

    const sensitive = isSensitiveField({
      inputType: dom.inputType,
      nameAttr: dom.nameAttr,
      accessibleName: cleanName,
      autocomplete: dom.autocomplete,
    });
    if (sensitive) {
      sensitiveFieldsRedacted += 1;
    }

    const regionKind = resolveRegionKind(dom);
    const region = ensureRegion(regionKind, dom.regionLabel);

    const sig = `${role}|${cleanName}|${dom.formId ?? ""}|${dom.tagName.toLowerCase()}|${dom.idAttr ?? ""}`;
    const elementId = makeStableId(role, dom.idAttr || cleanName, sig);

    const sourceRef: ElementReference = {
      pageId: snapshot.pageId,
      revision,
      backendNodeId: dom.backendNodeId,
      locator: dom.locator,
      role,
      accessibleName: cleanName,
      tagName: dom.tagName.toLowerCase(),
      domId: dom.idAttr,
      nameAttr: dom.nameAttr,
    };

    const element: SemanticElement = {
      id: elementId,
      role,
      name: cleanName,
      textContent: sensitive ? undefined : cleanText,
      description: descScan?.sanitizedText || undefined,
      value: sensitive ? undefined : dom.value,
      checked: dom.checked,
      href: safeHref,
      mediaSrc: safeMediaSrc,
      posterSrc: safePosterSrc,
      mediaAlt: cleanMediaAlt,
      inputType: dom.inputType,
      options: dom.options,
      headingLevel: dom.headingLevel,
      tableData: dom.tableData,
      listItems: dom.listItems?.map((item) => detectAndSanitizePromptInjection(item).sanitizedText),
      regionId: region.id,
      formId: dom.formId,
      errorMessage: dom.errorMessage
        ? detectAndSanitizePromptInjection(dom.errorMessage).sanitizedText
        : undefined,
      constraints:
        dom.required || dom.inputType || dom.errorMessage
          ? {
              required: dom.required,
              inputType: dom.inputType,
              errorMessage: dom.errorMessage,
            }
          : undefined,
      visible: dom.visible,
      enabled: !dom.disabled,
      sensitive: sensitive || undefined,
      sourceRef,
      provenance: {
        source: ax ? "merged" : "dom",
        extractedAt: snapshot.capturedAt,
        confidence: ax ? 0.96 : 0.84,
        sanitizedInjectionFlag: nameScan.detected || textScan.detected || undefined,
      },
    };

    elements.push(element);
    region.elementIds.push(elementId);

    // Derive strictly grounded actions for interactive controls
    if (!element.enabled) continue;

    const isSearchForm = Boolean(dom.formId && searchFormIds.has(dom.formId));
    const confLevel = options?.confirmationLevel ?? "standard";

    if (role === "link" && safeHref) {
      const risk = classifyActionRisk({
        kind: "navigate",
        label: cleanName,
        href: safeHref,
        confirmationLevel: confLevel,
      });
      actions.push({
        id: makeStableId("act-nav", cleanName),
        label: cleanName,
        kind: "navigate",
        targetElementId: elementId,
        href: safeHref,
        requiresConfirmation: risk.requiresConfirmation,
        riskLevel: risk.riskLevel,
        riskReasons: risk.reasons,
        preconditions: ["Target link is visible and enabled"],
        expectedOutcome: `Navigate to ${cleanName}`,
      });
    } else if (role === "button") {
      const isSubmit =
        dom.inputType === "submit" ||
        (dom.tagName.toLowerCase() === "button" && (dom.inputType === "submit" || (!dom.inputType && Boolean(dom.formId))));
      const kind = isSubmit ? "submit" : "click";
      const risk = classifyActionRisk({
        kind,
        label: cleanName,
        isSearchForm,
        confirmationLevel: confLevel,
      });
      actions.push({
        id: makeStableId(isSubmit ? "act-submit" : "act-click", cleanName),
        label: cleanName,
        kind,
        targetElementId: elementId,
        formId: dom.formId,
        requiresConfirmation: risk.requiresConfirmation,
        riskLevel: risk.riskLevel,
        riskReasons: risk.reasons,
        preconditions: ["Button is visible and enabled"],
        expectedOutcome: isSubmit ? `Submit "${cleanName}"` : `Activate "${cleanName}"`,
      });
    } else if (role === "textbox" || role === "searchbox") {
      actions.push({
        id: makeStableId("act-fill", cleanName),
        label: `Fill ${cleanName}`,
        kind: "fill",
        targetElementId: elementId,
        formId: dom.formId,
        requiresConfirmation: false,
        riskLevel: "moderate",
        riskReasons: [],
        preconditions: ["Input field is editable"],
        expectedOutcome: `Update value of "${cleanName}"`,
      });
    } else if (role === "combobox") {
      actions.push({
        id: makeStableId("act-select", cleanName),
        label: `Select ${cleanName}`,
        kind: "select",
        targetElementId: elementId,
        formId: dom.formId,
        requiresConfirmation: false,
        riskLevel: "moderate",
        riskReasons: [],
        preconditions: ["Select control is enabled"],
        expectedOutcome: `Choose an option for "${cleanName}"`,
      });
    } else if (role === "checkbox" || role === "radio") {
      actions.push({
        id: makeStableId("act-check", cleanName),
        label: cleanName,
        kind: "check",
        targetElementId: elementId,
        formId: dom.formId,
        requiresConfirmation: false,
        riskLevel: "moderate",
        riskReasons: [],
        preconditions: ["Control is enabled"],
        expectedOutcome: `Toggle "${cleanName}"`,
      });
    }
  }

  // History actions (only if browser reports capability)
  if (snapshot.canGoBack) {
    actions.push({
      id: "act-browser-back",
      label: "Go back to previous page",
      kind: "back",
      requiresConfirmation: false,
      riskLevel: "safe",
      riskReasons: [],
      preconditions: ["Browser history has a previous page"],
      expectedOutcome: "Return to the previous page",
    });
  }
  if (snapshot.canGoForward) {
    actions.push({
      id: "act-browser-forward",
      label: "Go forward to next page",
      kind: "forward",
      requiresConfirmation: false,
      riskLevel: "safe",
      riskReasons: [],
      preconditions: ["Browser history has a forward page"],
      expectedOutcome: "Advance to the next page",
    });
  }

  // Build Semantic Workflows from observed forms & search interfaces
  const workflows: SemanticWorkflow[] = [];
  const formGroups = new Map<string, SemanticElement[]>();
  for (const el of elements) {
    if (el.formId) {
      const list = formGroups.get(el.formId) ?? [];
      list.push(el);
      formGroups.set(el.formId, list);
    }
  }

  for (const [formId, formElements] of formGroups.entries()) {
    const isSearch = searchFormIds.has(formId);
    const submitAction = actions.find((a) => a.formId === formId && a.kind === "submit");
    const inputElements = formElements.filter(
      (e) =>
        e.role === "textbox" ||
        e.role === "searchbox" ||
        e.role === "combobox" ||
        e.role === "checkbox" ||
        e.role === "radio"
    );

    if (inputElements.length > 0) {
      const steps = inputElements.map((el, index) => {
        const elActions = actions
          .filter((a) => a.targetElementId === el.id)
          .map((a) => a.id);
        return {
          stepNumber: index + 1,
          title: el.name,
          description: el.constraints?.required ? "Required field" : "Optional field",
          elementIds: [el.id],
          actionIds: elActions,
          required: Boolean(el.constraints?.required),
        };
      });

      if (submitAction) {
        steps.push({
          stepNumber: steps.length + 1,
          title: submitAction.label,
          description: submitAction.requiresConfirmation
            ? "Review and confirm before submitting"
            : "Submit form",
          elementIds: submitAction.targetElementId ? [submitAction.targetElementId] : [],
          actionIds: [submitAction.id],
          required: true,
        });
      }

      workflows.push({
        id: `workflow-${slugify(formId) || "form"}`,
        title: isSearch ? "Search" : `Complete ${formId.replace(/[-_]/g, " ")}`,
        kind: isSearch ? "search" : "form",
        formId,
        steps,
        submitActionId: submitAction?.id,
      });
    }
  }

  // Infer page purpose deterministically
  const primaryHeading = elements.find((e) => e.role === "heading" && e.headingLevel === 1);
  let purpose = "Information and navigation";
  if (workflows.some((w) => w.kind === "search")) {
    purpose = "Search and browse results";
  } else if (workflows.some((w) => w.kind === "form")) {
    purpose = "Form submission workflow";
  } else if (primaryHeading) {
    purpose = `Information page: ${primaryHeading.name}`;
  }

  if (snapshot.unsupportedFeatures.length > 0) {
    extractionWarnings.push(
      `Unsupported website features detected: ${snapshot.unsupportedFeatures.join(", ")}`
    );
  }

  const incomplete =
    elements.length === 0 ||
    snapshot.unsupportedFeatures.length > 0 ||
    Boolean(snapshot.loadError);

  const confidence =
    elements.length === 0
      ? 0.1
      : Math.max(
          0.35,
          Math.min(
            0.98,
            (snapshot.axNodes.length > 0 ? 0.92 : 0.78) -
              snapshot.unsupportedFeatures.length * 0.12 -
              (snapshot.loadError ? 0.3 : 0)
          )
        );

  const cleanTitle = detectAndSanitizePromptInjection(snapshot.title || "Untitled Page").sanitizedText;

  return {
    schemaVersion: SEMANTIC_SCHEMA_VERSION,
    pageId: snapshot.pageId,
    url: snapshot.url,
    title: cleanTitle,
    purpose,
    revision,
    capturedAt: snapshot.capturedAt,
    regions: Array.from(regionsMap.values()),
    elements,
    actions,
    workflows,
    extractionWarnings,
    unsupportedFeatures: [...snapshot.unsupportedFeatures],
    confidence: Number(confidence.toFixed(2)),
    incomplete,
    securityFlags: {
      promptInjectionDetected: injectionDetections.size > 0,
      injectionDetections: Array.from(injectionDetections),
      blockedLinksCount,
      sensitiveFieldsRedacted,
    },
  };
}

export interface SemanticValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateSemanticPage(page: SemanticPage): SemanticValidationResult {
  const parsed = SemanticPageSchema.safeParse(page);
  const errors: string[] = [];

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      errors.push(`${issue.path.join(".")}: ${issue.message}`);
    }
    return { valid: false, errors };
  }

  const elementIds = new Set(page.elements.map((e) => e.id));
  for (const action of page.actions) {
    if (action.targetElementId && !elementIds.has(action.targetElementId)) {
      errors.push(
        `Action "${action.id}" references missing element "${action.targetElementId}".`
      );
    }
    if (action.href) {
      const check = validateNavigationUrl(action.href);
      if (!check.allowed) {
        errors.push(`Action "${action.id}" contains unsafe URL: ${check.reason}`);
      }
    }
  }

  for (const el of page.elements) {
    if (el.sourceRef && el.sourceRef.revision !== page.revision) {
      errors.push(
        `Element "${el.id}" has stale reference revision ${el.sourceRef.revision} (page is ${page.revision}).`
      );
    }
  }

  return { valid: errors.length === 0, errors };
}

export function isElementReferenceStale(
  ref: ElementReference | undefined,
  currentPage: SemanticPage | null
): boolean {
  if (!ref || !currentPage) return true;
  return ref.pageId !== currentPage.pageId || ref.revision !== currentPage.revision;
}
