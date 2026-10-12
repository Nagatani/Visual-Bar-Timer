const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
  formatTime,
  calculateBars,
  MAX_SECONDS,
  TOTAL_BARS,
  MODE_NORMAL,
} = require('../web/timer-engine.js');

describe('Time Formatting (formatTime)', () => {
  test('formats 0 seconds as 00:00', () => {
    const result = formatTime(0);
    assert.strictEqual(result.minutes, '00');
    assert.strictEqual(result.seconds, '00');
    assert.strictEqual(result.formatted, '00:00');
  });

  test('formats single digit minutes and seconds', () => {
    const result = formatTime(65); // 1 min 5 sec
    assert.strictEqual(result.minutes, '01');
    assert.strictEqual(result.seconds, '05');
    assert.strictEqual(result.formatted, '01:05');
  });

  test('formats standard 25 minutes pomodoro', () => {
    const result = formatTime(25 * 60);
    assert.strictEqual(result.minutes, '25');
    assert.strictEqual(result.seconds, '00');
    assert.strictEqual(result.formatted, '25:00');
  });

  test('formats maximum boundary 99:59 (5999 seconds)', () => {
    const result = formatTime(MAX_SECONDS);
    assert.strictEqual(result.minutes, '99');
    assert.strictEqual(result.seconds, '59');
    assert.strictEqual(result.formatted, '99:59');
  });

  test('clamps values exceeding MAX_SECONDS to 99:59', () => {
    const result = formatTime(10000);
    assert.strictEqual(result.minutes, '99');
    assert.strictEqual(result.seconds, '59');
    assert.strictEqual(result.formatted, '99:59');
  });

  test('handles null, undefined, or negative values safely', () => {
    assert.strictEqual(formatTime(null).formatted, '00:00');
    assert.strictEqual(formatTime(undefined).formatted, '00:00');
    assert.strictEqual(formatTime(-10).formatted, '00:00');
  });
});

describe('20-Segment Bar Calculation (calculateBars)', () => {
  describe('Countdown Mode', () => {
    test('returns 20 bars when full time remaining', () => {
      const bars = calculateBars(MODE_NORMAL, 60, 60);
      assert.strictEqual(bars, 20);
    });

    test('returns 10 bars when exactly half time remaining', () => {
      const bars = calculateBars(MODE_NORMAL, 30, 60);
      assert.strictEqual(bars, 10);
    });

    test('returns 5 bars when 25% time remaining', () => {
      const bars = calculateBars(MODE_NORMAL, 15, 60);
      assert.strictEqual(bars, 5);
    });

    test('returns 1 bar even when tiny positive fraction of time remains', () => {
      // 1 second out of 3600 seconds (1 hour)
      const bars = calculateBars(MODE_NORMAL, 1, 3600);
      assert.strictEqual(bars, 1, 'At least 1 bar should remain visible while timer is running');
    });

    test('returns 0 bars when remaining time is 0', () => {
      const bars = calculateBars(MODE_NORMAL, 0, 60);
      assert.strictEqual(bars, 0);
    });

    test('returns 0 bars when target time is 0 or negative', () => {
      assert.strictEqual(calculateBars(MODE_NORMAL, 0, 0), 0);
      assert.strictEqual(calculateBars(MODE_NORMAL, -5, 60), 0);
    });

    test('proportionally scales across 20 discrete intervals for 20-minute timer', () => {
      const target = 20 * 60; // 1200s (each bar is exactly 60s)
      for (let min = 20; min >= 1; min--) {
        const remaining = min * 60;
        assert.strictEqual(calculateBars(MODE_NORMAL, remaining, target), min);
      }
    });
  });

  describe('Count-up Mode (1 bar added per 5 minutes = 300 seconds)', () => {
    test('starts with 0 bars at 0 seconds', () => {
      assert.strictEqual(calculateBars(MODE_NORMAL, 0, 0), 0);
    });

    test('remains 0 bars just before 5 minutes (299s)', () => {
      assert.strictEqual(calculateBars(MODE_NORMAL, 299, 0), 0);
    });

    test('turns on 1 bar at 5 minutes (300s)', () => {
      assert.strictEqual(calculateBars(MODE_NORMAL, 300, 0), 1);
    });

    test('turns on 2 bars at 10 minutes (600s)', () => {
      assert.strictEqual(calculateBars(MODE_NORMAL, 600, 0), 2);
    });

    test('turns on 10 bars at 50 minutes (3000s)', () => {
      assert.strictEqual(calculateBars(MODE_NORMAL, 3000, 0), 10);
    });

    test('reaches maximum 20 bars at 100 minutes (6000s)', () => {
      assert.strictEqual(calculateBars(MODE_NORMAL, 6000, 0), 20);
    });

    test('never exceeds 20 bars even after 100+ minutes', () => {
      assert.strictEqual(calculateBars(MODE_NORMAL, 10000, 0), TOTAL_BARS);
    });
  });
});
