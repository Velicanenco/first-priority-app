/**
 * Tiny synthesized sound-effects layer -- no external audio files, no
 * licensing to worry about, nothing to download. Every sound is a short
 * Web Audio oscillator + gain envelope, generated on the fly.
 *
 * Design intent (deliberately restrained -- see tg-app-design skill's
 * "restraint is part of the craft"): sound only plays on a small set of
 * MEANINGFUL events -- switching tabs, opening/closing a sheet or stacked
 * sub-page, and success/error feedback on real actions (adding a "Five"
 * entry, marking someone prayed-for/invited, creating a group, redeeming a
 * code). It deliberately does NOT hook into every .tg-press tap (nav rows,
 * accordions, generic buttons) -- that already has haptic feedback on every
 * press, and layering a click sound on top of literally everything would
 * read as noisy/gamey rather than polished.
 *
 * No mute toggle by product decision -- this relies on the device's own
 * volume / silent switch. Every call is wrapped in try/catch and simply
 * no-ops if Web Audio isn't available (very old WebViews) -- sound is
 * always a pure enhancement, never something the rest of the app depends
 * on working.
 */
(function () {
  let ctx = null;
  function getCtx() {
    if (ctx) return ctx;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    try { ctx = new Ctor(); } catch (e) { ctx = null; }
    return ctx;
  }

  // One short tone: freq -> optional `to` (a frequency slide, used for the
  // open/close whoosh), duration in seconds, peak gain (kept low -- these
  // are meant to sit well under notification-sound volume), an optional
  // start delay (for two-note chimes), and oscillator waveform ("sine"
  // reads soft/rounded; "triangle" is a little more present, used only for
  // the error tone so it's distinguishable without being harsh).
  function tone({ freq, to, duration = 0.09, gain = 0.09, delay = 0, type = "sine" }) {
    const c = getCtx();
    if (!c) return;
    if (c.state === "suspended") c.resume().catch(() => {});
    const t0 = c.currentTime + delay;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + duration);
    // Fast linear attack, exponential decay -- avoids the click/pop you get
    // from a hard gain jump at t0, and the exponential tail feels natural
    // for a short percussive UI sound rather than an abrupt cutoff.
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(g);
    g.connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  window.sound = {
    // Barely-there tick on tab-bar / language switches -- just enough to
    // punctuate the change, paired with the existing selection() haptic.
    tick() {
      try { tone({ freq: 640, duration: 0.045, gain: 0.05 }); } catch (e) {}
    },
    // Soft rising whoosh when a sheet or stacked sub-page opens.
    open() {
      try { tone({ freq: 320, to: 620, duration: 0.1, gain: 0.06 }); } catch (e) {}
    },
    // Mirror of open(), sliding down instead of up, for closing.
    close() {
      try { tone({ freq: 480, to: 260, duration: 0.09, gain: 0.05 }); } catch (e) {}
    },
    // Gentle two-note major-third rise for real completions.
    success() {
      try {
        tone({ freq: 523.25, duration: 0.1, gain: 0.08 });               // C5
        tone({ freq: 659.25, duration: 0.16, gain: 0.08, delay: 0.07 }); // E5
      } catch (e) {}
    },
    // Low, short double-tick for errors -- clearly different from success
    // without being harsh or alarming.
    error() {
      try {
        tone({ freq: 220, duration: 0.07, gain: 0.07, type: "triangle" });
        tone({ freq: 196, duration: 0.09, gain: 0.07, type: "triangle", delay: 0.09 });
      } catch (e) {}
    },
  };
})();
