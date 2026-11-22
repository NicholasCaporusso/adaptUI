# Accessibility Profile Specification (`@adaptui/personalization` & `@adaptui/accessible-ui`)

AdaptUI stores user accessibility preferences locally in SQLite (`adaptui.sqlite`) and applies them live across both the desktop shell and reconstructed interfaces without restarting.

## Profile Schema

- **`presentation`**:
  - `textScale` (`0.85`–`2.2`): Scales base font size via `--aui-text-scale`.
  - `lineHeight` (`1.2`–`2.4`): Adjusts vertical reading rhythm via `--aui-line-height`.
  - `letterSpacing` (`0`–`0.15em`): Adjusts character spacing via `--aui-letter-spacing`.
  - `contrast` (`"standard" | "high" | "dark-high"`): Switches high-contrast color palettes (`data-contrast`).
  - `density` (`"compact" | "comfortable" | "minimal"`): Adjusts container padding and visual separation.
  - `reducedMotion` (`boolean`): Disables CSS transitions, animations, and smooth scrolling (`data-reduced-motion="true"`).
  - `showImages` (`boolean`): Controls whether webpage images are displayed in comfortable accessible containers with captions/alt text inside reconstructed views.
  - `showVideos` (`boolean`): Controls whether webpage videos are displayed with user-controlled playback (never autoplaying) inside reconstructed views.
- **`interaction`**:
  - `minimumTargetSize` (`36`–`96px`): Enforces minimum hit-target dimensions (`--aui-min-target`).
  - `controlSpacing` (`4`–`40px`): Enforces generous spacing between controls (`--aui-control-spacing`).
  - `keyboardOnly` (`boolean`): Optimizes focus visibility and keyboard-only flow.
  - `scanningMode` (`boolean`) & `scanIntervalMs` (`600`–`8000ms`): Enables switch-compatible sequential focus scanning across interactive controls.
  - `eyeGazeMode` (`boolean`): Increases target borders, padding, and separation for eye-gaze layouts.
  - `confirmationLevel` (`"standard" | "enhanced"`): Standard confirms consequential actions; Enhanced confirms all clicks, links, and form submissions.
- **`workflow`**:
  - `simplifyNavigation`: Limits top navigation clutter to concise primary links.
  - `preferStepByStepForms`: Wraps form inputs into numbered `AccessibleTaskStep` cards.
  - `showAdvancedOptions`: Exposes secondary controls when desired.
  - `hideSecondaryContent`: Suppresses promotional/complementary sidebars while keeping primary content intact.

## Built-In Profiles
1. **Standard Accessible** (44px targets, 1.1x text, step-by-step forms)
2. **Eye-Gaze & Large Targets** (64px targets, 24px spacing, 1.35x text, high contrast, reduced motion, enhanced confirmation)
3. **Switch & Keyboard Scanning** (56px targets, 18px spacing, scanning focus mode, keyboard-only, reduced motion)
4. **Dark High Contrast** (Dark black/yellow high-contrast palette, 48px targets, reduced motion)

> **Assistive Device Honesty Note:** Profiles provide layout, target sizing, focus scanning, and reduced-motion support designed for keyboard, switch, and eye-gaze workflows, but AdaptUI has not yet been tested with physical hardware eye trackers or clinical switch interfaces.
