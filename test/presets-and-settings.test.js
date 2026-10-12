const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
  TimerEngine,
  MODE_NORMAL,
  MODE_REPEAT,
  REPEAT_RUNNING_WORK,
  MAX_SECONDS,
} = require('../web/timer-engine.js');

describe('Preset Configurations (applyPreset)', () => {
  test('applies pomodoro preset (25m work / 5m break x 4 sets)', () => {
    const engine = new TimerEngine();
    engine.applyPreset('pomodoro');

    assert.strictEqual(engine.mode, MODE_REPEAT);
    assert.strictEqual(engine.repeat.workDuration, 25 * 60);
    assert.strictEqual(engine.repeat.breakDuration, 5 * 60);
    assert.strictEqual(engine.repeat.totalSets, 4);
    assert.strictEqual(engine.repeat.currentSet, 1);
    assert.strictEqual(engine.repeat.subState, REPEAT_RUNNING_WORK);
    assert.strictEqual(engine.isRunning, true);
    assert.strictEqual(engine.getActiveBars(), 20);
    assert.strictEqual(engine.getDisplayTime().formatted, '25:00');
  });

  test('applies pomodoro50 preset (50m work / 10m break x 2 sets)', () => {
    const engine = new TimerEngine();
    engine.applyPreset('pomodoro50');

    assert.strictEqual(engine.mode, MODE_REPEAT);
    assert.strictEqual(engine.repeat.workDuration, 50 * 60);
    assert.strictEqual(engine.repeat.breakDuration, 10 * 60);
    assert.strictEqual(engine.repeat.totalSets, 2);
    assert.strictEqual(engine.isRunning, true);
    assert.strictEqual(engine.getDisplayTime().formatted, '50:00');
  });

  test('applies short countdown presets (3m, 5m, 15m, 60m)', () => {
    const presets = [
      { id: '3m', expected: 180, display: '03:00' },
      { id: '5m', expected: 300, display: '05:00' },
      { id: '15m', expected: 900, display: '15:00' },
      { id: '25m', expected: 1500, display: '25:00' },
      { id: '60m', expected: 3600, display: '60:00' },
    ];

    for (const p of presets) {
      const engine = new TimerEngine();
      engine.applyPreset(p.id);

      assert.strictEqual(engine.mode, MODE_NORMAL);
      assert.strictEqual(engine.normal.targetSeconds, p.expected);
      assert.strictEqual(engine.normal.currentSeconds, p.expected);
      assert.strictEqual(engine.getDisplayTime().formatted, p.display);
      assert.strictEqual(engine.getActiveBars(), 20);
    }
  });

  test('caps time addition at MAX_SECONDS (99:59)', () => {
    const engine = new TimerEngine();
    // Add 100 minutes (exceeds 99:59)
    for (let i = 0; i < 11; i++) {
      engine.addTime(10 * 60);
    }
    assert.strictEqual(engine.normal.targetSeconds, MAX_SECONDS);
    assert.strictEqual(engine.getDisplayTime().formatted, '99:59');
  });
});
