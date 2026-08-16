// 纯音乐背景乐：用 Web Audio 实时合成，循环播放，无需任何音频文件（离线可用、零版权风险）
// 仅用振荡器生成舒缓的器乐旋律 + 低音垫，无任何人声。
(function () {
  var ctx = null, master = null, timer = null, enabled = false;
  var tempo = 0.5;       // 每拍秒数（舒缓）
  var lookahead = 0.25;  // 预排程窗口（秒）
  var VOL = 0.09;        // 主音量（轻柔）

  // MIDI 音高 → 频率
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  // 旋律：C 大调五声音阶，舒缓循环 [MIDI, 拍数]
  var melody = [
    [72, 1], [76, 1], [79, 1], [76, 1],
    [74, 1], [77, 1], [81, 1], [77, 1],
    [72, 1], [76, 1], [79, 2],
    [71, 1], [74, 1], [79, 1], [74, 1],
    [69, 1], [72, 1], [76, 1], [72, 1]
  ];
  // 低音垫：每 2 拍换一次，C3 / G2 / A2 / F2
  var bass = [48, 43, 45, 41];

  var mIdx = 0, bIdx = 0, nextM = 0, nextB = 0;

  function ensure() {
    if (ctx) return true;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = VOL;
    master.connect(ctx.destination);
    return true;
  }

  function note(f, t, dur, type, vol) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.value = f;
    var rel = Math.min(0.6, dur * 0.7);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.5, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + rel);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + rel + 0.05);
  }

  function tick() {
    if (!ctx || !enabled) return;
    var ahead = ctx.currentTime + lookahead;
    while (nextM < ahead) {
      var m = melody[mIdx % melody.length];
      note(mtof(m[0]), nextM, m[1] * tempo * 0.92, 'triangle', 0.5);
      nextM += m[1] * tempo;
      mIdx++;
    }
    while (nextB < ahead) {
      var b = bass[bIdx % bass.length];
      note(mtof(b), nextB, tempo * 1.9, 'sine', 0.32);
      nextB += tempo * 2;
      bIdx++;
    }
    timer = setTimeout(tick, 70);
  }

  function start() {
    if (!ensure()) return;
    if (ctx.state === 'suspended' && ctx.resume) ctx.resume();
    if (enabled) return;
    enabled = true;
    var now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(VOL, now + 0.4);
    nextM = now + 0.06; nextB = now + 0.06;
    tick();
  }

  function stop() {
    enabled = false;
    if (timer) { clearTimeout(timer); timer = null; }
    if (master && ctx) {
      var now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(0.0001, now + 0.3);
    }
  }

  // 短促提示音（用于喝水提醒等），自带 AudioContext，无需背景乐开启
  function chime() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    var c = new AC();
    if (c.resume) c.resume();
    var now = c.currentTime;
    [659.25, 880, 1046.5].forEach(function (f, i) {
      var o = c.createOscillator(), g = c.createGain();
      o.type = 'sine'; o.frequency.value = f;
      var s = now + i * 0.12;
      g.gain.setValueAtTime(0.0001, s);
      g.gain.exponentialRampToValueAtTime(0.22, s + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, s + 0.4);
      o.connect(g).connect(c.destination);
      o.start(s); o.stop(s + 0.45);
    });
    setTimeout(function () { try { c.close() } catch (e2) {} }, 1300);
  }

  window.SlimMusic = {
    isEnabled: function () { return enabled; },
    start: start,
    stop: stop,
    chime: chime,
    setEnabled: function (on) { if (on) start(); else stop(); }
  };
})();
