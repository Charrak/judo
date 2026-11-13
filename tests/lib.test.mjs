import { test } from 'node:test';
import assert from 'node:assert/strict';

import { esc, attrs, classNames, icon, flagPath } from '../src/lib/html.mjs';

test('esc escapes every character that can break out of markup', () => {
  assert.equal(esc('<b>&"\'</b>'), '&lt;b&gt;&amp;&quot;&#39;&lt;/b&gt;');
  assert.equal(esc('Judo – Training'), 'Judo – Training');
  assert.equal(esc(42), '42');
});

test('attrs skips empty values and renders booleans', () => {
  assert.equal(attrs({ href: '/de/', hidden: false, title: null }), ' href="/de/"');
  assert.equal(attrs({ open: true }), ' open');
  assert.equal(attrs({}, ), '');
  assert.equal(attrs({ 'aria-label': 'a"b' }), ' aria-label="a&quot;b"');
});

test('classNames drops empty entries', () => {
  assert.equal(classNames('a', '', null, 'b'), 'a b');
  assert.equal(classNames(), '');
});

test('icons are known and screen-reader safe', () => {
  const svg = icon('arrow', 'btn__icon');
  assert.match(svg, /class="icon btn__icon"/);
  assert.match(svg, /aria-hidden="true"/);
  assert.throws(() => icon('does-not-exist'));
});

test('flag paths follow the asset layout', () => {
  assert.equal(flagPath('de'), '/assets/flags/de.svg');
});
