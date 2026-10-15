# Accessibility

FLIXO Hub is a browser-first application, so accessibility is part of the public developer and user surface rather than an optional UI polish step.

## Accessibility goals

The project aims to provide:

- Keyboard-operable navigation and controls.
- Visible focus indication that is not communicated by color alone.
- Semantic headings, labels, buttons, and form relationships.
- Text alternatives for meaningful non-text content.
- Reasonable zoom and reflow behavior.
- Respect for reduced-motion preferences where animation is non-essential.
- Error and status messaging that remains understandable without relying on color alone.

These are engineering targets. A route is not considered accessibility-complete merely because it renders successfully.

## Reporting a barrier

Open an issue using the most relevant template and include:

- Route, page, or component.
- Browser and operating system.
- Exact interaction that fails or becomes difficult.
- Expected accessible behavior.
- Reproduction steps.
- Screenshot or short recording when it clarifies the barrier, after removing private information.

Do not include credentials, private user data, or security-sensitive exploit details.

## Developer verification

Accessibility changes should include a targeted regression where practical. For browser-facing changes, verify keyboard navigation, focus visibility, labels/name computation, and the affected responsive states. Preserve the existing exact-SHA evidence and release gates.
