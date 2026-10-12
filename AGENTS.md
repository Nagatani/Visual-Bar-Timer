# AGENTS.md - Visual Bar Timer Development Guide

This document serves as an exhaustive guide for AI agents (and human developers) working on or extending the **Visual Bar Timer** project.

---

## 1. Project Overview & Philosophy

This application is a 20-segment visual LCD bar timer application for intuitive time perception and interval training.

- **Core Value Proposition**: Time is visualized instantly using **20 physical LCD bar segments**. Instead of solely relying on shifting numbers, users perceive remaining time geometrically at a glance.
- **Architectural Tenet**:
  1. **Web Layer (`web/`)**: **Pure Vanilla JS** with zero build pipelines, zero npm runtime dependencies, and zero framework overhead. Runs directly in any modern browser by opening `web/index.html`.
  2. **Desktop Layer (`src-tauri/`)**: Embedded into **Tauri v2 (Rust)** desktop shell to provide native OS capabilities:
     - Always-on-top window pinning (`setAlwaysOnTop`)
     - Compact floating bar mode (`set_compact_size`)
     - Frameless window dragging

---

## 2. Directory Structure

```
visual-bar-timer/
├── AGENTS.md                    # This developer & agent guide
├── README.md                    # User guide and feature overview
├── package.json                 # Tauri CLI & local serve scripts
│
├── web/                         # Pure Vanilla Web Application (Zero external libraries)
│   ├── index.html               # Semantic HTML markup, LCD indicators, tactile button grid
│   ├── style.css                # Authentic hardware styling, LCD fonts, White/Black themes
│   ├── app.js                   # Application state machine, 20-bar calculations, shortcuts
│   └── audio.js                 # Web Audio API synthesizer for electronic buzzer tones
│
└── src-tauri/                   # Tauri 2.x Rust desktop backend
    ├── Cargo.toml               # Rust dependencies (tauri v2, log)
    ├── tauri.conf.json          # Tauri configuration (window sizes, frontendDist: "../web")
    ├── capabilities/
    │   └── default.json         # Tauri v2 security permissions
    └── src/
        ├── main.rs              # Tauri application entrypoint
        └── lib.rs               # Rust IPC commands (set_always_on_top, set_compact_size)
```

---

## 3. Core Behavioral Specifications

Any agent modifying timer logic must preserve or adhere to the following specifications:

### 3.1 20-Segment Visual Bar Mechanics
- **Total Bar Segments**: Exactly **20** discrete segments (`TOTAL_BARS = 20`).
- **Countdown Mode**:
  - Initial state: All 20 segments are illuminated.
  - Formula: $\text{litSegments} = \lceil (\text{currentSeconds} / \text{targetSeconds}) \times 20 \rceil$.
  - When $\text{currentSeconds} == 0$, $\text{litSegments} = 0$.
- **Count-up Mode** (Started from `00:00`):
  - Initial state: 0 segments illuminated.
  - Formula: $\text{litSegments} = \lfloor \text{currentSeconds} / 300 \rfloor$ (1 bar added every 5 minutes / 300 seconds, up to 20 bars / 100 minutes).

### 3.2 Repeat Mode (Pomodoro / Interval Timer)
- Repeat cycle structure:
  - Step 1: Set **Work Duration** (`workDuration`, default 25:00).
  - Step 2: Set **Break Duration** (`breakDuration`, default 05:00).
  - Step 3: Set **Total Sets** (`totalSets`, default 4 sets).
- **Execution Rule**:
  - A break interval is inserted between work intervals.
  - **The cycle always terminates with the final work interval** ($N$ work sessions, $N-1$ break sessions).
  - Interval transition triggers **3 short electronic chirps** (`intervalTransition()`) and visual screen flashing.
  - Final completion triggers continuous alarm buzzer (`startAlarm()`).

### 3.3 Audio Synthesis (`audio.js`)
- Does **not** require external `.mp3` or `.wav` assets. Everything is generated client-side via the `Web Audio API` (`OscillatorNode` + `GainNode` with exponential ramps).
- **Mute Functionality (消音)**:
  - When muted, audible tones are suppressed.
  - The LCD display triggers an alternate visual flashing animation (`.alarm-flash`) to notify silent users (useful in libraries or quiet workspaces).

### 3.4 Hardware Buttons & Keyboard Shortcuts
- Buttons:
  - `MODE`: Toggle between Normal and Repeat modes.
  - `10分`: +10 minutes.
  - `1分`: +1 minute.
  - `10秒`: +10 seconds.
  - `START / STOP`: Start, pause, or confirm setup.
  - `RESET`: Clears timer to 0 or resets Pomodoro step.
- Global Hotkeys:
  - `Space`: Start / Stop / Acknowledge alarm.
  - `R`: Reset.
  - `M`: Switch mode.
  - `S`: Toggle mute.
  - `1`: +10 min | `2`: +1 min | `3`: +10 sec.

---

## 4. Desktop & Tauri Integration Guidelines

- The web app dynamically probes for Tauri presence:
  ```js
  const isTauri = Boolean(window.__TAURI__ || window.__TAURI_INTERNALS__);
  ```
- **Rust Commands defined in `src-tauri/src/lib.rs`**:
  - `set_always_on_top(always_on_top: bool)`: Window pinning.
  - `set_compact_size(compact: bool)`: Resizes window to `660x160` (mini floating widget) or restores to `940x520`.
- **Permissions**: Tauri v2 requires explicit declarations in `src-tauri/capabilities/default.json`. If you add new window or OS capabilities, declare them there.

---

## 5. Development & Testing Commands

### Running Web Application
```bash
# Option A: Direct static serving
npx serve web -p 3000

# Option B: Any static file server or direct browser open
# file:///D:/github/Visual-Bar-Timer/web/index.html
```

### Tauri Desktop Application
```bash
# Ensure Rust toolchain is active (MSVC recommended on Windows)
rustup default stable-x86_64-pc-windows-msvc

# Run Tauri in dev mode
npm run tauri:dev

# Build production installer / executable
npm run tauri:build
```

---

## 6. Important Guidelines for AI Agents

1. **Keep Web Pure**: Do not install bundling frameworks (Webpack, Vite, Tailwind, React) inside `web/` unless explicitly instructed. Keep HTML, CSS, and JS modular and plain.
2. **Preserve Audio Reliability**: Browsers suspend `AudioContext` until the first user interaction. `ensureContext()` handles resuming on button clicks. Keep this mechanism intact.
3. **Accessibility & Responsive**: Support both desktop widescreen and compact mobile/mini-bar views.
