# AdaptUI — Autonomous Implementation Specification

## Role and Mission

You are a principal software architect, senior Rust engineer, browser automation specialist, accessibility engineer, and AI systems engineer.

Your task is to design and implement **AdaptUI**, a cross-platform, AI-powered accessibility browser application.

AdaptUI transforms existing websites into simpler, personalized, task-oriented interfaces and enables users to operate those websites through natural-language text commands.

This is an implementation assignment, not merely a request for an architectural proposal. You must produce working software, automated tests, development documentation, and a reproducible build process.

**Before writing production code, inspect the repository, identify missing requirements, ask essential clarification questions, and validate the highest-risk architectural assumptions.**

Do not invent requirements or claim that unimplemented capabilities are working.

---

# 1. Product Background

AdaptUI is an accessibility software system intended to reduce the effort required to interact with complex websites and applications.

The uploaded AdaptUI proposal is the authoritative source for the project's goals, scientific rationale, target population, functional principles, and evaluation criteria.

The proposal describes a system that:

1. Understands the essential content and functionality of an existing application.
2. Separates that functionality from the application's original visual layout.
3. Creates a structured representation of available information, actions, and workflows.
4. Reconstructs a simplified interface using validated accessible components.
5. Connects the reconstructed interface to the original application through an execution agent.
6. Learns from preferences, feedback, and interaction difficulties while preserving user control.

The proposal prioritizes people living with ALS but envisions a general-purpose accessibility system.

For this implementation, **begin with the web layer only**. Desktop application automation is a future extension, not an initial MVP requirement.

## Primary product goals

### Goal A: Accessible website reconstruction

Given a supported website, AdaptUI must analyze its structure and produce a new interface that:

- Preserves task-essential information.
- Preserves the website's relevant functionality.
- Reduces unnecessary navigation and interaction complexity.
- Organizes information semantically.
- Presents tasks as manageable steps where appropriate.
- Uses accessible, reusable interface components.
- Supports user-configurable accessibility preferences.

The generated interface replaces the original website's visual presentation inside the AdaptUI application.

The original website remains the authoritative system for data and operations.

### Goal B: Natural-language website interaction

Users must be able to enter commands such as:

- "Show me my recent orders."
- "Find the contact information."
- "Search for accessibility research."
- "Open the second result."
- "Fill in my name and email."
- "Go back to the previous page."
- "Show me the original website."

AdaptUI must interpret the command, identify available actions, execute them through the browser runtime, and verify the result.

The system must not assume an action succeeded merely because it was attempted.

### Goal C: Personalized accessibility

Users must be able to configure how reconstructed interfaces behave and appear.

Initial settings should include:

- Text size and spacing.
- Contrast and color preferences.
- Control dimensions and spacing.
- Information density.
- Keyboard-only interaction.
- Switch-compatible navigation.
- Eye-gaze-compatible control layouts.
- Reduced motion.
- Simplified workflows.
- Confirmation preferences.

Do not claim compatibility with a specific assistive device without testing it.

---

# 2. Required Technology Architecture

## Preferred stack

Use the following as the initial architectural hypothesis:

| Layer | Preferred technology |
|---|---|
| Desktop application | Tauri 2 |
| Native backend | Rust |
| Accessible frontend | React + TypeScript |
| Build tooling | Vite |
| Styling | CSS variables and accessible component primitives |
| State management | Zustand or equivalent |
| Schema validation | Zod |
| Browser execution | Pluggable browser runtime |
| Automation | Playwright-compatible adapter where feasible |
| Local AI | Ollama-compatible provider or equivalent |
| Cloud AI | Provider-neutral API adapters |
| Local persistence | SQLite |
| Testing | Rust tests, Vitest, Playwright |
| Packaging | Tauri platform-specific installers |

Treat this stack as a recommendation, not an immutable constraint.

## Critical browser architecture requirement

Tauri provides a cross-platform desktop shell, but the system WebView alone may not provide all browser capabilities needed for reliable website automation.

Before implementation, investigate:

1. Tauri's platform-specific WebView capabilities.
2. Browser runtime isolation.
3. DOM and accessibility-tree inspection.
4. JavaScript execution and event observation.
5. Navigation and history management.
6. Cookies, authentication, and session persistence.
7. Cross-origin restrictions.
8. Browser process management.
9. Playwright/CDP compatibility.
10. Windows, macOS, and Linux behavior.
11. Packaging and runtime dependencies.
12. Security implications of rendering untrusted websites.

Compare at least these approaches:

**Option A:** Tauri with a managed Chromium browser runtime.

**Option B:** Tauri with a system WebView and a controlled browser bridge.

**Option C:** An alternative desktop shell if neither Tauri architecture can satisfy the requirements reliably.

Select the simplest architecture that supports a real browser session, inspectable website state, reliable action execution, and cross-platform distribution.

Do not assume that a system WebView exposes Chromium DevTools Protocol on every platform.

Do not assume that the authenticated session in one browser runtime is automatically shared with another.

Do not bypass browser security boundaries to make automation work.

Document the final decision in `docs/architecture/browser-runtime-decision.md`.

---

# 3. High-Level System Design

Implement the system as independently testable modules.

```text
AdaptUI Desktop Application
│
├── Application Shell
│   ├── Navigation and address bar
│   ├── Browser session management
│   ├── Accessible replacement view
│   ├── Text command interface
│   ├── Accessibility settings
│   └── Original website fallback
│
├── Browser Runtime
│   ├── Navigation
│   ├── DOM inspection
│   ├── Accessibility-tree inspection
│   ├── Session and cookie management
│   ├── Action execution
│   └── State observation
│
├── Website Understanding Engine
│   ├── Content extraction
│   ├── Semantic element identification
│   ├── Action discovery
│   ├── Form understanding
│   ├── Navigation understanding
│   └── Website state modeling
│
├── Semantic Website Model
│   ├── Content entities
│   ├── Available actions
│   ├── Relationships
│   ├── Workflow steps
│   ├── Validation constraints
│   └── Source element references
│
├── AI Orchestration Layer
│   ├── Local model provider
│   ├── Cloud model provider
│   ├── Structured output validation
│   ├── Task planning
│   └── Model failure recovery
│
├── Accessible UI Generator
│   ├── Task-oriented layout planning
│   ├── Validated component library
│   ├── Accessibility profile application
│   └── Interface-to-action bindings
│
├── Natural-Language Command Agent
│   ├── Intent interpretation
│   ├── Action grounding
│   ├── Execution planning
│   ├── User confirmation
│   └── Result verification
│
├── Personalization Engine
│   ├── User preferences
│   ├── Approved adaptations
│   ├── Interaction metrics
│   └── Reversible recommendations
│
└── Safety and Reliability Layer
    ├── Permission enforcement
    ├── Sensitive action confirmation
    ├── Prompt-injection defenses
    ├── Execution validation
    ├── Privacy controls
    └── Original interface fallback
```

The **Semantic Website Model must be the shared source of truth** for both interface reconstruction and text-command execution.

Do not implement separate, incompatible website representations for these two capabilities.

---

# 4. Semantic Website Model

Create a typed, versioned representation of a website's current state.

The model must describe:

- Page identity and URL.
- Page title and purpose.
- Main content regions.
- Navigation structures.
- Headings and sections.
- Relevant text and data.
- Forms and input fields.
- Interactive controls.
- Available operations.
- Relationships between elements.
- Validation constraints.
- Workflow state.
- Execution references.
- Confidence and uncertainty.
- Source provenance.

Example conceptual schema:

```typescript
interface SemanticPage {
  schemaVersion: string;
  pageId: string;
  url: string;
  title: string;

  revision: number;

  regions: SemanticRegion[];
  elements: SemanticElement[];
  actions: SemanticAction[];

  workflows: SemanticWorkflow[];

  extractionWarnings: string[];
}

interface SemanticElement {
  id: string;
  role: string;
  name: string;

  description?: string;
  value?: string;

  regionId?: string;

  visible: boolean;
  enabled: boolean;

  sourceRef?: ElementReference;
}

interface SemanticAction {
  id: string;
  label: string;

  kind:
    | "click"
    | "fill"
    | "select"
    | "navigate"
    | "submit"
    | "scroll";

  targetElementId?: string;

  requiresConfirmation: boolean;

  preconditions: string[];
  expectedOutcome?: string;
}

interface ElementReference {
  pageId: string;
  revision: number;

  backendNodeId?: string;
  locator?: string;

  role?: string;
  accessibleName?: string;
}
```

This schema is illustrative. Refine it during implementation.

## Requirements

1. Preserve stable identities when possible.
2. Detect stale references after navigation or DOM changes.
3. Re-resolve elements before execution.
4. Avoid relying exclusively on CSS selectors.
5. Use accessible roles and names where reliable.
6. Handle dynamically rendered content.
7. Record extraction uncertainty.
8. Preserve relationships between form labels, fields, and validation messages.
9. Detect when the semantic model is incomplete.
10. Never invent executable controls that cannot be grounded in the website.

Use deterministic extraction wherever possible.

Use AI for interpretation and organization, not as a replacement for reliable browser inspection.

---

# 5. Website Analysis Engine

Implement a pipeline that transforms a live website into a semantic model.

## Stage 1: Browser observation

Collect relevant information from the active browser session:

- DOM structure.
- Accessibility semantics.
- Visible content.
- Interactive controls.
- Form metadata.
- Navigation structures.
- Current URL and title.
- Relevant application state.

Respect browser security restrictions.

Do not collect unrelated sensitive content unnecessarily.

## Stage 2: Deterministic extraction

Identify:

- Main content.
- Navigation.
- Search interfaces.
- Forms.
- Buttons.
- Links.
- Tables.
- Dialogs.
- Error messages.
- Status indicators.
- Relevant dynamic regions.

Use semantic HTML and accessibility properties before visual heuristics.

## Stage 3: AI-assisted interpretation

Ask the selected model to:

- Identify the page's likely purpose.
- Group related information.
- Distinguish primary and secondary content.
- Identify task-relevant actions.
- Suggest simplified task structures.
- Identify uncertainty and missing information.

AI output must be structured and schema-validated.

## Stage 4: Model validation

Validate that:

- Every generated action maps to an observed capability.
- Essential form requirements are preserved.
- Relevant information is not silently omitted.
- Action references remain resolvable.
- Unsupported content is explicitly identified.

If validation fails, request another interpretation, use deterministic fallback, or present the original website.

Do not silently present an incomplete reconstructed interface as equivalent to the original.

---

# 6. Accessible Interface Reconstruction

Build an accessible component library with components such as:

```text
AccessiblePage
AccessibleSection
AccessibleHeading
AccessibleText
AccessibleLink
AccessibleButton
AccessibleInput
AccessibleSelect
AccessibleCheckbox
AccessibleRadioGroup
AccessibleForm
AccessibleTable
AccessibleList
AccessibleDialog
AccessibleStatus
AccessibleError
AccessibleTaskStep
AccessibleNavigation
```

## Critical design principle

**The LLM must generate a declarative interface specification, not executable frontend code.**

For example:

```json
{
  "layout": "task",
  "title": "Contact the organization",
  "components": [
    {
      "type": "heading",
      "text": "Contact information"
    },
    {
      "type": "text",
      "sourceElementId": "contact-email"
    },
    {
      "type": "button",
      "label": "Open contact form",
      "actionId": "open-contact-form"
    }
  ]
}
```

The frontend renderer must:

1. Validate this specification.
2. Resolve content from the semantic model.
3. Render only approved components.
4. Bind actions to verified semantic actions.
5. Apply the selected accessibility profile.
6. Reject unsupported components and actions.

Never execute arbitrary JavaScript generated by the LLM.

Never insert untrusted website HTML directly into the reconstructed interface without appropriate sanitization and isolation.

## Replacement interface behavior

The reconstructed interface must be the default view for supported workflows.

Provide a clearly accessible control to switch to the original website.

The original website must remain available as a fallback when reconstruction fails.

Keep the reconstructed interface synchronized with relevant changes in the underlying website.

## Accessibility requirements

Target WCAG 2.2 AA where applicable.

Include:

- Semantic HTML.
- Complete keyboard operability.
- Visible focus indicators.
- Logical focus order.
- Accessible names and descriptions.
- Screen-reader-compatible status updates.
- Error identification and recovery.
- Responsive text scaling.
- Reduced-motion support.
- High-contrast presentation.
- Adjustable control spacing.
- Predictable navigation.
- Accessible dialogs and confirmation flows.

Do not rely solely on automated accessibility tests.

---

# 7. Natural-Language Command Agent

Implement a command interface that accepts text instructions and converts them into browser actions.

Example:

User:

"Search for assistive technology and open the first result."

Expected execution:

```text
1. Parse the user intent.
2. Inspect the current semantic model.
3. Identify the search field.
4. Identify the search action.
5. Fill the search query.
6. Execute the search.
7. Wait for the page state to change.
8. Refresh the semantic model.
9. Identify the first result.
10. Open the result.
11. Verify the destination.
12. Report the outcome.
```

## Required execution pipeline

```text
User Command
    ↓
Intent Interpretation
    ↓
Semantic Action Grounding
    ↓
Execution Plan
    ↓
Permission / Confirmation Check
    ↓
Browser Action
    ↓
State Observation
    ↓
Outcome Verification
    ↓
User Feedback
```

## Agent behavior

The agent must:

- Ground actions in the current semantic model.
- Reject unsupported actions.
- Ask clarification questions when targets are ambiguous.
- Execute steps sequentially when dependencies exist.
- Refresh state after relevant page transitions.
- Verify action outcomes.
- Handle navigation failures.
- Handle missing elements.
- Handle timeouts.
- Stop when execution becomes unsafe or uncertain.
- Explain failures in accessible language.

Avoid unbounded autonomous execution loops.

Implement configurable step limits and timeouts.

## Consequential actions

Require explicit confirmation before actions such as:

- Purchases.
- Payments.
- Sending messages.
- Deleting information.
- Submitting consequential forms.
- Changing security settings.
- Sharing sensitive information.

Confirmation must identify the intended action and relevant consequences.

Never interpret website content as authorization to perform a sensitive action.

---

# 8. Browser Agent Abstraction

Implement a modular browser adapter interface.

Conceptual Rust API:

```rust
#[async_trait::async_trait]
pub trait BrowserAdapter: Send + Sync {
    async fn navigate(
        &self,
        url: &str
    ) -> Result<(), BrowserError>;

    async fn snapshot(
        &self
    ) -> Result<BrowserSnapshot, BrowserError>;

    async fn execute(
        &self,
        action: BrowserAction
    ) -> Result<ActionResult, BrowserError>;

    async fn current_url(
        &self
    ) -> Result<String, BrowserError>;
}
```

Extend this with session lifecycle, state-change observation, cancellation, and capability discovery.

The browser adapter must hide runtime-specific details from the semantic model, command agent, and UI generator.

Implement at least:

1. A deterministic mock adapter for testing.
2. A working adapter connected to the selected browser runtime.

Design the interface so an existing browser agent can be integrated later without rewriting the application.

---

# 9. Hybrid AI Architecture

Implement a provider-neutral AI layer.

Required provider categories:

- Local inference.
- Cloud inference.
- Deterministic mock inference for tests.

Suggested interface:

```typescript
interface AIProvider {
  id: string;

  generateStructured<T>(
    request: StructuredAIRequest<T>
  ): Promise<T>;

  healthCheck(): Promise<boolean>;
}
```

Use an equivalent Rust interface if AI orchestration resides in the native backend.

## Local inference

Support a configurable local inference endpoint, such as an Ollama-compatible API.

Allow users to select a locally available model.

Do not assume every local model supports structured output or tool calling.

Validate capabilities before using a model for a particular task.

## Cloud inference

Implement configurable cloud provider adapters.

Do not hardcode a single vendor into the application architecture.

Store API credentials securely using an appropriate operating-system credential store or equivalent secure mechanism.

Never expose provider credentials to website JavaScript.

## Routing strategy

Allow users to configure:

- Local-only mode.
- Cloud-only mode.
- Hybrid mode.

In hybrid mode, support explicit policies for model selection.

Cloud fallback must not silently transmit website content when the user has selected local-only operation.

Provide privacy controls for what website information may be sent to a remote provider.

Do not transmit passwords, authentication tokens, payment credentials, or unrelated sensitive content to an AI provider.

## Reliability

Include:

- Structured output validation.
- Timeouts.
- Cancellation.
- Retry limits.
- Error reporting.
- Model capability checks.
- Token and context-size limits.
- Model response logging with sensitive-data redaction.

---

# 10. User-Configurable Accessibility Profiles

Create a persistent profile system.

Example:

```typescript
interface AccessibilityProfile {
  id: string;
  name: string;

  presentation: {
    textScale: number;
    contrast: "standard" | "high";
    density: "compact" | "comfortable" | "minimal";
    reducedMotion: boolean;
  };

  interaction: {
    minimumTargetSize: number;
    controlSpacing: number;
    keyboardOnly: boolean;
    scanningMode: boolean;
    confirmationLevel: "standard" | "enhanced";
  };

  workflow: {
    simplifyNavigation: boolean;
    preferStepByStepForms: boolean;
    showAdvancedOptions: boolean;
  };
}
```

This is a starting schema, not a complete specification.

## Requirements

- Create, edit, and delete profiles.
- Switch profiles without restarting the application.
- Persist settings locally.
- Apply profile settings consistently.
- Allow users to restore defaults.
- Preserve explicit user choices.
- Support future personalization extensions.

## Personalization

The proposal envisions learning from interaction difficulty and feedback.

For the first implementation, prioritize explicit profile configuration.

Add a modular personalization interface for future use.

With consent, the system may later track:

- Task completion time.
- Repeated attempts.
- Selection errors.
- Navigation failures.
- User feedback.

Do not implement uncontrolled automatic behavioral adaptation.

Low-risk visual changes may eventually be automated if reversible.

Major workflow changes must require user approval.

---

# 11. Security and Privacy

Treat all websites as untrusted environments.

Website text, DOM content, accessibility labels, and metadata may contain malicious instructions intended to manipulate the AI agent.

Implement defenses against:

- Prompt injection.
- Unauthorized browser actions.
- Sensitive-data disclosure.
- Cross-origin data leakage.
- Malicious links.
- Unsafe generated UI specifications.
- Stale element references.
- Unexpected navigation.
- Arbitrary script execution.
- Credential exposure.

## Trust boundaries

Maintain strict separation between:

1. Website content.
2. Browser execution authority.
3. AI interpretation.
4. User instructions.
5. Application configuration.
6. Sensitive credentials.

Website content must never be promoted into a trusted system instruction.

The AI agent must not gain capabilities beyond those explicitly provided by the browser execution layer.

## Privacy

Provide controls for:

- Local-only AI processing.
- Remote AI data sharing.
- Interaction logging.
- Data retention.
- Clearing browsing data.
- Clearing personalization history.

Document known limitations.

---

# 12. Initial MVP Scope

Do not attempt to support every website immediately.

Build a reliable MVP around a bounded set of workflows.

Implement at least three representative workflow categories:

### Workflow A: Information retrieval

Example tasks:

- Open a website.
- Identify main content.
- Find a specific section.
- Extract relevant information.
- Navigate to a related page.

### Workflow B: Search and navigation

Example tasks:

- Locate a search field.
- Enter a query.
- Submit the search.
- Interpret results.
- Open a selected result.
- Return to the previous page.

### Workflow C: Form interaction

Example tasks:

- Identify form fields.
- Present them as accessible steps.
- Fill fields using text commands.
- Preserve validation requirements.
- Show errors accessibly.
- Request confirmation before final submission.

Use local test websites or controlled fixtures for deterministic tests.

Add at least one real-world public website workflow as an integration demonstration, subject to compatibility and permitted automation.

Do not claim general website compatibility based only on these demonstrations.

---

# 13. Development Phases

Implement incrementally.

## Phase 0: Repository and feasibility analysis

Tasks:

1. Inspect the existing repository.
2. Identify reusable code.
3. Validate the proposed technology stack.
4. Prototype browser navigation and DOM inspection.
5. Test browser automation integration.
6. Verify that original and reconstructed views can share the same authoritative browser session.
7. Identify cross-platform limitations.
8. Write an architecture decision record.

Deliverable:

A minimal desktop application that can navigate to a website, inspect its structure, and execute a grounded browser action.

**Do not proceed to the full implementation until the browser architecture is technically viable.**

## Phase 1: Browser foundation

Implement:

- Application window.
- Address bar.
- Navigation.
- Browser sessions.
- Browser adapter.
- Original website view.
- Basic error handling.
- Browser state inspection.

## Phase 2: Semantic website modeling

Implement:

- DOM extraction.
- Accessibility semantics extraction.
- Interactive element identification.
- Structured page model.
- Action references.
- State revision tracking.
- Schema validation.

## Phase 3: Accessible interface reconstruction

Implement:

- Declarative UI specification.
- Validated component renderer.
- Content organization.
- Action bindings.
- Original website fallback.
- Basic accessibility settings.

## Phase 4: Natural-language command execution

Implement:

- Command input.
- Intent interpretation.
- Action grounding.
- Execution planning.
- Browser action execution.
- Verification.
- User feedback.
- Confirmation dialogs.

## Phase 5: Hybrid AI providers

Implement:

- Local provider.
- Cloud provider.
- Provider configuration.
- Capability validation.
- Structured response handling.
- Privacy settings.
- Error recovery.

## Phase 6: Accessibility profiles

Implement:

- Profile management.
- Persistent settings.
- Profile-driven rendering.
- Keyboard interaction.
- Reduced-motion and contrast settings.
- Simplified workflow preferences.

## Phase 7: Integration and validation

Implement:

- End-to-end tests.
- Accessibility tests.
- Security tests.
- Browser recovery tests.
- Packaging validation.
- User documentation.

---

# 14. Testing Requirements

Create automated tests at multiple levels.

## Unit tests

Cover:

- Semantic model validation.
- Action grounding.
- UI specification validation.
- Profile application.
- AI provider selection.
- Command parsing.
- Confirmation policies.

## Integration tests

Cover:

- Browser navigation.
- DOM extraction.
- Dynamic content updates.
- Search workflows.
- Form workflows.
- Session continuity.
- Stale element recovery.
- Model provider failures.

## End-to-end tests

Demonstrate:

1. Launch AdaptUI.
2. Open a supported website.
3. Analyze the website.
4. Generate the replacement interface.
5. Interact with the interface.
6. Execute a natural-language command.
7. Verify the browser action.
8. Switch to the original website.
9. Return to the reconstructed interface.

## Accessibility testing

Use automated tools where applicable, supplemented by manual keyboard and assistive-technology testing.

Verify:

- Keyboard navigation.
- Focus management.
- Accessible labels.
- Error announcements.
- Text scaling.
- Contrast.
- Control sizes.
- Logical task progression.

## Security tests

Include adversarial website content attempting to:

- Override system instructions.
- Trigger unauthorized actions.
- Exfiltrate private information.
- Generate unsupported controls.
- Bypass confirmation.
- Access unrelated browser data.

The application must reject or safely contain these attempts.

---

# 15. Evaluation Metrics

The proposal identifies task completion, required interactions, time, errors, perceived effort, and user control as important evaluation outcomes.

Instrument the MVP to support measurement of:

- Task completion success.
- Number of interactions.
- Time to completion.
- Failed actions.
- Repeated attempts.
- Reconstruction failures.
- Browser execution failures.
- User-requested fallbacks.
- User feedback.

Collect only the information necessary for evaluation and respect consent settings.

Provide a basic local diagnostics view.

Do not interpret developer testing as evidence of usability for people living with ALS.

---

# 16. Repository Structure

Use a modular structure similar to:

```text
adaptui/
├── apps/
│   └── desktop/
│       ├── src/
│       ├── src-tauri/
│       └── tests/
│
├── crates/
│   ├── browser-core/
│   ├── browser-adapters/
│   ├── semantic-model/
│   ├── website-analyzer/
│   ├── action-executor/
│   ├── ai-core/
│   ├── ai-providers/
│   ├── personalization/
│   └── security/
│
├── packages/
│   ├── accessible-ui/
│   ├── ui-schema/
│   └── shared-types/
│
├── fixtures/
│   ├── information-site/
│   ├── search-site/
│   ├── form-site/
│   └── adversarial-site/
│
├── tests/
│   ├── integration/
│   ├── e2e/
│   └── accessibility/
│
├── docs/
│   ├── architecture/
│   ├── security/
│   ├── development/
│   └── evaluation/
│
└── README.md
```

Adjust the structure when justified by the chosen architecture.

Avoid unnecessary abstraction or duplicated infrastructure.

---

# 17. Engineering Standards

Follow these principles:

1. Prefer maintainable code over clever code.
2. Use strong typing.
3. Keep module boundaries explicit.
4. Validate all external inputs.
5. Handle failures explicitly.
6. Avoid silent fallback behavior.
7. Use structured logs.
8. Avoid logging sensitive content.
9. Write tests alongside implementation.
10. Keep the application functional after each phase.
11. Document architectural decisions.
12. Prefer existing well-maintained libraries.
13. Avoid premature optimization.
14. Do not introduce unnecessary microservices.
15. Avoid hardcoded website-specific logic in core modules.
16. Keep browser adapters replaceable.
17. Keep AI providers replaceable.
18. Keep generated interfaces deterministic to render.
19. Maintain user control over consequential actions.
20. Do not claim functionality without verification.

---

# 18. Acceptance Criteria

The initial MVP is complete when:

- [ ] The application launches on the primary development platform.
- [ ] Cross-platform build procedures are documented.
- [ ] Browser runtime feasibility has been validated.
- [ ] Users can open a supported website.
- [ ] AdaptUI extracts a structured semantic representation.
- [ ] AdaptUI generates a replacement interface.
- [ ] The replacement interface preserves the selected workflow's essential content and functionality.
- [ ] Users can switch to the original website.
- [ ] Users can execute grounded natural-language commands.
- [ ] Browser actions are verified.
- [ ] Consequential actions require confirmation.
- [ ] Local and cloud AI providers can be configured.
- [ ] Local-only mode prevents remote AI requests.
- [ ] Users can create and switch accessibility profiles.
- [ ] Accessibility settings affect the generated interface.
- [ ] Automated tests cover the three selected workflow categories.
- [ ] Unsafe or invalid AI-generated UI specifications are rejected.
- [ ] Prompt-injection defenses are tested.
- [ ] Developer setup and usage instructions are complete.

Windows, macOS, and Linux builds must be validated separately before claiming full cross-platform support.

---

# 19. Required Deliverables

Produce:

1. Working source code.
2. Development environment setup instructions.
3. Architecture documentation.
4. Browser runtime decision record.
5. Semantic model specification.
6. Browser adapter API documentation.
7. AI provider configuration documentation.
8. Accessibility profile specification.
9. Automated tests.
10. Example website fixtures.
11. Security and privacy documentation.
12. Known limitations.
13. Build and packaging instructions.
14. MVP demonstration walkthrough.
15. A prioritized backlog for future development.

---

# 20. Working Procedure for the Coding Agent

Follow this exact process.

## Step 1: Understand

Read the project specification and inspect the repository.

Summarize:

- Product goals.
- Existing capabilities.
- Missing components.
- Technical risks.
- Proposed implementation boundaries.

## Step 2: Clarify

Ask only questions that materially affect architecture, security, scope, or implementation.

Do not repeatedly ask questions already answered in this specification.

## Step 3: Validate

Implement a minimal technical feasibility prototype for the browser runtime.

Demonstrate navigation, inspection, action execution, and session continuity.

If the proposed architecture is not viable, explain the evidence and recommend an alternative before proceeding.

## Step 4: Plan

Produce:

- Architecture diagram.
- Module responsibilities.
- API contracts.
- Data models.
- Implementation phases.
- Testing strategy.
- Risk register.

## Step 5: Implement

Write working code incrementally.

Do not stop after generating scaffolding.

For each module:

1. Implement functionality.
2. Add tests.
3. Run tests.
4. Fix failures.
5. Document behavior.
6. Integrate with the application.

## Step 6: Demonstrate

Provide reproducible demonstrations for:

- Website analysis.
- Accessible reconstruction.
- Natural-language interaction.
- Accessibility profile switching.
- Original website fallback.
- Action verification.

## Step 7: Report

At the end of each implementation phase, report:

- What was implemented.
- Files changed.
- Tests executed.
- Test results.
- Known limitations.
- Remaining work.
- Next implementation steps.

Distinguish completed functionality from planned functionality.

---

# 21. Final Design Principles

The following principles are non-negotiable.

**Principle 1: Preserve functionality**

AdaptUI must not simplify a workflow by silently removing required information or essential operations.

**Principle 2: Separate understanding from presentation**

Website semantics must be independent of the reconstructed interface.

**Principle 3: Ground every action**

Every executable action must map to a real, currently available browser capability.

**Principle 4: Keep the original website authoritative**

AdaptUI reconstructs interaction; it does not replace the website's underlying application logic.

**Principle 5: Preserve user autonomy**

Users must remain in control of consequential actions and major adaptations.

**Principle 6: Accessibility is architectural**

Accessibility must be built into components, workflows, focus behavior, error handling, and navigation rather than added at the end.

**Principle 7: Hybrid AI must preserve privacy**

Users must know when website information is processed locally or remotely.

**Principle 8: Fail safely**

When the system cannot confidently understand or execute a task, it must explain the limitation and provide a safe fallback.

**Principle 9: Build for extension**

The architecture should eventually support desktop applications without requiring a redesign of semantic modeling, task planning, personalization, or interface reconstruction.

**Principle 10: Deliver verifiable software**

Every major claim about implementation must be supported by working code, tests, or a reproducible demonstration.

---

# Begin Implementation

Start by inspecting the repository and the uploaded AdaptUI proposal.

Then:

1. Identify any essential unanswered questions.
2. Evaluate the Tauri/Rust browser-runtime architecture.
3. Propose the minimum viable technical design.
4. Implement the Phase 0 feasibility prototype.
5. Report the results before beginning the remaining phases.

Do not skip the feasibility prototype.

Do not produce only a theoretical architecture.

The objective is to build a functioning, cross-platform foundation for AdaptUI that can analyze websites, reconstruct accessible interfaces, and execute natural-language commands safely and reliably.