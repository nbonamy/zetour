export type GameSoundEffect =
  | "sweat-pickup"
  | "cash-pickup"
  | "pothole-crash"
  | "car-crash"
  | "draft-start"
  | "draft-end"
  | "power-up-pickup"
  | "power-up-activate"
  | "power-up-end"
  | "shield-hit"
  | "challenge-clean"
  | "challenge-missed"
  | "level-up"
  | "upgrade-purchase"
  | "sector-complete"
  | "tour-complete"
  | "race-start"
  | "workshop-open"
  | "workshop-close";

export interface StageSoundtrack {
  stage: number;
  title: string;
  bpm: number;
  character: string;
}

export type GameAudioMode = "muted" | "effects" | "full";

export const stageSoundtracks: readonly StageSoundtrack[] = [
  {
    stage: 1,
    title: "Atlantic Sun",
    bpm: 108,
    character: "sunny guitar, brushes, and muted brass",
  },
  {
    stage: 2,
    title: "Dust of Perigord",
    bpm: 102,
    character: "earthy percussion and rustic reeds",
  },
  {
    stage: 3,
    title: "Rhone Velocity",
    bpm: 126,
    character: "motorik drums and fast rhythmic guitar",
  },
  {
    stage: 4,
    title: "Mistral Lines",
    bpm: 112,
    character: "air, syncopation, and restless harmony",
  },
  {
    stage: 5,
    title: "Twenty-One Bends",
    bpm: 98,
    character: "a climbing ostinato with a heroic brass lift",
  },
] as const;

export const gameSoundEffects: readonly GameSoundEffect[] = [
  "sweat-pickup",
  "cash-pickup",
  "pothole-crash",
  "car-crash",
  "draft-start",
  "draft-end",
  "power-up-pickup",
  "power-up-activate",
  "power-up-end",
  "shield-hit",
  "challenge-clean",
  "challenge-missed",
  "level-up",
  "upgrade-purchase",
  "sector-complete",
  "tour-complete",
  "race-start",
  "workshop-open",
  "workshop-close",
] as const;

export interface GameAudioTransitionState {
  activePowerUp: string | null;
  level: number;
  raceFinished: boolean;
  raceRevision: number;
  stage: number;
}

/**
 * Maps one authoritative store transition to its audible milestones.
 *
 * Finish and restart fanfares deliberately take priority over smaller events
 * that can happen in the same store emission. This keeps a Tour finish from
 * becoming a pile-up of level-up and power-up-expiry jingles.
 */
export const gameEffectsForTransition = (
  previous: GameAudioTransitionState,
  next: GameAudioTransitionState,
): GameSoundEffect[] => {
  if (next.raceRevision !== previous.raceRevision && !next.raceFinished) {
    return ["race-start"];
  }
  if (!previous.raceFinished && next.raceFinished) {
    return ["tour-complete"];
  }
  if (next.stage === previous.stage + 1) {
    return ["sector-complete"];
  }

  const effects: GameSoundEffect[] = [];
  if (next.level > previous.level) effects.push("level-up");
  if (
    previous.activePowerUp &&
    !next.activePowerUp &&
    next.raceRevision === previous.raceRevision
  ) {
    effects.push("power-up-end");
  }
  return effects;
};

const AUDIO_PREFERENCE_STORAGE_KEY = "ze-tour-audio-v1";
const MUSIC_VOLUME = 0.36;
const EFFECTS_VOLUME = 0.78;
const MUSIC_CROSSFADE_SECONDS = 1.1;
const EFFECT_COOLDOWN_SECONDS = 0.045;

interface AudioPreferences {
  mode: GameAudioMode;
}

interface PlayingTrack {
  stage: number;
  source: AudioBufferSourceNode;
  gain: GainNode;
}

export interface GameAudioState {
  supported: boolean;
  unlocked: boolean;
  mode: GameAudioMode;
  muted: boolean;
  paused: boolean;
  requestedStage: number;
  playingStage: number | null;
  soundtrackTitle: string;
  preferredFormat: "ogg" | "mp3";
  loadedAssets: number;
}

type AudioStateListener = (state: GameAudioState) => void;

type WindowWithAudioContext = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

const normalizedStage = (stage: number): number =>
  Math.max(1, Math.min(stageSoundtracks.length, Math.round(stage)));

const soundtrackForStage = (stage: number): StageSoundtrack =>
  stageSoundtracks[normalizedStage(stage) - 1] ?? stageSoundtracks[0];

const readPreferences = (): AudioPreferences => {
  if (typeof window === "undefined") return { mode: "full" };
  try {
    const saved = JSON.parse(
      window.localStorage.getItem(AUDIO_PREFERENCE_STORAGE_KEY) ?? "{}",
    ) as Partial<AudioPreferences> & { muted?: boolean };
    if (
      saved.mode === "muted" ||
      saved.mode === "effects" ||
      saved.mode === "full"
    ) {
      return { mode: saved.mode };
    }
    // Preserve the boolean preference written by earlier builds.
    return { mode: saved.muted === true ? "muted" : "full" };
  } catch {
    return { mode: "full" };
  }
};

const preferredAudioFormat = (): "ogg" | "mp3" => {
  if (typeof document === "undefined") return "mp3";
  const probe = document.createElement("audio");
  return probe.canPlayType('audio/ogg; codecs="vorbis"') !== ""
    ? "ogg"
    : "mp3";
};

const audioContextConstructor = (): typeof AudioContext | null => {
  if (typeof window === "undefined") return null;
  const audioWindow = window as WindowWithAudioContext;
  return audioWindow.AudioContext ?? audioWindow.webkitAudioContext ?? null;
};

export class GameAudioController {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private effectsGain: GainNode | null = null;
  private playingTrack: PlayingTrack | null = null;
  private readonly buffers = new Map<string, Promise<AudioBuffer>>();
  private readonly listeners = new Set<AudioStateListener>();
  private readonly lastEffectAt = new Map<GameSoundEffect, number>();
  private requestedStage = 1;
  private trackRequestRevision = 0;
  private unlocked = false;
  private paused = false;
  private mode = readPreferences().mode;
  private readonly preferredFormat = preferredAudioFormat();

  getState(): GameAudioState {
    return {
      supported: audioContextConstructor() !== null,
      unlocked: this.unlocked,
      mode: this.mode,
      muted: this.mode === "muted",
      paused: this.paused,
      requestedStage: this.requestedStage,
      playingStage: this.playingTrack?.stage ?? null,
      soundtrackTitle: soundtrackForStage(this.requestedStage).title,
      preferredFormat: this.preferredFormat,
      loadedAssets: this.buffers.size,
    };
  }

  subscribe(listener: AudioStateListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  installUserGestureUnlock(target: Window = window): () => void {
    let removed = false;
    const remove = (): void => {
      if (removed) return;
      removed = true;
      target.removeEventListener("pointerdown", unlock, true);
      target.removeEventListener("keydown", unlock, true);
    };
    const unlock = (): void => {
      void this.unlock().then((wasUnlocked) => {
        if (wasUnlocked) remove();
      });
    };

    target.addEventListener("pointerdown", unlock, true);
    target.addEventListener("keydown", unlock, true);
    return remove;
  }

  async unlock(): Promise<boolean> {
    if (this.unlocked && this.context) {
      if (this.context.state === "suspended") await this.context.resume();
      return true;
    }

    const AudioContextClass = audioContextConstructor();
    if (!AudioContextClass) {
      this.notify();
      return false;
    }

    try {
      const context = new AudioContextClass();
      const masterGain = context.createGain();
      const musicGain = context.createGain();
      const effectsGain = context.createGain();

      musicGain.connect(masterGain);
      effectsGain.connect(masterGain);
      masterGain.connect(context.destination);
      masterGain.gain.value = this.mode === "muted" ? 0 : 1;
      musicGain.gain.value =
        this.paused || this.mode !== "full" ? 0 : MUSIC_VOLUME;
      effectsGain.gain.value = EFFECTS_VOLUME;

      this.context = context;
      this.masterGain = masterGain;
      this.musicGain = musicGain;
      this.effectsGain = effectsGain;
      await context.resume();
      this.unlocked = true;
      this.notify();

      gameSoundEffects.forEach((effect) => {
        void this.loadBuffer(effect).catch(() => undefined);
      });
      await this.startRequestedTrack();
      return true;
    } catch {
      this.context = null;
      this.masterGain = null;
      this.musicGain = null;
      this.effectsGain = null;
      this.unlocked = false;
      this.notify();
      return false;
    }
  }

  setStage(stage: number): void {
    const nextStage = normalizedStage(stage);
    if (this.requestedStage === nextStage) return;
    this.requestedStage = nextStage;
    this.notify();
    if (this.unlocked) void this.startRequestedTrack();
  }

  setPaused(paused: boolean): void {
    if (this.paused === paused) return;
    this.paused = paused;
    this.applyMusicVolume();
    this.notify();
  }

  setMode(mode: GameAudioMode): void {
    if (this.mode === mode) return;
    this.mode = mode;
    try {
      window.localStorage.setItem(
        AUDIO_PREFERENCE_STORAGE_KEY,
        JSON.stringify({ mode } satisfies AudioPreferences),
      );
    } catch {
      // The in-memory preference still applies for the current session.
    }
    this.applyMasterVolume();
    this.applyMusicVolume();
    this.notify();
  }

  cycleMode(): GameAudioMode {
    const nextMode: GameAudioMode =
      this.mode === "muted"
        ? "effects"
        : this.mode === "effects"
          ? "full"
          : "muted";
    this.setMode(nextMode);
    if (nextMode !== "muted") void this.unlock();
    return nextMode;
  }

  playEffect(effect: GameSoundEffect): void {
    const context = this.context;
    const effectsGain = this.effectsGain;
    if (
      !this.unlocked ||
      !context ||
      !effectsGain ||
      this.mode === "muted"
    ) {
      return;
    }

    const lastPlayedAt = this.lastEffectAt.get(effect) ?? -Infinity;
    if (context.currentTime - lastPlayedAt < EFFECT_COOLDOWN_SECONDS) return;
    this.lastEffectAt.set(effect, context.currentTime);
    const requestedAt = context.currentTime;

    void this.loadBuffer(effect)
      .then((buffer) => {
        if (
          !this.context ||
          !this.effectsGain ||
          this.mode === "muted" ||
          this.context.currentTime - requestedAt > 0.35
        ) {
          return;
        }
        const source = this.context.createBufferSource();
        source.buffer = buffer;
        source.connect(this.effectsGain);
        source.start();
      })
      .catch(() => undefined);
  }

  private async startRequestedTrack(): Promise<void> {
    const context = this.context;
    const musicGain = this.musicGain;
    if (!this.unlocked || !context || !musicGain) return;
    if (this.playingTrack?.stage === this.requestedStage) return;

    const stage = this.requestedStage;
    const requestRevision = ++this.trackRequestRevision;
    try {
      const buffer = await this.loadBuffer(`stage-${stage}`);
      if (
        !this.context ||
        !this.musicGain ||
        requestRevision !== this.trackRequestRevision ||
        stage !== this.requestedStage
      ) {
        return;
      }

      const startAt = this.context.currentTime + 0.02;
      const source = this.context.createBufferSource();
      const gain = this.context.createGain();
      source.buffer = buffer;
      source.loop = true;
      source.connect(gain);
      gain.connect(this.musicGain);
      gain.gain.setValueAtTime(0, startAt);
      gain.gain.linearRampToValueAtTime(1, startAt + MUSIC_CROSSFADE_SECONDS);
      source.start(startAt);

      const previousTrack = this.playingTrack;
      this.playingTrack = { stage, source, gain };
      if (previousTrack) {
        previousTrack.gain.gain.cancelScheduledValues(startAt);
        previousTrack.gain.gain.setValueAtTime(
          previousTrack.gain.gain.value,
          startAt,
        );
        previousTrack.gain.gain.linearRampToValueAtTime(
          0,
          startAt + MUSIC_CROSSFADE_SECONDS,
        );
        previousTrack.source.stop(startAt + MUSIC_CROSSFADE_SECONDS + 0.04);
      }
      this.notify();
    } catch {
      this.notify();
    }
  }

  private async loadBuffer(assetName: string): Promise<AudioBuffer> {
    const existing = this.buffers.get(assetName);
    if (existing) return existing;

    const request = this.fetchAndDecode(assetName, this.preferredFormat).catch(
      async () => {
        const fallback = this.preferredFormat === "ogg" ? "mp3" : "ogg";
        return this.fetchAndDecode(assetName, fallback);
      },
    );
    this.buffers.set(assetName, request);
    this.notify();
    try {
      return await request;
    } catch (error) {
      this.buffers.delete(assetName);
      throw error;
    }
  }

  private async fetchAndDecode(
    assetName: string,
    format: "ogg" | "mp3",
  ): Promise<AudioBuffer> {
    if (!this.context) throw new Error("Audio context is not ready");
    const response = await fetch(`/assets/audio/${assetName}.${format}`);
    if (!response.ok) {
      throw new Error(`Could not load audio asset ${assetName}.${format}`);
    }
    return this.context.decodeAudioData(await response.arrayBuffer());
  }

  private applyMasterVolume(): void {
    if (!this.context || !this.masterGain) return;
    const now = this.context.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setTargetAtTime(
      this.mode === "muted" ? 0 : 1,
      now,
      0.025,
    );
  }

  private applyMusicVolume(): void {
    if (!this.context || !this.musicGain) return;
    const now = this.context.currentTime;
    this.musicGain.gain.cancelScheduledValues(now);
    this.musicGain.gain.setTargetAtTime(
      this.paused || this.mode !== "full" ? 0 : MUSIC_VOLUME,
      now,
      this.paused || this.mode !== "full" ? 0.06 : 0.12,
    );
  }

  private notify(): void {
    const state = this.getState();
    this.listeners.forEach((listener) => listener(state));
  }
}

export const gameAudio = new GameAudioController();
