// audio.js - Zero-dependency procedural sound effects using browser Web Audio API.
// Designed to be simple and beginner-friendly for students learning JavaScript.

let audioContext = null;
let muted = localStorage.getItem("cw_water_pipes_muted") === "true";

/**
 * Initializes or resumes the AudioContext on user interaction.
 * Browsers require a user gesture (like a click) before playing audio.
 */
function getAudioContext() {
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioContext = new AudioContextClass();
    }
  }
  if (audioContext && audioContext.state === "suspended") {
    audioContext.resume();
  }
  return audioContext;
}

/**
 * Plays a single synthesized tone with frequency ramp and volume envelope.
 * @param {number} startFreq - Starting frequency in Hertz (Hz)
 * @param {number} endFreq - Ending frequency in Hertz (Hz)
 * @param {number} duration - Tone duration in seconds
 * @param {string} type - Oscillator waveform: "sine", "triangle", "square"
 * @param {number} peakGain - Peak volume between 0.0 and 1.0
 */
function playTone(startFreq, endFreq, duration, type = "sine", peakGain = 0.15) {
  if (muted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(startFreq, now);
  if (endFreq !== startFreq) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), now + duration);
  }

  // Attack and decay volume envelope to avoid audio clicks
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.linearRampToValueAtTime(peakGain, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + duration);
}

export const soundManager = {
  /**
   * Initializes audio context on user interaction.
   */
  init() {
    getAudioContext();
  },

  /**
   * Toggles mute state and saves preference in localStorage.
   * @returns {boolean} New mute state
   */
  toggleMute() {
    muted = !muted;
    localStorage.setItem("cw_water_pipes_muted", String(muted));
    return muted;
  },

  /**
   * Checks if audio is currently muted.
   * @returns {boolean}
   */
  isMuted() {
    return muted;
  },

  /**
   * Sound when placing a pipe onto the grid.
   */
  playPlace() {
    playTone(260, 140, 0.08, "triangle", 0.18);
  },

  /**
   * Sound when rotating a pipe.
   */
  playRotate() {
    playTone(520, 600, 0.04, "square", 0.08);
  },

  /**
   * Ticking countdown warning sound.
   */
  playTick() {
    playTone(400, 280, 0.04, "sine", 0.1);
  },

  /**
   * Sound when water advances into the next pipe.
   */
  playFlow() {
    playTone(280, 360, 0.12, "sine", 0.16);
  },

  /**
   * Sound when water enters a reservoir tank (soft bubbling fill).
   */
  playReservoir() {
    playTone(180, 220, 0.35, "triangle", 0.2);
  },

  /**
   * Cheerful chime when collecting a Jerry Can or using a Filter.
   */
  playBonus() {
    if (muted) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Two-tone bright major chord (C6 and E6)
    [1046, 1318].forEach((freq, index) => {
      setTimeout(() => {
        playTone(freq, freq * 1.05, 0.18, "sine", 0.2);
      }, index * 80);
    });
  },

  /**
   * Sound when discarding a piece.
   */
  playDiscard() {
    playTone(160, 80, 0.12, "sawtooth", 0.12);
  },

  /**
   * Triumphant ascending arpeggio when successfully supplying the community tank.
   */
  playWin() {
    if (muted) return;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, index) => {
      setTimeout(() => {
        playTone(freq, freq, 0.25, "triangle", 0.22);
      }, index * 120);
    });
  },

  /**
   * Descending tone when a route breaks or water leaks.
   */
  playLose() {
    if (muted) return;
    const notes = [440, 370, 311, 240];
    notes.forEach((freq, index) => {
      setTimeout(() => {
        playTone(freq, freq * 0.9, 0.22, "sawtooth", 0.15);
      }, index * 130);
    });
  },
};
