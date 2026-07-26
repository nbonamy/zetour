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
- Choose between Super Draft and Super Power pickups. One power-up can wait in
  reserve; activate it with `Space`.
- Avoid potholes, which make the rider drop Cash.
- Follow directed bonus, slalom, sprint, climb, and drafting encounters.
- Random riders provide a timed 50% draft; domestiques provide permanent
  formation bonuses of 20%, 30%, or 40%.
- Chain pickups and near-misses to build a temporary Flow reward multiplier.
- Every collected unit is credited immediately.
- Open the Career Workshop with its button or `U`; the ride pauses while it is
  open.
- Drag or scroll its compact honeycomb to explore the five career branches.
- Sector 1 opens Rider and Nutrition, Sector 2 opens Equipment, Sector 3 opens
  Bike, and Sector 5 opens Team.
- Spend Sweat on Rider and Nutrition; spend Cash on Bike, Equipment, and Team.
- Race each sector against its course record. The live leaderboard shows exactly
  how many seconds the rider is ahead or behind, and faster personal records are
  saved locally.
- Finishing Alpe d'Huez starts the next Tour in Paris without relocking branches
  or losing upgrades.

The first compressed Tour crosses France through Paris → Bordeaux →
Clermont-Ferrand → Avignon → Grenoble → Alpe d'Huez. Distances are tuned for
game pacing while terrain, wind direction, and the final 21-bend climb provide
the geographical identity.
