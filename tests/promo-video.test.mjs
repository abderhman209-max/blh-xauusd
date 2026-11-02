import test from 'node:test';
import assert from 'node:assert/strict';
import {promoHtml, TEXT, DURATION} from '../tools/promo-video.mjs';

test('chaque langue fournit tous les textes de la vidéo', () => {
  const keys = Object.keys(TEXT.fr).sort();
  for (const lang of Object.keys(TEXT)) assert.deepEqual(Object.keys(TEXT[lang]).sort(), keys, lang);
});

test('reprend le tarif du site, passe en RTL pour l’arabe et échappe le lien', () => {
  const html = promoHtml({lang: 'ar', url: '<x>'});
  assert.match(html, /dir="rtl"/);
  assert.match(html, />49</);
  assert.ok(!html.includes('<x>'));
  assert.equal(DURATION, 24);
});
