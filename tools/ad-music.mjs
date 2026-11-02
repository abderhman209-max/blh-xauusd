#!/usr/bin/env node
// Musique électronique originale de 20 s pour la publicité (synthèse procédurale, sans échantillon externe).
// Calée sur les scènes de tools/ad-video.mjs : intro tendue, entrée du kick à 4 s, drop à 8 s,
// montée à 14 s avec trois impacts sur « Analyze. Plan. Trade. », impact final à 17 s.
//
//   node tools/ad-music.mjs --out musique.wav
import fs from 'node:fs';
import path from 'node:path';
import {parseArgs} from 'node:util';

export const SR = 44100, LEN = 20, BPM = 124;
const BEAT = 60 / BPM, N = SR * LEN;

export function synth() {
  const L = new Float32Array(N), R = new Float32Array(N);
  const sendL = new Float32Array(N), sendR = new Float32Array(N);
  let seed = 1;
  const noise = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2147483648) - 1;
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const add = (i, l, r, send = 0) => { if (i >= 0 && i < N) { L[i] += l; R[i] += r; sendL[i] += l * send; sendR[i] += r * send; } };

  // La mineur : Am – F – C – G, un accord par mesure.
  const CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
  const chordAt = t => CHORDS[Math.floor(t / (BEAT * 4)) % 4];

  const kicks = [];
  const kick = (t0, gain = 1) => {
    kicks.push(t0);
    let ph = 0;
    for (let i = 0; i < SR * 0.45; i++) {
      const t = i / SR, f = 45 + 110 * Math.exp(-t * 28);
      ph += 2 * Math.PI * f / SR;
      const v = (Math.sin(ph) * Math.exp(-t * 7) + (i < 90 ? noise() * 0.3 * (1 - i / 90) : 0)) * gain * 0.75;
      add(Math.round(t0 * SR) + i, v, v);
    }
  };
  const hat = (t0, gain = 0.12, open = false) => {
    let prev = 0;
    const d = open ? 0.18 : 0.035;
    for (let i = 0; i < SR * d * 4; i++) {
      const n = noise(), hp = n - prev; prev = n;
      const v = hp * Math.exp(-(i / SR) / d) * gain;
      add(Math.round(t0 * SR) + i, v * 0.8, v);
    }
  };
  const clap = (t0, gain = 0.35) => {
    let lp = 0;
    for (let i = 0; i < SR * 0.3; i++) {
      const t = i / SR, n = noise(); lp += 0.35 * (n - lp);
      const env = (t < 0.03 ? (Math.floor(t / 0.01) % 2 ? 0.6 : 1) : 1) * Math.exp(-t * 18);
      const v = (n - lp) * env * gain;
      add(Math.round(t0 * SR) + i, v, v * 0.9, 0.5);
    }
  };
  const impact = (t0, gain = 0.9) => {
    let ph = 0, lp = 0;
    for (let i = 0; i < SR * 2.2; i++) {
      const t = i / SR; ph += 2 * Math.PI * (30 + 60 * Math.exp(-t * 6)) / SR;
      const n = noise(); lp += 0.08 * (n - lp);
      const v = (Math.sin(ph) * Math.exp(-t * 1.6) * 0.6 + lp * Math.exp(-t * 3) * 1.4) * gain;
      add(Math.round(t0 * SR) + i, v, v, 0.6);
    }
  };
  const riser = (t0, t1, gain = 0.25) => {
    let lp = 0, ph = 0;
    for (let i = Math.round(t0 * SR); i < Math.round(t1 * SR); i++) {
      const k = (i / SR - t0) / (t1 - t0), n = noise();
      lp += (0.02 + 0.5 * k * k) * (n - lp);
      ph += 2 * Math.PI * (200 + 1800 * k * k) / SR;
      const v = ((n - lp) * 0.7 + Math.sin(ph) * 0.15) * k * k * gain;
      add(i, v * (0.8 + 0.2 * Math.sin(k * 40)), v * (0.8 + 0.2 * Math.cos(k * 40)), 0.4);
    }
  };
  // Synthé à dents de scie désaccordées + filtre passe-bas (pad, basse, arpège).
  const saw = (t0, dur, midi, {gain = 0.1, cutoff = 1500, envCut = 0, attack = 0.005, release = 0.1, detune = 0, voices = 1, send = 0, pan = 0} = {}) => {
    const f = mtof(midi), n0 = Math.round(t0 * SR), n = Math.round((dur + release) * SR);
    const ph = new Array(voices).fill(0).map((_, v) => v / voices);
    let lp1 = 0, lp2 = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      let s = 0;
      for (let v = 0; v < voices; v++) {
        const fv = f * (1 + (voices > 1 ? (v / (voices - 1) - 0.5) * detune : 0));
        ph[v] = (ph[v] + fv / SR) % 1; s += 2 * ph[v] - 1;
      }
      s /= voices;
      const fc = Math.min(cutoff + envCut * Math.exp(-t * 12), 16000), a = 1 - Math.exp(-2 * Math.PI * fc / SR);
      lp1 += a * (s - lp1); lp2 += a * (lp1 - lp2);
      const env = Math.min(1, t / attack) * (t > dur ? Math.exp(-(t - dur) / (release / 4)) : 1);
      const v = lp2 * env * gain;
      add(n0 + i, v * (1 - pan) , v * (1 + pan), send);
    }
  };

  const at = b => b * BEAT;
  const beats = Math.ceil(LEN / BEAT);
  // Impacts de transition calés sur les scènes.
  impact(0, 0.8); impact(4, 0.7); impact(8, 1); impact(17, 1.1);
  riser(2.2, 4, 0.22); riser(6.3, 8, 0.3); riser(15.6, 17, 0.38);
  for (const t of [14.6, 15.15, 15.7]) { kick(t, 1.1); clap(t, 0.4); }

  // Pad continu.
  for (let bar = 0; bar * BEAT * 4 < LEN; bar++) {
    const t = bar * BEAT * 4, ch = CHORDS[bar % 4];
    for (const m of ch) saw(t, BEAT * 4, m, {gain: 0.1, cutoff: t < 8 ? 900 : 1800, attack: 0.4, release: 0.6, detune: 0.012, voices: 3, send: 0.6, pan: (m % 3 - 1) * 0.4});
  }
  for (let b = 0; b < beats; b++) {
    const t = at(b);
    if (t >= LEN - 0.6) break;
    const inBuild = t >= 14 && t < 17;
    // Pulsation d'intro.
    if (t < 4) saw(t + BEAT / 2, BEAT / 3, chordAt(t)[0] - 12, {gain: 0.12, cutoff: 300, envCut: 900, release: 0.05});
    if (t >= 4 && !inBuild) kick(t);
    if (t >= 8 && !inBuild && b % 2 === 1) clap(t);
    if (t >= 4) { hat(t + BEAT / 2, 0.14, b % 4 === 3); }
    if (t >= 8 && !inBuild) { hat(t + BEAT / 4, 0.06); hat(t + 3 * BEAT / 4, 0.06); }
    // Basse en contretemps (8 à 14 s et après 17 s).
    if ((t >= 4 && t < 14) || t >= 17) {
      const root = chordAt(t)[0] - 24;
      saw(t + BEAT / 2, BEAT * 0.42, root, {gain: t >= 8 ? 0.24 : 0.16, cutoff: 320, envCut: 1600, release: 0.04, detune: 0.006, voices: 2});
    }
    // Arpège en doubles croches pendant le drop.
    if ((t >= 8 && t < 14) || t >= 17.5) {
      const ch = chordAt(t);
      for (let s = 0; s < 4; s++) {
        const m = ch[(b * 4 + s) % 3] + 12 + ((b * 4 + s) % 8 === 7 ? 12 : 0);
        saw(t + s * BEAT / 4, BEAT / 6, m, {gain: 0.13, cutoff: 1100, envCut: 4200, release: 0.08, send: 0.5, pan: s % 2 ? 0.5 : -0.5});
      }
    }
    // Roulement de montée.
    if (inBuild && t >= 15.6) for (let s = 0; s < 4; s++) clap(t + s * BEAT / 4, 0.12 + 0.2 * (t - 15.6) / 1.4);
  }

  // Sidechain : la basse, le pad et l'arpège respirent sous le kick.
  const duck = new Float32Array(N).fill(1);
  for (const k of kicks) for (let i = 0; i < SR * 0.3; i++) { const j = Math.round(k * SR) + i; if (j < N) duck[j] = Math.min(duck[j], 1 - 0.55 * Math.exp(-i / SR / 0.09)); }

  // Réverbération de Schroeder sur le bus d'envoi + écho stéréo.
  const reverb = (inp, off) => {
    const out = new Float32Array(N);
    for (const [d, g] of [[1557, 0.82], [1617, 0.81], [1491, 0.83], [1422, 0.8]]) {
      const buf = new Float32Array(d + off); let p = 0, lp = 0;
      for (let i = 0; i < N; i++) { const y = buf[p]; lp += 0.4 * (y - lp); buf[p] = inp[i] + lp * g; out[i] += y * 0.25; p = (p + 1) % buf.length; }
    }
    for (const d of [225, 556]) { const buf = new Float32Array(d + off); let p = 0; for (let i = 0; i < N; i++) { const b = buf[p], y = -out[i] + b; buf[p] = out[i] + b * 0.5; out[i] = y; p = (p + 1) % buf.length; } }
    return out;
  };
  const rvL = reverb(sendL, 0), rvR = reverb(sendR, 23);
  const dly = Math.round(BEAT * 0.75 * SR);
  for (let i = 0; i < N; i++) {
    const dl = i >= dly ? sendR[i - dly] * 0.25 : 0, dr = i >= dly ? sendL[i - dly] * 0.25 : 0;
    L[i] = L[i] * (0.45 + 0.55 * duck[i]) + rvL[i] * 0.35 + dl;
    R[i] = R[i] * (0.45 + 0.55 * duck[i]) + rvR[i] * 0.35 + dr;
  }
  // Saturation douce + normalisation, fondu d'entrée et de sortie.
  let peak = 0;
  for (let i = 0; i < N; i++) { L[i] = Math.tanh(L[i] * 1.3); R[i] = Math.tanh(R[i] * 1.3); peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i])); }
  const g = 0.89 / (peak || 1);
  for (let i = 0; i < N; i++) {
    const t = i / SR, f = Math.min(1, t / 0.02, (LEN - t) / 0.8);
    L[i] *= g * f; R[i] *= g * f;
  }
  return [L, R];
}

export function wav([L, R]) {
  const buf = Buffer.alloc(44 + L.length * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + L.length * 4, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(L.length * 4, 40);
  for (let i = 0; i < L.length; i++) {
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i])) * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i])) * 32767), 46 + i * 4);
  }
  return buf;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const {values} = parseArgs({options: {out: {type: 'string', default: 'pipvoria-music.wav'}}});
  fs.writeFileSync(path.resolve(values.out), wav(synth()));
  console.log('Musique créée : ' + path.resolve(values.out));
}
