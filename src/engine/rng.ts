// Deterministic PRNG: xfnv1a string hash + mulberry32 stream.
export function xfnv1a(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Rng = () => number;

export function makeRng(seed: string): Rng {
  return mulberry32(xfnv1a(seed));
}

export function pick<T>(rng: Rng, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

export function range(rng: Rng, min: number, max: number): number {
  return min + rng() * (max - min);
}

export function rangeInt(rng: Rng, min: number, max: number): number {
  return Math.floor(range(rng, min, max + 1));
}

export function chance(rng: Rng, p: number): boolean {
  return rng() < p;
}
