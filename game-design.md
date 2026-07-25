# Biker Inc. — Game Design

## Concept

Biker Inc. is an incremental cycling game. The rider moves forward
automatically without clicking or manual pedalling. Riding generates resources,
resources buy permanent improvements, and those improvements allow the rider
to overcome progressively harder roads.

During active play, the player can move the rider between road lanes by moving
the mouse. Steering is used to collect bonuses and avoid hazards; it never
controls forward motion.

The first campaign begins on a flat local circuit and gradually introduces
wind, rolling terrain, longer climbs, and mountain passes. Its final challenge
is the ascent of Alpe d'Huez.

## Core Loop

1. The rider travels forward automatically.
2. Riding continuously generates Sweat and Cash.
3. During active play, the player moves between lanes to collect bonus bags and
   avoid road hazards.
4. Sweat and Cash buy permanent nodes in their respective progression branches.
5. These upgrades improve speed, endurance, handling, and power-to-weight
   ratio.
6. The player attempts a harder stage.
7. Completing the stage unlocks new roads and new branches of the progression
   tree.
8. If the rider fails, they return to a completed road, keep earning resources,
   improve their setup, and try again.

The player's role is strategic: choose what to improve and when to attempt the
next challenge. The player never pedals or clicks for resources, but can
optionally steer to improve the ride's return.

The opening is intentionally slow: the fixed starter bike travels at about
12 km/h, making it feel obviously inadequate. This dull state must be brief.
The affordable first Workshop Road Bike creates a large immediate speed jump,
and the first Power training levels arrive quickly enough that the player sees
meaningful acceleration during the opening minutes.

## Buying Units

The economy has two spendable units: **Sweat** and **Cash**. They come from
different kinds of riding and serve different branches.

### Sweat

Sweat represents accumulated physical effort. It is generated continuously by
riding, with harder terrain producing more:

```text
Sweat gained = distance travelled × stage yield × temporary bonuses
```

Sweat is spent on the Rider branch: fitness, power, endurance, technique,
nutrition knowledge, and body-composition improvements.

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
| Equipment | Cash | Low starting cost, several levels | Small cumulative gains |
| Bike | Cash | Expensive milestone purchases | Large gains and new component subtrees |
| Team | Cash | Very expensive and stage-gated | Strong multiplicative bonuses |

Early upgrades use only one unit each. Mixed Sweat-and-Cash prices are avoided
so the player always understands what kind of riding will reach the next node.

An illustrative early-game cost sequence could be:

```text
Rider endurance:   100 → 180 → 325 → 585 Sweat
Aero socks:        $30 → $90 → $270 → $810
Road bike:         $500
Carbon frame:      $2,500
First teammate:    $8,000, plus the Stage 3 requirement
```

The exact numbers will be tuned through playtesting. Their relative shape is
important: Equipment offers frequent small purchases, Rider upgrades provide
reliable progress, Bike nodes are exciting milestones, and Team upgrades are
rare multipliers.

## Road View and Steering

The rider remains near the left side of the screen while the road and scenery
scroll from right to left. The road is divided into multiple visible lanes.

Moving the mouse vertically selects a target lane. The rider changes lanes
smoothly rather than snapping instantly, and no click is required. Handling,
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
- Hairpin patterns on climbing stages
- A drafting rider encounter

These patterns let the player read the road, choose a line, and execute it using
mouse-only steering. Each pickup pattern is a single sequence: missing one
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
a temporary speed bonus and additional shelter from headwind.

The other rider periodically changes lanes. The player has a short reaction
window to follow. Missing the move breaks the draft immediately; the other
rider accelerates toward the right edge and disappears. Drafting can continue
for at most 15 seconds. At the end of that window, the other rider accelerates
toward the right edge and disappears even if every move was followed.

Drafting becomes less forgiving as the campaign advances. Stage 1 allows a
wide spatial tolerance and a 1.5-second reaction window. Both values shrink on
every stage until Stage 6 allows only a 12-pixel alignment tolerance and roughly
0.4 seconds to follow a lane change.

### Perceived Speed

The ride view reinforces progression through faster wheel cadence, denser road
particles, stronger parallax, climb-specific rider tilt, wind streaks, floating
combo feedback, and subtle high-speed camera vibration. Collisions retain a
stronger shake so hazards feel materially different from normal speed.

## Challenges

Terrain and conditions determine whether a setup is strong enough:

- Gradient reduces speed and rewards low weight and high sustained power.
- Descents produce large distance gains but require handling and braking.
- Headwinds reward aerodynamics and drafting.
- Gravel, mud, cobbles, and rough roads increase rolling resistance and
  mechanical risk.
- Long stages accumulate fatigue and reward endurance, nutrition, and team
  support.

Each major stage has a cutoff time and acts as a boss challenge. The player
chooses when to attempt it. Failure does not remove purchased improvements; the
rider returns to training and continues accumulating resources.

Speed carries between stages as the output of the same rider and build, then
the new stage conditions modify it. A build travelling at 20 km/h on the flat
local circuit enters the flat but windy Stage 2 at roughly 15 km/h:

```text
20 km/h × 75% headwind factor = 15 km/h
```

The reason for the slowdown must be visible. Wind is represented by animated
streaks moving against the rider and a HUD percentage. Gradient is represented
by uphill road chevrons and the current grade percentage. Calm and flat stages
say so explicitly rather than hiding a neutral modifier.

Wind and gradient are introduced separately before they are combined:

```text
Stage 1: flat, calm
Stage 2: flat, strong headwind
Stage 3: small slope, calm
Stage 4: medium slope, calm
Stage 5: medium slope, headwind
Stage 6: high Alpe d'Huez slope, headwind
```

The raw headwind is a property of the stage, while equipment reduces its
effective speed penalty. Aero Socks begin helping at their Aero tier, the Aero
Helmet begins helping at its Aero Road tier, and Wheels begin helping at the
Carbon tier. Higher tiers improve the mitigation further. The HUD displays
both raw and effective wind whenever mitigation is active.

## Campaign Progression

| Stage | Main challenge | What it teaches | Major unlock |
| --- | --- | --- | --- |
| 1. Local circuit | Flat, safe, short | Automatic riding and earning Cash | First upgradeable bike can be purchased |
| 2. Windy open road | Flat with strong headwind | Aerodynamics | Advanced equipment levels |
| 3. Rolling countryside | Small slope, no wind | Shifting and endurance | Team branch |
| 4. First categorized climb | Medium slope, no wind | Power-to-weight ratio | Climbing specializations |
| 5. Mountain pass | Medium slope with headwind | Nutrition, weight, and braking | Professional equipment tiers |
| 6. Alpe d'Huez | High slope with headwind | Complete build optimization | Next campaign |

Completing Alpe d'Huez finishes the first campaign. It can unlock a new season
with a permanent career bonus and new campaigns based on gravel, cobbles,
ultra-distance riding, or another mountain range.

## Permanent Progression Tree

The progression tree has one root, **Cycling Career**, which is unlocked by
default. Four branches grow directly from that root:

```text
Cycling Career — unlocked by default
├── Bike — unlocked by default
├── Rider — unlocked by default
├── Equipment — unlocked by default
└── Team — visible but locked until Stage 3
```

The graph is not visible during normal riding. The player deliberately opens
the Career Workshop with the on-screen button or keyboard shortcut. Doing so
pauses road movement, hazards, pickups, and resource generation; closing the
Workshop resumes the ride.

The Workshop is one large two-dimensional canvas, not four separate menus.
Cycling Career sits at its center and the Bike, Rider, Equipment, and Team
branches expand outward. The canvas is larger than the viewport and can be
explored by dragging, scrolling, or using a trackpad. It opens centered on the
Career node.

Progressive discovery keeps the large graph readable:

- The center and four branch roots are visible from the start.
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

The Bike branch is available immediately. Its root node is the basic,
non-upgradeable starter bike, which is owned by default. The player's first
major objective is to earn enough Cash on the local circuit to purchase the
next node: an upgradeable road bike.

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
tiers remain gated by stages. This preserves the excitement of unlocking a new
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
flat, windy stages. There should not be one universally optimal build.

### Equipment: Apparel and Accessories

The Equipment branch is independent from the Bike branch and is available from
the beginning. Its root node is the rider's basic recreational kit. Every
family contains multiple levels, starting with ordinary equipment and ending
with specialized professional gear. Advanced levels can still require
stage victories.

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
    └── Nutrition
        ├── Better hydration
        ├── Race fueling
        └── Recovery program
```

Training primarily raises sustainable power and efficiency. Nutrition improves
endurance and recovery, with limited and realistic body-composition
improvements. The important climbing statistic is power-to-weight ratio, not
weight alone.

### Team and Support

The Team branch is visible from the beginning but remains locked until Stage 3
is completed. Unlocking it reveals the first purchasable node: Hire First
Domestique. Additional riders create a drafting train and provide support:

```text
Team branch — locked until Stage 3
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
roads. Its effect decreases on steep climbs because speeds are lower.
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

The progression must always connect visible growth to a new capability:

**ride → collect → upgrade → become stronger → defeat a harder road → unlock a
new part of the tree**
