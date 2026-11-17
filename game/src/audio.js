// Solace Vice — all sound is synthesised with WebAudio: no audio files, no
// network. Short noise/oscillator blips for shots, punches, pickups and
// chimes; a two-tone siren that follows the nearest police car; a soft
// engine hum while driving; and a slow synth bass loop under the title.

export function createAudio() {
  let ctx = null;
  let master = null;
  let sirenOsc = null;
  let sirenGain = null;
  let engineOsc = null;
  let engineGain = null;
  let musicTimer = 0;
  let musicStep = 0;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function blip(freqA, freqB, seconds, type, volume) {
    if (!ensure()) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqA, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(freqB, 1), ctx.currentTime + seconds);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + seconds);
    osc.connect(gain).connect(master);
    osc.start();
    osc.stop(ctx.currentTime + seconds);
  }

  function noise(seconds, volume, lowpass) {
    if (!ensure()) return;
    const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    source.connect(filter).connect(gain).connect(master);
    source.start();
  }

  function setSiren(active, dt) {
    if (!ensure()) return;
    if (active && !sirenOsc) {
      sirenOsc = ctx.createOscillator();
      sirenGain = ctx.createGain();
      sirenOsc.type = 'triangle';
      sirenGain.gain.value = 0.0;
      sirenOsc.connect(sirenGain).connect(master);
      sirenOsc.start();
    }
    if (sirenOsc) {
      const target = active ? 0.045 : 0;
      sirenGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
      if (active) sirenOsc.frequency.value = 660 + Math.sin(ctx.currentTime * 5.2) * 190;
      else if (sirenGain.gain.value < 0.002) {
        sirenOsc.stop();
        sirenOsc = null;
        sirenGain = null;
      }
    }
  }

  function setEngine(active, speedRatio) {
    if (!ensure()) return;
    if (active && !engineOsc) {
      engineOsc = ctx.createOscillator();
      engineGain = ctx.createGain();
      engineOsc.type = 'sawtooth';
      engineGain.gain.value = 0.0;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 320;
      engineOsc.connect(filter).connect(engineGain).connect(master);
      engineOsc.start();
    }
    if (engineOsc) {
      engineGain.gain.setTargetAtTime(active ? 0.05 : 0, ctx.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(55 + speedRatio * 130, ctx.currentTime, 0.05);
      if (!active && engineGain.gain.value < 0.002) {
        engineOsc.stop();
        engineOsc = null;
        engineGain = null;
      }
    }
  }

  // A lazy four-chord synthwave bassline for menus and quiet streets.
  const CHORDS = [110, 87.31, 130.81, 98];
  function updateMusic(dt, active) {
    if (!active || !ensure()) return;
    musicTimer -= dt;
    if (musicTimer <= 0) {
      musicTimer = 0.46;
      const root = CHORDS[Math.floor(musicStep / 4) % CHORDS.length];
      blip(root, root, 0.4, 'triangle', 0.05);
      if (musicStep % 4 === 0) blip(root * 2, root * 2, 0.5, 'sine', 0.03);
      musicStep += 1;
    }
  }

  return {
    unlock: ensure,
    shot() { noise(0.14, 0.5, 2600); blip(220, 60, 0.1, 'square', 0.16); },
    punch() { noise(0.08, 0.3, 700); },
    hurt() { blip(160, 70, 0.16, 'sawtooth', 0.14); },
    pickup() { blip(740, 1180, 0.12, 'sine', 0.16); },
    cash() { blip(980, 1470, 0.14, 'sine', 0.15); setTimeout(() => blip(1320, 1760, 0.12, 'sine', 0.1), 60); },
    door() { blip(300, 180, 0.09, 'square', 0.1); },
    crash() { noise(0.25, 0.4, 900); },
    missionDone() { blip(523, 523, 0.12, 'sine', 0.14); setTimeout(() => blip(784, 784, 0.2, 'sine', 0.14), 110); },
    setSiren,
    setEngine,
    updateMusic,
  };
}
