const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
  TimerEngine,
  MODE_NORMAL,
  MODE_REPEAT,
  REPEAT_SET_WORK,
  REPEAT_SET_BREAK,
  REPEAT_SET_COUNT,
  REPEAT_RUNNING_WORK,
  REPEAT_RUNNING_BREAK,
} = require('../web/timer-engine.js');

describe('Normal Mode State Machine', () => {
  test('increments time using addTime (+10m, +1m, +10s)', () => {
    const engine = new TimerEngine();
    assert.strictEqual(engine.normal.targetSeconds, 0);

    engine.addTime(10 * 60); // +10m
    assert.strictEqual(engine.normal.targetSeconds, 600);
    assert.strictEqual(engine.getDisplayTime().formatted, '10:00');

    engine.addTime(1 * 60);  // +1m
    assert.strictEqual(engine.normal.targetSeconds, 660);
    assert.strictEqual(engine.getDisplayTime().formatted, '11:00');

    engine.addTime(10);      // +10s
    assert.strictEqual(engine.normal.targetSeconds, 670);
    assert.strictEqual(engine.getDisplayTime().formatted, '11:10');
  });

  test('countdown runs, pauses, resumes and triggers alarm', () => {
    let alarmTriggered = false;
    const engine = new TimerEngine({
      onTimeUp: () => {
        alarmTriggered = true;
      }
    });

    engine.addTime(3); // 3 seconds
    assert.strictEqual(engine.getActiveBars(), 20);

    engine.start();
    assert.strictEqual(engine.isRunning, true);

    // Tick 1
    engine.tick();
    assert.strictEqual(engine.normal.currentSeconds, 2);
    assert.strictEqual(alarmTriggered, false);

    // Pause
    engine.pause();
    assert.strictEqual(engine.isRunning, false);
    engine.tick(); // Should not advance when paused
    assert.strictEqual(engine.normal.currentSeconds, 2);

    // Resume
    engine.start();
    engine.tick(); // 1 second left
    assert.strictEqual(engine.normal.currentSeconds, 1);

    // Final tick to 0
    engine.tick();
    assert.strictEqual(engine.normal.currentSeconds, 0);
    assert.strictEqual(engine.getActiveBars(), 0);
    assert.strictEqual(alarmTriggered, true);
    assert.strictEqual(engine.isAlarming, true);
    assert.strictEqual(engine.isRunning, false);

    // Stopping alarm
    engine.stopAlarm();
    assert.strictEqual(engine.isAlarming, false);
  });

  test('count-up mode activates when started from 00:00', () => {
    const engine = new TimerEngine();
    assert.strictEqual(engine.normal.targetSeconds, 0);

    engine.start();
    assert.strictEqual(engine.isRunning, true);
    assert.strictEqual(engine.normal.isCountUp, true);
    assert.strictEqual(engine.normal.currentSeconds, 0);
    assert.strictEqual(engine.getActiveBars(), 0);

    // Simulate 300 seconds (5 minutes)
    for (let i = 0; i < 300; i++) {
      engine.tick();
    }
    assert.strictEqual(engine.normal.currentSeconds, 300);
    assert.strictEqual(engine.getDisplayTime().formatted, '05:00');
    assert.strictEqual(engine.getActiveBars(), 1);

    // Simulate another 300 seconds (total 10 minutes)
    for (let i = 0; i < 300; i++) {
      engine.tick();
    }
    assert.strictEqual(engine.normal.currentSeconds, 600);
    assert.strictEqual(engine.getDisplayTime().formatted, '10:00');
    assert.strictEqual(engine.getActiveBars(), 2);
  });

  test('reset restores initial state', () => {
    const engine = new TimerEngine();
    engine.addTime(120);
    engine.start();
    engine.tick();

    engine.reset();
    assert.strictEqual(engine.isRunning, false);
    assert.strictEqual(engine.isAlarming, false);
    assert.strictEqual(engine.normal.targetSeconds, 0);
    assert.strictEqual(engine.normal.currentSeconds, 0);
    assert.strictEqual(engine.getActiveBars(), 0);
    assert.strictEqual(engine.getDisplayTime().formatted, '00:00');
  });
});

describe('Repeat (Pomodoro / Interval) State Machine', () => {
  test('mode toggles between Normal and Repeat', () => {
    const engine = new TimerEngine();
    assert.strictEqual(engine.mode, MODE_NORMAL);

    engine.toggleMode();
    assert.strictEqual(engine.mode, MODE_REPEAT);
    assert.strictEqual(engine.repeat.subState, REPEAT_SET_WORK);

    engine.toggleMode();
    assert.strictEqual(engine.mode, MODE_NORMAL);
  });

  test('repeat setup wizard advances: Work -> Break -> Count -> Run', () => {
    const engine = new TimerEngine();
    engine.toggleMode(); // To Repeat mode

    // Step 1: Work setup (default 25:00)
    assert.strictEqual(engine.repeat.subState, REPEAT_SET_WORK);
    assert.strictEqual(engine.getDisplayTime().formatted, '25:00');

    // Advance to Step 2: Break setup
    engine.advanceRepeatSetup();
    assert.strictEqual(engine.repeat.subState, REPEAT_SET_BREAK);
    assert.strictEqual(engine.getDisplayTime().formatted, '05:00');

    // Advance to Step 3: Count setup
    engine.advanceRepeatSetup();
    assert.strictEqual(engine.repeat.subState, REPEAT_SET_COUNT);
    assert.strictEqual(engine.getDisplayTime().formatted, 'SE:04');

    // Confirm & Start
    engine.advanceRepeatSetup();
    assert.strictEqual(engine.repeat.subState, REPEAT_RUNNING_WORK);
    assert.strictEqual(engine.repeat.currentSet, 1);
    assert.strictEqual(engine.isRunning, true);
  });

  test('executes exact N Work and N-1 Break intervals, finishing with Work', () => {
    const transitionLog = [];
    let completed = false;

    const engine = new TimerEngine({
      onIntervalTransition: (type, eng) => {
        transitionLog.push({ type, set: eng.repeat.currentSet });
      },
      onTimeUp: () => {
        completed = true;
      }
    });

    // Configure 3 sets: 2s Work, 1s Break
    engine.mode = MODE_REPEAT;
    engine.repeat.workDuration = 2;
    engine.repeat.breakDuration = 1;
    engine.repeat.totalSets = 3;
    engine.repeat.subState = REPEAT_RUNNING_WORK;
    engine.repeat.currentSet = 1;
    engine.repeat.currentSeconds = 2;
    engine.start();

    // Set 1: Work (2s)
    engine.tick(); // 1s left
    assert.strictEqual(engine.repeat.subState, REPEAT_RUNNING_WORK);
    engine.tick(); // 0s -> Transition to Break 1
    assert.strictEqual(engine.repeat.subState, REPEAT_RUNNING_BREAK);
    assert.strictEqual(engine.repeat.currentSeconds, 1);

    // Set 1: Break (1s)
    engine.tick(); // 0s -> Transition to Work 2
    assert.strictEqual(engine.repeat.subState, REPEAT_RUNNING_WORK);
    assert.strictEqual(engine.repeat.currentSet, 2);
    assert.strictEqual(engine.repeat.currentSeconds, 2);

    // Set 2: Work (2s)
    engine.tick();
    engine.tick(); // Transition to Break 2
    assert.strictEqual(engine.repeat.subState, REPEAT_RUNNING_BREAK);
    assert.strictEqual(engine.repeat.currentSeconds, 1);

    // Set 2: Break (1s)
    engine.tick(); // Transition to Work 3
    assert.strictEqual(engine.repeat.subState, REPEAT_RUNNING_WORK);
    assert.strictEqual(engine.repeat.currentSet, 3);
    assert.strictEqual(engine.repeat.currentSeconds, 2);

    // Set 3: Work (2s - Final set)
    engine.tick();
    assert.strictEqual(completed, false);
    engine.tick(); // Complete!

    // Verify final state
    assert.strictEqual(completed, true, 'Final work interval completion must trigger time-up');
    assert.strictEqual(engine.isAlarming, true);
    assert.strictEqual(engine.isRunning, false);

    // Verify transitions pattern: Work1 -> Break1 -> Work2 -> Break2 -> Work3 (End)
    assert.deepStrictEqual(transitionLog, [
      { type: 'to_break', set: 1 },
      { type: 'to_work', set: 2 },
      { type: 'to_break', set: 2 },
      { type: 'to_work', set: 3 },
    ]);
  });
});
