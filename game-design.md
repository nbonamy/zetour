# Ze Tour — Incremental Game Design

## Product promise

Ze Tour is an incremental cycling game with a readable active layer. The player
can always see a rider, three lanes, fans, bags, hazards, and terrain moving at
a believable speed. Behind that presentation, effective Tour pace compounds
until a bicycle becomes an economic and aerodynamic incident.

The emotional rhythm is:

**ride → collect → buy → break through → melt a sector → finish a Tour →
choose greed or prestige → return absurdly stronger**

The game starts as cycling and ends as a friendly argument with arithmetic.

## Non-negotiable rules

- Forward travel is automatic.
- Active steering helps but is never required for progression.
- Sweat and Cash are the only resources spent during a Season.
- Palmarès is a permanent prestige reward earned only from completed Tours.
- Every repeatable family compounds with the others.
- Major level milestones must feel larger than the levels between them.
- A player never loses a finished Tour without seeing and choosing the
  associated Palmarès reward.
- Physical road speed stays readable even when effective Tour pace exceeds
  100,000 km/h.
- Road, verges, fans, riders, pickups, and hazards share one visual scroll
  clock.

## Core loop

1. The rider advances and continuously produces Sweat and Cash.
2. The player optionally changes lanes to collect bags, draft, build Flow, and
   avoid hazards.
3. The Career Workshop pauses the ride and exposes affordable upgrades.
4. Upgrade levels improve production, effective pace, physical capability, or
   terrain mitigation.
5. Levels 10, 25, 50, and 100 trigger named multiplicative breakthroughs.
6. New sectors unlock new branches and mechanics.
7. Alpe d'Huez completes a Tour and presents two choices:
   - keep the complete build for another Tour and a larger eventual reward;
   - bank the run as Palmarès and begin the next Season.
8. Palmarès upgrades accelerate mastered content and automate solved decisions.

## Three clocks, one readable road

Ze Tour deliberately separates three values:

### Physical road speed

Road speed is the rider's believable movement through the rendered scene. It
responds to:

- logarithmic equipment and training improvements;
- gradient;
- wind;
- gravel;
- handling;
- drafting and domestiques.

This number controls wheel cadence, parallax, road particles, fans, hazards,
lane markers, and both verges. It does not grow exponentially.

### Effective Tour pace

Effective pace advances the compressed route simulation:

```text
effective pace =
    physical road speed
    × all career pace families
    × permanent Palmarès multiplier
    × Flow
```

Independent families multiply. Their milestone multipliers are cumulative, so
late builds can exceed 100,000 km/h without making the rendered rider teleport.

### Production

Sweat and Cash have separate multiplicative families. Permanent Palmarès and
Flow also multiply production, keeping collection and spending synchronized
with route acceleration.

The unupgraded flat-road opening targets roughly 45 Sweat/minute and
44 Cash/minute. Endurance costs 20 Sweat, putting the first purchase around
27 seconds without pickups.

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
| Sweat bag | 20 seconds of current Sweat production |
| Cash bag | 30 seconds of current Cash production |
| Completed random-rider draft | 5 Sweat bags |
| Pothole loss | 4–8 seconds of current Cash production before protection |

Lucky Bidon and permanent Sticky bidons attract bags; they do not reduce bag
value.

## Upgrade structure

Every repeatable node defines:

- one currency;
- a base cost and exponential cost scale;
- a maximum level;
- an optional prerequisite and sector gate;
- one or more effects;
- named milestones.

The workshop supports `+1`, `+10`, and `MAX`. A bulk purchase buys only the
affordable portion and reports the exact level count and total cost.

### Milestones

Deep Level-100 nodes use cumulative breakthroughs:

| Level | New multiplier | Cumulative milestone multiplier |
| ---: | ---: | ---: |
| 10 | ×2 | ×2 |
| 25 | ×3 | ×6 |
| 50 | ×5 | ×30 |
| 100 | ×10 | ×300 |

Some Level-50 families stop after the ×5 breakthrough. Named late milestones
are intentionally ridiculous—examples include “Negative-mass frame,” “Internal
rain cloud,” and “Economy with a logo.”

### Branches and unlocks

| Branch | Opens | Resource | Main role |
| --- | ---: | --- | --- |
| Rider | Sector 1 | Sweat | Endurance, power, handling, climbing |
| Nutrition | Sector 1 | Sweat | Hydration, fueling, Flow retention |
| Equipment | Sector 2 | Cash | Aero kit, gravel tires, suspension |
| Bike | Sector 3 | Cash | Road bike, frame, drivetrain, wheels, brakes, lubrication |
| Team | Sector 4 | Cash | Domestiques, mechanic, sponsors, directeur sportif |

Mechanical paths are first-class progression, not flavor text:

- **Gravel tires** reduce surface resistance.
- **Micro-suspension** stacks further gravel mitigation and handling.
- **Chain lubrication** adds pace and contributes gravel efficiency.
- **Race mechanic** reduces gravel losses and pothole damage.
- **Sponsor empire** multiplies Cash.
- **Directeur sportif** multiplies pace and sponsor production.

## Active ride

### Steering and encounters

`↑` and `↓` select one of three lanes. The rider eases toward the lane at a
speed derived from handling. Encounters arrive as readable sequences rather
than unrelated random objects:

- bonus lines;
- feed zones;
- broken-road slaloms;
- sprints and hairpins;
- power-up choices;
- random-rider drafting.

Missing part of a linked pickup sequence invalidates the remaining chain, which
flashes before disappearing.

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
- five scalable Sweat bags for completing the full draft.

The rider changes lanes during the draft. Reaction time and lane tolerance
tighten across the Tour.

Domestiques provide permanent formation bonuses of +20%, +30%, or +40% road
speed depending on visible formation size.

### Power-ups

- **Super Draft:** temporary speed and headwind shelter.
- **Lucky Bidon:** attracts all bags across the road.
- **Jump:** clears potholes.

One power-up can wait in reserve. A new pickup replaces the reserve; `Space`
activates it.

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

- current run balances, route, upgrades, reserve, and timing;
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

- First passive purchase: no later than 35 seconds.
- First Level-10 breakthrough under a simple cheapest-upgrade strategy: within
  12 minutes.
- First Tour under that conservative strategy, with no bag pickups: within
  25 minutes.
- At least 20 purchases during that simulated first Tour.
- The same run must finish above 40 km/h effective pace.
- A maxed milestone build must exceed 100,000 km/h effective pace while physical
  speed remains under twice the unupgraded flat-road speed.
- The ride, workshop, Palmarès panel, and finish decision must fit without
  horizontal overflow at desktop, compact landscape, and narrow portrait sizes.
- The finish actions must remain visible while the leaderboard scrolls.

## Future tuning

The next tuning pass should use real play-session telemetry rather than more
systems. Measure:

- seconds between meaningful purchases by sector;
- which milestone first creates a visible acceleration spike;
- whether victory lap is ever preferable to immediate prestige;
- active reward share versus passive production;
- gravel-upgrade purchase rate before and during Sector 2;
- time spent in Workshop versus on the road.

The desired result is not perfect balance. It is a steady stream of decisions,
several sharp “oh shit” acceleration moments, and a prestige choice that feels
tempting in both directions.
