import test from 'node:test';
import assert from 'node:assert/strict';
import {adHtml, makeCandles, SCENES, DURATION} from '../tools/ad-video.mjs';
import {synth, wav, SR, LEN} from '../tools/ad-music.mjs';

test('les cinq scènes couvrent les 20 s sans trou', () => {
  assert.equal(SCENES[0].from, 0);
  SCENES.slice(1).forEach((s, i) => assert.equal(s.from, SCENES[i].to));
  assert.equal(SCENES.at(-1).to, DURATION);
});

test('bougies déterministes et cohérentes', () => {
  const a = makeCandles(), b = makeCandles();
  assert.deepEqual(a, b);
  for (const k of a) assert.ok(k.h >= Math.max(k.o, k.c) && k.l <= Math.min(k.o, k.c));
});

test('la page reprend les textes demandés et échappe l’adresse', () => {
  const html = adHtml({url: '<x>'});
  for (const w of ['GOLD', 'DISCOVER', 'SMARTER', 'ANALYZE,', 'START']) assert.ok(html.includes(w), w);
  assert.ok(!html.includes('VISIT <x>'));
});

test('la musique dure 20 s, sans écrêtage', () => {
  const [L, R] = synth();
  assert.equal(L.length, SR * LEN);
  let peak = 0; for (let i = 0; i < L.length; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  assert.ok(peak <= 0.9 && peak > 0.5);
  assert.equal(wav([L, R]).length, 44 + L.length * 4);
});
