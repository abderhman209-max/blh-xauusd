import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSignal, signalHtml} from '../tools/signal-video.mjs';

test('calcule le ratio risque/rendement de chaque TP', () => {
  const s = buildSignal({side: 'buy', entry: '2650.50', sl: '2644.00', tp1: '2656.00', tp2: '2662.00', tp3: '2670.00'});
  assert.equal(s.decimals, 2);
  assert.deepEqual(s.tps.map(t => t.rr.toFixed(1)), ['0.8', '1.8', '3.0']);
});

test('refuse des niveaux incohérents avec le sens', () => {
  assert.throws(() => buildSignal({side: 'buy', entry: 100, sl: 101, tp1: 102}), /Stop Loss/);
  assert.throws(() => buildSignal({side: 'sell', entry: 100, sl: 101, tp1: 99, tp2: 99.5}), /TP2/);
  assert.throws(() => buildSignal({side: 'hold', entry: 100, sl: 99, tp1: 101}), /side/);
});

test('échappe le texte libre et gère la vente en arabe', () => {
  const html = signalHtml(buildSignal({side: 'sell', entry: 100, sl: 101, tp1: 99, lang: 'ar', note: '<b>x</b>'}));
  assert.match(html, /dir="rtl"/);
  assert.match(html, /بيع/);
  assert.ok(!html.includes('<b>x</b>'));
});
