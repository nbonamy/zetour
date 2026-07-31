# Ze Tour — Game Design

## Concept

Ze Tour is an incremental cycling game. The rider moves forward
automatically without clicking or manual pedalling. Riding generates resources,
resources buy permanent improvements, and those improvements allow the rider
to overcome progressively harder roads.

During active play, the player can move the rider between road lanes with the
Up and Down arrow keys. Steering is used to collect bonuses and avoid hazards;
it never controls forward motion.

The first campaign is a deliberately compressed journey across France. It
starts with a fast Paris–Bordeaux run, crosses the Massif Central, rewards the
climb with a high-speed descent into Provence, turns north into the Mistral,
and finishes on Alpe d'Huez. Simulation distances are compressed for pacing,
while the HUD maps progress onto the declared real-route distances. The places,
terrain rhythm, wind direction, and famous final climb remain recognizable.

## Mini Task List

- [x] Rename the game and browser page to **Ze Tour**.
- [x] Keep riding autonomous, with arrow-key lane steering as the optional
  active layer.
- [x] Use exactly two currencies: riding generates Sweat, while sponsorship and
  roadside rewards generate Cash.
- [x] Credit every pickup immediately and make potholes drop a percentage of
  current Cash.
- [x] Shift roadside loot from 80% Sweat in Sector 1 to 80% Cash in Sector 5.
- [x] Build readable multi-lane encounters: bonus lines, fan corridors, feed
  zones, slaloms, sprints, hairpins, potholes, and chain-failure feedback.
- [x] Add random-rider drafting plus visible domestique formations and
  stage-dependent draft tolerance.
- [x] Award roughly 100 Sweat for following the temporary random rider through
  the full 15-second draft.
- [x] Build one paused, scrollable career graph with Rider, Nutrition,
  Equipment, Bike, and Team branches.
- [x] Unlock Equipment in Sector 2, Bike in Sector 3, and Team in Sector 5.
- [x] Expand Sector 1 to fourteen Rider and Nutrition purchases worth 1,035
  Sweat before later-sector gates take over.
- [x] Make tires one progressive upgrade: reinforced, performance, then
  tubeless.
- [x] Include progressive frames, shifting, brakes, wheels, aero socks,
  helmets, skinsuits, nutrition, fitness, and teammates.
- [x] Build the five-sector France route from Paris to Alpe d'Huez.
- [x] Show real city checkpoints and per-sector route distances of 580, 370,
  380, 220, and 65 km while keeping internal simulation lengths compressed.
- [x] Give every sector a smooth, changing gradient profile instead of one
  fixed slope.
- [x] Join sector profiles at matching gradients so terrain never jumps at a
  checkpoint.
- [x] Make the descent physically tilt downward and create a large speed
  payoff.
- [x] Make Avignon–Grenoble a visible Mistral battle mitigated by aero gear.
- [x] Keep icon-only `💧` and `$` balance counters in the HUD and workshop.
- [x] Add Super Draft, Lucky Bidon, and Jump as a three-lane pickup choice.
- [x] Limit power-ups to one reserve slot, replace it with the latest pickup,
  and activate it with `Space`.
- [x] Show active power-up countdowns, effects, and rider feedback.
- [x] Animate the player, random riders, and domestiques as they pedal.
- [x] Give each sector a distinct modern atmosphere with speed-linked scrolling
  and sharper rider art.
- [x] Keep the desktop masthead and controls inside the ride frame, enlarge
  speed, distance, and notices, and keep tuning ranges out of the live HUD.
- [x] Keep current and target sector distance on one unbroken baseline.
- [x] Draw the mini profile from accumulated elevation so it never looks like a
  descent while the road is still climbing.
- [x] Add a persistent fastest-sector record and live seconds-ahead/behind
  leaderboard.
- [x] Stop at Alpe d'Huez, show a final leaderboard, and make **Ride again**
  reset the entire career.
- [x] Make both restart actions clear the live road world: fans, bags, potholes,
  pickup power-ups, draft riders, domestiques, Flow, and encounter state.
- [ ] Playtest sector duration, power-up frequency, and final-climb economy,
  then rebalance from actual ride data.

## Core Loop

1. The rider travels forward automatically.
2. Riding continuously generates Sweat and Cash.
3. During active play, the player moves between lanes to collect bonus bags and
   avoid road hazards.
4. Sweat and Cash buy permanent nodes in their respective progression branches.
5. These upgrades improve speed, endurance, handling, and power-to-weight
   ratio.
6. The player attempts a harder Tour sector.
7. Completing the sector unlocks new roads and new branches of the progression
   tree.
8. If the rider fails, they return to a completed road, keep earning resources,
   improve their setup, and try again.

The player's role is strategic: choose what to improve and when to attempt the
next challenge. The player never pedals or clicks for resources, but can
optionally steer to improve the ride's return.

The fixed starter bike travels at a believable 18 km/h on Sector 1's flat,
windless road, even before the rider has learned any skills. The first two
sectors focus on improving the rider through training and nutrition. Equipment
opens at Sector 2. The Bike branch opens at Sector 3, when accumulated sponsor Cash puts
the first Workshop Road Bike within reach and creates a large immediate speed
jump.

## Buying Units

The economy has two spendable units: **Sweat** and **Cash**. They come from
different kinds of riding and serve different branches.

### Sweat

Sweat represents accumulated physical effort. It is generated continuously by
riding, with harder terrain producing more:

```text
Sweat gained = riding time × stage effort × temporary bonuses
```

Sweat is spent on the Rider and Nutrition branches: fitness, power, endurance,
technique, fueling, hydration, and body-composition improvements.

### Cash

Cash represents sponsor income, prizes, and roadside support. A basic sponsor
contract generates Cash from distance, while bonus bags and stage victories
provide larger amounts:

```text
Cash gained = distance travelled × sponsor rate + bags + stage rewards
```

Cash is spent on physical purchases and salaries: the Bike, Equipment, and Team
branches.

This gives different roads different economic roles:

```text
Fast flat road → more kilometres per hour → more Cash
Hard climb     → more effort per hour     → more Sweat
```

Other visible values are not currencies:

- **Watts** measure current rider power.
- **Kilometres** measure route and career progress.
- **Elevation metres** record climbing achievements.
- **Stage victories** unlock nodes and branches.

None of these values are spent. Stage requirements remain gates rather than a
third currency.

### Spending Model

Every purchasable node defines:

- A cost in either Sweat or Cash
- A prerequisite node, if any
- A required stage, if any
- A maximum level
- Its effect on the rider or earning rate

A node can be purchased when all of its prerequisites are satisfied:

```text
available =
    parent node owned
    + required stage completed
    + enough of the required unit accumulated
```

| Branch | Unit | Cost pattern | Upgrade effect |
| --- | --- | --- | --- |
| Rider | Sweat | Medium cost, many repeatable levels | Steady power and endurance growth |
| Nutrition | Sweat | Low entry cost, progressively expensive levels | Sustained speed and Flow retention |
| Equipment | Cash | Low starting cost, several levels | Small cumulative gains |
| Bike | Cash | Expensive milestone purchases | Large gains and new component subtrees |
| Team | Cash | Very expensive and stage-gated | Strong multiplicative bonuses |

Early upgrades use only one unit each. Mixed Sweat-and-Cash prices are avoided
so the player always understands what kind of riding will reach the next node.

An illustrative early-game cost sequence could be:

```text
Rider endurance:   20 → 45 → 100 → 225 → 500 → 1,100 Sweat
Hydration:         25 → 60 → 145 → 350 → 850 Sweat
Aero socks:        $25 → $55 → $121 → $266
Road bike:         $60, plus the Sector 3 requirement
First teammate:    $350, plus the Sector 5 requirement
```

The exact numbers will be tuned through playtesting. Their relative shape is
important: Equipment offers frequent small purchases, Rider upgrades provide
reliable progress, Bike nodes are exciting milestones, and Team upgrades are
rare multipliers.

Sector 1 deliberately exposes the first three Endurance, Sustained Power, and
Hydration levels; the first two Technique and Fueling levels; and the first
Body Composition level. That creates fourteen early choices costing 1,035 Sweat
in total instead of an abrupt eight-purchase, 350-Sweat ceiling. Higher levels
remain gated so the first flat sector cannot erase the later climbing challenge.

## Road View and Steering

The rider remains near the left side of the screen while the road and scenery
scroll from right to left. The road is divided into multiple visible lanes.

Pressing the Up and Down arrow keys selects a target lane. The rider changes
lanes smoothly rather than snapping instantly, and no click is required. Handling,
tires, road surface, and current speed affect how quickly and safely the rider
can move.

The active interaction is optional:

- Without steering, the rider continues to generate the normal base amount of
  Sweat and Cash.
- Active steering lets the player pursue additional rewards but introduces the
  risk of hitting hazards.
- Offline progress uses the safe base rate and does not simulate collisions.

### Bonuses

Fans can stand beside the road and hold bags toward a particular lane. Passing
through a bag collects its reward:

- Sweat bags immediately add Sweat.
- Cash bags immediately add Cash.
- Bottles restore endurance.
- Energy gels temporarily increase power.
- Sponsor flags multiply Cash generation for a limited distance.
- Cheering crowds multiply Sweat generation for a limited distance.
- Toolboxes repair wear or prevent a mechanical problem.
- Rare bags provide component discounts or permanent equipment.
- Coffee stops provide an unusually powerful recovery bonus.

The roadside mix follows what progression needs at each point in the race:

| Sector | Sweat loot | Cash loot |
| --- | ---: | ---: |
| 1 | 80% | 20% |
| 2 | 65% | 35% |
| 3 | 50% | 50% |
| 4 | 35% | 65% |
| 5 | 20% | 80% |

Every bag is rolled independently against its sector probability. Sector 1
therefore averages 80% Sweat over time, but one five-bag pack may contain five
Sweat, four Sweat and one Cash, or even the rare five Cash.

### Collectible Power-ups

Power-up gates present one large pickup in each of the three lanes, forcing a
quick choice:

- **Super Draft** gives 10 seconds of +50% speed and blocks 90% of headwind.
- **Lucky Bidon** gives 7 seconds of pickup magnetism, collecting every Sweat
  and Cash bag across all lanes at its normal value.
- **Jump** lifts the rider over potholes for 1.2 seconds.

Only one power-up can be held in reserve. Collecting another always replaces
the held item rather than stacking it. Pressing `Space` or using the reserve
button activates it; an active power-up has a visible countdown and aura around
the rider. The reserve may be refilled while a power-up is active, but the next
one cannot be activated until the current effect ends. This creates three
different decisions: save Super Draft for wind, keep Lucky Bidon for a rich fan
corridor, or hold Jump for broken road.

### Hazards and Lost Units

Potholes, debris, mud, and damaged road surfaces occupy lanes and are
telegraphed far enough ahead to avoid.

Hitting a pothole slows the rider, increases fatigue, and immediately deducts
between 10% and 20% of total Cash. Dropped notes or coins spill onto nearby
lanes and a portion can be recovered by steering through them. Tires pull the
random loss toward the 10% floor, reducing severe hits without removing the
risk.

There are no checkpoints or delayed balances. All Sweat and Cash—whether
generated by riding or collected from the road—is credited to the visible,
spendable totals immediately. Sweat is not lost on collision because the
physical effort has already occurred.

Sweat and Cash balances are always whole numbers. Passive generation can
accumulate sub-unit progress internally, but the next unit is credited as soon
as that accumulator reaches one. Pickups, purchases, pothole losses, saves, and
all displayed balances use integers only.

Bonuses can chain together. For example, a gel increases power on the final
part of a climb, reaching the summit activates a large descent multiplier, and
joining a peloton afterward preserves that momentum.

### Directed Ride Encounters

Road objects are delivered as readable 10–20 second sequences rather than an
endless stream of unrelated random spawns. The Ride Director selects from:

- A bonus line with a clear high-value lane
- A broken-road slalom pairing potholes with risky Cash
- A Cash-heavy fan corridor
- A Sweat-heavy feed zone
- A short sprint segment
- Hairpin patterns on climbing sectors
- A three-lane Super Draft, Lucky Bidon, or Jump choice
- A drafting rider encounter

These patterns let the player read the road, choose a line, and execute it using
arrow-key steering. Each pickup pattern is a single sequence: missing one
pickup immediately invalidates every remaining pickup in that sequence. The
lost pickups flash three times and disappear so the failed chain is obvious.

### Flow

Consecutive pickups and actively steered near-misses build temporary Flow.
Every 20 Flow raises roadside rewards by 0.2x, up to a 2x multiplier. Flow
decays after a short quiet period and a collision resets it. Flow is never
saved or spent, so it remains a ride multiplier rather than a third currency.

### Temporary Drafting

A faster rider enters from the left, overtakes the player, and settles just
ahead of the entire team. Staying in the same lane behind their wheel activates
a temporary 50% speed bonus, additional shelter from headwind, and a Sweat
bonus paid continuously at a rate that reaches roughly 100 over the full
15-second draft. A countdown directly above the rider displays the remaining
time.

The other rider periodically changes lanes. The player has a short reaction
window to follow. Missing the move breaks the draft immediately; the other
rider accelerates toward the right edge and disappears. Drafting can continue
for at most 15 seconds. At the end of that window, the other rider accelerates
toward the right edge and disappears even if every move was followed.

Drafting becomes less forgiving as the campaign advances. Alignment is measured
in road space, so the same lane remains valid on climbs, descents, and during
the Jump animation. Sector 1 allows an 18-pixel alignment tolerance and a
1.6-second reaction window. Both values tighten gradually until Sector 5 allows
a 10-pixel tolerance and 0.8 seconds to follow a lane change.

Domestiques and Super Draft improve speed or shelter only. Neither multiplies
Sweat generation; that reward belongs exclusively to following the temporary
random rider.

### Perceived Speed

The ride view reinforces progression through faster wheel cadence, denser road
particles, stronger parallax, climb-specific rider tilt, moving drafting
streaks, a slipstream cone, floating combo feedback, and subtle high-speed
camera vibration. Active power-ups add a persistent dual aura, ground ring, and
orbiting sparks. Collisions retain a stronger shake so hazards feel materially
different from normal speed.

## Challenges

Terrain and conditions determine whether a setup is strong enough:

- Gradient reduces speed and rewards low weight and high sustained power.
- Descents produce large distance gains but require handling and braking.
- Headwinds reward aerodynamics and drafting.
- Gravel, mud, cobbles, and rough roads increase rolling resistance and
  mechanical risk.
- Long sectors accumulate fatigue and reward endurance, nutrition, and team
  support.

Each major sector can eventually gain a cutoff time and act as a boss challenge. The player
chooses when to attempt it. Failure does not remove purchased improvements; the
rider returns to training and continues accumulating resources.

Speed carries between sectors as the output of the same rider and build, then
the new road conditions modify it. A build travelling at roughly 20 km/h on the
calm Paris–Bordeaux road reaches about 14.5 km/h when it turns north into the
28% Mistral penalty:

```text
20.2 km/h × 72% headwind factor ≈ 14.5 km/h
```

The reason for the slowdown must be visible. Wind is represented by animated
streaks moving against the rider and a HUD percentage. Gradient physically
inclines the asphalt, verges, lane markings, road objects, and every rider while
the HUD shows the current grade percentage. Negative gradients physically tilt
the complete road downhill and multiply speed. Calm and flat sectors say so
explicitly rather than hiding a neutral modifier.

The five-sector rhythm deliberately alternates pressure and release:

```text
Sector 1: flat and calm
Sector 2: gentle 2.5% climb
Sector 3: fast 4% descent
Sector 4: flat road into a strong Mistral
Sector 5: 7.9% Alpe d'Huez finale
```

Those labels describe bands, not constants. Each sector interpolates smoothly
between curated profile points so the road and speed change continuously:

```text
Flat:       -2% to +2%
Easy climb:  0% to +5%
Descent:    -5% to 0%
Hard climb: +6% to +12%
```

The live grade, a moving marker on the mini profile, and the physical road angle
all report the same value. Full tuning ranges stay in this design document
rather than cluttering the live HUD.

The raw headwind is a property of the sector, while equipment reduces its
effective speed penalty. Aero Socks begin helping at their Aero tier, the Aero
Helmet begins helping at its Aero Road tier, and Wheels begin helping at the
Carbon tier. Higher tiers improve the mitigation further. The HUD displays
both raw and effective wind whenever mitigation is active.

## Campaign Progression

The campaign uses recognizable checkpoints. Each sector maps internal progress
proportionally onto its declared route distance, while simulation geometry
remains compressed enough to keep the full route inside one satisfying session.

| Sector | Route | Display distance | Main challenge | Major unlock |
| --- | --- | ---: | --- | --- |
| 1 | Paris → Bordeaux | 580 km | Calm Atlantic run and pure speed | Rider and Nutrition branches |
| 2 | Bordeaux → Clermont-Ferrand | 370 km | Gentle Massif Central climb | Equipment branch |
| 3 | Clermont-Ferrand → Avignon | 380 km | 4% descent and high-speed control | Bike branch |
| 4 | Avignon → Grenoble | 220 km | Northbound Rhône valley against the Mistral | Advanced components |
| 5 | Grenoble → Alpe d'Huez via Bourg-d'Oisans | 65 km | 21 bends at 7.9% | Team branch and Tour completion |

Completing Alpe d'Huez freezes the ride and opens a final leaderboard with every
sector time and the total race time. **Ride again** is deliberately a clean
restart: it returns to Paris and clears balances, upgrades, branch unlocks,
distance, sector records, and held or active power-ups.

### Sector Records

Every sector has a deterministic course record made from its exact gradient and
wind profile. The ride HUD compares elapsed time with the record at regular
distance splits, so the player sees a stable seconds-ahead or seconds-behind
delta instead of a misleading estimate from current speed.

Finishing a sector stores the attempt locally when it is a personal best. Once
the personal best beats the course record, that faster split curve becomes the
new live target. Restart race and Ride again deliberately erase these records
with the rest of the save.

### Route Grounding

- [La Scandibérique](https://www.francevelotourisme.com/itineraire/la-scandiberique-eurovelo-3)
  provides a real cycling spine through both Paris and Bordeaux.
- [Météo-France](https://meteofrance.com/actualites-et-dossiers/comprendre-la-meteo/le-mistral-vent-regional)
  describes the Mistral as a northerly wind in the Rhône valley, making the
  northbound Avignon–Grenoble sector a coherent headwind challenge.
- [Oisans Tourisme](https://en.oisans.com/equipement/alpe-dhuez-la-montee-mythique/)
  records the Alpe d'Huez climb from Bourg-d'Oisans as 13.8 km at 7.9%, with
  the famous 21 bends. Ze Tour compresses its distance but preserves that
  identity and average profile.

## Permanent Progression Tree

The progression tree has one root, **Cycling Career**, which is unlocked by
default. Five branches grow directly from that root:

```text
Cycling Career — unlocked by default
├── Rider — unlocked by default
├── Nutrition — unlocked by default
├── Bike — visible but locked until Sector 3
├── Equipment — visible but locked until Sector 2
└── Team — visible but locked until Sector 5
```

The graph is not visible during normal riding. The player deliberately opens
the Career Workshop with the on-screen button or `W`. Doing so pauses road
movement, hazards, pickups, and resource generation; closing the Workshop
resumes the ride.

The Workshop is one compact two-dimensional honeycomb, not five separate
menus. Cycling Career sits at its center and the Rider, Nutrition, Bike,
Equipment, and Team hexes touch it edge-to-edge. Upgrade hexes continue the
same axial grid without connector lines. Every cell uses a 1:1 bounding box;
positions are derived from one cell size with axial coordinates rather than
hand-tuned pixel offsets. A slightly larger uniform grid pitch leaves a narrow,
consistent gutter between every neighboring hex. The canvas remains draggable
and scrollable as future seasons expand it, and opens centered on the Career
node.

Progressive discovery keeps the honeycomb readable:

- The center and five branch roots are visible from the start.
- The first available upgrade in each unlocked branch is visible.
- The next connected generation appears as an unknown node.
- Purchasing its parent reveals the node's identity, levels, and price.
- More distant generations do not appear until the player advances.

Hovering or keyboard-focusing a node activates it and shows its full details.
Clicking an available revealed node immediately buys its next level. Clicking
an unavailable node keeps it active so the detail panel can explain its missing
currency, stage gate, or prerequisite.

Roadside tents can later become optional events that offer discounts, repairs,
or temporary stock. They are not required to open the permanent upgrade graph,
so players never have to interrupt a ride simply because a tent appeared.

The branches are independent. Buying a better bike unlocks customization inside
the Bike branch; it does not unlock the Rider or Equipment branches. A node can
require Cash, Sweat, completion of a stage, or ownership of a previous node.
Later choices can branch into specializations instead of always having one
strictly superior option.

### Bike and Components

The Bike branch is visible but locked through Sectors 1 and 2. Its root node is
the basic, non-upgradeable starter bike, which is owned by default. Sponsor
Cash continues accumulating while the rider trains, so reaching Sector 3 puts
the upgradeable road bike within reach.

```text
Bike branch
└── Basic bike — owned by default, fixed equipment
    └── Buy workshop-ready road bike
        ├── Frame
        │   └── Steel
        │       └── Aluminium
        │           └── Carbon
        │               ├── Lightweight climbing frame
        │               └── Aerodynamic racing frame
        ├── Shifting
        │   └── Basic indexed shifting
        │       └── Performance mechanical shifting
        │           └── Electronic shifting
        ├── Braking
        │   └── Rim brakes
        │       └── Mechanical disc brakes
        │           └── Hydraulic disc brakes
        ├── Wheels
        │   └── Alloy wheels
        │       └── Carbon wheels
        │           ├── Lightweight climbing wheels
        │           └── Deep aerodynamic wheels
        └── Tires — one progressive upgrade node
            ├── Level 1: Reinforced tires
            ├── Level 2: Performance tires
            └── Level 3: Tubeless tires
```

The initial road bike unlocks component replacement, but advanced component
tiers remain gated by sectors. This preserves the excitement of unlocking a new
system instead of merely buying a larger number. A component family is one
graph node with named internal levels: upgrading Tires changes that same node
from Reinforced to Performance to Tubeless rather than creating three separate
nodes.

Each component family has a distinct purpose:

- Frame material primarily affects weight, stiffness, comfort, and
  aerodynamics.
- Shifting preserves efficiency as gradients change.
- Braking improves descending speed, control, and safety.
- Wheels trade low weight against aerodynamic performance.
- Tires affect rolling resistance, grip, puncture protection, lane-change
  response, and the severity of pothole collisions.

Specializations create meaningful choices. A lightweight climbing setup should
dominate on steep grades, while an aerodynamic setup should be stronger on
flat, windy sectors. There should not be one universally optimal build.

### Equipment: Apparel and Accessories

The Equipment branch is independent from the Bike branch and opens in Sector 2.
Its root node is the rider's basic recreational kit. Every family contains
multiple levels, starting with ordinary equipment and ending with specialized
professional gear. Advanced levels can still require stage victories.

```text
Equipment branch
└── Basic recreational kit — owned by default
    ├── Apparel
    │   ├── Socks
    │   │   └── Cycling socks
    │   │       └── Compression socks
    │   │           └── Aero socks
    │   │               └── Wind-tunnel-optimized aero socks
    │   ├── Jersey and shorts
    │   │   └── Fitted cycling kit
    │   │       └── Race-cut kit
    │   │           └── Skinsuit
    │   │               └── Custom full aero suit
    │   ├── Helmet
    │   │   └── Entry-level road helmet
    │   │       └── Lightweight performance helmet
    │   │           └── Aero road helmet
    │   │               └── Custom-optimized aero helmet
    │   ├── Shoes
    │   │   └── Clipless cycling shoes
    │   │       └── Stiff performance shoes
    │   │           └── Carbon-soled shoes
    │   │               └── Custom aero shoes
    │   └── Eyewear
    │       └── Cycling glasses
    │           └── Full-coverage glasses
    │               └── Aero-integrated eyewear
    └── Accessories
        ├── Hydration
        ├── Bike computer
        ├── Saddle
        ├── Gloves
        └── Repair kit
```

Apparel upgrades provide small cumulative improvements to aerodynamic drag,
rider weight, comfort, and fatigue resistance. Their late levels become
important when a stage is decided by marginal gains.

Accessories form a parallel tree:

```text
Basic accessories
├── Hydration
│   └── Lightweight bottle cage
│       └── Dual-bottle system
│           └── Aero hydration system
├── Bike computer
│   └── GPS computer
│       └── Performance computer
│           └── Smart pacing system
├── Saddle
│   └── Endurance saddle
│       └── Lightweight saddle
│           └── Custom-fit saddle
├── Gloves
│   └── Padded gloves
│       └── Performance gloves
│           └── Aero gloves
└── Repair kit
    └── Compact roadside kit
        └── Fast repair system
            └── Self-sealing race setup
```

Accessories can improve more than raw speed. Hydration increases the value of
bottle pickups, the computer improves pacing, the saddle reduces fatigue,
gloves improve handling, and the repair kit reduces time lost to mechanical
problems.

### Rider Development

The Rider branch is available from the beginning. Its root node is Basic
Fitness, which is owned by default. Rider upgrades use Sweat and improve
performance without allowing body weight to decrease forever:

```text
Rider branch
└── Basic fitness — owned by default
    ├── Aerobic base
    │   └── Endurance
    │       └── Fatigue resistance
    ├── Threshold training
    │   └── Sustained power
    │       └── Climbing specialization
    ├── Technique
    │   ├── Efficient cadence
    │   └── Descending and handling
    └── Body composition
        ├── Lean endurance build
        └── Climbing specialization
```

Training primarily raises sustainable power and efficiency. Body-composition
improvements reduce the effect of steep gradients within realistic limits. The
important climbing statistic is power-to-weight ratio, not weight alone.

### Nutrition

The Nutrition branch is available from Stage 1 and uses Sweat. Hydration slows
Flow decay between successful actions. Buying Hydration reveals Fueling, whose
levels progress from basic ride food to a complete race nutrition plan and
increase sustainable speed.

### Team and Support

The Team branch is visible from the beginning but remains locked until Sector 5.
Unlocking it reveals the first purchasable node: Hire First
Domestique. Additional riders create a drafting train and provide support:

```text
Team branch — locked until Sector 5
└── Solo rider
    └── Hire first domestique
        ├── Two-rider paceline
        │   └── Three-rider train
        │       └── Optimized team formation
        ├── Bottle carrier
        │   └── Nutrition support
        └── Road captain
            └── Improved pacing
```

Drafting provides a strong multiplicative efficiency bonus on fast, flat
roads: one domestique adds 20% speed, two add 30%, and three add 40%. Its effect
decreases on steep climbs because speeds are lower.
Teammates remain useful in the mountains by pacing the leader, carrying
nutrition, and delivering the leader fresh to the foot of the climb.

Purchased domestiques are always visible in a line ahead of the player. One,
two, or three riders appear as their corresponding levels are purchased. The
whole formation changes lanes whenever the player changes lanes. Temporary
outside riders must overtake every visible domestique before settling at the
front of the group.

Support staff can become a later extension of this branch:

- A mechanic reduces failures and equipment wear.
- A coach improves training efficiency.
- A nutritionist improves endurance and recovery.
- A team manager improves sponsor income and offline progression.

## Core Performance Model

The rider's speed is derived from a small set of readable statistics:

- Sustainable power
- Rider weight
- Bike weight
- Aerodynamic drag
- Rolling resistance
- Endurance and current fatigue
- Drafting efficiency
- Handling and braking

Road gradient, surface, wind, and weather modify those statistics. The
simulation should be believable enough that equipment choices make intuitive
sense, but simple enough that the player can understand why an upgrade helps.
Gradient uses an escalating curve rather than a linear penalty: an unupgraded
18 km/h rider falls to roughly 10.5 km/h at 5% and 5 km/h at 10%. Rider
body-composition upgrades reduce the effective gradient before that curve is
applied.

The progression must always connect visible growth to a new capability:

**ride → collect → upgrade → become stronger → defeat a harder road → unlock a
new part of the tree**
