# Semantic Website Model Specification (`schemaVersion: "1.0.0"`)

The **Semantic Website Model** (`@adaptui/semantic-model`) is the versioned, strongly typed representation of a webpage's live state. It serves as the **single shared source of truth** for both accessible interface reconstruction and natural-language command execution.

## Core Entities

- **`SemanticPage`**: Root document containing `schemaVersion`, `pageId`, `url`, `title`, `purpose`, monotonic `revision`, `regions`, `elements`, `actions`, `workflows`, `extractionWarnings`, `unsupportedFeatures`, `confidence` (`0..1`), `incomplete`, and `securityFlags`.
- **`SemanticRegion`**: Landmarks (`main`, `navigation`, `search`, `form`, `complementary`, `dialog`, `status`, `alert`, `contentinfo`, `banner`, `section`) annotated with `primary: boolean` so accessibility profiles can suppress non-essential clutter without losing primary content.
- **`SemanticElement`**: Normalized accessible element with `id`, `role`, `name`, optional `textContent`, `value`, `checked`, `href`, `options`, `headingLevel`, `tableData`, `listItems`, `formId`, `errorMessage`, `constraints` (`required`, `inputType`), `sensitive` flag, `sourceRef`, and `provenance` (`ax-tree | dom | merged`).
- **`SemanticAction`**: Grounded executable operation (`click`, `fill`, `select`, `check`, `navigate`, `submit`, `scroll`, `back`, `forward`) referencing a real `targetElementId`, annotated with `riskLevel` (`safe | moderate | consequential`), `requiresConfirmation`, `riskReasons`, `preconditions`, and `expectedOutcome`.
- **`SemanticWorkflow`**: Structured multi-step task representation inferred from observed forms and search interfaces (`search | form | information | navigation`).
- **`ElementReference`**: Execution handle storing `(pageId, revision, backendNodeId, locator, role, accessibleName, tagName, domId, nameAttr)` to detect stale references and avoid brittle CSS-only selectors.

## Extraction & Validation Rules

1. **Deterministic first:** Accessibility-tree nodes (`Accessibility.getFullAXTree`) are merged with DOM semantics (`label[for]`, `aria-labelledby`, `aria-describedby`, `required`, table captions/headers).
2. **Stable identities:** When re-extracting the same `pageId`, elements matching `(role, name, formId, tagName, domId)` retain their previous `id` while `revision` increments.
3. **Stale reference detection:** `isElementReferenceStale(ref, currentPage)` checks both `pageId` and `revision`.
4. **Security at extraction:**
   - Sensitive fields (`password`, `cc-number`, `cvv`, `ssn`, API keys) are marked `sensitive: true` and their raw values are never copied into `SemanticPage`.
   - Links with unsafe schemes (`javascript:`, `data:`, `vbscript:`) are dropped, counted in `securityFlags.blockedLinksCount`, and logged in `extractionWarnings`.
   - Prompt-injection patterns are detected and stripped of fake `[SYSTEM: ...]` directives.
5. **No hallucinated controls:** `validateSemanticPage(page)` enforces Zod schema compliance and verifies that every `action.targetElementId` resolves to an element in `page.elements`.
