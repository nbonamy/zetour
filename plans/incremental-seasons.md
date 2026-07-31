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

- [x] Add compact large-number formatting.
- [x] Add repeatable upgrade cost and bulk-purchase helpers.
- [x] Add milestone multipliers and milestone metadata.
- [x] Scale roadside rewards from seconds of current production.
- [x] Cover the primitives with focused tests.

Commit: `feat: add compounding economy primitives`

### 2. Career tree and ride production

- [x] Convert core upgrades to deep repeatable nodes with milestone names.
- [x] Add lubrication, gravel tires, suspension, mechanic, sponsor, and team
      management nodes with coherent prerequisites.
- [x] Separate readable road speed from effective Tour pace.
- [x] Multiply production across independent upgrade families.
- [x] Apply gravel resistance and mechanical reliability to a gravel sector.
- [x] Cover purchases, multipliers, terrain effects, and migration with tests.

Commit: `feat: expand the incremental cycling career`

### 3. Seasons and Palmarès

- [x] Persist lifetime distance, Tours completed, season number, Palmarès, and
      permanent upgrades.
- [x] Replace the empty Ride again reset with a rewarded Next Season flow.
- [x] Preview reset rewards and next-season multiplier.
- [x] Preserve records and permanent progression across seasons.
- [x] Add Palmarès preparation, production, and automation upgrades.
- [x] Cover reset decisions, persistence, offline progress, and automation.

Commit: `feat: add seasons and palmares progression`

### 4. UI and interaction polish

- [x] Show road speed and effective Tour pace without crowding the masthead.
- [x] Add compact number formatting throughout.
- [x] Make the large career graph navigable with deep levels, milestones,
      bulk-buy controls, and the new nodes.
- [x] Add a Palmarès panel and a satisfying season-complete dialog.
- [x] Update active rewards, pothole feedback, and gravel encounter language.
- [x] Preserve responsive behavior across desktop and constrained viewports.

Commit: `feat: surface the incremental season loop`

### 5. Verification and tuning

- [x] Run unit/component tests after every increment.
- [x] Run typecheck and production build.
- [x] Exercise first purchases, milestones, branch unlocks, gravel mechanics,
      Tour completion, season reset, Palmarès purchases, and offline progress.
- [x] Perform browser QA at desktop and constrained viewport sizes.
- [x] Tune the first-session curve from observed runtime behavior.
- [x] Update game-design.md and README.md to match the shipped mechanics.

Commit: `test: harden incremental season progression`

## Key learnings

- Keeping physical road speed logarithmic while effective Tour pace compounds
  preserves rider, lane, fan, and verge readability even above 100,000 km/h.
- Active rewards must be production-time rewards, not fixed amounts. Twenty
  seconds of Sweat, thirty seconds of Cash, and five Sweat bags for a completed
  draft remain meaningful in every Season.
- A conservative no-pickup simulation reached its first purchase at 28
  seconds, its first Level-10 breakthrough at 11:18, and the finish at 12:31
  with 58 purchases and 152 km/h effective pace.
- Browser QA found issues unit tests could not: collapsed Workshop tabs,
  completion actions below the fold, and a clipped portrait detail panel.
  Explicit grid rows and independently scrollable content fixed all three.
- Gravel needed its own correctly proportioned texture. Recoloring asphalt
  changed the palette but not the player's understanding of the surface.
- The strongest finish decision is a visible tradeoff: keep the current machine
  for a richer victory lap, or bank Palmarès now and make the next Season melt.
