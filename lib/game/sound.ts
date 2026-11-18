"use client";

/**
 * Every game sound is made in code with the Web Audio API: no audio files to download or store.
 * Browsers only allow sound after the person has clicked or typed on the page at least once;
 * before that these calls are silently skipped.
 */
let ctx: AudioContext | null = null;
// One switch for every game sound (chimes, jingle, game effects) for everyone, set by the developer in the console.
let muted = false;
const soundListeners = new Set<() => void>();

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch { return null; }
}

export function setMuted(v: boolean) {
  if (muted === v) return;
  muted = v;
  soundListeners.forEach((l) => l());
}
export function isMuted() { return muted; }
export const soundStore = {
  subscribe(l: () => void) { soundListeners.add(l); return () => { soundListeners.delete(l); }; },
  get: () => muted,
  server: () => false,
};

/** One note: a soft bell-like tone (two sine partials with a quick attack and a long fade). */
function note(freq: number, at: number, dur = 0.5, vol = 0.22, type: OscillatorType = "sine") {
  const a = audio();
  if (!a || muted) return;
  const t = a.currentTime + at;
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  g.connect(a.destination);
  for (const [mult, level] of [[1, 1], [2.01, 0.25]] as const) {
    const o = a.createOscillator();
    const og = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq * mult, t);
    og.gain.value = level;
    o.connect(og).connect(g);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
}

const N: Record<string, number> = {
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.0, B5: 987.77, C6: 1046.5, E6: 1318.5,
};

/** Three rising chimes, the "something's happening" call. */
export function chimeThrice() {
  [0, 0.42, 0.84].forEach((t, i) => {
    note([N.E5, N.G5, N.C6][i], t, 0.9, 0.24);
    note([N.C5, N.E5, N.G5][i], t, 0.9, 0.12);
  });
}

/** A short happy jingle (about 3 seconds) that plays after the chimes. */
export function jingle(delay = 0) {
  const beat = 0.17;
  const melody: [string, number][] = [
    ["C5", 1], ["E5", 1], ["G5", 1], ["C6", 2], ["A5", 1], ["G5", 1], ["E5", 2],
    ["F5", 1], ["A5", 1], ["G5", 1], ["E5", 1], ["D5", 1], ["E5", 1], ["C5", 3],
  ];
  const bass: [string, number][] = [["C4", 4], ["A4", 4], ["F4", 4], ["G4", 4], ["C4", 3]];
  let t = delay;
  for (const [n, len] of melody) { note(N[n], t, beat * len + 0.25, 0.16, "triangle"); t += beat * len; }
  t = delay;
  for (const [n, len] of bass) { note(N[n] / 2, t, beat * len + 0.1, 0.09, "sine"); t += beat * len; }
}

/** Launch call: three chimes, then the jingle. */
export function launchFanfare() {
  chimeThrice();
  jingle(1.5);
}

export const sfx = {
  correct: () => { note(N.C5, 0, 0.25, 0.18, "triangle"); note(N.E5, 0.08, 0.25, 0.18, "triangle"); note(N.G5, 0.16, 0.25, 0.18, "triangle"); note(N.C6, 0.24, 0.5, 0.2, "triangle"); },
  close: () => { note(N.A4, 0, 0.18, 0.12, "square"); },
  tick: () => { note(N.E6, 0, 0.06, 0.06, "square"); },
  turn: () => { note(N.G4, 0, 0.2, 0.15, "triangle"); note(N.C5, 0.12, 0.2, 0.15, "triangle"); note(N.G5, 0.24, 0.45, 0.17, "triangle"); },
  timeUp: () => { note(N.G4, 0, 0.3, 0.16, "sawtooth"); note(N.E4, 0.22, 0.3, 0.16, "sawtooth"); note(N.C4, 0.44, 0.6, 0.16, "sawtooth"); },
  win: () => jingle(0),
  pop: () => { note(N.C6, 0, 0.08, 0.1, "sine"); },
};
