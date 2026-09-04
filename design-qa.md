# 3D Tour model-detail visual QA

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
- Local state: 1600 × 900 viewport, 3D Tour, Chase camera, Sector 1. The rider comparison uses a repeatable zero-speed capture; traffic uses the forced traffic encounter. Audio was set to and programmatically verified as `muted` before every interactive capture.
- Spectator follow-up state: 1600 × 1000 CSS-pixel viewport at device scale 1, 3D Tour, Roadside camera, 25 km/h, paused for the static model comparison. The implementation capture is 1600 × 1000 pixels. The 178 × 240 source and implementation crop were both nearest-neighbor normalized to 480 pixels tall and placed together in a 1040 × 520 focused comparison. Primary interactions tested were choosing 3D, switching twice to Roadside, and loading the ride with the audio preference forced and programmatically verified as `muted`. Browser-rendered WebGL canvas was present and the captured page reported no console errors.

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

## Follow-up polish

- [P3] Future variety could add alternate jersey patterns, vehicle body styles, and handheld spectator signs. The current shared constructors already meet the requested low-poly detail level across the course.

final result: passed
