# Incremental Seasons

## Goal

Turn Ze Tour's finite, mostly additive career into a replayable incremental
cycling game while preserving the readable three-lane ride. The road remains
physically legible; an independent effective Tour pace provides the absurd
late-game numbers.

## Product rules

- Keep Sweat and Cash as the only currencies used during a Tour.
- Unlock permanent Palmarès only after finishing the first Tour.
- Never wipe a finished Tour without awarding persistent progress.
- Make upgrades compound across Rider, Nutrition, Bike, Equipment, and Team.
- Make pickups scale with the player's current production.
- Keep active steering an accelerant, not a requirement.
- Keep the road, both verges, fans, riders, pickups, and hazards on one visual
  scroll clock even when effective Tour pace becomes enormous.
- Introduce mastered-system automation through Palmarès rather than making the
  initial ride play itself.
- Expand the tree with mechanical and gravel preparation, including
  lubrication, gravel tires, suspension, mechanics, sponsors, and team
  management.

## Implementation increments

### 1. Economy primitives

- [ ] Add compact large-number formatting.
- [ ] Add repeatable upgrade cost and bulk-purchase helpers.
- [ ] Add milestone multipliers and milestone metadata.
- [ ] Scale roadside rewards from seconds of current production.
- [ ] Cover the primitives with focused tests.

Commit: `feat: add compounding economy primitives`

### 2. Career tree and ride production

- [ ] Convert core upgrades to deep repeatable nodes with milestone names.
- [ ] Add lubrication, gravel tires, suspension, mechanic, sponsor, and team
      management nodes with coherent prerequisites.
- [ ] Separate readable road speed from effective Tour pace.
- [ ] Multiply production across independent upgrade families.
- [ ] Apply gravel resistance and mechanical reliability to a gravel sector.
- [ ] Cover purchases, multipliers, terrain effects, and migration with tests.

Commit: `feat: expand the incremental cycling career`

### 3. Seasons and Palmarès

- [ ] Persist lifetime distance, Tours completed, season number, Palmarès, and
      permanent upgrades.
- [ ] Replace the empty Ride again reset with a rewarded Next Season flow.
- [ ] Preview reset rewards and next-season multiplier.
- [ ] Preserve records and permanent progression across seasons.
- [ ] Add Palmarès preparation, production, and automation upgrades.
- [ ] Cover reset decisions, persistence, offline progress, and automation.

Commit: `feat: add seasons and palmares progression`

### 4. UI and interaction polish

- [ ] Show road speed and effective Tour pace without crowding the masthead.
- [ ] Add compact number formatting throughout.
- [ ] Make the large career graph navigable with deep levels, milestones,
      bulk-buy controls, and the new nodes.
- [ ] Add a Palmarès panel and a satisfying season-complete dialog.
- [ ] Update active rewards, pothole feedback, and gravel encounter language.
- [ ] Preserve responsive behavior across desktop and constrained viewports.

Commit: `feat: surface the incremental season loop`

### 5. Verification and tuning

- [ ] Run unit/component tests after every increment.
- [ ] Run typecheck and production build.
- [ ] Exercise first purchases, milestones, branch unlocks, gravel mechanics,
      Tour completion, season reset, Palmarès purchases, and offline progress.
- [ ] Perform browser QA at desktop and constrained viewport sizes.
- [ ] Tune the first-session curve from observed runtime behavior.
- [ ] Update game-design.md and README.md to match the shipped mechanics.

Commit: `test: harden incremental season progression`

## Key learnings

To be completed after implementation and runtime QA.
