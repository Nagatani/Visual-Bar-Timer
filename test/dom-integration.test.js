const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

describe('HTML Markup & DOM Component Structure', () => {
  const htmlPath = path.join(__dirname, '../web/index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  test('contains stage wrapper for physical 90-degree rotation', () => {
    assert.match(html, /<div class="device-stage" id="deviceStage">/, 'deviceStage wrapper must exist');
    assert.match(html, /<main class="timer-device" id="deviceUnit">/, 'timer-device element must exist');
  });

  test('contains LCD screen and 20-segment bar track', () => {
    assert.match(html, /id="lcdScreen"/, 'LCD screen element must exist');
    assert.match(html, /id="barTrack"/, '20-segment bar track container must exist');
    assert.match(html, /id="digitMinutes"/, 'Minutes digit span must exist');
    assert.match(html, /id="digitSeconds"/, 'Seconds digit span must exist');
  });

  test('contains all required hardware buttons', () => {
    const requiredButtons = [
      'btnMode',
      'btnPlus10M',
      'btnPlus1M',
      'btnPlus10S',
      'btnStartStop',
      'btnReset',
      'soundToggle',
    ];

    for (const btnId of requiredButtons) {
      assert.match(html, new RegExp(`id="${btnId}"`), `Button #${btnId} must be present in HTML`);
    }
  });

  test('contains desktop controls (Pin, Compact, Orientation, Theme)', () => {
    const controls = [
      'pinTopBtn',
      'compactModeBtn',
      'orientationBtn',
      'orientationLabel',
      'themeToggleBtn',
      'themeLabel',
    ];

    for (const id of controls) {
      assert.match(html, new RegExp(`id="${id}"`), `Control #${id} must be present in HTML`);
    }
  });

  test('contains all 7 quick preset chips', () => {
    const presets = ['pomodoro', 'pomodoro50', '3m', '5m', '15m', '25m', '60m'];
    for (const preset of presets) {
      assert.match(html, new RegExp(`data-preset="${preset}"`), `Preset chip for ${preset} must exist`);
    }
  });

  test('loads scripts in correct dependency order', () => {
    const engineIdx = html.indexOf('src="timer-engine.js"');
    const audioIdx = html.indexOf('src="audio.js"');
    const appIdx = html.indexOf('src="app.js"');

    assert.ok(engineIdx > -1, 'timer-engine.js script tag missing');
    assert.ok(audioIdx > -1, 'audio.js script tag missing');
    assert.ok(appIdx > -1, 'app.js script tag missing');
    assert.ok(engineIdx < appIdx, 'timer-engine.js must be loaded before app.js');
    assert.ok(audioIdx < appIdx, 'audio.js must be loaded before app.js');
  });

  test('contains zero references to competitor brand or model names', () => {
    assert.doesNotMatch(html, /king\s*jim/i, 'No brand references allowed');
    assert.doesNotMatch(html, /vbt10/i, 'No product model references allowed');
    assert.doesNotMatch(html, /キングジム/, 'No Japanese brand references allowed');
  });
});
