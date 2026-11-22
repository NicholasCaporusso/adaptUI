import { z } from "zod";
import {
  UI_SCHEMA_VERSION,
  type AccessibilityProfile,
  type SemanticElement,
  type SemanticPage,
} from "@adaptui/shared-types";
import { validateNavigationUrl } from "@adaptui/security";

export const ALLOWED_UI_COMPONENT_TYPES = [
  "section",
  "heading",
  "text",
  "image",
  "video",
  "link",
  "button",
  "input",
  "select",
  "checkbox",
  "radioGroup",
  "form",
  "table",
  "list",
  "dialog",
  "status",
  "error",
  "taskStep",
  "navigation",
] as const;

const BaseNodeSchema = z.object({
  id: z.string().min(1),
  sourceElementId: z.string().optional(),
});

export const HeadingNodeSchema = BaseNodeSchema.extend({
  type: z.literal("heading"),
  level: z.number().int().min(1).max(6),
  text: z.string(),
}).strict();

export const TextNodeSchema = BaseNodeSchema.extend({
  type: z.literal("text"),
  text: z.string(),
}).strict();

export const ImageNodeSchema = BaseNodeSchema.extend({
  type: z.literal("image"),
  src: z.string().min(1),
  alt: z.string(),
  caption: z.string().optional(),
}).strict();

export const VideoNodeSchema = BaseNodeSchema.extend({
  type: z.literal("video"),
  src: z.string().min(1),
  poster: z.string().optional(),
  title: z.string().min(1),
  caption: z.string().optional(),
}).strict();

export const LinkNodeSchema = BaseNodeSchema.extend({
  type: z.literal("link"),
  label: z.string().min(1),
  actionId: z.string().min(1),
  href: z.string().optional(),
}).strict();

export const ButtonNodeSchema = BaseNodeSchema.extend({
  type: z.literal("button"),
  label: z.string().min(1),
  actionId: z.string().min(1),
  variant: z.enum(["primary", "secondary", "danger"]).optional(),
  requiresConfirmation: z.boolean().optional(),
}).strict();

export const InputNodeSchema = BaseNodeSchema.extend({
  type: z.literal("input"),
  label: z.string().min(1),
  actionId: z.string().min(1),
  inputType: z.string().optional(),
  value: z.string().optional(),
  required: z.boolean().optional(),
  errorMessage: z.string().optional(),
  sensitive: z.boolean().optional(),
}).strict();

export const SelectNodeSchema = BaseNodeSchema.extend({
  type: z.literal("select"),
  label: z.string().min(1),
  actionId: z.string().min(1),
  value: z.string().optional(),
  required: z.boolean().optional(),
  options: z.array(
    z.object({
      value: z.string(),
      label: z.string(),
    })
  ),
}).strict();

export const CheckboxNodeSchema = BaseNodeSchema.extend({
  type: z.literal("checkbox"),
  label: z.string().min(1),
  actionId: z.string().min(1),
  checked: z.boolean().optional(),
  required: z.boolean().optional(),
  errorMessage: z.string().optional(),
}).strict();

export const RadioGroupNodeSchema = BaseNodeSchema.extend({
  type: z.literal("radioGroup"),
  label: z.string().min(1),
  name: z.string().min(1),
  options: z.array(
    z.object({
      label: z.string().min(1),
      value: z.string(),
      actionId: z.string().min(1),
      checked: z.boolean().optional(),
      sourceElementId: z.string().optional(),
    })
  ),
}).strict();

export const TableNodeSchema = BaseNodeSchema.extend({
  type: z.literal("table"),
  caption: z.string().optional(),
  headers: z.array(z.string()),
  rows: z.array(z.array(z.string())),
}).strict();

export const ListNodeSchema = BaseNodeSchema.extend({
  type: z.literal("list"),
  ordered: z.boolean().optional(),
  items: z.array(z.string()),
}).strict();

export const StatusNodeSchema = BaseNodeSchema.extend({
  type: z.literal("status"),
  message: z.string().min(1),
  tone: z.enum(["info", "success", "warning"]).optional(),
}).strict();

export const ErrorNodeSchema = BaseNodeSchema.extend({
  type: z.literal("error"),
  message: z.string().min(1),
}).strict();

export const NavigationNodeSchema = BaseNodeSchema.extend({
  type: z.literal("navigation"),
  label: z.string().min(1),
  links: z.array(
    z.object({
      id: z.string().min(1),
      label: z.string().min(1),
      actionId: z.string().min(1),
      sourceElementId: z.string().optional(),
    })
  ),
}).strict();

export type UIComponentNode =
  | z.infer<typeof HeadingNodeSchema>
  | z.infer<typeof TextNodeSchema>
  | z.infer<typeof ImageNodeSchema>
  | z.infer<typeof VideoNodeSchema>
  | z.infer<typeof LinkNodeSchema>
  | z.infer<typeof ButtonNodeSchema>
  | z.infer<typeof InputNodeSchema>
  | z.infer<typeof SelectNodeSchema>
  | z.infer<typeof CheckboxNodeSchema>
  | z.infer<typeof RadioGroupNodeSchema>
  | z.infer<typeof TableNodeSchema>
  | z.infer<typeof ListNodeSchema>
  | z.infer<typeof StatusNodeSchema>
  | z.infer<typeof ErrorNodeSchema>
  | z.infer<typeof NavigationNodeSchema>
  | {
      id: string;
      type: "section";
      title: string;
      sourceElementId?: string;
      children: UIComponentNode[];
    }
  | {
      id: string;
      type: "form";
      title: string;
      formId?: string;
      sourceElementId?: string;
      children: UIComponentNode[];
    }
  | {
      id: string;
      type: "taskStep";
      stepNumber: number;
      totalSteps: number;
      title: string;
      description?: string;
      required?: boolean;
      sourceElementId?: string;
      children: UIComponentNode[];
    }
  | {
      id: string;
      type: "dialog";
      title: string;
      description?: string;
      sourceElementId?: string;
      children: UIComponentNode[];
    };

export const UIComponentNodeSchema: z.ZodType<UIComponentNode> = z.lazy(() =>
  z.union([
    HeadingNodeSchema,
    TextNodeSchema,
    ImageNodeSchema,
    VideoNodeSchema,
    LinkNodeSchema,
    ButtonNodeSchema,
    InputNodeSchema,
    SelectNodeSchema,
    CheckboxNodeSchema,
    RadioGroupNodeSchema,
    TableNodeSchema,
    ListNodeSchema,
    StatusNodeSchema,
    ErrorNodeSchema,
    NavigationNodeSchema,
    BaseNodeSchema.extend({
      type: z.literal("section"),
      title: z.string().min(1),
      children: z.array(UIComponentNodeSchema),
    }).strict(),
    BaseNodeSchema.extend({
      type: z.literal("form"),
      title: z.string().min(1),
      formId: z.string().optional(),
      children: z.array(UIComponentNodeSchema),
    }).strict(),
    BaseNodeSchema.extend({
      type: z.literal("taskStep"),
      stepNumber: z.number().int().positive(),
      totalSteps: z.number().int().positive(),
      title: z.string().min(1),
      description: z.string().optional(),
      required: z.boolean().optional(),
      children: z.array(UIComponentNodeSchema),
    }).strict(),
    BaseNodeSchema.extend({
      type: z.literal("dialog"),
      title: z.string().min(1),
      description: z.string().optional(),
      children: z.array(UIComponentNodeSchema),
    }).strict(),
  ])
);

export const AccessibleUISpecSchema = z
  .object({
    schemaVersion: z.string(),
    pageId: z.string().min(1),
    pageRevision: z.number().int().positive(),
    layout: z.enum(["task", "reading", "search", "form"]),
    title: z.string().min(1),
    summary: z.string().optional(),
    incompleteNotice: z.string().optional(),
    securityNotice: z.string().optional(),
    components: z.array(UIComponentNodeSchema),
  })
  .strict();

export type AccessibleUISpec = z.infer<typeof AccessibleUISpecSchema>;

export interface UIValidationResult {
  valid: boolean;
  errors: string[];
  spec?: AccessibleUISpec;
}

export function validateAccessibleUISpec(
  rawSpec: unknown,
  semanticPage: SemanticPage
): UIValidationResult {
  const parsed = AccessibleUISpecSchema.safeParse(rawSpec);
  if (!parsed.success) {
    return {
      valid: false,
      errors: parsed.error.issues.map((i) => `${i.path.join(".") || "root"}: ${i.message}`),
    };
  }

  const spec = parsed.data;
  const errors: string[] = [];

  if (spec.pageId !== semanticPage.pageId) {
    errors.push(`Spec pageId "${spec.pageId}" does not match current page "${semanticPage.pageId}".`);
  }
  if (spec.pageRevision !== semanticPage.revision) {
    errors.push(
      `Spec revision ${spec.pageRevision} does not match current page revision ${semanticPage.revision}.`
    );
  }

  const actionById = new Map(semanticPage.actions.map((a) => [a.id, a]));
  const elementById = new Map(semanticPage.elements.map((e) => [e.id, e]));
  const referencedElements = new Set<string>();
  const referencedActions = new Set<string>();

  const visit = (node: UIComponentNode): void => {
    if (node.sourceElementId) {
      if (!elementById.has(node.sourceElementId)) {
        errors.push(`Component "${node.id}" references unknown sourceElementId "${node.sourceElementId}".`);
      } else {
        referencedElements.add(node.sourceElementId);
      }
    }

    switch (node.type) {
      case "image": {
        const srcCheck = validateNavigationUrl(node.src);
        if (!srcCheck.allowed) {
          errors.push(`Image "${node.id}" contains unsafe URL: ${srcCheck.reason}`);
        }
        break;
      }
      case "video": {
        const srcCheck = validateNavigationUrl(node.src);
        if (!srcCheck.allowed) {
          errors.push(`Video "${node.id}" contains unsafe URL: ${srcCheck.reason}`);
        }
        if (node.poster) {
          const posterCheck = validateNavigationUrl(node.poster);
          if (!posterCheck.allowed) {
            errors.push(`Video "${node.id}" contains unsafe poster URL: ${posterCheck.reason}`);
          }
        }
        break;
      }
      case "link": {
        if (!actionById.has(node.actionId)) {
          errors.push(`Link "${node.id}" references ungrounded actionId "${node.actionId}".`);
        } else {
          referencedActions.add(node.actionId);
        }
        if (node.href) {
          const check = validateNavigationUrl(node.href);
          if (!check.allowed) {
            errors.push(`Link "${node.id}" contains unsafe URL: ${check.reason}`);
          }
        }
        break;
      }
      case "button": {
        const action = actionById.get(node.actionId);
        if (!action) {
          errors.push(`Button "${node.id}" references ungrounded actionId "${node.actionId}".`);
        } else {
          referencedActions.add(node.actionId);
          if (action.requiresConfirmation && node.requiresConfirmation === false) {
            errors.push(
              `Button "${node.id}" attempted to disable confirmation on consequential action "${action.id}".`
            );
          }
        }
        break;
      }
      case "input":
      case "select":
      case "checkbox": {
        if (!actionById.has(node.actionId)) {
          errors.push(`Control "${node.id}" references ungrounded actionId "${node.actionId}".`);
        } else {
          referencedActions.add(node.actionId);
        }
        break;
      }
      case "radioGroup": {
        for (const opt of node.options) {
          if (!actionById.has(opt.actionId)) {
            errors.push(`Radio option "${opt.label}" references ungrounded actionId "${opt.actionId}".`);
          } else {
            referencedActions.add(opt.actionId);
          }
          if (opt.sourceElementId) {
            if (!elementById.has(opt.sourceElementId)) {
              errors.push(`Radio option "${opt.label}" references unknown sourceElementId "${opt.sourceElementId}".`);
            } else {
              referencedElements.add(opt.sourceElementId);
            }
          }
        }
        break;
      }
      case "navigation": {
        for (const link of node.links) {
          if (!actionById.has(link.actionId)) {
            errors.push(`Navigation link "${link.label}" references ungrounded actionId "${link.actionId}".`);
          } else {
            referencedActions.add(link.actionId);
          }
          if (link.sourceElementId) {
            if (!elementById.has(link.sourceElementId)) {
              errors.push(`Navigation link "${link.label}" references unknown sourceElementId "${link.sourceElementId}".`);
            } else {
              referencedElements.add(link.sourceElementId);
            }
          }
        }
        break;
      }
      case "section":
      case "form":
      case "taskStep":
      case "dialog": {
        node.children.forEach(visit);
        break;
      }
      default:
        break;
    }
  };

  spec.components.forEach(visit);

  // Principle 1: Ensure required, visible, enabled form fields are not silently omitted
  for (const el of semanticPage.elements) {
    if (el.visible && el.enabled && el.constraints?.required && el.formId) {
      const hasAction = semanticPage.actions.some(
        (a) => a.targetElementId === el.id && referencedActions.has(a.id)
      );
      if (!referencedElements.has(el.id) && !hasAction) {
        errors.push(`Required form field "${el.name}" (${el.id}) was omitted from reconstructed UI.`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    spec: errors.length === 0 ? spec : undefined,
  };
}

function elementToUINode(
  el: SemanticElement,
  page: SemanticPage,
  profile: AccessibilityProfile
): UIComponentNode | null {
  const action = page.actions.find((a) => a.targetElementId === el.id);

  if (el.role === "img" && el.mediaSrc) {
    if (!profile.presentation.showImages) return null;
    return {
      id: `ui-${el.id}`,
      type: "image",
      src: el.mediaSrc,
      alt: el.mediaAlt || el.name || "Image",
      caption: el.mediaAlt || undefined,
      sourceElementId: el.id,
    };
  }
  if (el.role === "video" && el.mediaSrc) {
    if (!profile.presentation.showVideos) return null;
    return {
      id: `ui-${el.id}`,
      type: "video",
      src: el.mediaSrc,
      poster: el.posterSrc,
      title: el.mediaAlt || el.name || "Video",
      caption: el.mediaAlt || undefined,
      sourceElementId: el.id,
    };
  }

  if (el.role === "heading") {
    return {
      id: `ui-${el.id}`,
      type: "heading",
      level: el.headingLevel ?? 2,
      text: el.name,
      sourceElementId: el.id,
    };
  }
  if (el.role === "paragraph" || el.role === "text") {
    const text = el.textContent || el.name;
    if (!text) return null;
    return {
      id: `ui-${el.id}`,
      type: "text",
      text,
      sourceElementId: el.id,
    };
  }
  if (el.role === "alert") {
    const msg = el.textContent || el.name;
    if (!msg) return null;
    return {
      id: `ui-${el.id}`,
      type: "error",
      message: msg,
      sourceElementId: el.id,
    };
  }
  if (el.role === "status") {
    const msg = el.textContent || el.name;
    if (!msg) return null;
    return {
      id: `ui-${el.id}`,
      type: "status",
      message: msg,
      tone: msg.toLowerCase().includes("submitted") || msg.toLowerCase().includes("confirmation")
        ? "success"
        : "info",
      sourceElementId: el.id,
    };
  }
  if (el.role === "table" && el.tableData) {
    return {
      id: `ui-${el.id}`,
      type: "table",
      caption: el.tableData.caption,
      headers: el.tableData.headers,
      rows: el.tableData.rows,
      sourceElementId: el.id,
    };
  }
  if (el.role === "list" && el.listItems && el.listItems.length > 0) {
    return {
      id: `ui-${el.id}`,
      type: "list",
      items: el.listItems,
      sourceElementId: el.id,
    };
  }
  if (el.role === "link" && action) {
    return {
      id: `ui-${el.id}`,
      type: "link",
      label: el.name,
      actionId: action.id,
      href: el.href,
      sourceElementId: el.id,
    };
  }
  if (el.role === "button" && action) {
    return {
      id: `ui-${el.id}`,
      type: "button",
      label: el.name,
      actionId: action.id,
      variant: action.riskLevel === "consequential" ? "danger" : action.kind === "submit" ? "primary" : "secondary",
      requiresConfirmation: action.requiresConfirmation,
      sourceElementId: el.id,
    };
  }
  if ((el.role === "textbox" || el.role === "searchbox") && action) {
    return {
      id: `ui-${el.id}`,
      type: "input",
      label: el.name,
      actionId: action.id,
      inputType: el.sensitive ? "password" : el.inputType || (el.role === "searchbox" ? "search" : "text"),
      value: el.sensitive ? "" : el.value ?? "",
      required: el.constraints?.required,
      errorMessage: el.errorMessage,
      sensitive: el.sensitive,
      sourceElementId: el.id,
    };
  }
  if (el.role === "combobox" && action) {
    return {
      id: `ui-${el.id}`,
      type: "select",
      label: el.name,
      actionId: action.id,
      value: el.value,
      required: el.constraints?.required,
      options: (el.options ?? []).map((o) => ({ value: o.value, label: o.label })),
      sourceElementId: el.id,
    };
  }
  if (el.role === "checkbox" && action) {
    return {
      id: `ui-${el.id}`,
      type: "checkbox",
      label: el.name,
      actionId: action.id,
      checked: el.checked,
      required: el.constraints?.required,
      errorMessage: el.errorMessage,
      sourceElementId: el.id,
    };
  }
  return null;
}

export interface AIOrganizationPlan {
  layout?: "task" | "reading" | "search" | "form";
  title?: string;
  summary?: string;
  prioritizedRegionIds?: string[];
}

export function generateDeterministicUISpec(
  page: SemanticPage,
  profile: AccessibilityProfile,
  aiPlan?: AIOrganizationPlan | null
): AccessibleUISpec {
  const components: UIComponentNode[] = [];
  const consumedElementIds = new Set<string>();

  // 1. Prominent errors and status messages first (WCAG error recovery)
  for (const el of page.elements) {
    if (el.role === "alert" || el.role === "status") {
      const node = elementToUINode(el, page, profile);
      if (node) {
        components.push(node);
        consumedElementIds.add(el.id);
      }
    }
  }

  // 2. Navigation landmark (simplified when configured)
  const navRegions = page.regions.filter((r) => r.kind === "navigation");
  const navLinks: Array<{ id: string; label: string; actionId: string; sourceElementId?: string }> = [];
  for (const navRegion of navRegions) {
    for (const elId of navRegion.elementIds) {
      const el = page.elements.find((e) => e.id === elId);
      const act = page.actions.find((a) => a.targetElementId === elId && a.kind === "navigate");
      if (el && act) {
        navLinks.push({
          id: `nav-${el.id}`,
          label: el.name,
          actionId: act.id,
          sourceElementId: el.id,
        });
        consumedElementIds.add(el.id);
      }
    }
  }

  if (navLinks.length > 0) {
    const maxNav = profile.workflow.simplifyNavigation ? 6 : navLinks.length;
    components.push({
      id: "ui-primary-navigation",
      type: "navigation",
      label: "Page Navigation",
      links: navLinks.slice(0, maxNav),
    });
  }

  // 3. Workflows (Search & Step-by-step Forms)
  for (const wf of page.workflows) {
    const formElements = page.elements.filter((e) => e.formId === wf.formId);
    if (formElements.length === 0) continue;

    // Group radio buttons by nameAttr
    const radiosByName = new Map<string, SemanticElement[]>();
    for (const el of formElements) {
      if (el.role === "radio") {
        const groupName = el.sourceRef?.nameAttr || "options";
        const arr = radiosByName.get(groupName) ?? [];
        arr.push(el);
        radiosByName.set(groupName, arr);
      }
    }
    const emittedRadioGroups = new Set<string>();

    const buildControlNode = (el: SemanticElement): UIComponentNode | null => {
      if (el.role === "radio") {
        const groupName = el.sourceRef?.nameAttr || "options";
        if (emittedRadioGroups.has(groupName)) return null;
        emittedRadioGroups.add(groupName);
        const group = radiosByName.get(groupName) ?? [el];
        const options = group
          .map((r) => {
            const act = page.actions.find((a) => a.targetElementId === r.id);
            consumedElementIds.add(r.id);
            return act
              ? {
                  label: r.name,
                  value: r.value || r.name,
                  actionId: act.id,
                  checked: r.checked,
                  sourceElementId: r.id,
                }
              : null;
          })
          .filter((x): x is NonNullable<typeof x> => x !== null);
        if (options.length === 0) return null;
        return {
          id: `ui-radio-${groupName}`,
          type: "radioGroup",
          label: groupName.replace(/([A-Z])/g, " $1").trim(),
          name: groupName,
          options,
        };
      }
      consumedElementIds.add(el.id);
      return elementToUINode(el, page, profile);
    };

    if (wf.kind === "form" && profile.workflow.preferStepByStepForms) {
      const stepNodes: UIComponentNode[] = [];
      const rawSteps: Array<{ title: string; description?: string; required?: boolean; nodes: UIComponentNode[] }> = [];

      for (const el of formElements) {
        if (consumedElementIds.has(el.id)) continue;
        const node = buildControlNode(el);
        if (!node) continue;
        rawSteps.push({
          title: el.role === "radio" ? "Choose Option" : el.name,
          description: el.constraints?.required ? "Required" : el.role === "button" ? "Action" : "Optional",
          required: el.constraints?.required,
          nodes: [node],
        });
      }

      rawSteps.forEach((step, idx) => {
        stepNodes.push({
          id: `ui-${wf.id}-step-${idx + 1}`,
          type: "taskStep",
          stepNumber: idx + 1,
          totalSteps: rawSteps.length,
          title: step.title,
          description: step.description,
          required: step.required,
          children: step.nodes,
        });
      });

      components.push({
        id: `ui-${wf.id}`,
        type: "form",
        title: wf.title,
        formId: wf.formId,
        children: stepNodes,
      });
    } else {
      const children: UIComponentNode[] = [];
      for (const el of formElements) {
        if (consumedElementIds.has(el.id)) continue;
        const node = buildControlNode(el);
        if (node) children.push(node);
      }
      if (children.length > 0) {
        components.push({
          id: `ui-${wf.id}`,
          type: "form",
          title: wf.title,
          formId: wf.formId,
          children,
        });
      }
    }
  }

  // 4. Remaining content regions (respecting AI region priority & secondary-content profile preference)
  let orderedRegions = page.regions.filter(
    (r) => r.kind !== "navigation" && r.kind !== "alert" && r.kind !== "status"
  );
  if (aiPlan?.prioritizedRegionIds?.length) {
    const rank = new Map(aiPlan.prioritizedRegionIds.map((id, i) => [id, i]));
    orderedRegions = [...orderedRegions].sort(
      (a, b) => (rank.get(a.id) ?? 999) - (rank.get(b.id) ?? 999)
    );
  }

  for (const region of orderedRegions) {
    if (!region.primary && profile.workflow.hideSecondaryContent && !profile.workflow.showAdvancedOptions) {
      continue;
    }
    const children: UIComponentNode[] = [];
    for (const elId of region.elementIds) {
      if (consumedElementIds.has(elId)) continue;
      const el = page.elements.find((e) => e.id === elId);
      if (!el) continue;
      const node = elementToUINode(el, page, profile);
      if (node) {
        children.push(node);
        consumedElementIds.add(el.id);
      }
    }
    if (children.length > 0) {
      components.push({
        id: `ui-${region.id}`,
        type: "section",
        title: region.label || "Main Content",
        children,
      });
    }
  }

  const layout: AccessibleUISpec["layout"] =
    aiPlan?.layout ??
    (page.workflows.some((w) => w.kind === "search")
      ? "search"
      : page.workflows.some((w) => w.kind === "form")
      ? "form"
      : "reading");

  const incompleteNotice = page.incomplete
    ? `Partial reconstruction (${Math.round(page.confidence * 100)}% confidence): ${
        page.extractionWarnings.join(" ") || "Some page features may require the Original Website view."
      }`
    : undefined;

  const securityNotice =
    page.securityFlags.promptInjectionDetected ||
    page.securityFlags.blockedLinksCount > 0 ||
    page.securityFlags.sensitiveFieldsRedacted > 0
      ? [
          page.securityFlags.promptInjectionDetected
            ? "Suspicious webpage instructions were detected and isolated."
            : null,
          page.securityFlags.blockedLinksCount > 0
            ? `${page.securityFlags.blockedLinksCount} unsafe link(s) were blocked.`
            : null,
          page.securityFlags.sensitiveFieldsRedacted > 0
            ? `${page.securityFlags.sensitiveFieldsRedacted} sensitive field(s) are protected from AI transmission.`
            : null,
        ]
          .filter(Boolean)
          .join(" ")
      : undefined;

  return {
    schemaVersion: UI_SCHEMA_VERSION,
    pageId: page.pageId,
    pageRevision: page.revision,
    layout,
    title: aiPlan?.title || page.title || "Accessible Page",
    summary: aiPlan?.summary || page.purpose,
    incompleteNotice,
    securityNotice,
    components,
  };
}
