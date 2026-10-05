# FLIXO MVP Scope Freeze — Image Tool Expansion

The canonical image-tool surface for this execution track contains exactly these 20 image tools:

1. background-remover
2. image-upscaler
3. image-cropper
4. image-compressor
5. image-converter
6. image-effects
7. image-resizer
8. image-rotate-flip
9. image-brightness-contrast
10. image-saturation-hue
11. image-exposure
12. image-highlights-shadows
13. image-sharpen
14. image-blur
15. image-grayscale-duotone
16. image-filters
17. image-watermark
18. image-text-overlay
19. image-draw-annotate
20. image-redaction

This expansion does not create a second registry. The canonical registry remains `src/config/registry.ts`; canonical capability definitions remain in `src/config/manual-capability-definition.ts`.

The four existing video capabilities remain outside this image expansion and are preserved unless a later scoped decision changes them.

Definition of Done for this image scope:
- every listed tool is registered and executable only through the canonical surface;
- every listed tool is manually callable in the browser;
- every listed tool is routable from the Agent workflow;
- every listed tool has an output verifier and output contract;
- cancellation, confirmation, locked-layer rejection, local-only processing, and bounded retry are enforced fail-closed;
- CI and browser verification are green for the exact commit under review.
