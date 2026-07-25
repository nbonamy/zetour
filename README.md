# Biker Inc.

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
- Move the mouse vertically over the road to change lanes.
- Collect fan bags for Sweat and Cash.
- Avoid potholes, which make the rider drop Cash.
- Follow directed bonus, slalom, sprint, climb, and drafting encounters.
- Random riders provide a timed 50% draft; domestiques provide permanent
  formation bonuses of 20%, 30%, or 40%.
- Chain pickups and near-misses to build a temporary Flow reward multiplier.
- Every collected unit is credited immediately.
- Open the Career Workshop with its button or `U`; the ride pauses while it is
  open.
- Drag or scroll its large canvas to explore the five connected branches.
- Stage 1 opens Rider and Nutrition, Stage 2 opens Equipment, Stage 3 opens
  Bike, and Stage 5 opens Team.
- Spend Sweat on Rider and Nutrition; spend Cash on Bike, Equipment, and Team.
