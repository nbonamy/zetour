# Other delightful technical oddities

The economy laboratory and procedural composer are the obvious excesses. A few smaller Ze Tour decisions are also worth preserving because they tell the story of how the game was built.

## The Career Workshop is a validated graph

[`upgrade-catalog.json`](../src/data/upgrade-catalog.json) stores the five branches, named equipment tiers, currencies, prices, stat gains, parents, children, and cross-branch dependencies. The Workshop renderer places the five branch hubs 72° apart around the Season and lays their nodes on radial and tangential steps.

Before the game starts, [`upgrades.ts`](../src/core/upgrades.ts) rejects a catalog with:

- duplicate or missing nodes;
- a parent and child that disagree about their relationship;
- a missing dependency or dependency cycle;
- a tier requiring the wrong unit—for example, seconds of flat speed;
- mixed currencies inside one upgrade path;
- an adjacent tier price above the declared maximum ratio;
- flat-speed gains that do not add up to exactly 55 km/h.

That last check is subtle. The game does not simply clamp an upgraded rider to 80 km/h. A bare neutral-flat rider starts at 25, and the authored permanent gains must total 55. Terrain, wind, Flow, drafting, and temporary powers are applied later, so they can still push the effective pace outside that permanent 25–80 range.

## Generated artwork still needs an assembly line

The hand-drawn source images are not dropped directly into Phaser. [`process-art-assets.py`](../scripts/process-art-assets.py) turns them into a coherent game set with Pillow:

- transparent characters are cropped to their visible pixels, resized together, and grounded on a shared baseline so animation frames do not jump;
- riders and fans become two-frame pedal or cheer animations;
- pickups, potholes, and profile-view vehicles receive purpose-built transparent canvases;
- each stage painting becomes a mirrored 2,048-pixel panorama that can repeat without a hard seam;
- roadside paintings become independent horizontal strips so they can scroll with the road instead of being baked into the distant landscape;
- road and paper artwork become compressed browser textures.

This small pipeline is why generated source art can behave like a deliberately authored sprite set. It also explains why a fan, bicycle, or pothole can be resized once without reintroducing a different baseline in every frame.

## There is a deterministic screenshot universe

Visual bugs in Ze Tour tended to be wonderfully specific: a pothole six pixels too low, a bottom-lane car that never appeared, a verge scrolling at the wrong speed, or a HUD panel shifting by one pixel.

Development builds therefore understand save-neutral QA parameters:

| Parameter | Forced state |
| --- | --- |
| `qaFresh=1` | Isolated Level 1 career that neither reads nor changes the normal save |
| `qaStage=1..5` | Landscape and road surface |
| `qaSpeed=25` | Visual road speed |
| `qaGradient=-0.05` | Climb or descent geometry |
| `qaEncounter=traffic` | Specific road encounter |
| `qaDrafting=1` and `qaDraftLane=1` | Draft presentation and lane |
| `qaPowerUp=super-draft` | Active power-up presentation |
| `qaFlow=80` | Flow feedback |
| `qaDomestiques=3` | Team formation |
| `qaPaused=1` or `qaFinished=1` | Stable pause and finish states |

For example:

```text
http://localhost:5173/?qaFresh=1&qaStage=5&qaSpeed=80&qaEncounter=traffic
```

The parameters are parsed and bounded in [`visualQa.ts`](../src/game/visualQa.ts). Production builds ignore them. They turn transient arcade scenes into stable, repeatable compositions that can be compared across viewport sizes.

## France is 1,615 km and also 5.95 km

The five displayed routes total 1,615 km. Their playable simulation distances total only 5,950 metres before the duration multiplier is applied. [`gameStore.ts`](../src/core/gameStore.ts) maps progress through each compact stage back onto its real route distance for the HUD.

This lets the game say Paris → Bordeaux without asking the player to leave a browser tab open for twenty hours. Pace still affects completion time, but geography and playability are intentionally separate scales.

## The Konami code is an economic instrument

The classic Konami sequence grants 5B Sweat and $5B Cash. It is not a monetization strategy; it exists so the expensive end of the Workshop can be inspected without replaying the entire exponential curve after every UI change.

The cheat is deliberately save-aware: invoking it restores each resource to at least five billion rather than blindly adding five billion every time. Even the cheat has accounting rules.

## The game and its tests share the awkward maths

Traffic guarantees at least one safe lane, can occupy two lanes, gives the safe route a maximum one-lane jump, and is spaced from physical road speed to preserve reaction time. Riders, potholes, vehicles, and bags use different grounding offsets because their transparent sprite canvases do not share the same visual baseline.

These details live in pure functions rather than being buried in Phaser callbacks. That made it possible to turn a long sequence of “that car is in the wrong lane” screenshots into executable geometry rules—and is a good summary of Ze Tour itself: playful on the surface, suspiciously serious underneath.
