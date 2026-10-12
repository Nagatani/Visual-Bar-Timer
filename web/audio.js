// Web Audio API Sound Synthesizer for Visual Bar Timer
// Authentic electronic buzzer tones for timer operations.

class TimerAudio {
  constructor() {
    this.audioCtx = null;
    this.isMuted = false;
    this.alarmIntervalId = null;
    this.isAlarming = false;
  }

  ensureContext() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  setMuted(muted) {
    this.isMuted = Boolean(muted);
    if (this.isMuted && this.isAlarming) {
      this.stopAlarm();
    }
  }

  toggleMute() {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  // Play a simple frequency beep
  playTone(frequency, durationMs, type = 'square', volume = 0.15) {
    if (this.isMuted) return;
    try {
      this.ensureContext();
      if (!this.audioCtx) return;

      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(frequency, this.audioCtx.currentTime);

      gain.gain.setValueAtTime(volume, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.audioCtx.currentTime + durationMs / 1000);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start();
      osc.stop(this.audioCtx.currentTime + durationMs / 1000);
    } catch (e) {
      console.warn('Audio playback error:', e);
    }
  }

  // Button click: sharp, short electronic beep
  buttonClick() {
    this.playTone(2400, 35, 'square', 0.12);
  }

  // Setting adjustment tick
  buttonTick() {
    this.playTone(2000, 25, 'sine', 0.1);
  }

  // Mode change beep (slightly lower double tone)
  modeChange() {
    this.playTone(1800, 40, 'square', 0.12);
    setTimeout(() => {
      this.playTone(2200, 50, 'square', 0.12);
    }, 60);
  }

  // Start / Stop confirmation
  actionTrigger() {
    this.playTone(2600, 50, 'square', 0.15);
  }

  // Interval transition beep: 3 short chirps (used when switching between Work and Break)
  intervalTransition() {
    if (this.isMuted) return;
    const playChirp = (idx) => {
      setTimeout(() => {
        this.playTone(2500, 70, 'square', 0.2);
      }, idx * 140);
    };
    playChirp(0);
    playChirp(1);
    playChirp(2);
  }

  // Time-up Alarm loop ("pip-pip-pip-pip")
  startAlarm(onTickCallback) {
    this.stopAlarm();
    this.isAlarming = true;

    const playBeepCycle = () => {
      if (!this.isAlarming) return;
      if (!this.isMuted) {
        this.playTone(2800, 90, 'square', 0.25);
        setTimeout(() => {
          if (this.isAlarming && !this.isMuted) this.playTone(2800, 90, 'square', 0.25);
        }, 130);
      }
      if (typeof onTickCallback === 'function') {
        onTickCallback();
      }
    };

    playBeepCycle();
    this.alarmIntervalId = setInterval(playBeepCycle, 600);
  }

  stopAlarm() {
    this.isAlarming = false;
    if (this.alarmIntervalId) {
      clearInterval(this.alarmIntervalId);
      this.alarmIntervalId = null;
    }
  }
}

// Export instance
window.timerAudio = new TimerAudio();
