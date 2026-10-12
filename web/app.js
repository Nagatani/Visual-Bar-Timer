// Visual Bar Timer - Core Pure JS Application Logic

(function() {
  'use strict';

  // Constants
  const MAX_SECONDS = 99 * 60 + 59; // 99:59
  const TOTAL_BARS = 20;

  // App Modes
  const MODE_NORMAL = 'normal';
  const MODE_REPEAT = 'repeat';

  // Repeat sub-states
  const REPEAT_SET_WORK = 'set_work';
  const REPEAT_SET_BREAK = 'set_break';
  const REPEAT_SET_COUNT = 'set_count';
  const REPEAT_RUNNING_WORK = 'running_work';
  const REPEAT_RUNNING_BREAK = 'running_break';

  // State
  const state = {
    mode: MODE_NORMAL, // normal | repeat
    isRunning: false,
    isAlarming: false,
    theme: 'white', // white | black
    isVertical: false,
    isCompact: false,
    isAlwaysOnTop: false,

    // Normal mode timer
    normal: {
      isCountUp: false,
      targetSeconds: 0,
      currentSeconds: 0,
      initialCountdownSeconds: 0,
    },

    // Repeat mode timer (Pomodoro / Interval)
    repeat: {
      subState: REPEAT_SET_WORK,
      workDuration: 25 * 60, // 25:00
      breakDuration: 5 * 60,  // 05:00
      totalSets: 4,
      currentSet: 1,
      currentSeconds: 25 * 60,
    },

    timerInterval: null,
  };

  // DOM Elements
  const dom = {
    body: document.body,
    barTrack: document.getElementById('barTrack'),
    deviceUnit: document.getElementById('deviceUnit'),
    lcdScreen: document.getElementById('lcdScreen'),
    lcdDigits: document.getElementById('lcdDigits'),
    digitMinutes: document.getElementById('digitMinutes'),
    digitSeconds: document.getElementById('digitSeconds'),
    startStopText: document.getElementById('startStopText'),
    repeatStepInfo: document.getElementById('repeatStepInfo'),
    currentSetNum: document.getElementById('currentSetNum'),
    totalSetNum: document.getElementById('totalSetNum'),

    // Indicators
    indCd: document.getElementById('indCd'),
    indCu: document.getElementById('indCu'),
    indRepeat: document.getElementById('indRepeat'),
    indWork: document.getElementById('indWork'),
    indRest: document.getElementById('indRest'),
    indMute: document.getElementById('indMute'),

    // Buttons
    btnMode: document.getElementById('btnMode'),
    btnPlus10M: document.getElementById('btnPlus10M'),
    btnPlus1M: document.getElementById('btnPlus1M'),
    btnPlus10S: document.getElementById('btnPlus10S'),
    btnStartStop: document.getElementById('btnStartStop'),
    btnReset: document.getElementById('btnReset'),
    soundToggle: document.getElementById('soundToggle'),

    // Desktop & Header controls
    pinTopBtn: document.getElementById('pinTopBtn'),
    pinIcon: document.getElementById('pinIcon'),
    compactModeBtn: document.getElementById('compactModeBtn'),
    orientationBtn: document.getElementById('orientationBtn'),
    themeToggleBtn: document.getElementById('themeToggleBtn'),
    themeLabel: document.getElementById('themeLabel'),
    quickPanel: document.getElementById('quickPanel'),
  };

  // Generate 20 Bar Segments
  function initBarSegments() {
    dom.barTrack.innerHTML = '';
    for (let i = 0; i < TOTAL_BARS; i++) {
      const seg = document.createElement('div');
      seg.className = 'bar-segment';
      seg.dataset.index = i;
      dom.barTrack.appendChild(seg);
    }
  }

  // Format MM:SS
  function formatTime(totalSeconds) {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return {
      minutes: String(mins).padStart(2, '0'),
      seconds: String(secs).padStart(2, '0')
    };
  }

  // Update LCD Bar Display (0 to 20 segments)
  function renderBars(activeCount) {
    const count = Math.max(0, Math.min(TOTAL_BARS, Math.round(activeCount)));
    const segments = dom.barTrack.children;
    for (let i = 0; i < TOTAL_BARS; i++) {
      if (i < count) {
        segments[i].classList.add('active');
      } else {
        segments[i].classList.remove('active');
      }
    }
  }

  // Update LCD Indicators
  function updateIndicators() {
    const isNormal = state.mode === MODE_NORMAL;
    const isRepeat = state.mode === MODE_REPEAT;

    dom.indCd.classList.toggle('active', isNormal && (!state.normal.isCountUp && state.normal.targetSeconds > 0));
    dom.indCu.classList.toggle('active', isNormal && state.normal.isCountUp);
    dom.indRepeat.classList.toggle('active', isRepeat);

    if (isRepeat) {
      const isWork = state.repeat.subState === REPEAT_SET_WORK || state.repeat.subState === REPEAT_RUNNING_WORK;
      const isRest = state.repeat.subState === REPEAT_SET_BREAK || state.repeat.subState === REPEAT_RUNNING_BREAK;
      dom.indWork.classList.toggle('active', isWork);
      dom.indRest.classList.toggle('active', isRest);
      dom.lcdScreen.classList.toggle('mode-break', isRest);
      dom.repeatStepInfo.style.visibility = 'visible';
      dom.currentSetNum.textContent = state.repeat.currentSet;
      dom.totalSetNum.textContent = state.repeat.totalSets;
    } else {
      dom.indWork.classList.remove('active');
      dom.indRest.classList.remove('active');
      dom.lcdScreen.classList.remove('mode-break');
      dom.repeatStepInfo.style.visibility = 'hidden';
    }

    dom.indMute.classList.toggle('active', window.timerAudio.isMuted);
  }

  // Render Full Display UI
  function renderDisplay() {
    updateIndicators();

    // Digits & Bars calculation
    if (state.mode === MODE_NORMAL) {
      const time = formatTime(state.normal.currentSeconds);
      dom.digitMinutes.textContent = time.minutes;
      dom.digitSeconds.textContent = time.seconds;

      if (state.normal.isCountUp) {
        // Count up: 1 bar per 5 minutes (300 sec), max 20 bars (100 min)
        const bars = Math.floor(state.normal.currentSeconds / 300);
        renderBars(bars);
      } else {
        // Count down
        if (state.normal.targetSeconds === 0) {
          renderBars(0);
        } else {
          const ratio = state.normal.currentSeconds / state.normal.targetSeconds;
          // Ceil to ensure at least 1 bar visible until 00:00
          const bars = state.normal.currentSeconds > 0 ? Math.ceil(ratio * TOTAL_BARS) : 0;
          renderBars(bars);
        }
      }

      if (state.isRunning) {
        dom.lcdDigits.className = 'lcd-digits-display';
      } else {
        dom.lcdDigits.className = state.normal.targetSeconds > 0 ? 'lcd-digits-display paused' : 'lcd-digits-display setting';
      }

    } else if (state.mode === MODE_REPEAT) {
      if (state.repeat.subState === REPEAT_SET_WORK) {
        const time = formatTime(state.repeat.workDuration);
        dom.digitMinutes.textContent = time.minutes;
        dom.digitSeconds.textContent = time.seconds;
        renderBars(TOTAL_BARS);
        dom.lcdDigits.className = 'lcd-digits-display setting';
      } else if (state.repeat.subState === REPEAT_SET_BREAK) {
        const time = formatTime(state.repeat.breakDuration);
        dom.digitMinutes.textContent = time.minutes;
        dom.digitSeconds.textContent = time.seconds;
        renderBars(TOTAL_BARS);
        dom.lcdDigits.className = 'lcd-digits-display setting';
      } else if (state.repeat.subState === REPEAT_SET_COUNT) {
        dom.digitMinutes.textContent = 'SE';
        dom.digitSeconds.textContent = String(state.repeat.totalSets).padStart(2, '0');
        renderBars(Math.min(TOTAL_BARS, state.repeat.totalSets * 2));
        dom.lcdDigits.className = 'lcd-digits-display setting';
      } else {
        // Running
        const time = formatTime(state.repeat.currentSeconds);
        dom.digitMinutes.textContent = time.minutes;
        dom.digitSeconds.textContent = time.seconds;

        const maxDuration = state.repeat.subState === REPEAT_RUNNING_WORK
          ? state.repeat.workDuration
          : state.repeat.breakDuration;

        const ratio = maxDuration > 0 ? (state.repeat.currentSeconds / maxDuration) : 0;
        const bars = state.repeat.currentSeconds > 0 ? Math.ceil(ratio * TOTAL_BARS) : 0;
        renderBars(bars);

        dom.lcdDigits.className = state.isRunning ? 'lcd-digits-display' : 'lcd-digits-display paused';
      }
    }

    // Update Start/Stop button appearance
    if (state.isAlarming) {
      dom.startStopText.textContent = 'STOP';
      dom.btnStartStop.classList.add('running');
    } else if (state.isRunning) {
      dom.startStopText.textContent = 'STOP';
      dom.btnStartStop.classList.add('running');
    } else {
      if (state.mode === MODE_REPEAT &&
         (state.repeat.subState === REPEAT_SET_WORK ||
          state.repeat.subState === REPEAT_SET_BREAK ||
          state.repeat.subState === REPEAT_SET_COUNT)) {
        dom.startStopText.textContent = 'SET';
      } else {
        dom.startStopText.textContent = 'START';
      }
      dom.btnStartStop.classList.remove('running');
    }
  }

  // Timer Tick (Every 1000ms)
  function tick() {
    if (!state.isRunning) return;

    if (state.mode === MODE_NORMAL) {
      if (state.normal.isCountUp) {
        // Count Up
        state.normal.currentSeconds++;
        if (state.normal.currentSeconds >= MAX_SECONDS) {
          triggerTimeUp();
        }
      } else {
        // Count Down
        if (state.normal.currentSeconds > 0) {
          state.normal.currentSeconds--;
          if (state.normal.currentSeconds === 0) {
            triggerTimeUp();
          }
        }
      }
    } else if (state.mode === MODE_REPEAT) {
      if (state.repeat.currentSeconds > 0) {
        state.repeat.currentSeconds--;
      }

      if (state.repeat.currentSeconds === 0) {
        // Step finished
        if (state.repeat.subState === REPEAT_RUNNING_WORK) {
          // Finished Work interval
          if (state.repeat.currentSet >= state.repeat.totalSets) {
            // Final work interval finished -> All sets complete!
            triggerTimeUp();
          } else {
            // Transition to Break
            window.timerAudio.intervalTransition();
            state.repeat.subState = REPEAT_RUNNING_BREAK;
            state.repeat.currentSeconds = state.repeat.breakDuration;
            flashScreen(3);
          }
        } else if (state.repeat.subState === REPEAT_RUNNING_BREAK) {
          // Finished Break interval -> Transition to next Work interval
          window.timerAudio.intervalTransition();
          state.repeat.currentSet++;
          state.repeat.subState = REPEAT_RUNNING_WORK;
          state.repeat.currentSeconds = state.repeat.workDuration;
          flashScreen(3);
        }
      }
    }

    renderDisplay();
  }

  // Visual screen flash helper (for transitions & silent alerts)
  function flashScreen(times = 1) {
    let count = 0;
    const interval = setInterval(() => {
      dom.lcdScreen.classList.toggle('alarm-flash');
      count++;
      if (count >= times * 2) {
        clearInterval(interval);
        if (!state.isAlarming) {
          dom.lcdScreen.classList.remove('alarm-flash');
        }
      }
    }, 150);
  }

  // Trigger Time Up Alarm
  function triggerTimeUp() {
    state.isRunning = false;
    clearInterval(state.timerInterval);
    state.timerInterval = null;
    state.isAlarming = true;

    dom.lcdScreen.classList.add('alarm-flash');
    window.timerAudio.startAlarm(() => {
      dom.lcdScreen.classList.toggle('alarm-flash');
    });

    renderDisplay();
  }

  // Stop Alarm
  function stopAlarm() {
    if (state.isAlarming) {
      state.isAlarming = false;
      window.timerAudio.stopAlarm();
      dom.lcdScreen.classList.remove('alarm-flash');
      renderDisplay();
      return true;
    }
    return false;
  }

  // Start Timer
  function startTimer() {
    if (state.isRunning) return;

    if (state.mode === MODE_NORMAL) {
      if (state.normal.targetSeconds === 0) {
        // Start Count-up
        state.normal.isCountUp = true;
        state.normal.currentSeconds = 0;
      } else {
        // Start Count-down
        state.normal.isCountUp = false;
        if (state.normal.currentSeconds === 0) {
          state.normal.currentSeconds = state.normal.targetSeconds;
        }
      }
    } else if (state.mode === MODE_REPEAT) {
      if (state.repeat.subState === REPEAT_SET_WORK ||
          state.repeat.subState === REPEAT_SET_BREAK ||
          state.repeat.subState === REPEAT_SET_COUNT) {
        // If still in setup steps, advance or start
        advanceRepeatSetup();
        return;
      }
    }

    state.isRunning = true;
    window.timerAudio.actionTrigger();
    state.timerInterval = setInterval(tick, 1000);
    renderDisplay();
  }

  // Pause Timer
  function pauseTimer() {
    if (!state.isRunning) return;
    state.isRunning = false;
    if (state.timerInterval) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
    }
    window.timerAudio.buttonClick();
    renderDisplay();
  }

  // Toggle Start / Stop / Set
  function handleStartStop() {
    if (stopAlarm()) return;

    if (state.mode === MODE_REPEAT &&
       (state.repeat.subState === REPEAT_SET_WORK ||
        state.repeat.subState === REPEAT_SET_BREAK ||
        state.repeat.subState === REPEAT_SET_COUNT)) {
      advanceRepeatSetup();
      return;
    }

    if (state.isRunning) {
      pauseTimer();
    } else {
      startTimer();
    }
  }

  // Advance Repeat Mode Setup (Work -> Break -> Count -> Run)
  function advanceRepeatSetup() {
    window.timerAudio.buttonTick();
    if (state.repeat.subState === REPEAT_SET_WORK) {
      state.repeat.subState = REPEAT_SET_BREAK;
    } else if (state.repeat.subState === REPEAT_SET_BREAK) {
      state.repeat.subState = REPEAT_SET_COUNT;
    } else if (state.repeat.subState === REPEAT_SET_COUNT) {
      // Ready to start!
      state.repeat.subState = REPEAT_RUNNING_WORK;
      state.repeat.currentSet = 1;
      state.repeat.currentSeconds = state.repeat.workDuration;
      startTimer();
    }
    renderDisplay();
  }

  // Reset Timer
  function resetTimer() {
    stopAlarm();
    window.timerAudio.buttonClick();

    if (state.isRunning) {
      pauseTimer();
    }

    if (state.mode === MODE_NORMAL) {
      state.normal.targetSeconds = 0;
      state.normal.currentSeconds = 0;
      state.normal.isCountUp = false;
    } else if (state.mode === MODE_REPEAT) {
      state.repeat.subState = REPEAT_SET_WORK;
      state.repeat.currentSet = 1;
      state.repeat.currentSeconds = state.repeat.workDuration;
    }

    renderDisplay();
  }

  // Time Increment buttons (+10m, +1m, +10s)
  function addTime(secondsToAdd) {
    if (state.isRunning || state.isAlarming) return;
    window.timerAudio.buttonTick();

    if (state.mode === MODE_NORMAL) {
      state.normal.isCountUp = false;
      state.normal.targetSeconds = Math.min(MAX_SECONDS, state.normal.targetSeconds + secondsToAdd);
      state.normal.currentSeconds = state.normal.targetSeconds;
    } else if (state.mode === MODE_REPEAT) {
      if (state.repeat.subState === REPEAT_SET_WORK) {
        state.repeat.workDuration = Math.min(MAX_SECONDS, state.repeat.workDuration + secondsToAdd);
        state.repeat.currentSeconds = state.repeat.workDuration;
      } else if (state.repeat.subState === REPEAT_SET_BREAK) {
        state.repeat.breakDuration = Math.min(MAX_SECONDS, state.repeat.breakDuration + secondsToAdd);
        state.repeat.currentSeconds = state.repeat.breakDuration;
      } else if (state.repeat.subState === REPEAT_SET_COUNT) {
        // In repeat count step, increment sets count
        state.repeat.totalSets = (state.repeat.totalSets % 20) + 1;
      }
    }

    renderDisplay();
  }

  // Mode button toggle (Normal <-> Repeat)
  function toggleMode() {
    if (state.isRunning) {
      pauseTimer();
    }
    stopAlarm();
    window.timerAudio.modeChange();

    state.mode = state.mode === MODE_NORMAL ? MODE_REPEAT : MODE_NORMAL;

    if (state.mode === MODE_REPEAT) {
      state.repeat.subState = REPEAT_SET_WORK;
      state.repeat.currentSet = 1;
      state.repeat.currentSeconds = state.repeat.workDuration;
    } else {
      state.normal.targetSeconds = 0;
      state.normal.currentSeconds = 0;
      state.normal.isCountUp = false;
    }

    renderDisplay();
  }

  // Sound Mute Toggle
  function toggleSound() {
    const isMuted = window.timerAudio.toggleMute();
    dom.soundToggle.classList.toggle('on', !isMuted);
    renderDisplay();
  }

  // Theme Switch (White / Black theme)
  function toggleTheme() {
    state.theme = state.theme === 'white' ? 'black' : 'white';
    dom.body.setAttribute('data-theme', state.theme);
    dom.themeLabel.textContent = state.theme === 'white' ? '⬛ 黒テーマ' : '⬜ 白テーマ';
    window.timerAudio.buttonTick();
  }

  // Orientation Toggle (Horizontal / Vertical bar)
  function toggleOrientation() {
    state.isVertical = !state.isVertical;
    dom.deviceUnit.classList.toggle('vertical-mode', state.isVertical);
    window.timerAudio.buttonTick();
  }

  // Compact Mini Floating Bar Mode
  function toggleCompactMode() {
    state.isCompact = !state.isCompact;
    dom.body.classList.toggle('compact-mode', state.isCompact);
    window.timerAudio.buttonTick();

    // If running in Tauri, also adapt desktop window size!
    if (window.tauriDesktop) {
      window.tauriDesktop.setCompactWindow(state.isCompact);
    }
  }

  // Apply Presets
  function applyPreset(type) {
    if (state.isRunning) pauseTimer();
    stopAlarm();
    window.timerAudio.buttonClick();

    if (type === 'pomodoro') {
      state.mode = MODE_REPEAT;
      state.repeat.workDuration = 25 * 60;
      state.repeat.breakDuration = 5 * 60;
      state.repeat.totalSets = 4;
      state.repeat.currentSet = 1;
      state.repeat.subState = REPEAT_RUNNING_WORK;
      state.repeat.currentSeconds = 25 * 60;
      startTimer();
    } else if (type === 'pomodoro50') {
      state.mode = MODE_REPEAT;
      state.repeat.workDuration = 50 * 60;
      state.repeat.breakDuration = 10 * 60;
      state.repeat.totalSets = 2;
      state.repeat.currentSet = 1;
      state.repeat.subState = REPEAT_RUNNING_WORK;
      state.repeat.currentSeconds = 50 * 60;
      startTimer();
    } else {
      state.mode = MODE_NORMAL;
      state.normal.isCountUp = false;
      const minutes = parseInt(type.replace('m', ''), 10) || 5;
      state.normal.targetSeconds = minutes * 60;
      state.normal.currentSeconds = minutes * 60;
      renderDisplay();
    }
  }

  // =========================================================================
  // TAURI DESKTOP INTEGRATION BRIDGE
  // =========================================================================
  async function initTauriIntegration() {
    try {
      const tauri = window.__TAURI__;
      const tauriInternals = window.__TAURI_INTERNALS__;
      const isTauriEnv = Boolean(tauri || tauriInternals);

      if (!isTauriEnv) {
        // Plain browser fallback
        dom.pinTopBtn.title = "最前面表示 (Tauriデスクトップアプリ版で利用可能)";
        dom.pinTopBtn.addEventListener('click', () => {
          alert('「最前面表示」はTauriデスクトップアプリ版の機能です。デスクトップ版で起動すると常時最前面固定が有効になります。');
        });
        return;
      }

      console.log('Tauri environment detected.');

      // Helper to invoke Rust command
      const invoke = async (cmd, args = {}) => {
        if (tauri && tauri.core && typeof tauri.core.invoke === 'function') {
          return await tauri.core.invoke(cmd, args);
        }
        if (tauriInternals && typeof tauriInternals.invoke === 'function') {
          return await tauriInternals.invoke(cmd, args);
        }
        throw new Error('Tauri invoke API not available');
      };

      window.tauriDesktop = {
        async toggleAlwaysOnTop() {
          try {
            state.isAlwaysOnTop = !state.isAlwaysOnTop;
            try {
              await invoke('set_always_on_top', { alwaysOnTop: state.isAlwaysOnTop });
            } catch (e) {
              if (tauri && tauri.window) {
                const current = tauri.window.getCurrentWindow();
                await current.setAlwaysOnTop(state.isAlwaysOnTop);
              }
            }
            dom.pinTopBtn.classList.toggle('active', state.isAlwaysOnTop);
            dom.pinIcon.textContent = state.isAlwaysOnTop ? '📌' : '📍';
          } catch (err) {
            console.error('Failed to set always on top:', err);
          }
        },
        async setCompactWindow(compact) {
          try {
            try {
              await invoke('set_compact_size', { compact });
            } catch (e) {
              if (tauri && tauri.window) {
                const current = tauri.window.getCurrentWindow();
                if (compact) {
                  await current.setSize(new tauri.window.LogicalSize(660, 160));
                } else {
                  await current.setSize(new tauri.window.LogicalSize(940, 520));
                }
              }
            }
          } catch (err) {
            console.error('Failed to set compact size:', err);
          }
        }
      };

      dom.pinTopBtn.addEventListener('click', () => {
        window.tauriDesktop.toggleAlwaysOnTop();
      });

    } catch (err) {
      console.warn('Tauri initialization failed:', err);
    }
  }

  // Event Listeners setup
  function setupEventListeners() {
    // Hardware button clicks
    dom.btnStartStop.addEventListener('click', handleStartStop);
    dom.btnReset.addEventListener('click', resetTimer);
    dom.btnMode.addEventListener('click', toggleMode);
    dom.btnPlus10M.addEventListener('click', () => addTime(10 * 60));
    dom.btnPlus1M.addEventListener('click', () => addTime(1 * 60));
    dom.btnPlus10S.addEventListener('click', () => addTime(10));
    dom.soundToggle.addEventListener('click', toggleSound);

    // Header actions
    dom.themeToggleBtn.addEventListener('click', toggleTheme);
    dom.orientationBtn.addEventListener('click', toggleOrientation);
    dom.compactModeBtn.addEventListener('click', toggleCompactMode);

    // Preset buttons
    document.querySelectorAll('.preset-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        applyPreset(chip.dataset.preset);
      });
    });

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      // Don't trigger if focus is on an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.code === 'Space') {
        e.preventDefault();
        handleStartStop();
      } else if (e.key === 'r' || e.key === 'R') {
        resetTimer();
      } else if (e.key === 'm' || e.key === 'M') {
        toggleMode();
      } else if (e.key === 's' || e.key === 'S') {
        toggleSound();
      } else if (e.key === '1') {
        addTime(10 * 60);
      } else if (e.key === '2') {
        addTime(1 * 60);
      } else if (e.key === '3') {
        addTime(10);
      }
    });
  }

  // Initialize
  function init() {
    initBarSegments();
    setupEventListeners();
    initTauriIntegration();
    renderDisplay();
  }

  // Bootstrap when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
