# Ze Tour

A browser-based incremental cycling game prototype built with Phaser, Vue,
TypeScript, and Vite.

## Run locally

```sh
npm install
npm run dev
```

Then open the local URL printed by Vite.

## Verify

```sh
npm test
npm run typecheck
npm run build
```

## Prototype controls

- The rider moves forward automatically.
- Use the Up/Down arrow keys to change lanes.
- Collect fan bags for Sweat and Cash.
- Loot shifts gradually from 80% Sweat in Sector 1 to 80% Cash in Sector 5.
- Choose between Super Draft, Lucky Bidon, and Jump pickups—one in each lane.
  One power-up can wait in reserve, a new pickup replaces it, and `Space`
  activates it.
- Avoid potholes, which make the rider drop Cash.
- Follow directed bonus, slalom, sprint, climb, and drafting encounters.
- Following a random rider for the full 15-second draft earns roughly 100
  Sweat; domestiques provide permanent formation bonuses of 20%, 30%, or 40%
  without changing Sweat income.
- Chain pickups and near-misses to build a temporary Flow reward multiplier.
- Every collected unit is credited immediately.
- Read the two compact resource counters by icon: `💧` for Sweat and `$` for
  Cash.
- Open the Career Workshop with its button or `W`; the ride pauses while it is
  open.
- Drag or scroll its compact honeycomb to explore the five career branches.
- Sector 1 opens Rider and Nutrition, Sector 2 opens Equipment, Sector 3 opens
  Bike, and Sector 5 opens Team.
- Spend Sweat on Rider and Nutrition; spend Cash on Bike, Equipment, and Team.
- Race each sector against its course record. The live leaderboard shows exactly
  how many seconds the rider is ahead or behind, and faster personal records are
  saved locally.
- Finishing Alpe d'Huez pauses the race and opens the final leaderboard.
  **Ride again** starts a completely fresh career and clears balances, upgrades,
  unlocks, records, distance, power-ups, and every spawned road object.

The first compressed Tour crosses France through Paris → Bordeaux →
Clermont-Ferrand → Avignon → Grenoble → Alpe d'Huez. The HUD displays the
declared route distances—580, 370, 380, 220, and 65 km—while the internal
simulation remains compressed for game pacing. Terrain, wind direction, and the
final 21-bend climb provide the geographical identity.
