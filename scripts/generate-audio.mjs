#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(SCRIPT_DIR, "..");
const OUTPUT_DIR = resolve(ROOT_DIR, "public/assets/audio");
const TEMP_DIR = resolve(ROOT_DIR, ".audio-build");
const SAMPLE_RATE = 32_000;
const TAU = Math.PI * 2;

const soundtrackDefinitions = [
  {
    stage: 1,
    title: "Atlantic Sun",
    bpm: 108,
    key: "D major",
    roots: [50, 47, 43, 45],
    chords: [
      [0, 4, 7],
      [0, 3, 7],
      [0, 4, 7],
      [0, 4, 7],
    ],
    scale: [0, 2, 4, 5, 7, 9, 11],
    melody: [0, 2, 4, 2, 1, 0, 4, 2, 0, 2, 5, 4, 2, 1, 0, -1],
    palette: "sunny",
  },
  {
    stage: 2,
    title: "Dust of Perigord",
    bpm: 102,
    key: "A dorian",
    roots: [45, 43, 38, 40],
    chords: [
      [0, 3, 7],
      [0, 4, 7],
      [0, 3, 7],
      [0, 3, 7],
    ],
    scale: [0, 2, 3, 5, 7, 9, 10],
    melody: [0, 2, 1, 4, 2, 0, -1, 0, 3, 2, 0, 5, 4, 2, 1, 0],
    palette: "earthy",
  },
  {
    stage: 3,
    title: "Rhone Velocity",
    bpm: 126,
    key: "E minor",
    roots: [40, 43, 35, 38],
    chords: [
      [0, 3, 7],
      [0, 4, 7],
      [0, 4, 7],
      [0, 4, 7],
    ],
    scale: [0, 2, 3, 5, 7, 8, 10],
    melody: [0, 4, 2, 5, 4, 2, 1, 2, 0, 4, 6, 5, 4, 2, 1, 0],
    palette: "motorik",
  },
  {
    stage: 4,
    title: "Mistral Lines",
    bpm: 112,
    key: "D minor",
    roots: [38, 41, 45, 36],
    chords: [
      [0, 3, 7],
      [0, 4, 7],
      [0, 3, 7],
      [0, 4, 7],
    ],
    scale: [0, 2, 3, 5, 7, 8, 10],
    melody: [0, 3, 5, 2, 4, 1, 3, 0, 6, 4, 2, 5, 3, 1, 0, -1],
    palette: "wind",
  },
  {
    stage: 5,
    title: "Twenty-One Bends",
    bpm: 98,
    key: "C minor",
    roots: [36, 43, 41, 43],
    chords: [
      [0, 3, 7],
      [0, 4, 7],
      [0, 4, 7],
      [0, 4, 7],
    ],
    scale: [0, 2, 3, 5, 7, 8, 10],
    melody: [0, 2, 3, 4, 5, 4, 3, 2, 0, 2, 4, 6, 5, 4, 2, 0],
    palette: "summit",
  },
];

const midiFrequency = (midi) => 440 * 2 ** ((midi - 69) / 12);
const clamp = (value, minimum, maximum) =>
  Math.max(minimum, Math.min(maximum, value));

const seededRandom = (seed) => {
  let state = seed >>> 0;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
};

const createBuffer = (durationSeconds, seed) => ({
  durationSeconds,
  length: Math.round(durationSeconds * SAMPLE_RATE),
  left: new Float32Array(Math.round(durationSeconds * SAMPLE_RATE)),
  right: new Float32Array(Math.round(durationSeconds * SAMPLE_RATE)),
  random: seededRandom(seed),
});

const panGains = (pan) => {
  const angle = ((clamp(pan, -1, 1) + 1) * Math.PI) / 4;
  return [Math.cos(angle), Math.sin(angle)];
};

const mixSample = (buffer, sampleIndex, value, pan = 0, echo = 0) => {
  const index = ((sampleIndex % buffer.length) + buffer.length) % buffer.length;
  const [leftGain, rightGain] = panGains(pan);
  buffer.left[index] += value * leftGain;
  buffer.right[index] += value * rightGain;

  if (echo <= 0) return;
  const firstDelay = Math.round(SAMPLE_RATE * 0.137);
  const secondDelay = Math.round(SAMPLE_RATE * 0.233);
  const firstIndex = (index + firstDelay) % buffer.length;
  const secondIndex = (index + secondDelay) % buffer.length;
  buffer.left[firstIndex] += value * rightGain * echo;
  buffer.right[firstIndex] += value * leftGain * echo;
  buffer.left[secondIndex] += value * leftGain * echo * 0.55;
  buffer.right[secondIndex] += value * rightGain * echo * 0.55;
};

const envelope = (time, duration, attack, release) => {
  if (time < 0 || time >= duration) return 0;
  const attackGain = attack <= 0 ? 1 : Math.min(1, time / attack);
  const releaseGain = release <= 0
    ? 1
    : Math.min(1, (duration - time) / release);
  return Math.sin((Math.min(attackGain, releaseGain) * Math.PI) / 2);
};

const oscillatorSample = (instrument, frequency, time, duration, random) => {
  const phase = TAU * frequency * time;
  switch (instrument) {
    case "bass": {
      const env = envelope(time, duration, 0.012, 0.16) * Math.exp(-time * 0.8);
      return env * (
        Math.sin(phase) * 0.82 +
        Math.sin(phase * 2) * 0.13 +
        Math.sin(phase * 3) * 0.05
      );
    }
    case "pluck": {
      const env = Math.exp(-time * 3.8) * envelope(time, duration, 0.003, 0.07);
      return env * (
        Math.sin(phase) * 0.58 +
        Math.sin(phase * 2) * 0.24 * Math.exp(-time * 2) +
        Math.sin(phase * 3) * 0.12 * Math.exp(-time * 4) +
        Math.sin(phase * 5) * 0.06 * Math.exp(-time * 7)
      );
    }
    case "accordion": {
      const vibrato = 1 + Math.sin(TAU * 5.2 * time) * 0.0018;
      const detuned = phase * 1.004;
      const env = envelope(time, duration, 0.09, 0.18);
      let value = 0;
      for (let harmonic = 1; harmonic <= 7; harmonic += 1) {
        value +=
          (Math.sin(phase * vibrato * harmonic) + Math.sin(detuned * harmonic)) /
          (harmonic * 3.2);
      }
      return value * env;
    }
    case "pad": {
      const vibrato = 1 + Math.sin(TAU * 4.1 * time) * 0.0012;
      const env = envelope(time, duration, 0.42, 0.55);
      return env * (
        Math.sin(phase * vibrato) * 0.62 +
        Math.sin(phase * 2.002) * 0.2 +
        Math.sin(phase * 3.005) * 0.1 +
        Math.sin(phase * 0.501) * 0.08
      );
    }
    case "brass": {
      const vibrato = 1 + Math.sin(TAU * 5.5 * time) * 0.0025;
      const env = envelope(time, duration, 0.08, 0.18);
      let value = 0;
      for (let harmonic = 1; harmonic <= 6; harmonic += 1) {
        value += Math.sin(phase * vibrato * harmonic) / (harmonic * 1.7);
      }
      return value * env * (0.72 + 0.28 * Math.min(1, time * 5));
    }
    case "flute": {
      const vibrato = 1 + Math.sin(TAU * 5.7 * time) * 0.003;
      const env = envelope(time, duration, 0.055, 0.12);
      const breath = (random() * 2 - 1) * 0.035;
      return env * (
        Math.sin(phase * vibrato) * 0.86 +
        Math.sin(phase * vibrato * 2) * 0.1 +
        breath
      );
    }
    case "glock": {
      const env = envelope(time, duration, 0.001, 0.05);
      return env * (
        Math.sin(phase) * 0.58 * Math.exp(-time * 3.2) +
        Math.sin(phase * 2.71) * 0.24 * Math.exp(-time * 5.5) +
        Math.sin(phase * 4.18) * 0.12 * Math.exp(-time * 7.2) +
        Math.sin(phase * 6.35) * 0.06 * Math.exp(-time * 9)
      );
    }
    default:
      return 0;
  }
};

const addNoteAtSeconds = (
  buffer,
  instrument,
  midi,
  startSeconds,
  durationSeconds,
  volume,
  pan = 0,
  echo = 0.04,
) => {
  const frequency = midiFrequency(midi);
  const startSample = Math.round(startSeconds * SAMPLE_RATE);
  const sampleCount = Math.max(1, Math.round(durationSeconds * SAMPLE_RATE));
  for (let index = 0; index < sampleCount; index += 1) {
    const time = index / SAMPLE_RATE;
    const value =
      oscillatorSample(
        instrument,
        frequency,
        time,
        durationSeconds,
        buffer.random,
      ) * volume;
    mixSample(buffer, startSample + index, value, pan, echo);
  }
};

const addKick = (buffer, startSeconds, volume = 1) => {
  const sampleCount = Math.round(SAMPLE_RATE * 0.36);
  const startSample = Math.round(startSeconds * SAMPLE_RATE);
  let phase = 0;
  for (let index = 0; index < sampleCount; index += 1) {
    const time = index / SAMPLE_RATE;
    const frequency = 44 + 105 * Math.exp(-time * 18);
    phase += (TAU * frequency) / SAMPLE_RATE;
    const click = index < 90 ? (1 - index / 90) * 0.18 : 0;
    const value = (Math.sin(phase) * Math.exp(-time * 11) + click) * volume;
    mixSample(buffer, startSample + index, value, -0.04, 0.015);
  }
};

const addSnare = (buffer, startSeconds, volume = 1, earthy = false) => {
  const duration = earthy ? 0.22 : 0.28;
  const sampleCount = Math.round(SAMPLE_RATE * duration);
  const startSample = Math.round(startSeconds * SAMPLE_RATE);
  let previousNoise = 0;
  for (let index = 0; index < sampleCount; index += 1) {
    const time = index / SAMPLE_RATE;
    const noise = buffer.random() * 2 - 1;
    const highNoise = noise - previousNoise * 0.72;
    previousNoise = noise;
    const body = Math.sin(TAU * (earthy ? 155 : 195) * time) * 0.28;
    const value =
      (highNoise * (earthy ? 0.52 : 0.7) + body) *
      Math.exp(-time * (earthy ? 15 : 12)) *
      volume;
    mixSample(buffer, startSample + index, value, 0.05, 0.025);
  }
};

const addHat = (buffer, startSeconds, volume = 1, open = false, pan = 0.2) => {
  const duration = open ? 0.19 : 0.065;
  const sampleCount = Math.round(SAMPLE_RATE * duration);
  const startSample = Math.round(startSeconds * SAMPLE_RATE);
  let previousNoise = 0;
  for (let index = 0; index < sampleCount; index += 1) {
    const time = index / SAMPLE_RATE;
    const noise = buffer.random() * 2 - 1;
    const highNoise = noise - previousNoise;
    previousNoise = noise;
    const metallic =
      Math.sin(TAU * 6_103 * time) * 0.15 +
      Math.sin(TAU * 8_111 * time) * 0.1;
    const value =
      (highNoise * 0.72 + metallic) *
      Math.exp(-time * (open ? 17 : 45)) *
      volume;
    mixSample(buffer, startSample + index, value, pan, 0.01);
  }
};

const addShaker = (buffer, startSeconds, volume = 1, pan = 0) => {
  const duration = 0.11;
  const sampleCount = Math.round(SAMPLE_RATE * duration);
  const startSample = Math.round(startSeconds * SAMPLE_RATE);
  let previousNoise = 0;
  for (let index = 0; index < sampleCount; index += 1) {
    const time = index / SAMPLE_RATE;
    const noise = buffer.random() * 2 - 1;
    const highNoise = noise - previousNoise * 0.9;
    previousNoise = noise;
    const pulse = Math.sin(Math.PI * clamp(time / duration, 0, 1));
    mixSample(
      buffer,
      startSample + index,
      highNoise * pulse * Math.exp(-time * 12) * volume,
      pan,
      0.018,
    );
  }
};

const addMusicNote = (buffer, definition, instrument, midi, beat, beats, volume, pan, echo) => {
  const secondsPerBeat = 60 / definition.bpm;
  addNoteAtSeconds(
    buffer,
    instrument,
    midi,
    beat * secondsPerBeat,
    beats * secondsPerBeat,
    volume,
    pan,
    echo,
  );
};

const scaleMidi = (root, scale, degree, octave = 0) => {
  const scaleLength = scale.length;
  const normalized = ((degree % scaleLength) + scaleLength) % scaleLength;
  const octaveOffset = Math.floor(degree / scaleLength);
  return root + scale[normalized] + (octave + octaveOffset) * 12;
};

const arrangeSoundtrack = (definition) => {
  const bars = 24;
  const totalBeats = bars * 4;
  const durationSeconds = totalBeats * (60 / definition.bpm);
  const buffer = createBuffer(durationSeconds, 4_200 + definition.stage * 997);
  const beatSeconds = 60 / definition.bpm;

  for (let bar = 0; bar < bars; bar += 1) {
    const section = Math.floor(bar / 8);
    const progressionIndex = bar % definition.roots.length;
    const root = definition.roots[progressionIndex];
    const chord = definition.chords[progressionIndex];
    const barBeat = bar * 4;
    const finalResetBar = bar === bars - 1;

    addMusicNote(buffer, definition, "bass", root - 12, barBeat, 0.85, 0.23, -0.12, 0.025);
    addMusicNote(
      buffer,
      definition,
      "bass",
      root - 5,
      barBeat + 2,
      0.72,
      0.18,
      -0.08,
      0.02,
    );

    chord.forEach((interval, chordIndex) => {
      const pan = (chordIndex - 1) * 0.28;
      const instrument = definition.palette === "summit" ? "pad" : "accordion";
      const chordVolume = definition.palette === "sunny" ? 0.055 : 0.047;
      addMusicNote(
        buffer,
        definition,
        instrument,
        root + interval + 12,
        barBeat,
        finalResetBar ? 2.8 : 3.85,
        chordVolume,
        pan,
        definition.palette === "wind" ? 0.1 : 0.055,
      );
    });

    for (let eighth = 0; eighth < 8; eighth += 1) {
      const chordDegree = chord[(eighth + bar) % chord.length];
      const note = root + chordDegree + 24 + (eighth === 7 ? 12 : 0);
      const paletteVolume = definition.palette === "motorik" ? 0.105 : 0.082;
      addMusicNote(
        buffer,
        definition,
        "pluck",
        note,
        barBeat + eighth * 0.5,
        0.42,
        paletteVolume,
        eighth % 2 === 0 ? -0.35 : 0.35,
        0.075,
      );
    }

    if (section > 0 && !finalResetBar) {
      for (let phraseStep = 0; phraseStep < 4; phraseStep += 1) {
        const melodyIndex = (bar * 4 + phraseStep) % definition.melody.length;
        const degree = definition.melody[melodyIndex];
        const melodyRoot = definition.roots[0];
        const melodyInstrument =
          definition.palette === "sunny"
            ? "brass"
            : definition.palette === "wind"
              ? "flute"
              : definition.palette === "summit"
                ? "brass"
                : "glock";
        addMusicNote(
          buffer,
          definition,
          melodyInstrument,
          scaleMidi(melodyRoot, definition.scale, degree, 2),
          barBeat + phraseStep,
          definition.palette === "wind" ? 0.82 : 0.68,
          definition.palette === "summit" ? 0.105 : 0.075,
          0.16,
          melodyInstrument === "glock" ? 0.13 : 0.08,
        );
      }
    }

    if (definition.palette === "summit") {
      for (let step = 0; step < 8; step += 1) {
        addMusicNote(
          buffer,
          definition,
          "pluck",
          root + 12 + chord[step % chord.length],
          barBeat + step * 0.5,
          0.38,
          0.07 + section * 0.012,
          step % 2 ? 0.28 : -0.28,
          0.08,
        );
      }
    }
  }

  for (let beat = 0; beat < totalBeats; beat += 1) {
    const bar = Math.floor(beat / 4);
    const beatInBar = beat % 4;
    const section = Math.floor(bar / 8);
    const start = beat * beatSeconds;

    if (definition.palette === "motorik") {
      addKick(buffer, start, beatInBar === 0 ? 0.62 : 0.46);
    } else if (beatInBar === 0 || beatInBar === 2) {
      addKick(buffer, start, definition.palette === "summit" ? 0.62 : 0.53);
    }

    if (beatInBar === 1 || beatInBar === 3) {
      addSnare(
        buffer,
        start,
        definition.palette === "earthy" ? 0.35 : 0.42,
        definition.palette === "earthy",
      );
    }

    const subdivisions = definition.palette === "motorik" || section > 0 ? 2 : 1;
    for (let subdivision = 0; subdivision < subdivisions; subdivision += 1) {
      const offset = subdivision / subdivisions;
      if (definition.palette === "earthy") {
        addShaker(buffer, start + offset * beatSeconds, 0.12, beatInBar % 2 ? 0.28 : -0.28);
      } else if (definition.palette === "wind") {
        addShaker(buffer, start + offset * beatSeconds + 0.03, 0.1, Math.sin(beat) * 0.55);
        if (subdivision === 1) addHat(buffer, start + offset * beatSeconds, 0.075, false, -0.2);
      } else {
        addHat(
          buffer,
          start + offset * beatSeconds,
          definition.palette === "motorik" ? 0.105 : 0.08,
          beatInBar === 3 && subdivision === subdivisions - 1,
          subdivision === 0 ? 0.24 : -0.24,
        );
      }
    }
  }

  return buffer;
};

const addSweep = (
  buffer,
  startSeconds,
  durationSeconds,
  startFrequency,
  endFrequency,
  volume,
  pan = 0,
  noiseAmount = 0,
) => {
  const startSample = Math.round(startSeconds * SAMPLE_RATE);
  const sampleCount = Math.round(durationSeconds * SAMPLE_RATE);
  let phase = 0;
  let previousNoise = 0;
  for (let index = 0; index < sampleCount; index += 1) {
    const time = index / SAMPLE_RATE;
    const progress = time / durationSeconds;
    const frequency = startFrequency * (endFrequency / startFrequency) ** progress;
    phase += (TAU * frequency) / SAMPLE_RATE;
    const env = Math.sin(Math.PI * clamp(progress, 0, 1)) ** 0.7;
    const noise = buffer.random() * 2 - 1;
    const highNoise = noise - previousNoise * 0.85;
    previousNoise = noise;
    const value =
      (Math.sin(phase) * (1 - noiseAmount) + highNoise * noiseAmount) *
      env *
      volume;
    mixSample(buffer, startSample + index, value, pan, 0.035);
  }
};

const createSoundEffect = (name) => {
  switch (name) {
    case "sweat-pickup": {
      const buffer = createBuffer(0.72, 7_101);
      addSweep(buffer, 0, 0.38, 330, 920, 0.34, -0.12, 0.08);
      addNoteAtSeconds(buffer, "glock", 76, 0.16, 0.42, 0.23, 0.25, 0.12);
      addSweep(buffer, 0.36, 0.18, 820, 510, 0.16, 0.18, 0.02);
      return buffer;
    }
    case "cash-pickup": {
      const buffer = createBuffer(0.68, 7_102);
      addNoteAtSeconds(buffer, "glock", 83, 0, 0.5, 0.42, -0.18, 0.11);
      addNoteAtSeconds(buffer, "glock", 90, 0.085, 0.48, 0.36, 0.2, 0.13);
      addNoteAtSeconds(buffer, "glock", 95, 0.17, 0.42, 0.22, 0, 0.12);
      return buffer;
    }
    case "pothole-crash": {
      const buffer = createBuffer(0.78, 7_103);
      addKick(buffer, 0, 1.15);
      addSnare(buffer, 0.035, 0.8, true);
      for (let index = 0; index < 5; index += 1) {
        addSweep(buffer, 0.12 + index * 0.055, 0.12, 180 + index * 21, 110, 0.12, index % 2 ? 0.35 : -0.35, 0.42);
      }
      return buffer;
    }
    case "car-crash": {
      const buffer = createBuffer(1.18, 7_104);
      addKick(buffer, 0, 1.35);
      addSnare(buffer, 0.015, 1.05, false);
      addSweep(buffer, 0.02, 0.72, 520, 92, 0.42, -0.08, 0.62);
      [55, 61, 68, 76].forEach((midi, index) =>
        addNoteAtSeconds(buffer, "glock", midi, 0.04 + index * 0.025, 0.85, 0.28, index % 2 ? 0.48 : -0.48, 0.12),
      );
      addSweep(buffer, 0.3, 0.5, 340, 225, 0.18, 0.16, 0.04);
      return buffer;
    }
    case "draft-start": {
      const buffer = createBuffer(1.05, 7_105);
      addSweep(buffer, 0, 0.72, 95, 720, 0.28, 0, 0.72);
      addNoteAtSeconds(buffer, "pad", 62, 0.2, 0.75, 0.16, -0.24, 0.12);
      addNoteAtSeconds(buffer, "pad", 66, 0.2, 0.75, 0.14, 0, 0.12);
      addNoteAtSeconds(buffer, "pad", 69, 0.2, 0.75, 0.14, 0.24, 0.12);
      addNoteAtSeconds(buffer, "glock", 86, 0.48, 0.42, 0.18, 0.1, 0.16);
      return buffer;
    }
    case "draft-end": {
      const buffer = createBuffer(0.92, 7_106);
      addSweep(buffer, 0, 0.62, 620, 105, 0.2, 0, 0.68);
      addNoteAtSeconds(buffer, "glock", 81, 0.03, 0.55, 0.25, -0.18, 0.14);
      addNoteAtSeconds(buffer, "glock", 74, 0.17, 0.6, 0.19, 0.2, 0.14);
      return buffer;
    }
    case "power-up-pickup": {
      const buffer = createBuffer(0.92, 7_107);
      addSweep(buffer, 0, 0.48, 240, 1_350, 0.2, 0, 0.16);
      [74, 79, 83, 86].forEach((midi, index) =>
        addNoteAtSeconds(
          buffer,
          "glock",
          midi,
          0.06 + index * 0.09,
          0.55,
          0.2 - index * 0.018,
          index % 2 ? 0.3 : -0.3,
          0.16,
        ),
      );
      return buffer;
    }
    case "power-up-activate": {
      const buffer = createBuffer(1.12, 7_108);
      addSweep(buffer, 0, 0.78, 110, 1_080, 0.35, 0, 0.48);
      [62, 66, 69].forEach((midi, index) =>
        addNoteAtSeconds(
          buffer,
          "brass",
          midi,
          0.16,
          0.82,
          0.14,
          (index - 1) * 0.28,
          0.1,
        ),
      );
      addKick(buffer, 0.14, 0.52);
      return buffer;
    }
    case "power-up-end": {
      const buffer = createBuffer(0.82, 7_109);
      addSweep(buffer, 0, 0.58, 760, 150, 0.16, 0, 0.55);
      addNoteAtSeconds(buffer, "glock", 78, 0.05, 0.54, 0.19, -0.18, 0.12);
      addNoteAtSeconds(buffer, "glock", 71, 0.17, 0.56, 0.15, 0.18, 0.12);
      return buffer;
    }
    case "shield-hit": {
      const buffer = createBuffer(0.74, 7_110);
      addSweep(buffer, 0, 0.26, 1_450, 390, 0.31, -0.14, 0.08);
      addSweep(buffer, 0.11, 0.34, 420, 1_520, 0.22, 0.16, 0.1);
      addNoteAtSeconds(buffer, "glock", 91, 0.08, 0.5, 0.3, 0, 0.14);
      return buffer;
    }
    case "challenge-clean": {
      const buffer = createBuffer(1.28, 7_111);
      [67, 71, 74, 79].forEach((midi, index) =>
        addNoteAtSeconds(
          buffer,
          index === 3 ? "brass" : "glock",
          midi,
          index * 0.12,
          index === 3 ? 0.78 : 0.56,
          index === 3 ? 0.16 : 0.25,
          (index - 1.5) * 0.2,
          0.15,
        ),
      );
      addKick(buffer, 0.36, 0.4);
      return buffer;
    }
    case "challenge-missed": {
      const buffer = createBuffer(0.88, 7_112);
      addNoteAtSeconds(buffer, "pluck", 59, 0, 0.52, 0.3, -0.2, 0.04);
      addNoteAtSeconds(buffer, "pluck", 54, 0.14, 0.58, 0.26, 0.2, 0.04);
      addSweep(buffer, 0.08, 0.48, 280, 95, 0.16, 0, 0.38);
      return buffer;
    }
    case "level-up": {
      const buffer = createBuffer(1.72, 7_113);
      [60, 64, 67, 72, 76].forEach((midi, index) =>
        addNoteAtSeconds(
          buffer,
          index < 3 ? "glock" : "brass",
          midi,
          index * 0.13,
          index < 3 ? 0.58 : 0.9,
          index < 3 ? 0.26 : 0.17,
          (index - 2) * 0.18,
          0.16,
        ),
      );
      addKick(buffer, 0.48, 0.48);
      addSnare(buffer, 0.61, 0.3, false);
      return buffer;
    }
    case "upgrade-purchase": {
      const buffer = createBuffer(0.82, 7_114);
      addNoteAtSeconds(buffer, "pluck", 50, 0, 0.28, 0.34, -0.25, 0.03);
      addNoteAtSeconds(buffer, "pluck", 57, 0.07, 0.3, 0.3, 0.22, 0.04);
      addNoteAtSeconds(buffer, "glock", 81, 0.16, 0.52, 0.28, 0, 0.13);
      addSweep(buffer, 0.03, 0.16, 180, 460, 0.1, 0, 0.1);
      return buffer;
    }
    case "sector-complete": {
      const buffer = createBuffer(1.64, 7_115);
      [62, 66, 69].forEach((midi, index) =>
        addNoteAtSeconds(buffer, "brass", midi, 0, 0.64, 0.16, (index - 1) * 0.25, 0.12),
      );
      [64, 68, 71, 74].forEach((midi, index) =>
        addNoteAtSeconds(buffer, "glock", midi, 0.42 + index * 0.11, 0.66, 0.2, index % 2 ? 0.28 : -0.28, 0.15),
      );
      addKick(buffer, 0, 0.48);
      addKick(buffer, 0.42, 0.38);
      return buffer;
    }
    case "tour-complete": {
      const buffer = createBuffer(2.82, 7_116);
      const fanfare = [60, 64, 67, 72, 67, 72, 76, 79];
      fanfare.forEach((midi, index) =>
        addNoteAtSeconds(
          buffer,
          "brass",
          midi,
          index * 0.18,
          index >= fanfare.length - 3 ? 1.25 : 0.48,
          0.18,
          index % 2 ? 0.22 : -0.22,
          0.14,
        ),
      );
      [60, 64, 67, 72].forEach((midi, index) =>
        addNoteAtSeconds(buffer, "pad", midi, 1.28, 1.35, 0.11, (index - 1.5) * 0.2, 0.15),
      );
      [0, 0.72, 1.26].forEach((time, index) => addKick(buffer, time, 0.48 - index * 0.05));
      addSnare(buffer, 0.72, 0.34, false);
      return buffer;
    }
    case "race-start": {
      const buffer = createBuffer(1.18, 7_117);
      addNoteAtSeconds(buffer, "flute", 91, 0, 0.72, 0.34, -0.1, 0.1);
      addNoteAtSeconds(buffer, "flute", 94, 0.34, 0.7, 0.31, 0.14, 0.12);
      addSweep(buffer, 0.62, 0.34, 250, 880, 0.17, 0, 0.13);
      return buffer;
    }
    case "workshop-open": {
      const buffer = createBuffer(0.86, 7_118);
      addNoteAtSeconds(buffer, "pluck", 43, 0, 0.48, 0.28, -0.25, 0.04);
      addNoteAtSeconds(buffer, "pluck", 50, 0.1, 0.48, 0.23, 0.2, 0.05);
      addNoteAtSeconds(buffer, "glock", 74, 0.22, 0.5, 0.16, 0, 0.12);
      addShaker(buffer, 0.04, 0.16, -0.1);
      return buffer;
    }
    case "workshop-close": {
      const buffer = createBuffer(0.68, 7_119);
      addNoteAtSeconds(buffer, "glock", 74, 0, 0.42, 0.18, 0.15, 0.1);
      addNoteAtSeconds(buffer, "pluck", 50, 0.12, 0.42, 0.3, -0.15, 0.04);
      addSweep(buffer, 0.1, 0.24, 480, 180, 0.1, 0, 0.12);
      return buffer;
    }
    default:
      throw new Error(`Unknown sound effect: ${name}`);
  }
};

const masterBuffer = (buffer, targetRms) => {
  let squaredTotal = 0;
  let peak = 0;
  for (let index = 0; index < buffer.length; index += 1) {
    const left = buffer.left[index];
    const right = buffer.right[index];
    squaredTotal += left * left + right * right;
    peak = Math.max(peak, Math.abs(left), Math.abs(right));
  }
  const rms = Math.sqrt(squaredTotal / (buffer.length * 2));
  const gain = Math.min(0.92 / Math.max(peak, 0.001), targetRms / Math.max(rms, 0.001));
  const saturation = Math.tanh(1.18);
  for (let index = 0; index < buffer.length; index += 1) {
    buffer.left[index] = Math.tanh(buffer.left[index] * gain * 1.18) / saturation;
    buffer.right[index] = Math.tanh(buffer.right[index] * gain * 1.18) / saturation;
  }
  return { rms, peak, gain };
};

const softenLoopBoundary = (buffer, durationSeconds = 0.05) => {
  const sampleCount = Math.max(2, Math.round(SAMPLE_RATE * durationSeconds));
  for (let index = 0; index < sampleCount; index += 1) {
    const gain = Math.sin((index / (sampleCount - 1)) * (Math.PI / 2));
    const endingIndex = buffer.length - 1 - index;
    buffer.left[index] *= gain;
    buffer.right[index] *= gain;
    buffer.left[endingIndex] *= gain;
    buffer.right[endingIndex] *= gain;
  }
};

const writeWaveFile = (filePath, buffer) => {
  const byteLength = 44 + buffer.length * 4;
  const output = Buffer.allocUnsafe(byteLength);
  output.write("RIFF", 0);
  output.writeUInt32LE(byteLength - 8, 4);
  output.write("WAVE", 8);
  output.write("fmt ", 12);
  output.writeUInt32LE(16, 16);
  output.writeUInt16LE(1, 20);
  output.writeUInt16LE(2, 22);
  output.writeUInt32LE(SAMPLE_RATE, 24);
  output.writeUInt32LE(SAMPLE_RATE * 4, 28);
  output.writeUInt16LE(4, 32);
  output.writeUInt16LE(16, 34);
  output.write("data", 36);
  output.writeUInt32LE(buffer.length * 4, 40);

  let offset = 44;
  for (let index = 0; index < buffer.length; index += 1) {
    output.writeInt16LE(Math.round(clamp(buffer.left[index], -1, 1) * 32_767), offset);
    output.writeInt16LE(Math.round(clamp(buffer.right[index], -1, 1) * 32_767), offset + 2);
    offset += 4;
  }
  writeFileSync(filePath, output);
};

const encodeAudio = (wavePath, outputBase, title, isMusic) => {
  const common = [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    wavePath,
    "-fflags",
    "+bitexact",
    "-flags:a",
    "+bitexact",
    "-metadata",
    `title=${title}`,
    "-metadata",
    "artist=Ze Tour",
    "-metadata",
    "comment=Original procedural composition generated by scripts/generate-audio.mjs",
  ];
  const encodings = [
    [
      "-codec:a",
      "vorbis",
      "-strict",
      "-2",
      "-q:a",
      isMusic ? "4.5" : "5",
      `${outputBase}.ogg`,
    ],
    ["-codec:a", "libmp3lame", "-b:a", isMusic ? "128k" : "112k", `${outputBase}.mp3`],
  ];

  encodings.forEach((encoding) => {
    const result = spawnSync("ffmpeg", [...common, ...encoding], {
      stdio: "inherit",
    });
    if (result.status !== 0) {
      throw new Error(`ffmpeg failed while encoding ${outputBase}`);
    }
  });
};

const renderAsset = (name, title, buffer, isMusic) => {
  if (isMusic) softenLoopBoundary(buffer);
  const mastered = masterBuffer(buffer, isMusic ? 0.13 : 0.2);
  const wavePath = resolve(TEMP_DIR, `${name}.wav`);
  const outputBase = resolve(OUTPUT_DIR, name);
  writeWaveFile(wavePath, buffer);
  encodeAudio(wavePath, outputBase, title, isMusic);
  return {
    name,
    title,
    durationSeconds: Number(buffer.durationSeconds.toFixed(3)),
    sourceRms: Number(mastered.rms.toFixed(4)),
    sourcePeak: Number(mastered.peak.toFixed(4)),
  };
};

if (existsSync(OUTPUT_DIR)) {
  rmSync(OUTPUT_DIR, { recursive: true, force: true });
}
mkdirSync(OUTPUT_DIR, { recursive: true });
if (existsSync(TEMP_DIR)) rmSync(TEMP_DIR, { recursive: true, force: true });
mkdirSync(TEMP_DIR, { recursive: true });

const manifest = {
  generatedBy: "scripts/generate-audio.mjs",
  sampleRate: SAMPLE_RATE,
  license: "Original Ze Tour game assets; distributed under the repository Apache-2.0 license.",
  soundtrack: [],
  effects: [],
};

for (const definition of soundtrackDefinitions) {
  const name = `stage-${definition.stage}`;
  const rendered = renderAsset(
    name,
    definition.title,
    arrangeSoundtrack(definition),
    true,
  );
  manifest.soundtrack.push({
    stage: definition.stage,
    bpm: definition.bpm,
    key: definition.key,
    ...rendered,
  });
  process.stdout.write(`Rendered ${name}: ${definition.title}\n`);
}

const soundEffects = [
  ["sweat-pickup", "Sweat pickup"],
  ["cash-pickup", "Cash pickup"],
  ["pothole-crash", "Pothole crash"],
  ["car-crash", "Car crash"],
  ["draft-start", "Draft start"],
  ["draft-end", "Draft end"],
  ["power-up-pickup", "Power-up pickup"],
  ["power-up-activate", "Power-up activation"],
  ["power-up-end", "Power-up end"],
  ["shield-hit", "Invincibility impact"],
  ["challenge-clean", "Clean challenge"],
  ["challenge-missed", "Missed challenge"],
  ["level-up", "Rider level up"],
  ["upgrade-purchase", "Upgrade purchase"],
  ["sector-complete", "Sector complete"],
  ["tour-complete", "Tour complete"],
  ["race-start", "Race start"],
  ["workshop-open", "Workshop open"],
  ["workshop-close", "Workshop close"],
];

for (const [name, title] of soundEffects) {
  manifest.effects.push(
    renderAsset(name, title, createSoundEffect(name), false),
  );
  process.stdout.write(`Rendered ${name}\n`);
}

writeFileSync(
  resolve(OUTPUT_DIR, "manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
rmSync(TEMP_DIR, { recursive: true, force: true });
process.stdout.write(`Audio assets written to ${OUTPUT_DIR}\n`);
