# Ze Tour graphics asset inventory

## Direction

The new look is a hand-drawn storybook cycling game: thick dark-brown
outlines, softly rounded characters, restrained cel shading, muted French
landscape colors, painted texture, and a dark cocoa UI frame. It is not pixel
art and it is not a photorealistic cycling simulator.

The generated full-screen concepts are style references, not production
assets. The shippable game needs reusable transparent sprites, seamless
scrolling tiles, and a small number of landmark illustrations. A full-screen
AI image cannot be used as a scrolling background without visible seams or
breaking the road geometry.

## Implemented runtime asset map

The current game no longer generates placeholder sprites in Phaser. The
production-ready files live in `public/assets/art`; the high-resolution
image-generation sources live in `art-source`.

| Runtime keys/files | Runtime role | Implementation |
| --- | --- | --- |
| `rider-a`, `rider-b` | player pedal loop | Yellow-jersey storybook cyclist |
| `draft-rider-a`, `draft-rider-b` | temporary rider ahead | Contrasting blue rider on the same two-pose rig |
| `domestique-rider-a`, `domestique-rider-b` | hired support riders | Green/rust support rider on the same rig |
| `fan-1-a/b` through `fan-4-a/b` | roadside crowd | Four randomized fans spanning genders, ages, skin tones, hats, and clothing |
| `bag-sweat`, `bag-cash` | collectible resources | Painted blue droplet bag and ochre cash pouch |
| `power-super-draft` | speed power-up | Painted slipstream medallion |
| `power-lucky-bidon` | pickup-magnet power-up | Painted bidon medallion |
| `power-jump` | pothole-immunity power-up | Painted wheel/jump medallion |
| `pothole` | road hazard | Painted transparent road damage sprite |
| `stage-1.jpg` through `stage-5.jpg` | far/mid scenery | Five wide mirrored panoramas with stage-specific light and landmarks |
| `roadside-upper.png` | spectator verge | Purpose-built transparent, one-course packed-earth and limestone edge; rotates and scrolls at road speed without obscuring the panorama |
| `roadside-lower.jpg` | lower road foreground | Gravel shoulder, limestone wall, vines, and flowers; rotates with the road |
| `road-texture.jpg` | inclined road surface | Seamless warm asphalt paper texture |
| `paper-texture.jpg` | HUD and workshop | Shared paper grain behind dynamic cocoa UI chrome |

The speed dial, meters, road geometry, lane markings, flow feedback, wind
streaks, route text, resource numbers, and all interactive labels remain
code-controlled. That keeps them dynamic and crisp while using the exact
cocoa, parchment, and ochre construction from the original concept render.

## Current art pack

This is the coherent production pack used by the existing game.

### Characters

- Player cyclist: one two-frame side-view pedal loop, yellow jersey, starter
  bike, readable helmet and face.
- Random rider: one two-frame loop with a contrasting blue jersey.
- Domestique: one two-frame loop with a green/rust support kit.
- Fans: four two-frame cheering loops, randomized per pickup and reusable on
  the upper spectator verge. Every frame shares the same foot baseline and
  scale, so cheering never makes a fan jump or float.
- Fan clothing: blue blouse and terracotta skirt; navy cap and casual kit;
  beret, rust vest, and blue trousers; green jacket, coral scarf, and mustard
  trousers.

All cyclist sheets share the same camera angle, body proportions, wheel
radius, baseline, and frame timing.

### Pickups and hazards

- Sweat pickup: painted bag/droplet silhouette.
- Cash pickup: painted coin-pouch silhouette.
- Super Draft badge: slipstream/wind motif.
- Lucky Bidon badge: decorated bottle motif.
- Jump badge: wheel and upward-motion motif.
- Pothole: one painted transparent hazard that follows the inclined road.
- Collection, near-miss, impact, draft, and jump feedback remain lightweight
  Phaser motion, text, tint, and particle effects.

### Road and scrolling world

The world uses four independent horizontal layers:

- Five stage panoramas moving at the slow scenery speed.
- One upper roadside strip that gives every spectator a visible ground plane.
- One lower roadside strip that closes the road edge with the stone-and-vine
  treatment from the original mockup.
- One seamless asphalt tile moving fastest and rotating with the actual
  gradient.

Both roadside strips use the exact road rotation, vertical offset, and
contact-plane scroll speed rather than staying screen-horizontal or drifting
past fans. Lane markings, road edges, wind ribbons, and speed particles remain
dynamic Phaser geometry so they continue to align with incline and speed.

### Stage-specific landmarks

The current five panoramas incorporate the relevant landmarks into wide
scrolling compositions:

- Sector 1, Paris–Bordeaux: distant Paris skyline/Eiffel silhouette, vineyard
  rows, village church, and château/stone wall.
- Sector 2, Bordeaux–Clermont-Ferrand: Périgord village, wooded foothills,
  and first volcanic Massif Central ridges.
- Sector 3, Clermont-Ferrand–Avignon: volcanic ridge, long descent overlook,
  Rhône approach, and warm Provence village.
- Sector 4, Avignon–Grenoble: Pont d’Avignon/old city silhouette, lavender,
  plane trees bent by the Mistral, and distant Grenoble mountains.
- Sector 5, Grenoble–Alpe d’Huez: Alpine valley, snow peaks, hairpin road,
  stone retaining wall, summit crowd, and finish banner.

## Full campaign art pack

The complete visual overhaul adds these reusable families on top of the first
pack:

- Four fan silhouettes and four clothing palettes, each with idle, cheer, and
  bag-handoff poses.
- Four rival/support rider palettes while preserving the same cyclist rig.
- Four visual bike milestones: fixed starter, workshop road bike, carbon race
  bike, and pro-team bike.
- Four rider kit milestones: basic kit, fitted kit, skinsuit, and aero suit.
- Three helmet silhouettes and three wheel/tire silhouettes.
- Five stage-specific finish/transition cards.
- Finish-line banner, checkered flag, summit confetti, and record-pacing badge.
- Workshop backdrop, branch hubs, and modal panel decorations.
- A complete painted icon set for the career graph rather than the current
  emoji/glyph placeholders.

## Career graph and HUD icon set

The upgrade graph currently has sixteen upgrade concepts plus five branch hubs.
The icons should be a consistent painted line-art set, 64×64 source pixels,
with transparent backgrounds:

- Career center, Bike, Rider, Nutrition, Equipment, Team.
- Road bike, Frame, Tires, Shifting, Wheels, Brakes.
- Endurance, Sustained power, Bike handling, Body composition.
- Hydration, Fueling, Aero socks, Aero helmet, Race suit, Domestique.
- Sweat, Cash, wind, grade, route/flag, leaderboard, workshop, and restart.

These are UI icons, not scene sprites. They should not be generated as part of
the landscape batch.

## Technical contracts

- Keep the logical ride world at 640×360 and export source art at 2× or 4×.
- Use transparent PNG sprite atlases for characters, pickups, hazards, and
  effects.
- Use 1024-pixel-wide or larger seamless tiles for scrolling layers.
- Anchor cyclists and road objects at the wheel/road contact point so the
  existing incline and lane math remains correct.
- Derive the three lane centers from the two divider lines and the road edges;
  bags, potholes, and riders must share those exact centers.
- Keep all text, numbers, route distances, and progress bars out of generated
  art; render them in Vue/Phaser so they remain crisp and localized.
- Do not bake shadows into every sprite. Use one shared soft contact shadow or
  a controlled scene layer so road incline and lighting stay coherent.
- Generate one master style sheet first, then derive the character, pickup,
  landmark, and tile prompts from it. This avoids style drift across batches.

## Production order

1. Lock the master style sheet and player cyclist silhouette.
2. Generate the three cyclist atlases and the fan/prop atlas.
3. Generate Sweat, Cash, power-up, pothole, and feedback effects.
4. Replace the two current background tiles with the first stage's layered
   scrolling test.
5. Add all five stage background packs and landmarks.
6. Replace career/HUD glyphs with the painted icon set.
7. Add visual upgrade milestones and finish-line art.
8. Tune camera scale, anchors, animation timing, and road-layer speeds in the
   browser at desktop and narrow widths.

The first visual checkpoint should be one complete Sector 1 ride, not five
partially finished stages. If that screen does not feel like the generated
concepts, more assets will only multiply the problem.
