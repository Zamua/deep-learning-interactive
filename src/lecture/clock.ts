/** The lecture's clock: the narration track when there is one, a wall clock otherwise. */
export class Clock {
  private silentBase = 0;
  private silentAt: number | null = null;
  private lastCt = -1;
  private lastAt = 0;
  rate = 1;
  silent: boolean;

  constructor(
    readonly audio: HTMLAudioElement | null,
    private readonly duration: number,
  ) {
    this.silent = !audio;
  }

  get paused(): boolean {
    return this.silent ? this.silentAt === null : this.audio!.paused;
  }

  time(): number {
    if (this.silent) {
      const t = this.silentAt === null ? this.silentBase : this.silentBase + ((performance.now() - this.silentAt) / 1000) * this.rate;
      return Math.min(t, this.duration);
    }
    const a = this.audio!;
    const ct = a.currentTime;
    const now = performance.now();
    if (a.paused || a.readyState < 3 || ct !== this.lastCt) {
      this.lastCt = ct;
      this.lastAt = now;
      return ct;
    }
    // currentTime advances in coarse steps on some engines; extrapolate between them.
    return ct + Math.min(0.25, (now - this.lastAt) / 1000) * a.playbackRate;
  }

  async play(): Promise<void> {
    if (this.silent) {
      if (this.silentAt === null) {
        if (this.silentBase >= this.duration) this.silentBase = 0;
        this.silentAt = performance.now();
      }
      return;
    }
    await this.audio!.play();
  }

  pause(): void {
    if (this.silent) {
      this.silentBase = this.time();
      this.silentAt = null;
    } else this.audio!.pause();
  }

  seek(t: number): void {
    const v = Math.max(0, Math.min(this.duration, t));
    if (this.silent) {
      this.silentBase = v;
      if (this.silentAt !== null) this.silentAt = performance.now();
    } else this.audio!.currentTime = v;
  }

  setRate(r: number): void {
    if (this.silent) {
      this.silentBase = this.time();
      if (this.silentAt !== null) this.silentAt = performance.now();
    } else this.audio!.playbackRate = r;
    this.rate = r;
  }

  /** Drops the track (it failed to load) and carries on from the same moment, captions only. */
  goSilent(): void {
    if (this.silent) return;
    const t = this.audio!.currentTime;
    const playing = !this.audio!.paused;
    this.audio!.pause();
    this.silent = true;
    this.silentBase = t;
    this.silentAt = playing ? performance.now() : null;
  }
}
