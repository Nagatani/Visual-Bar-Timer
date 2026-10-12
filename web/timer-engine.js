// TimerEngine - Core State Machine & Calculation Engine for Visual Bar Timer
// Universal module: compatible with Browser globalThis and Node.js (CommonJS / tests)

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TimerEngine = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const MAX_SECONDS = 99 * 60 + 59; // 99:59 = 5999 seconds
  const TOTAL_BARS = 20;

  const MODE_NORMAL = 'normal';
  const MODE_REPEAT = 'repeat';

  const REPEAT_SET_WORK = 'set_work';
  const REPEAT_SET_BREAK = 'set_break';
  const REPEAT_SET_COUNT = 'set_count';
  const REPEAT_RUNNING_WORK = 'running_work';
  const REPEAT_RUNNING_BREAK = 'running_break';

  // Format MM:SS helper
  function formatTime(totalSeconds) {
    const s = Math.max(0, Math.min(MAX_SECONDS, Math.floor(totalSeconds || 0)));
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return {
      minutes: String(mins).padStart(2, '0'),
      seconds: String(secs).padStart(2, '0'),
      formatted: `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    };
  }

  // Calculate active segments count (0 to 20)
  function calculateBars(mode, currentSeconds, targetSeconds) {
    if (mode === MODE_NORMAL && (!targetSeconds || targetSeconds === 0)) {
      // Count-up mode: 1 bar per 300s (5 minutes), up to 20 bars
      return Math.min(TOTAL_BARS, Math.floor((currentSeconds || 0) / 300));
    }
    // Countdown mode
    if (!currentSeconds || currentSeconds <= 0 || !targetSeconds || targetSeconds <= 0) {
      return 0;
    }
    const ratio = currentSeconds / targetSeconds;
    return Math.min(TOTAL_BARS, Math.max(1, Math.ceil(ratio * TOTAL_BARS)));
  }

  class TimerEngine {
    constructor(callbacks = {}) {
      this.callbacks = {
        onTick: callbacks.onTick || (() => {}),
        onTimeUp: callbacks.onTimeUp || (() => {}),
        onIntervalTransition: callbacks.onIntervalTransition || (() => {}),
        onStateChange: callbacks.onStateChange || (() => {}),
      };

      this.mode = MODE_NORMAL;
      this.isRunning = false;
      this.isAlarming = false;
      this.timerInterval = null;

      // Normal mode state
      this.normal = {
        isCountUp: false,
        targetSeconds: 0,
        currentSeconds: 0,
      };

      // Repeat mode state (Pomodoro)
      this.repeat = {
        subState: REPEAT_SET_WORK,
        workDuration: 25 * 60, // 25 min default
        breakDuration: 5 * 60,  // 5 min default
        totalSets: 4,          // 4 sets default
        currentSet: 1,
        currentSeconds: 25 * 60,
      };
    }

    // Get active bars count
    getActiveBars() {
      if (this.mode === MODE_NORMAL) {
        if (this.normal.isCountUp) {
          return calculateBars(MODE_NORMAL, this.normal.currentSeconds, 0);
        }
        return calculateBars(MODE_NORMAL, this.normal.currentSeconds, this.normal.targetSeconds);
      }
      // Repeat mode
      if (this.repeat.subState === REPEAT_SET_WORK || this.repeat.subState === REPEAT_SET_BREAK) {
        return TOTAL_BARS;
      }
      if (this.repeat.subState === REPEAT_SET_COUNT) {
        return Math.min(TOTAL_BARS, this.repeat.totalSets * 2);
      }
      const max = this.repeat.subState === REPEAT_RUNNING_WORK
        ? this.repeat.workDuration
        : this.repeat.breakDuration;
      return calculateBars(MODE_REPEAT, this.repeat.currentSeconds, max);
    }

    // Get current display digits
    getDisplayTime() {
      if (this.mode === MODE_NORMAL) {
        return formatTime(this.normal.currentSeconds);
      }
      if (this.repeat.subState === REPEAT_SET_WORK) {
        return formatTime(this.repeat.workDuration);
      }
      if (this.repeat.subState === REPEAT_SET_BREAK) {
        return formatTime(this.repeat.breakDuration);
      }
      if (this.repeat.subState === REPEAT_SET_COUNT) {
        return {
          minutes: 'SE',
          seconds: String(this.repeat.totalSets).padStart(2, '0'),
          formatted: `SE:${String(this.repeat.totalSets).padStart(2, '0')}`
        };
      }
      return formatTime(this.repeat.currentSeconds);
    }

    // Add time (+10m, +1m, +10s)
    addTime(secondsToAdd) {
      if (this.isRunning || this.isAlarming) return false;

      if (this.mode === MODE_NORMAL) {
        this.normal.isCountUp = false;
        this.normal.targetSeconds = Math.min(MAX_SECONDS, this.normal.targetSeconds + secondsToAdd);
        this.normal.currentSeconds = this.normal.targetSeconds;
      } else if (this.mode === MODE_REPEAT) {
        if (this.repeat.subState === REPEAT_SET_WORK) {
          this.repeat.workDuration = Math.min(MAX_SECONDS, this.repeat.workDuration + secondsToAdd);
          this.repeat.currentSeconds = this.repeat.workDuration;
        } else if (this.repeat.subState === REPEAT_SET_BREAK) {
          this.repeat.breakDuration = Math.min(MAX_SECONDS, this.repeat.breakDuration + secondsToAdd);
          this.repeat.currentSeconds = this.repeat.breakDuration;
        } else if (this.repeat.subState === REPEAT_SET_COUNT) {
          this.repeat.totalSets = (this.repeat.totalSets % 20) + 1;
        }
      }
      this.callbacks.onStateChange(this);
      return true;
    }

    // Mode Toggle
    toggleMode() {
      if (this.isRunning) this.pause();
      this.stopAlarm();

      this.mode = this.mode === MODE_NORMAL ? MODE_REPEAT : MODE_NORMAL;

      if (this.mode === MODE_REPEAT) {
        this.repeat.subState = REPEAT_SET_WORK;
        this.repeat.currentSet = 1;
        this.repeat.currentSeconds = this.repeat.workDuration;
      } else {
        this.normal.targetSeconds = 0;
        this.normal.currentSeconds = 0;
        this.normal.isCountUp = false;
      }

      this.callbacks.onStateChange(this);
      return this.mode;
    }

    // Advance Repeat Mode Setup (Work -> Break -> Count -> Run)
    advanceRepeatSetup() {
      if (this.repeat.subState === REPEAT_SET_WORK) {
        this.repeat.subState = REPEAT_SET_BREAK;
      } else if (this.repeat.subState === REPEAT_SET_BREAK) {
        this.repeat.subState = REPEAT_SET_COUNT;
      } else if (this.repeat.subState === REPEAT_SET_COUNT) {
        this.repeat.subState = REPEAT_RUNNING_WORK;
        this.repeat.currentSet = 1;
        this.repeat.currentSeconds = this.repeat.workDuration;
        this.start();
      }
      this.callbacks.onStateChange(this);
    }

    // Start Timer
    start() {
      if (this.isRunning) return;

      if (this.mode === MODE_NORMAL) {
        if (this.normal.targetSeconds === 0) {
          // Count-up
          this.normal.isCountUp = true;
          this.normal.currentSeconds = 0;
        } else {
          // Count-down
          this.normal.isCountUp = false;
          if (this.normal.currentSeconds === 0) {
            this.normal.currentSeconds = this.normal.targetSeconds;
          }
        }
      } else if (this.mode === MODE_REPEAT) {
        if (this.repeat.subState === REPEAT_SET_WORK ||
            this.repeat.subState === REPEAT_SET_BREAK ||
            this.repeat.subState === REPEAT_SET_COUNT) {
          this.advanceRepeatSetup();
          return;
        }
      }

      this.isRunning = true;
      this.stopAlarm();
      this.callbacks.onStateChange(this);

      // In browser/realtime mode
      if (typeof setInterval !== 'undefined') {
        if (this.timerInterval) clearInterval(this.timerInterval);
        this.timerInterval = setInterval(() => this.tick(), 1000);
        if (this.timerInterval && typeof this.timerInterval.unref === 'function') {
          this.timerInterval.unref();
        }
      }
    }

    // Pause Timer
    pause() {
      if (!this.isRunning) return;
      this.isRunning = false;
      if (this.timerInterval) {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
      }
      this.callbacks.onStateChange(this);
    }

    // Toggle Start / Stop
    toggleStartStop() {
      if (this.isAlarming) {
        this.stopAlarm();
        return 'alarm_stopped';
      }
      if (this.mode === MODE_REPEAT &&
         (this.repeat.subState === REPEAT_SET_WORK ||
          this.repeat.subState === REPEAT_SET_BREAK ||
          this.repeat.subState === REPEAT_SET_COUNT)) {
        this.advanceRepeatSetup();
        return 'setup_advanced';
      }
      if (this.isRunning) {
        this.pause();
        return 'paused';
      } else {
        this.start();
        return 'started';
      }
    }

    // Reset Timer
    reset() {
      this.stopAlarm();
      if (this.isRunning) this.pause();

      if (this.mode === MODE_NORMAL) {
        this.normal.targetSeconds = 0;
        this.normal.currentSeconds = 0;
        this.normal.isCountUp = false;
      } else if (this.mode === MODE_REPEAT) {
        this.repeat.subState = REPEAT_SET_WORK;
        this.repeat.currentSet = 1;
        this.repeat.currentSeconds = this.repeat.workDuration;
      }

      this.callbacks.onStateChange(this);
    }

    // Trigger Time Up
    triggerTimeUp() {
      this.pause();
      this.isAlarming = true;
      this.callbacks.onTimeUp(this);
      this.callbacks.onStateChange(this);
    }

    // Stop Alarm
    stopAlarm() {
      if (this.isAlarming) {
        this.isAlarming = false;
        this.callbacks.onStateChange(this);
        return true;
      }
      return false;
    }

    // Timer Tick (1-second step)
    tick() {
      if (!this.isRunning) return;

      if (this.mode === MODE_NORMAL) {
        if (this.normal.isCountUp) {
          this.normal.currentSeconds++;
          if (this.normal.currentSeconds >= MAX_SECONDS) {
            this.triggerTimeUp();
          }
        } else {
          if (this.normal.currentSeconds > 0) {
            this.normal.currentSeconds--;
            if (this.normal.currentSeconds === 0) {
              this.triggerTimeUp();
            }
          }
        }
      } else if (this.mode === MODE_REPEAT) {
        if (this.repeat.currentSeconds > 0) {
          this.repeat.currentSeconds--;
        }

        if (this.repeat.currentSeconds === 0) {
          if (this.repeat.subState === REPEAT_RUNNING_WORK) {
            // Work finished
            if (this.repeat.currentSet >= this.repeat.totalSets) {
              // Final work completed!
              this.triggerTimeUp();
            } else {
              // Transition to break
              this.repeat.subState = REPEAT_RUNNING_BREAK;
              this.repeat.currentSeconds = this.repeat.breakDuration;
              this.callbacks.onIntervalTransition('to_break', this);
            }
          } else if (this.repeat.subState === REPEAT_RUNNING_BREAK) {
            // Break finished -> transition to next work
            this.repeat.currentSet++;
            this.repeat.subState = REPEAT_RUNNING_WORK;
            this.repeat.currentSeconds = this.repeat.workDuration;
            this.callbacks.onIntervalTransition('to_work', this);
          }
        }
      }

      this.callbacks.onTick(this);
      this.callbacks.onStateChange(this);
    }

    // Apply Presets
    applyPreset(type) {
      if (this.isRunning) this.pause();
      this.stopAlarm();

      if (type === 'pomodoro') {
        this.mode = MODE_REPEAT;
        this.repeat.workDuration = 25 * 60;
        this.repeat.breakDuration = 5 * 60;
        this.repeat.totalSets = 4;
        this.repeat.currentSet = 1;
        this.repeat.subState = REPEAT_RUNNING_WORK;
        this.repeat.currentSeconds = 25 * 60;
        this.start();
      } else if (type === 'pomodoro50') {
        this.mode = MODE_REPEAT;
        this.repeat.workDuration = 50 * 60;
        this.repeat.breakDuration = 10 * 60;
        this.repeat.totalSets = 2;
        this.repeat.currentSet = 1;
        this.repeat.subState = REPEAT_RUNNING_WORK;
        this.repeat.currentSeconds = 50 * 60;
        this.start();
      } else {
        this.mode = MODE_NORMAL;
        this.normal.isCountUp = false;
        const minutes = parseInt(type.replace('m', ''), 10) || 5;
        this.normal.targetSeconds = minutes * 60;
        this.normal.currentSeconds = minutes * 60;
      }

      this.callbacks.onStateChange(this);
    }
  }

  return {
    MAX_SECONDS,
    TOTAL_BARS,
    MODE_NORMAL,
    MODE_REPEAT,
    REPEAT_SET_WORK,
    REPEAT_SET_BREAK,
    REPEAT_SET_COUNT,
    REPEAT_RUNNING_WORK,
    REPEAT_RUNNING_BREAK,
    formatTime,
    calculateBars,
    TimerEngine,
  };
});
