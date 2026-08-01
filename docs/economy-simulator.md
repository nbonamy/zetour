# The economy laboratory

Ze Tour needed two apparently incompatible things:

- a bicycle whose permanent neutral-flat pace grows believably from 25 to 80 km/h;
- an incremental economy that escalates from pocket change to a $100M Hyperbike.

Guessing prices one workshop tile at a time did not work. So the project grew a population of bot cyclists.

## It drives the real game

[`economySimulation.ts`](../src/core/economySimulation.ts) constructs the same [`GameStore`](../src/core/gameStore.ts) used by the playable game. It injects a deterministic clock and seeded random-number generator, disables browser storage, and advances the store in 250 ms steps.

This is not a separate formula that approximates Ze Tour. A simulated rider:

- generates Sweat, Cash, distance, and XP through `GameStore.tick`;
- encounters the same stage-specific event sequence and delays as the Phaser road;
- collects the same randomly ranged bags;
- receives the same clean-challenge rewards;
- loses the same resources in collisions;
- builds and loses the same Flow multiplier;
- buys the same catalog upgrades through the same dependency checks;
- completes and continues Tours through the real progression methods.

The simulator omits the renderer and human reflexes. Instead, reflexes become probabilities: how often a rider collects a bag, clears a challenge, or crashes. This makes skill measurable without pretending that a command-line program can steer through traffic.

## Four virtual riders

| Strategy | Behaviour |
| --- | --- |
| Passive baseline | Never steers, never buys, and exposes the idle floor. |
| Casual explorer | Misses some bags, sometimes crashes, and buys the cheapest available upgrade every 15 seconds. |
| Skilled planner | Collects most bags, clears most challenges, rarely crashes, and optimizes for time-to-payback. |
| Perfect optimiser | Collects everything, never crashes, and buys aggressively. It is intentionally an upper bound, not a human promise. |

The interesting one is the payback planner. For every eligible purchase it clones the current store, grants the clone effectively unlimited funds, and buys forward until that path changes the relevant production rate. It then scores the path as:

```text
time waiting for the money + purchase cost / production gained per second
```

That allows an early tier with no immediate production gain to be evaluated using a productive tier later on the same upgrade path.

## What gets measured

Every run records much more than its ending balance:

- first purchase and first completed Tour;
- entry time and Rider Level for every stage;
- time to 1K, 100K, 1M, 100M, and 2B in both currencies;
- earned, spent, peak, and final balances;
- income split between passive riding, bags, and clean challenges;
- losses from collisions;
- production and rewards by sector;
- every purchase, its cost, its resulting income, and estimated payback;
- completion of the ordinary career tree and acquisition of the Hyperbike;
- final effective pace and permanent neutral-flat speed.

Multiple seeds are summarized as median and p10–p90 instead of presenting one lucky run as truth.

## The constraints are data too

The targets live in [`economy-balance.json`](../src/data/economy-balance.json), next to base production, reward ranges, stage multipliers, XP tiers, and the uncapped Rider Level curve. Upgrade prices and gains live in [`upgrade-catalog.json`](../src/data/upgrade-catalog.json).

The calibration command checks declared design promises, including:

- when a casual rider should make the first purchase and finish the first Tour;
- the target Rider Level at each stage boundary;
- how early the normal tree may be completed;
- the skilled-rider window for the Hyperbike;
- exactly 25 km/h with no permanent upgrades and 80 km/h with all of them.

`--check` makes a failed promise a failed command, which turns game feel into a regression gate without pretending that every aspect of fun can be unit-tested.

## Running the laboratory

```sh
# The standard calibration gate: two useful riders, three seeds, two virtual hours
npm run calibrate:economy

# Explore all four rider personalities
npm run simulate:economy -- --minutes=60 --runs=3 --seed=42

# See exactly what the skilled bot buys and why
npm run simulate:economy -- --minutes=60 --runs=1 --trace=skilled

# Remove continuous Rider Level growth to isolate its impact
npm run simulate:economy -- --minutes=60 --progression=none

# Consume every raw sample from another tool
npm run simulate:economy -- --minutes=60 --json
```

The report includes milestone timing, final production, income-source breakdowns, sector reward scaling, every upgrade cost cliff, and an optional purchase trace. It is both a balancing instrument and a compact explanation of what the current economy actually does.

## A simulator, not an oracle

It cannot measure whether dodging a van feels exhilarating, whether a button is satisfying, or whether the fifth soundtrack has become annoying. Its virtual riders are explicit assumptions. Change those assumptions and the answer changes.

What it does provide is a repeatable baseline. When a new skill, stage multiplier, XP tier, or cost is introduced, Ze Tour can answer “what happens after two hours?” before asking a human to play two hours.
