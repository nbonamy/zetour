import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  GameAudioController,
  gameEffectsForTransition,
  gameSoundEffects,
  stageSoundtracks,
} from "../../src/audio/gameAudio";
import audioManifest from "../../public/assets/audio/manifest.json";

class FakeAudioParam {
  value = 1;
  cancelScheduledValues = vi.fn();
  setValueAtTime = vi.fn((value: number) => {
    this.value = value;
    return this;
  });
  linearRampToValueAtTime = vi.fn((value: number) => {
    this.value = value;
    return this;
  });
  setTargetAtTime = vi.fn((value: number) => {
    this.value = value;
    return this;
  });
}

class FakeGainNode {
  gain = new FakeAudioParam();
  connect = vi.fn(() => this);
}

class FakeSourceNode {
  buffer: AudioBuffer | null = null;
  loop = false;
  connect = vi.fn(() => this);
  start = vi.fn();
  stop = vi.fn();
}

class FakeAudioContext {
  static instances: FakeAudioContext[] = [];

  state: AudioContextState = "suspended";
  currentTime = 1;
  destination = {} as AudioDestinationNode;
  gains: FakeGainNode[] = [];
  sources: FakeSourceNode[] = [];

  constructor() {
    FakeAudioContext.instances.push(this);
  }

  createGain(): GainNode {
    const gain = new FakeGainNode();
    this.gains.push(gain);
    return gain as unknown as GainNode;
  }

  createBufferSource(): AudioBufferSourceNode {
    const source = new FakeSourceNode();
    this.sources.push(source);
    return source as unknown as AudioBufferSourceNode;
  }

  async decodeAudioData(): Promise<AudioBuffer> {
    return { duration: 12 } as AudioBuffer;
  }

  async resume(): Promise<void> {
    this.state = "running";
  }
}

const flushAudioPromises = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

describe("GameAudioController", () => {
  const originalAudioContext = Object.getOwnPropertyDescriptor(
    window,
    "AudioContext",
  );

  beforeEach(() => {
    FakeAudioContext.instances = [];
    window.localStorage.clear();
    Object.defineProperty(window, "AudioContext", {
      configurable: true,
      value: FakeAudioContext,
    });
    vi.spyOn(HTMLMediaElement.prototype, "canPlayType").mockReturnValue(
      "probably",
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(8),
      })),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    if (originalAudioContext) {
      Object.defineProperty(window, "AudioContext", originalAudioContext);
    } else {
      Reflect.deleteProperty(window, "AudioContext");
    }
  });

  it("defines a distinct authored soundtrack for every Tour stage", () => {
    expect(stageSoundtracks).toHaveLength(5);
    expect(stageSoundtracks.map((track) => track.stage)).toEqual([
      1, 2, 3, 4, 5,
    ]);
    expect(new Set(stageSoundtracks.map((track) => track.title)).size).toBe(5);
    expect(new Set(stageSoundtracks.map((track) => track.bpm)).size).toBe(5);
  });

  it("keeps every runtime effect backed by one generated asset", () => {
    expect(gameSoundEffects).toHaveLength(19);
    expect(new Set(gameSoundEffects).size).toBe(gameSoundEffects.length);
    expect(audioManifest.effects.map((effect) => effect.name)).toEqual(
      gameSoundEffects,
    );
  });

  it("maps store changes to legible event sounds with major milestones taking priority", () => {
    const baseline = {
      activePowerUp: "jump",
      level: 1,
      raceFinished: false,
      raceRevision: 3,
      stage: 1,
    };

    expect(
      gameEffectsForTransition(baseline, {
        ...baseline,
        activePowerUp: null,
        level: 2,
      }),
    ).toEqual(["level-up", "power-up-end"]);
    expect(
      gameEffectsForTransition(baseline, {
        ...baseline,
        activePowerUp: null,
        level: 2,
        stage: 2,
      }),
    ).toEqual(["sector-complete"]);
    expect(
      gameEffectsForTransition(baseline, {
        ...baseline,
        activePowerUp: null,
        level: 2,
        raceFinished: true,
      }),
    ).toEqual(["tour-complete"]);
    expect(
      gameEffectsForTransition(
        { ...baseline, raceFinished: true },
        {
          ...baseline,
          activePowerUp: null,
          raceRevision: baseline.raceRevision + 1,
        },
      ),
    ).toEqual(["race-start"]);
  });

  it("unlocks on demand, loops the requested stage, and crossfades stage changes", async () => {
    const audio = new GameAudioController();
    audio.setStage(3);

    expect(await audio.unlock()).toBe(true);
    await flushAudioPromises();

    const context = FakeAudioContext.instances[0];
    expect(context).toBeDefined();
    expect(fetch).toHaveBeenCalledWith("/assets/audio/stage-3.ogg");
    expect(audio.getState()).toMatchObject({
      unlocked: true,
      requestedStage: 3,
      playingStage: 3,
      soundtrackTitle: "Rhone Velocity",
    });
    expect(context.sources[0]?.loop).toBe(true);
    expect(context.sources[0]?.start).toHaveBeenCalledOnce();

    audio.setStage(5);
    await vi.waitFor(() => expect(audio.getState().playingStage).toBe(5));

    expect(fetch).toHaveBeenCalledWith("/assets/audio/stage-5.ogg");
    expect(context.sources[0]?.stop).toHaveBeenCalledOnce();
    expect(context.sources[1]?.loop).toBe(true);
  });

  it("plays event effects and cycles muted, effects-only, and full audio", async () => {
    const audio = new GameAudioController();
    await audio.unlock();
    await flushAudioPromises();
    const context = FakeAudioContext.instances[0];
    const sourceCountBeforeEffect = context.sources.length;

    audio.playEffect("cash-pickup");
    await flushAudioPromises();

    expect(fetch).toHaveBeenCalledWith("/assets/audio/cash-pickup.ogg");
    expect(context.sources).toHaveLength(sourceCountBeforeEffect + 1);
    expect(context.sources.at(-1)?.loop).toBe(false);
    expect(context.sources.at(-1)?.start).toHaveBeenCalledOnce();

    audio.setPaused(true);
    expect(audio.getState().paused).toBe(true);
    expect(context.gains[1]?.gain.setTargetAtTime).toHaveBeenCalledWith(
      0,
      context.currentTime,
      0.06,
    );
    audio.setPaused(false);

    expect(audio.cycleMode()).toBe("muted");
    expect(audio.getState().muted).toBe(true);
    expect(audio.getState().mode).toBe("muted");
    expect(window.localStorage.getItem("ze-tour-audio-v1")).toBe(
      '{"mode":"muted"}',
    );
    expect(context.gains[0]?.gain.setTargetAtTime).toHaveBeenCalledWith(
      0,
      context.currentTime,
      0.025,
    );

    const sourceCountWhileMuted = context.sources.length;
    audio.playEffect("sweat-pickup");
    await flushAudioPromises();
    expect(context.sources).toHaveLength(sourceCountWhileMuted);

    expect(audio.cycleMode()).toBe("effects");
    expect(audio.getState()).toMatchObject({ mode: "effects", muted: false });
    expect(context.gains[1]?.gain.setTargetAtTime).toHaveBeenCalledWith(
      0,
      context.currentTime,
      0.06,
    );
    audio.playEffect("sweat-pickup");
    await flushAudioPromises();
    expect(context.sources).toHaveLength(sourceCountWhileMuted + 1);

    expect(audio.cycleMode()).toBe("full");
    expect(audio.getState()).toMatchObject({ mode: "full", muted: false });
    expect(context.gains[1]?.gain.setTargetAtTime).toHaveBeenCalledWith(
      0.36,
      context.currentTime,
      0.12,
    );
    expect(window.localStorage.getItem("ze-tour-audio-v1")).toBe(
      '{"mode":"full"}',
    );
  });

  it("migrates the previous boolean mute preference", () => {
    window.localStorage.setItem("ze-tour-audio-v1", '{"muted":true}');
    expect(new GameAudioController().getState()).toMatchObject({
      mode: "muted",
      muted: true,
    });
  });
});
