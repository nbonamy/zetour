# Ze Tour visual QA

## Evidence

- Rider reference: `/var/folders/y8/xf4zz5x505179mg2vb6xr17w0000gn/T/codex-app-sdk-attachments-HGBEyB/0-image.png`.
- House reference: `/var/folders/y8/xf4zz5x505179mg2vb6xr17w0000gn/T/codex-app-sdk-attachments-LmQPHj/0-image.png`.
- Vehicle reference: `/var/folders/y8/xf4zz5x505179mg2vb6xr17w0000gn/T/codex-app-sdk-attachments-v5bSVa/0-image.png`.
- Spectator reference: `/var/folders/y8/xf4zz5x505179mg2vb6xr17w0000gn/T/codex-app-sdk-attachments-ajR5Vo/0-image.png`.
- Close spectator reference: `/var/folders/y8/xf4zz5x505179mg2vb6xr17w0000gn/T/codex-app-sdk-attachments-MSWGGS/0-image.png` (178 × 240 pixels).
- Final rear view: `.design-qa/implementation-rider-chase-final.png`.
- Final side view: `.design-qa/implementation-rider-roadside-final.png` and `.design-qa/implementation-rider-roadside-crop-final.png`.
- Forced-traffic scene: `.design-qa/implementation-model-traffic-pass-1.png`.
- Four-way rider comparison: `.design-qa/comparison-rider-final.png`.
- Two-frame pedal cycle comparison: `.design-qa/pedal-cycle-comparison.png`.
- House, car, and spectator comparison: `.design-qa/comparison-models-pass-1.png`.
- Final spectator scene: `.design-qa/implementation-spectators-final.png`.
- Focused spectator comparison: `.design-qa/comparison-spectators-final.png`.
- Updated 25 km/h cadence comparison: `.design-qa/cadence-25kmh-comparison.png`.
- Mode-selector source capture: `.design-qa/mode-select-before.png`.
- Mode-selector implementation capture: `.design-qa/mode-select-after.png`.
- Selected 2D gameplay crop: `.design-qa/mode-preview-2d.png`.
- Selected 3D gameplay crop: `.design-qa/mode-preview-3d.png`.
- Mode-selector full comparison: `.design-qa/comparison-mode-select-full.png`.
- Mode-preview focused comparison: `.design-qa/comparison-mode-previews-focus.png`.
- Gameplay-source-to-rendered-card comparison: `.design-qa/comparison-mode-previews-source-to-card.png`.
- Unified rider-scale Chase view: `.design-qa/implementation-rider-scale-chase.png`.
- Corrected static Roadside view: `.design-qa/implementation-rider-scale-roadside-static.png`.
- Corrected Roadside riders-and-traffic view: `.design-qa/implementation-rider-scale-roadside.png`.
- Local state: 1600 × 900 viewport, 3D Tour, Chase camera, Sector 1. The rider comparison uses a repeatable zero-speed capture; traffic uses the forced traffic encounter. Audio was set to and programmatically verified as `muted` before every interactive capture.
- Spectator follow-up state: 1600 × 1000 CSS-pixel viewport at device scale 1, 3D Tour, Roadside camera, 25 km/h, paused for the static model comparison. The implementation capture is 1600 × 1000 pixels. The 178 × 240 source and implementation crop were both nearest-neighbor normalized to 480 pixels tall and placed together in a 1040 × 520 focused comparison. Primary interactions tested were choosing 3D, switching twice to Roadside, and loading the ride with the audio preference forced and programmatically verified as `muted`. Browser-rendered WebGL canvas was present and the captured page reported no console errors.
- Mode-selector state: source and implementation were both captured at a 1600 × 1000 CSS-pixel viewport at device scale 1 with a fresh profile and the selector idle. No density normalization was required. The 2D and 3D source renders were captured from the real game at the same viewport with HUD chrome hidden, cropped to 1000 × 437, and encoded as 1200 × 525 WebP previews. Primary interactions tested were selecting 2D, returning to the selector, and selecting 3D. Audio was forced and programmatically verified as `muted` in both modes; no browser console errors were captured.
- Rider-scale follow-up state: 1600 × 1000 CSS-pixel viewport at device scale 1 with a fresh career. The Chase capture forces the main rider, three teammates, and a draft rider into one scene; the Roadside captures exercise the exact camera named in the report plus a forced traffic encounter. All three captures programmatically verified `muted` audio, a WebGL canvas, and zero console errors.

## Findings

No actionable P0, P1, or P2 difference remains for the requested low-poly model-detail pass.

- Rider anatomy and pose: the cyclist now has a custom ring-sculpted jersey with sloping shoulders, short sleeves, a visible neck and ears, proportioned two-part arms with elbow/wrist/hand joints, a shaped waist, separated shorts legs, modeled knees and calves, white socks, and shoes. Two-bone leg kinematics solve each knee from the moving pedal position, keeping every foot, crank, and limb physically connected throughout the cycle.
- Helmet and bicycle: the face now has low-poly jaw, nose, and eye detail; the helmet adds inset rear vents, straps, and a band. The bicycle adds a double-stay frame and fork, visible chain, metal chainring and crank arms, pedals, bottle, saddle, grips, hubs, rims, and eight spokes per wheel while preserving the yellow Tour palette.
- Vehicles: cars and vans now have layered bodies, hood/cab separation, front-facing divided windscreens, mirrors, wheels with hubcaps, headlight housings, grille, bumper, and license plate. The brighter red car reads clearly against the road at gameplay scale.
- Houses and vegetation: houses now include foundations, eaves, framed and divided windows, blue-green shutters, inset doors with handles and steps, plus capped chimneys. Broadleaf trees use clustered faceted crowns and cypresses use a column-and-crown construction.
- Spectators and roadside props: spectators now have shaped torsos, necks, hair or caps, individual legs and shoes, sleeves, elbows, forearms, and hands. Road markers gained bases, plaques, and yellow caps matching the supplied reference.
- Spectator follow-up: close inspection now shows faceted heads with ears, noses, eyes, and mouths; sculpted shoulder-to-waist shirts and collars; separate shorts or trousers, knees, shins, and grounded shoes; and oversized readable elbow and hand joints. Four asymmetric cheer rigs include raised, waving, and clapping silhouettes. Each fan faces the road with slight angle and scale variation, and subtle arm animation preserves the bent pose.
- Pedaling cadence: moving riders now stay between 70 and 100 RPM, with 0 RPM at a stop, 81.25 RPM at 25 km/h, and a 100 RPM cap from 40 km/h upward. The 185 ms two-frame capture shows a clear opposing-leg phase change at tour pace.
- Runtime and accessibility: all additions remain native Three.js geometry with shadows and the existing low-poly materials. The four camera modes, semantic canvas label, keyboard controls, 2D mode, shared progression, and HUD are unchanged.
- Mode-selector fidelity: the generic landscape-plus-CSS-road illustrations have been replaced with authentic, clean gameplay captures. The 2D preview now shows the illustrated side-scrolling rider, vineyard scenery, route lettering, and horizontal road; the 3D preview shows the detailed rider from behind, converging road, village, flags, trees, and crowd. The existing card typography, parchment palette, spacing, copy, focus treatment, and `New` badge remain intact.
- Rider scale: the main rider, random draft rider, and all three teammates now share one 0.80 model scale. The cyclist mesh is approximately 1.62 world units tall at that scale, versus approximately 1.61 for a car and 2.06 for a van. Previously the main rider used 1.34, making it roughly 2.72 units tall before Roadside perspective enlarged it further. The corrected Roadside render reads as a cyclist-sized subject rather than a vehicle-sized giant.

## Comparison history

### Pass 1

- [P2] The rebuilt rider had the right helmet and part count, but the broad torso and single central shorts mass still read as a cape-and-skirt silhouette from the chase camera.
- [P2] The arms were physically segmented but sat too far forward in depth, so the torso hid most of the elbow bend.

Fixes: narrowed the jersey, reduced the central shorts body, lengthened and separated both shorts legs, moved the shoulders and elbows toward the visible rear plane, and widened the hand/handlebar contact points.

### Final pass

The first refinement was rejected after the Roadside camera exposed a still-boxy torso, overlong straight arms, disconnected-looking pedal pose, and a camera control obscuring the bicycle. The cyclist was rebuilt for all-angle close-up quality, and the Roadside control now moves to the opposite corner in that camera.

The final four-way evidence in `.design-qa/comparison-rider-final.png` shows the supplied rear benchmark, the final rear render, the rejected side render, and the corrected side render together. `.design-qa/pedal-cycle-comparison.png` verifies two distinct phases with both feet remaining on their pedals and both knees solving naturally. No actionable P0/P1/P2 mismatch remains.

### Spectator and cadence follow-up

The close spectator reference and final implementation crop were reviewed together in `.design-qa/comparison-spectators-final.png`. Both have the same defining low-poly silhouette: broad shirt, readable head treatment, raised two-part arms with hands, separated dark legs, shoes, and a grounded shadow. The implementation intentionally adds pose, clothing, hair, skin-tone, and facing-angle variety to avoid a repeated crowd stamp.

The full Roadside capture confirms that nearby and mid-distance fans remain legible without blocking the rider or controls. Fonts, HUD typography, color tokens, copy, and overall layout are unchanged by this model-only pass. The 3D geometry remains sharp at gameplay scale and does not substitute raster or placeholder assets. No actionable P0/P1/P2 issue remains.

### Mode-preview fidelity pass

The original and revised selector are shown at identical viewport and density in `.design-qa/comparison-mode-select-full.png`; the two preview rows are enlarged together in `.design-qa/comparison-mode-previews-focus.png`. `.design-qa/comparison-mode-previews-source-to-card.png` places both selected gameplay crops directly above their browser-rendered cards, confirming the crop, subject, palette, and sharpness survive the responsive render. The prior 3D vignette reused the flat 2D rider over a CSS-drawn perspective road and an unrelated mountain photograph, which materially misrepresented the low-poly game. The 2D vignette likewise omitted the game's real road markings and foreground composition.

The implementation uses raster captures from each actual renderer, so character style, perspective, scenery density, palette, and road treatment now match what each button launches. The image crops remain sharp at the rendered card size, the two card heights and borders still align, and all labels retain their original wrapping and hierarchy. No actionable P0/P1/P2 issue remains.

### Rider-scale correction

The scale audit found a direct model inconsistency rather than a camera-only illusion: main, draft, and teammate riders were instantiated at 1.34, 0.96, and 0.88 respectively. A regression test now requires every rider role to resolve to the same 0.80 scale. Roadside perspective still behaves naturally—the nearer subject appears larger—but it no longer compounds a 52% main-versus-teammate geometry mismatch. The Chase evidence shows all five rider instances using one physical model size at different road depths; the static Roadside evidence confirms the foreground rider is proportionate to spectators and roadside objects.

## Implementation checklist

- [x] Refine the rider silhouette and articulated pedal pose.
- [x] Verify the rider at close range in both Chase and Roadside cameras.
- [x] Keep knees, feet, crank arms, and pedals connected through the full cycle.
- [x] Move the Roadside camera control away from the rider and bicycle.
- [x] Add bicycle and helmet detail that remains legible from the chase camera.
- [x] Replace block-only traffic with layered car and van models.
- [x] Add façade depth and architectural trim to houses.
- [x] Add recognizable anatomy, clothing, hair, and props to spectators.
- [x] Match the close spectator reference with bent elbows, visible hands, split legs, and grounded shoes.
- [x] Add varied cheering poses and turn every spectator toward the road.
- [x] Constrain moving rider cadence to 70–100 RPM and verify the phase change at 25 km/h.
- [x] Improve broadleaf trees, cypresses, and roadside marker models.
- [x] Verify reference comparisons, browser console, muted audio, tests, and production build.
- [x] Replace both landing-page vignettes with authentic captures from their respective renderers.
- [x] Preserve the selector's typography, layout, hover/focus behavior, copy, and responsive card geometry.
- [x] Verify the 2D → selector → 3D interaction path with muted audio and no console errors.
- [x] Give the main, draft, and teammate riders one shared physical scale.
- [x] Verify the corrected scale in Chase and Roadside with teammates, drafting, traffic, muted audio, and no console errors.

## Follow-up polish

- [P3] Future variety could add alternate jersey patterns, vehicle body styles, and handheld spectator signs. The current shared constructors already meet the requested low-poly detail level across the course.

final result: passed
