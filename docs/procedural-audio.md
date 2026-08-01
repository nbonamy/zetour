# A soundtrack written by JavaScript

Every piece of audio in Ze Tour is original and generated inside the repository. There are no stock tracks, downloaded samples, sample packs, or mystery licensing terms.

[`generate-audio.mjs`](../scripts/generate-audio.mjs) is a tiny offline synthesizer, sequencer, arranger, effects desk, mastering chain, WAV writer, and build pipeline in one dependency-free Node.js file. FFmpeg is used only at the very end to encode the generated samples.

## Five authored compositions

Each stage starts with a compact musical definition: title, BPM, key, root progression, chord voicings, scale, melody degrees, and a palette. The arranger turns that data into a 24-bar loop with bass, chords, an arpeggiated pulse, percussion, and melodies that enter as the arrangement develops.

| Stage | Track | BPM | Key | Character |
| --- | --- | ---: | --- | --- |
| 1 | Atlantic Sun | 108 | D major | Sunny, open, and lightly brassy |
| 2 | Dust of Perigord | 102 | A Dorian | Earthy percussion and rustic motion |
| 3 | Rhône Velocity | 126 | E minor | Fast motorik momentum |
| 4 | Mistral Lines | 112 | D minor | Airy, restless, and windblown |
| 5 | Twenty-One Bends | 98 | C minor | A climbing ostinato with a summit lift |

The tracks are authored rather than randomly composed at build time. Randomness is seeded and used only where timbral noise is useful, so the same source produces the same underlying mix.

## The instruments are equations

The generator allocates left and right `Float32Array` buffers at 32 kHz, then writes every sample itself. Its instruments are small combinations of oscillators, harmonics, envelopes, detuning, vibrato, filtered noise, stereo panning, and two short echo taps.

- bass uses a decaying fundamental plus harmonics;
- plucks rapidly remove their upper harmonics;
- accordion combines detuned harmonic stacks and vibrato;
- pads use slow envelopes and gently detuned partials;
- brass brightens a harmonic stack during the attack;
- flute mixes a sine-like tone with seeded breath noise;
- glockenspiel uses inharmonic, independently decaying partials;
- kick, snare, hats, and shakers are synthesized separately.

There is no MIDI player and no soundfont. MIDI note numbers are merely a convenient way to specify pitch before they are converted to frequencies.

## Nineteen effects use the same studio

The event sounds are small hand-authored recipes built from those instruments plus frequency sweeps and noise. A cash bag is a bright three-note glock figure. A pothole combines a kick, an earthy snare, and several falling noisy sweeps. A car crash adds a much larger impact, detuned metal-like notes, and a descending scrape. Tour completion gets an actual brass fanfare because restraint had already left the building.

The full set covers pickups, collisions, drafting, power-ups, challenge outcomes, level-ups, purchases, sector and Tour completion, race starts, and Workshop transitions.

## From arrays to game assets

The build pipeline:

1. renders stereo floating-point samples;
2. softens both ends of music loops;
3. measures RMS and peak level;
4. applies gain and gentle `tanh` saturation;
5. writes a temporary 16-bit stereo WAV by constructing its RIFF header directly;
6. asks FFmpeg for OGG/Vorbis and MP3 versions;
7. writes [`manifest.json`](../public/assets/audio/manifest.json) with titles, durations, levels, sample rate, provenance, and license.

The browser prefers OGG and falls back to MP3. [`gameAudio.ts`](../src/audio/gameAudio.ts) loads and decodes assets through the Web Audio API, loops the current stage theme, crossfades on stage changes, and routes music and effects through separate gain nodes. Browser autoplay rules still apply, so the audio context is unlocked by the player's first gesture.

## Rebuilding the score

Node.js and FFmpeg must both be available:

```sh
npm run generate:audio
```

The command regenerates all checked-in files under `public/assets/audio`. The source mix is deterministic; different FFmpeg versions may still produce different encoded bytes, so generated asset diffs should be reviewed rather than blindly accepted.

The generated files are original Ze Tour assets distributed under the repository's Apache 2.0 license.
