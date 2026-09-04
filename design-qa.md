# 3D Tour visual QA

## Evidence

- Source visual truth: `/var/folders/y8/xf4zz5x505179mg2vb6xr17w0000gn/T/codex-app-sdk-attachments-fz2x3i/1-81015879796__FDCE24C8-9F14-4110-B34D-C1DB5A70E14F.jpeg` (primary), plus sibling reference images `0-81015875651__1204A940-41F0-4474-9157-23F0CA1EBE25.jpeg` and `2-81015908589__BC9D0127-DFFA-4179-A0C4-411B2A7DD780.jpeg`.
- Browser-rendered implementation: `.design-qa/implementation-pass-4.png`.
- Normalized implementation crop: `.design-qa/implementation-game-pass-4.png`.
- Full-view comparison: `.design-qa/comparison-final.png`.
- Focused road/rider/scenery comparison: `.design-qa/comparison-focus-final.png`.
- Local preview: `http://127.0.0.1:5173/?qaSpeed=0&qaFlow=65`.
- State: 3D Tour, Chase camera, Sector 1, stable zero-speed composition for repeatable capture, flow preview at 65%, audio muted.

## Normalization

- Source pixels: 4032 × 3024, EXIF orientation 3. The visible game region was cropped to `(0, 220, 4032, 2488)` and normalized to 1506 × 847.
- Implementation screenshot pixels: 1602 × 1738. The game frame was captured at 753 × 423.56 CSS px with device density 2, then cropped to 1506 × 847 physical pixels.
- Both sides of the comparison therefore use the same 1506 × 847 pixel content region and 16:9 composition. Browser canvas outside the game frame is excluded.

## Findings

No actionable P0, P1, or P2 differences remain for the requested low-poly 3D direction.

- Fonts and typography: the existing Ze Tour display face and serif HUD hierarchy remain intact. Camera and flow labels now match the compact scale and placement of the reference overlays.
- Spacing and layout rhythm: the chase view now uses the same high rear composition, road width, lower-center rider placement, top HUD clearance, side verges, and bottom HUD overlap as the reference. Wide, Roadside, and Helicopter cameras were also exercised.
- Colors and visual tokens: the scene now uses the reference's pale blue sky, desaturated green fields, cream village surfaces, terracotta roofs, dark gray road, white shoulders, and warm low-poly lighting.
- Image quality and asset fidelity: the previous rectangular stage-image backdrop is gone. Mountains, trees, cypresses, houses, hay bales, flags, crowds, gantries, vehicles, cyclist, bicycle, and shadows are true Three.js scene geometry. Existing supplied raster assets remain reserved for gameplay pickups and power-ups.
- Copy and content: `Chase/Wide/Roadside/Helicopter camera`, `Find your flow`, and multiplier/combo states are concise and consistent with the reference. Existing game copy is unchanged.
- Interaction and accessibility: the camera button remains a semantic keyboard-accessible button, `C` cycles all four views, the canvas retains its accessible label, and muted mode was verified before every browser run.
- Dynamic state: a forced oncoming-traffic run at 25 km/h verified vehicle approach, traffic spacing, road movement, and encounter rendering. The final comparison intentionally freezes movement for stable scene geometry; the source's exact traffic positions are temporal rather than a static layout requirement.

## Comparison history

### Pass 1

- [P2] Midground scenery was still too distant and evenly distributed compared with the dense village corridor in the reference.
- [P2] Camera and flow controls occupied too much of the playfield.
- [P2] The cyclist helmet color and silhouette drifted from the yellow Tour rider.

Fixes: pulled trees, houses, and hay bales closer to the road; clustered spectators; varied flags and village spacing; reduced overlay dimensions; raised and tightened the chase camera; enlarged and articulated the bicycle/rider; matched the yellow helmet and jersey.

### Pass 2

The capture contained a transient encounter announcement and was rejected as a comparison state before scoring. No visual pass was claimed from it.

### Final pass

Post-fix evidence in `.design-qa/comparison-final.png` and `.design-qa/comparison-focus-final.png` shows the corrected density, camera composition, cyclist scale, low-poly palette, roadside landmarks, and compact controls. No actionable P0/P1/P2 mismatch remains.

## Implementation checklist

- [x] Replace flat image backdrop with procedural low-poly depth.
- [x] Add dense French roadside scenery and event landmarks.
- [x] Improve cyclist, bicycle, traffic, pickups, potholes, shadows, and road surfaces.
- [x] Add distinct Chase, Wide, Roadside, and Helicopter cameras.
- [x] Add 3D flow/combo feedback without changing the shared HUD or 2D mode.
- [x] Verify muted interaction runs and current-browser console state.

## Follow-up polish

- [P3] A future asset pass could add more vehicle body variants and spectator poses; the current set already meets the requested density and low-poly art direction.

final result: passed
