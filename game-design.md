# Ze Tour — Incremental Game Design

## Product promise

Ze Tour is an incremental cycling game with a readable active layer. The player
can always see a rider, three lanes, fans, bags, hazards, and terrain moving at
a believable speed. Behind that presentation, effective Tour pace compounds
until a bicycle becomes an economic and aerodynamic incident.

The emotional rhythm is:

**ride → earn XP → collect → buy → break through → melt a sector → finish a
Tour → choose greed or prestige → return absurdly stronger**

The game starts as cycling and ends as a friendly argument with arithmetic.

## Non-negotiable rules

- Forward travel is automatic.
- Active steering helps but is never required for progression.
- Sweat and Cash are the only resources spent during a Season.
- Every rider starts at Level 1 and advances continuously through Rider XP.
- Palmarès is a permanent prestige reward earned only from completed Tours.
- Upgrade families compound strongly without multiplying every milestone into
  an uncontrolled tower.
- Major upgrade milestones must feel larger than the steps between them.
- A player never loses a finished Tour without seeing and choosing the
  associated Palmarès reward.
- Permanent neutral-flat speed progresses from exactly 25 to 80 km/h through
  authored upgrade gains; production may explode, speed may not.
- Road, verges, fans, riders, pickups, and hazards share one visual scroll
  clock.

## Core loop

1. The rider advances, earns Rider XP, and continuously produces Sweat and
   Cash.
2. The player optionally changes lanes to collect bags, draft, build Flow, and
   avoid hazards.
3. The Career Workshop pauses the ride and exposes affordable upgrades.
4. Upgrade steps improve production, effective pace, physical capability, or
   terrain mitigation.
5. Equipment follows real named product tiers; training uses at most ten steps.
6. Rider Level unlocks workshop branches; sectors change terrain, encounters,
   XP value, and reward scale.
7. Alpe d'Huez completes a Tour and presents two choices:
   - keep the complete build for another Tour and a larger eventual reward;
   - bank the run as Palmarès and begin the next Season.
8. Palmarès upgrades accelerate mastered content and automate solved decisions.

## Two curves, one readable road

Speed and production are deliberately independent.

### Physical Tour pace

The rider starts at 25 km/h on a neutral flat road. Every permanent speed gain
is written explicitly on a catalog tier, and all tiers together add exactly
55 km/h. Buying the complete tree therefore produces 80 km/h by construction,
not by clamping an otherwise broken formula.

Gradient, wind, gravel, drafting, domestiques, and temporary power-ups apply
after that permanent 25–80 km/h curve. Rider Level, Flow, Palmarès, and
production upgrades never masquerade as km/h.

The same pace drives route progress and all road objects. The 640 px viewport
represents roughly 44 m of road (`14.4 px/m`), so 25 km/h scrolls at 100 px/s
and 80 km/h at 320 px/s. Road, both verges, fans, lane markers, pickups, and
hazards remain locked to that shared clock; distant scenery uses restrained
parallax.

### Exponential production

Sweat and Cash have separate upgrade families. Rider Level, stage reward
scale, permanent Palmarès, Flow, and active power-ups multiply production.
This is where the incremental-game explosion lives.

The unupgraded flat-road opening targets roughly 175 Sweat/minute and
165 Cash/minute. Casual active play puts the first purchase inside a 15–30
second window; passive play remains viable.

## In-Season economy

### Sweat

Sweat represents training and physical capacity. It is generated continuously
and is higher on demanding terrain. Rider and Nutrition upgrades spend Sweat.

### Cash

Cash represents sponsors, prize value, and team financing. It is generated
continuously, with pace and sponsorship increasing the rate. Bike, Equipment,
and Team upgrades spend Cash.

Balances are whole numbers. Fractional production accumulates internally and
is credited as soon as it reaches one unit.

### Scalable active rewards

Fixed rewards become meaningless in an exponential game, so active rewards are
measured in seconds of current production:

| Reward | Value |
| --- | ---: |
| Sweat bag | 3 seconds of current Sweat production |
| Cash bag | 4.5 seconds of current Cash production |
| Clean challenge base | 1.5 seconds of both rates × challenge multiplier |
| Pothole loss | 4–8 seconds of current Cash production before protection |
| Traffic collision | 14–22 seconds of current Cash production before partial protection |

Base production scales by Sector at ×1, ×2, ×4, ×8, and ×16. Because bags and
clean challenges are denominated in current production seconds, their value
inherits this scaling automatically instead of applying a second hidden
multiplier.

## Upgrade structure

Every node and tier is authored in `src/data/upgrade-catalog.json`. A node
defines its branch, parent, children, optional additional dependencies, graph
position, and named tiers. Every tier carries an explicit price object and a
list of explicit gains with units. TypeScript interprets and validates this
data; it does not contain helmet, wheel, or training-specific balance rules.

The workshop buys either the next step or every currently affordable step.
Equipment paths contain only the real choices that exist: three helmet tiers,
four wheel tiers, three brake tiers, and so on. Technique and nutrition use five
steps; endurance and power use ten.

Product prices remain recognizable: helmets cost $100, $300, and $1,000, and
the first two tiers intentionally add no performance. Abstract training paths
start cheaply, then use explicitly authored ratios that accelerate up to the
10× adjacent-tier limit. Final endurance and power steps cost hundreds of
millions of Sweat, creating the late-game wall without pretending a normal
helmet costs $68M. The always-visible **Hyperbike moonshot** is a Bike capstone:
complete Sustained Power tier 10, pay $100M, gain 2.5 km/h, and multiply all
output by ×10.

This cost-versus-production seesaw follows the geometric model in
[The Math of Idle Games](https://blog.kongregate.com/the-math-of-idle-games-part-i/):
costs run ahead between breakpoints, then milestone multipliers let production
catch and overtake them. The Tour and Palmarès loops apply the genre pattern of
replaying mastered content at absurd speed before hitting a new wall, described
in [A Brief Look at the Idle Games Genre](https://blog.kongregate.com/idle-games/).

Named breakthroughs are presentation markers, not hidden multipliers. The
actual effect always comes from the tier's `gains` array. Wheels progress
through basic alloy, light aluminium, carbon, and deep aero carbon; helmets
progress from basic to premium to aero, with only the aero tier affecting pace.

### Branches and unlocks

| Branch | Opens | Resource | Main role |
| --- | ---: | --- | --- |
| Rider | Level 1 | Sweat | Endurance, power, handling, climbing |
| Nutrition | Level 1 | Sweat | Hydration, fueling, Flow retention |
| Equipment | Level 2 | Cash | Aero kit, gravel tires, suspension |
| Bike | Level 3 | Cash | Road bike, frame, drivetrain, wheels, brakes, lubrication |
| Team | Level 6 | Cash | Domestiques, mechanic, sponsors, directeur sportif |

Mechanical paths are first-class progression, not flavor text:

- **Gravel tires** reduce surface resistance.
- **Micro-suspension** stacks further gravel mitigation and handling.
- **Chain lubrication** adds pace and contributes gravel efficiency.
- **Race mechanic** reduces gravel losses and pothole damage.
- **Sponsor empire** multiplies Cash.
- **Directeur sportif** multiplies pace and sponsor production.

## Active ride

### Sound and music

Each Sector has an original looping arrangement tied to its landscape: sunny
road-movie brass for the Atlantic run, earthy percussion for Périgord gravel,
motorik momentum for the Provence descent, airy syncopation through the
Mistral, and a climbing ostinato for Alpe d'Huez. Sector changes crossfade
rather than cutting between tracks.

The event score distinguishes resource and power-up pickups, activation and
expiry, shielded impacts, collisions, clean and missed challenges, drafting,
Rider Levels, workshop purchases, Sector and Tour finishes, race starts, and
workshop transitions. High-frequency actions such as steering, passing cars,
fan groups, and generic encounter announcements stay silent so the important
cues remain legible. Larger milestones take priority when multiple state
changes land together. Music fades while the ride is paused, all audio waits
for the browser's first user gesture, and `M` cycles through muted, effects
only, and music plus effects. The selected mode persists locally.

The complete score is generated from the authored composition in
`scripts/generate-audio.mjs`, keeping it original and reproducible.

### Steering and encounters

`↑` and `↓` select one of three lanes. The rider eases toward the lane at a
speed derived from handling. Encounters arrive as readable sequences rather
than unrelated random objects:

- bonus lines;
- feed zones;
- broken-road slaloms;
- sprints and hairpins;
- oncoming-car traffic gauntlets;
- power-up choices;
- random-rider drafting.

Missing part of a linked pickup sequence invalidates the remaining chain, which
flashes before disappearing.

The rendered road moves 54% faster at starter pace than the original tuning.
Encounters arrive every 4.4–7.4 seconds depending on sector, with deliberate
tail overlap at high difficulty. Oncoming vehicles move another 42–74% faster
than the road, so they read as opposing traffic rather than parked scenery.

### Challenge contract

Every skill sequence announces its clean multiplier before the first object
arrives. Individual bags remain useful, but the large payout lands only when
the entire sequence is collected without a collision:

| Challenge | Difficulty | Clean payout |
| --- | ---: | ---: |
| Bonus line | 1 | ×1 |
| Feed zone | 1 | ×1.5 |
| Sprint | 2 | ×3 |
| Broken-road slalom | 3 | ×4 |
| Hairpins | 4 | ×6 |
| Oncoming traffic | 5 | ×8 |
| Full random-rider draft | 4 | ×6 |

The clean multiplier applies to 1.5 seconds of both current production rates
and the current Sector reward multiplier, so challenge rewards compound with
the build. Difficulty separately determines Rider XP. A miss forfeits the
clean payout; a collision also resets Flow and charges the relevant road
penalty. Passive production never stops, which keeps active skill rewarding
without making it a progression gate.

Fans are ambient roadside scenery, independent of encounters and rewards. Most
appear alone, occasional groups contain two or three people, and every fan
remains visible until the shared road scroll carries them off-screen.

### Flow

Successful pickups, deliberate near-misses, and drafting build Flow. Flow rises
from ×1 to ×3, multiplies effective pace and both production rates, decays after
quiet play, and resets on collision. It is neither saved nor spent. The road
view never carries a permanent Flow plate; a compact explanatory badge appears
inside the speed HUD only while the multiplier is above ×1.

Hydration upgrades slow Flow decay.

### Drafting

A random rider overtakes and settles ahead of the current formation. Matching
their lane starts a 15-second draft:

- +50% physical speed;
- wind shelter;
- doubled Sweat production while attached;
- Flow gain;
- a ×6 clean challenge burst in both currencies for completing the full draft.

The rider changes lanes during the draft. Reaction time and lane tolerance
tighten across the Tour.

Domestiques provide permanent formation bonuses of +20%, +30%, or +40% road
speed depending on visible formation size.

### Power-ups

- **Acceleration:** reliable ×2.5 speed and income for five seconds when
  riding solo. It cannot activate or apply while drafting a stranger.
- **Super Draft:** stronger ×4 speed and income for eight seconds, but it only
  activates while attached to another rider's wheel.
- **Invincibility:** ignores pothole and traffic damage for eight seconds.

One power-up can wait in the Power-up slot. A new pickup replaces it; `Space`
activates it. Successful activation awards Rider XP.

## Rider Level

Rider Level is the continuous progression clock that connects active play,
passive play, and the exponential economy. It starts at Level 1 and never
resets between Tours or Seasons.

| Action | Rider XP |
| --- | ---: |
| Riding | 0.5 per real second |
| Roadside pickup | 1 |
| Clean challenge | 2 × difficulty |
| Power-up activation | 8 |
| First Tour completion | 250 once |

Riding and action XP are worth ×1, ×1, ×5, ×6, and ×8 across the five stages.
This makes a short, fast descent capable of advancing the rider as much as a
long flat sector without coupling XP to resource production.

The authored standard-run checkpoints are:

| Completed stage | Rider Level |
| ---: | ---: |
| 1 | 3 |
| 2 | 5 |
| 3 | 8 |
| 4 | 10 |

Levels 1–10 grow production deliberately but moderately; Levels 11 and 12 are
the post-Tour incremental breakthroughs at ×7.5 and ×20. XP is based on riding
time and actions—not the size of a currency reward—so production cannot feed
back into XP and create an accidental infinite loop.

## Route and terrain

The HUD displays the recognizable 1,615 km route while the simulation uses
compressed distances:

| Sector | Route | Display | Surface / challenge |
| ---: | --- | ---: | --- |
| 1 | Paris → Bordeaux | 580 km | Flat Atlantic road |
| 2 | Bordeaux → Clermont-Ferrand | 370 km | Périgord gravel climb |
| 3 | Clermont-Ferrand → Avignon | 380 km | Massif Central descent |
| 4 | Avignon → Grenoble | 220 km | Northbound 28% Mistral |
| 5 | Grenoble → Alpe d'Huez | 65 km | 21-bend summit finale |

Each sector interpolates a curated gradient profile. The road, texture, verges,
riders, objects, and lane markers tilt together. The HUD reports the same live
grade used by the simulation.

Sector 2 has a 34% untreated gravel penalty:

```text
gravel surface multiplier = 1 - 0.34 × (1 - gravel mitigation)
```

Mitigation caps below complete immunity. The stage uses a dedicated painted
aggregate texture, faded dusty lane guides, and gravel-specific copy so the
surface change is visible before the player reads the stat.

Route grounding:

- [La Scandibérique](https://www.francevelotourisme.com/itineraire/la-scandiberique-eurovelo-3)
  connects Paris and Bordeaux.
- [Météo-France](https://meteofrance.com/actualites-et-dossiers/comprendre-la-meteo/le-mistral-vent-regional)
  grounds the northbound Rhône-valley Mistral.
- [Oisans Tourisme](https://en.oisans.com/equipement/alpe-dhuez-la-montee-mythique/)
  grounds the 13.8 km, 7.9%, 21-bend Alpe d'Huez identity.

## Tour completion and prestige

Finishing Sector 5 freezes the ride and shows:

- total time against the fastest target;
- every sector result;
- the Palmarès available now;
- the multiplier implied by banking it;
- two explicit actions.

### Victory lap

Victory lap returns to Paris while preserving:

- Sweat and Cash;
- every in-Season upgrade;
- branch unlocks;
- personal records.

The next completed Tour increases Season distance and therefore the pending
reward. Diminishing returns prevent infinite victory laps from dominating:

```text
pending Palmarès = floor(10 × sqrt(Season Tour equivalents))
```

### Start Next Season

Starting the next Season:

- awards pending Palmarès;
- resets Sweat, Cash, route progress, and in-Season upgrades;
- preserves Palmarès upgrades, records, lifetime distance, and completed Tours;
- applies pre-season starting resources;
- returns to Sector 1.

Every banked Palmarès point also contributes +10% permanent pace. This makes the
first 10-point prestige immediately double pace before the player buys a
dedicated permanent upgrade.

### Permanent Palmarès upgrades

| Upgrade | Effect |
| --- | --- |
| Tour legend | Doubles effective pace per level |
| Pre-season camp | Exponentially increases starting Sweat and Cash |
| Legendary soigneur | Raises offline efficiency from 60% toward 100% |
| Race radio | Optionally auto-buys the cheapest available upgrade |
| Sticky bidons | Attracts roadside bags from neighboring lanes |

Automation appears only after the player has completed a Tour and purchased
Race radio. It automates solved spending; it does not remove the initial game.

## Persistence

Local saves preserve:

- current run balances, route, upgrades, Power-up slot, and timing;
- Rider XP and Level progress;
- fastest sector records and splits;
- Season and Tour numbers;
- total Tours and lifetime distance;
- current and lifetime Palmarès;
- permanent upgrades and automation preference.

Offline progress advances route distance and both resources for at most the
configured offline window. It uses the build's effective pace and the current
offline-efficiency multiplier, and never simulates collisions.

The explicit **Restart race** action is the only full career wipe. It requires a
confirmation dialog.

## Pacing and acceptance targets

- First casual purchase: 15–30 seconds.
- First standard Tour: 20–30 minutes.
- A standard run exits Stages 1–4 at Rider Levels 3, 5, 8, and 10.
- A skilled run reaches a 1M Sweat balance in 10–20 minutes.
- A skilled run reaches a 100M Cash balance in 15–35 minutes.
- No strategy completes the ordinary upgrade tree before 40 minutes.
- A skilled run buys the $100M Hyperbike capstone in 38–60 minutes.
- Passive play advances Rider Level and resources but should not outperform
  active pickups and clean challenges.
- A 120-minute skilled run must remain below 1 quadrillion total Sweat; rapid
  growth is intentional, numeric runaway is not.
- Permanent neutral-flat pace is exactly 25–80 km/h. Terrain, wind, drafting,
  and temporary power-ups apply afterward; no corrective speed cap is used.
- The ride, workshop, Palmarès panel, and finish decision must fit without
  horizontal overflow at desktop, compact landscape, and narrow portrait sizes.
- The finish actions must remain visible while the leaderboard scrolls.

## Deterministic economy calibration

`npm run calibrate:economy`
runs the real
GameStore, encounters, rewards, collisions, Flow, purchases, stages, and Tour
loop. It reports and checks first-purchase timing, Tour length, Rider Level stage
checkpoints, balance thresholds, income sources, reward scaling, tree runway,
the 25–80 km/h invariant, and the Hyperbike arrival. The same seeds can run with
`--progression=none` to isolate Rider Level's impact; `--strategies` keeps
focused calibration runs fast.

The simulator is a reusable calibration harness: adding a skill means changing
the real rules, rerunning representative strategies over several seeds, and
then locking the intended timing window in tests. This follows the
objective-driven iterative balancing approach described by
[GEEvo](https://arxiv.org/abs/2404.18574), rather than tuning from a single
anecdotal playthrough.

## Future tuning

The next tuning pass should combine simulator regressions with real
play-session telemetry. Measure:

- seconds between meaningful purchases by sector;
- which milestone first creates a visible acceleration spike;
- whether victory lap is ever preferable to immediate prestige;
- active reward share versus passive production;
- gravel-upgrade purchase rate before and during Sector 2;
- time spent in Workshop versus on the road.

The desired result is not perfect balance. It is a steady stream of decisions,
several sharp “oh shit” acceleration moments, and a prestige choice that feels
tempting in both directions.
