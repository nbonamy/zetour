# Ze Tour

Ze Tour is a browser-based incremental cycling game built with Phaser, Vue,
TypeScript, and Vite. The rider stays readable on a three-lane road while an
independent Tour-pace multiplier grows from plausible club speed into gloriously
illegal six-digit kilometres per hour.

## Run locally

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite.

## Verify

```sh
npm test
npm run typecheck
npm run build
```

## The loop

1. Ride automatically and generate Sweat and Cash.
2. Steer into bags, drafting lines, and power-ups; avoid potholes and oncoming
   traffic.
3. Spend in the Career Workshop on repeatable upgrades.
4. Hit Levels 10, 25, 50, and 100 for cumulative ×2, ×3, ×5, and ×10
   breakthroughs.
5. Finish the Tour, then either keep the build for a victory lap or bank the
   run as Palmarès and start a faster Season.
6. Spend Palmarès on permanent pace, starting resources, offline efficiency,
   auto-buying, and pickup magnetism.

Sweat and Cash are the only resources spent during a Season. Palmarès is a
between-Season prestige reward and cannot drop from the road.

## Controls

- `↑` / `↓`: change lanes.
- `Space`: activate the reserved power-up.
- `P` or `Esc`: pause or resume.
- `W`: open or close the Career Workshop.
- The on-screen controls provide the same actions.

Forward travel is automatic. Steering is an optional accelerant, never a
requirement for passive or offline progress.

## Incremental systems

- The HUD separates physical **road speed** from effective **Tour pace**. Road
  speed stays visually coherent; Tour pace compounds without a physics ceiling.
- Career upgrades multiply one another across Rider, Nutrition, Equipment,
  Bike, and Team. Buy quantities are `+1`, `+10`, and `MAX`.
- Roadside Sweat bags award 20 seconds of current Sweat production. Cash bags
  award 30 seconds of current Cash production, so active play remains relevant
  in late Seasons.
- Completing a full random-rider draft grants five Sweat bags at the current
  production rate.
- Road power-ups have distinct jobs: Acceleration gives reliable 2.5× speed
  and income for 10 seconds; Super Draft gives 4× for eight seconds but only
  while holding a random rider's wheel; Invincibility nullifies potholes and
  traffic for eight seconds.
- Successful pickups, near-misses, and drafting build Flow up to ×3. Flow
  multiplies Tour pace and both production rates. It stays out of the road view
  and appears as a compact speed-HUD badge only while the bonus is active.
- Equipment opens in Sector 2, Bike in Sector 3, and Team in Sector 4.
- Mechanical upgrades include gravel tires, micro-suspension, chain
  lubrication, a race mechanic, a sponsor empire, and a directeur sportif.
- The Bordeaux → Clermont-Ferrand sector uses a dedicated gravel surface and a
  34% untreated rolling penalty. Gravel tires, suspension, lubrication, and the
  mechanic progressively erase it.
- Offline riding advances route distance and both resources at 60% efficiency;
  the Legendary soigneur can restore full efficiency.

## Tour and Seasons

The displayed route covers 1,615 km while the simulation distances are
compressed for game pacing:

| Sector | Route | Surface / challenge | Branch unlock |
| --- | --- | --- | --- |
| 1 | Paris → Bordeaux | Flat road | Rider + Nutrition |
| 2 | Bordeaux → Clermont-Ferrand | Périgord gravel climb | Equipment |
| 3 | Clermont-Ferrand → Avignon | Fast descent | Bike |
| 4 | Avignon → Grenoble | 28% Mistral penalty | Team |
| 5 | Grenoble → Alpe d'Huez | 21-bend summit finish | Final team node |

At Alpe d'Huez:

- **Victory lap** keeps balances, upgrades, unlocks, and records, then starts
  another Tour. Multiple Tours increase the eventual Palmarès reward with
  diminishing returns.
- **Start Next Season** awards the previewed Palmarès, resets the in-Season
  economy, and preserves Palmarès upgrades, total Tours, lifetime distance, and
  sector records.
- **Restart race** is the explicit destructive career reset and requires
  confirmation.

## Visual QA

Development builds accept save-neutral visual overrides:

`qaPaused`, `qaStage`, `qaGradient`, `qaEncounter`, `qaDomestiques`, `qaFlow`,
`qaPowerUp`, `qaDrafting`, and `qaFinished`.

Pair overrides with `qaPaused=1` for repeatable screenshots. They are disabled
in production.
