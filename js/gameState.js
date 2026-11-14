(function () {
  const D = window.GAME_DATA, C = D.config;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const byId = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pct = v => Math.max(0, Math.min(100, v));

  const GameSpace = {
    el: {},
    cables: {},
    audio: { ctx: null, muted: false },

    /* ============ setup ============ */
    init() {
      this.el = {
        grid: byId('grid'), cables: byId('cables'), generator: byId('generator'),
        devices: byId('devices'), genFree: byId('gen-free'),
        crew: byId('crew-list'), moodVal: byId('mood-val'), moodFace: byId('mood-face'),
        tea: byId('btn-tea'), feed: byId('feed'), alert: byId('alert'),
        modal: byId('modal'), mute: byId('btn-mute'), pause: byId('btn-pause')
      };
      const marker = byId('shield-marker');
      if (marker) marker.style.left = C.shieldSafeLevel + '%';

      this.buildDevices();
      this.layoutCables();

      this.el.tea.addEventListener('click', () => {
        if (!window.Main.canAct()) return;
        this.unlock();
        if (window.Crew.teaBreak()) {
          this.sfx('success');
          this.log('🍵 Tea & warm meal break! The crew feels much better.', 'good');
        }
        this.render();
      });
      this.el.mute.addEventListener('click', () => this.toggleMute());
      this.el.pause.addEventListener('click', () => window.Main.togglePause());

      let t;
      window.addEventListener('resize', () => {
        clearTimeout(t);
        t = setTimeout(() => { this.layoutCables(); this.render(); }, 120);
      });
    },

    buildDevices() {
      const box = this.el.devices;
      box.innerHTML = '';
      D.devices.forEach(d => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'device';
        b.dataset.id = d.id;
        b.innerHTML =
          `<span class="d-icon">${d.icon}</span>` +
          `<span class="d-info"><b>${d.name}</b><small>${d.desc}</small></span>` +
          `<span class="d-side"><span class="d-kw">${d.kw} kW</span><span class="d-state">OFF</span></span>`;
        b.addEventListener('click', () => this.onDeviceClick(d.id, b));
        box.appendChild(b);
      });
    },

    onDeviceClick(id, btn) {
      if (!window.Main.canAct()) return;
      this.unlock();
      const r = window.Resources.toggle(id);
      if (!r.ok) {
        this.sfx('error');
        btn.classList.add('denied');
        setTimeout(() => btn.classList.remove('denied'), 400);
        this.log(`⚡ Not enough power! You need ${r.need} more kW — disconnect another device first.`, 'warn');
      } else {
        this.sfx('click');
        this.log(`${r.dev.icon} ${r.dev.name} ${r.on ? 'connected' : 'disconnected'}.`);
      }
      this.render();
    },

    layoutCables() {
      const grid = this.el.grid, svg = this.el.cables, gen = this.el.generator;
      const gr = grid.getBoundingClientRect(), g = gen.getBoundingClientRect();
      svg.setAttribute('viewBox', `0 0 ${gr.width} ${gr.height}`);
      svg.innerHTML = '';
      this.cables = {};
      $$('.device', grid).forEach(btn => {
        const d = btn.getBoundingClientRect();
        const horizontal = d.left >= g.right - 4;
        let path;
        if (horizontal) {
          const x1 = g.right - gr.left, y1 = g.top + g.height / 2 - gr.top;
          const x2 = d.left - gr.left,  y2 = d.top + d.height / 2 - gr.top;
          const mx = (x1 + x2) / 2;
          path = `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
        } else {
          const x1 = g.left + 18 - gr.left, y1 = g.bottom - gr.top;
          const x2 = d.left - gr.left,      y2 = d.top + d.height / 2 - gr.top;
          path = `M${x1},${y1} L${x1},${y2} L${x2},${y2}`;
        }
        const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        p.setAttribute('d', path);
        p.setAttribute('class', 'cable');
        svg.appendChild(p);
        this.cables[btn.dataset.id] = p;
      });
    },

    /* ============ rendering ============ */
    meter(name, value, text, level) {
      const card = byId('m-' + name);
      byId('m-' + name + '-bar').style.width = pct(value) + '%';
      byId('m-' + name + '-val').textContent = text;
      card.classList.toggle('warn', level === 'warn');
      card.classList.toggle('danger', level === 'danger');
    },

    render() {
      if (!this.el.grid) return;
      const R = window.Resources, S = window.Storm, K = window.Crew, s = R.state;
      const used = R.used(), stormOn = S.phase !== 'calm';

      this.meter('energy', used / C.totalPower * 100, `${used} / ${C.totalPower} kW`, used >= C.totalPower ? 'warn' : '');
      this.meter('oxygen', s.oxygen, `${Math.round(s.oxygen)}%`, s.oxygen < 25 ? 'danger' : s.oxygen < 50 ? 'warn' : '');
      this.meter('shield', s.shield, `${Math.round(s.shield)}%`, stormOn && s.shield < C.shieldSafeLevel ? 'danger' : '');
      this.meter('temp', (s.temp + 10) / 32 * 100, `${Math.round(s.temp)} °C`, s.temp < 5 ? 'danger' : s.temp < 14 ? 'warn' : '');

      this.el.genFree.textContent = `${R.free()} kW free`;
      $$('.device', this.el.devices).forEach(btn => {
        const on = s.online[btn.dataset.id];
        btn.classList.toggle('on', !!on);
        $('.d-state', btn).textContent = on ? 'ON' : 'OFF';
        const p = this.cables[btn.dataset.id];
        if (p) p.setAttribute('class', 'cable' + (on ? ' on' : ''));
      });

      const avg = K.average();
      this.el.moodVal.textContent = Math.round(avg) + '%';
      this.el.moodFace.textContent = K.face(avg);
      this.el.crew.innerHTML = K.members.map(m =>
        `<div class="crew-card">
           <span class="c-emoji">${m.emoji}</span>
           <div class="c-info"><b>${m.name}</b><small>${m.role}</small>
             <div class="bar small"><div class="fill ${m.mood < 30 ? 'low' : ''}" style="width:${pct(m.mood)}%"></div></div>
           </div>
           <span class="c-face">${K.face(m.mood)}</span>
         </div>`).join('');
      this.el.tea.disabled = K.teaCooldown > 0;
      this.el.tea.textContent = K.teaCooldown > 0 ? `🍵 Tea break (${K.teaCooldown}s)` : '🍵 Tea & meal break';

      byId('stat-storms').textContent = `${S.survived}/${C.stormsToWin}`;
      byId('stat-score').textContent = window.Main.score;
      byId('stat-sol').textContent = 1 + Math.floor(window.Main.elapsed / 30);
      byId('stat-weather').textContent = S.phase === 'calm' ? 'Quiet ☀️' : S.phase === 'warning' ? 'Storm incoming ⚠️' : 'STORM ☢️';

      this.renderAlert();
    },

    renderAlert() {
      const S = window.Storm, a = this.el.alert, c = S.current;
      if (S.phase === 'calm' || !c) { a.className = 'alert hidden'; return; }
      const real = c.real
        ? `NASA DONKI event ${esc(c.real.id)}`
        : (S.liveStatus === 'live' ? 'NASA DONKI style alert' : 'Training alert (offline data)');
      if (S.phase === 'warning') {
        a.className = 'alert warning';
        a.innerHTML = `<div class="a-icon">${c.icon}</div><div><b>⚠️ ${c.name} — sector ${c.sector}</b>` +
          `<div>${c.blurb} Impact in <strong>${S.timer}s</strong>. Charge the 🛡️ shield to ${C.shieldSafeLevel}%!</div>` +
          `<small>${real}</small></div>`;
      } else {
        a.className = 'alert impact';
        a.innerHTML = `<div class="a-icon">☢️</div><div><b>STORM FRONT IS HERE!</b>` +
          `<div>Keep the shield powered and fix the wires!</div><small>${real}</small></div>`;
      }
    },

    log(msg, kind) {
      const ul = this.el.feed; if (!ul) return;
      const li = document.createElement('li');
      if (kind) li.className = kind;
      li.innerHTML = `<time>${window.Main.clock()}</time> ${msg}`;
      ul.prepend(li);
      while (ul.children.length > 8) ul.lastChild.remove();
    },

    /* ============ storm hooks ============ */
    onWarning(storm) {
      this.sfx('alarm');
      this.speak(`Warning, Commander! Solar radiation approaching sector ${storm.sector}!`);
      this.log(`⚠️ ${storm.name} detected — sector ${storm.sector}. Get the shield ready!`, 'warn');
    },

    onImpact() {
      this.sfx('alarm');
      this.speak('Radiation front arriving! Fix the wires!');
      this.log('☢️ Storm front hit! Cables are sparking — reconnect the wires!', 'bad');
    },

    /* ============ pop-up screens ============ */
    showModal(html, onMount) {
      const m = this.el.modal;
      $('.modal-card', m).innerHTML = html;
      m.classList.remove('hidden');
      if (onMount) onMount(m);
    },

    hideModal() {
      this.el.modal.classList.add('hidden');
    },

    showIntro(onStart) {
      this.showModal(
        `<h2>🚀 Welcome, Commander!</h2>
         <p>You lead a research outpost on Mars. Keep <b>4 astronauts</b> safe through <b>${C.stormsToWin} solar storms</b>.</p>
         <ul class="howto">
           <li>⚡ The solar array makes only <b>${C.totalPower} kW</b>. Tap a device to connect or disconnect its cable.</li>
           <li>☀️ Storm alerts are based on real NASA space-weather data (DONKI). When one arrives, charge the 🛡️ shield (40 kW).</li>
           <li>🔧 When the storm hits, cables spark. Drag each wire to its matching colour, fast!</li>
           <li>😊 Keep the crew happy: heat, light and a tea break all matter.</li>
         </ul>
         <button class="btn primary" id="btn-start">Start mission</button>`,
        m => $('#btn-start', m).addEventListener('click', () => { this.unlock(); this.hideModal(); onStart(); })
      );
    },

    showPause(onResume) {
      this.showModal(
        `<h2>⏸ Paused</h2><p>The outpost is on hold.</p><button class="btn primary" id="btn-resume">Resume</button>`,
        m => $('#btn-resume', m).addEventListener('click', () => { this.hideModal(); onResume(); })
      );
    },

    badgeHtml(list) {
      return list.length
        ? `<div class="new-badges">${list.map(b => `<div class="badge earned"><span>${b.icon}</span><b>${esc(b.name)}</b><small>${esc(b.desc)}</small></div>`).join('')}</div>`
        : '';
    },

    showSurvived(res, n, onContinue) {
      this.sfx('success');
      this.speak('Shield held. Well done, Commander.');
      const p = res.page;
      this.showModal(
        `<h2>✅ Storm survived! (${n}/${C.stormsToWin})</h2>
         ${p ? `<div class="page-card"><div class="p-icon">${p.icon}</div><h3>📖 New logbook page: ${esc(p.title)}</h3><p>${esc(p.fact)}</p><small>Source: ${esc(p.source)}</small></div>` : '<p>You have already unlocked every logbook page!</p>'}
         ${res.badges.length ? '<h3>🏅 New badge!</h3>' + this.badgeHtml(res.badges) : ''}
         <p class="muted">The next storm will be harder. Reconnect any device you switched off.</p>
         <button class="btn primary" id="btn-next">Continue</button>`,
        m => $('#btn-next', m).addEventListener('click', () => { this.hideModal(); onContinue(); })
      );
    },

    showFail(reason, ctx, score, survived) {
      this.sfx('fail');
      this.speak('Mission failed.');
      const f = D.failures[reason];
      let happened = f.happened, fix = f.fix;
      if (reason === 'radiation') {
        const extra = [];
        extra.push(ctx.online.shield ? `The shield was only at ${Math.round(ctx.shield)}%.` : 'The shield was switched OFF.');
        if (ctx.online.greenhouse) {
          extra.push('The greenhouse was still using 25 kW.');
          fix = 'Disconnect the greenhouse when the warning starts and send its power to the shield. ' + f.fix;
        }
        happened += ' ' + extra.join(' ');
      }
      this.hideAlert();
      this.showModal(
        `<h2>💥 ${esc(f.title)}</h2>
         <div class="edu bad"><h3>❌ What happened</h3><p>${esc(happened)}</p></div>
         <div class="edu sci"><h3>💡 The science (NASA)</h3><p>${esc(f.science)}</p></div>
         <div class="edu fix"><h3>🔧 How to fix it next time</h3><p>${esc(fix)}</p></div>
         <p class="muted">Storms survived: ${survived} · Score: ${score}</p>
         <div class="btn-row"><button class="btn primary" id="btn-retry">Try again</button><a class="btn" href="logbook.html">📖 Logbook</a></div>`,
        m => $('#btn-retry', m).addEventListener('click', () => location.reload())
      );
    },

    showWin(score, badges) {
      this.hideAlert();
      this.sfx('success');
      this.speak('Mission complete. You are a true Mars Commander.');
      this.showModal(
        `<h2>👑 Mission complete!</h2>
         <p>You kept the crew alive through all ${C.stormsToWin} storms. Real NASA engineers plan for exactly these problems.</p>
         <p><b>Final score: ${score}</b></p>
         ${this.badgeHtml(badges)}
         <div class="btn-row"><button class="btn primary" id="btn-again">Play again</button><a class="btn" href="logbook.html">📖 Logbook</a></div>`,
        m => $('#btn-again', m).addEventListener('click', () => location.reload())
      );
    },

    hideAlert() {
      if (this.el.alert) this.el.alert.className = 'alert hidden';
    },

    /* ============ audio ============ */
    unlock() {
      const a = this.audio;
      if (!a.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) { try { a.ctx = new AC(); } catch (e) {} }
      }
      if (a.ctx && a.ctx.state === 'suspended') a.ctx.resume();
    },

    toggleMute() {
      this.audio.muted = !this.audio.muted;
      this.el.mute.textContent = this.audio.muted ? '🔇' : '🔊';
      if (this.audio.muted && window.speechSynthesis) window.speechSynthesis.cancel();
    },

    tone(freq, dur, type, vol, delay) {
      const a = this.audio;
      if (a.muted || !a.ctx) return;
      const t = a.ctx.currentTime + (delay || 0);
      const o = a.ctx.createOscillator(), g = a.ctx.createGain();
      o.type = type || 'sine';
      o.frequency.value = freq;
      g.gain.setValueAtTime(vol || 0.12, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(a.ctx.destination);
      o.start(t); o.stop(t + dur);
    },

    sfx(name) {
      switch (name) {
        case 'click':   this.tone(520, 0.08, 'triangle'); break;
        case 'error':   this.tone(180, 0.2, 'sawtooth', 0.1); break;
        case 'connect': this.tone(660, 0.08, 'triangle'); this.tone(990, 0.1, 'triangle', 0.1, 0.08); break;
        case 'success': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.12, i * 0.12)); break;
        case 'fail':    [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.3, 'sawtooth', 0.1, i * 0.22)); break;
        case 'alarm':   this.alarm(); break;
      }
    },

    // Plays assets/audio/alarm.mp3 if present, otherwise a synth alarm.
    alarm() {
      if (this.audio.muted) return;
      const synth = () => { for (let i = 0; i < 6; i++) this.tone(i % 2 ? 660 : 880, 0.25, 'square', 0.08, i * 0.3); };
      let used = false;
      const fallback = () => { if (!used) { used = true; synth(); } };
      try {
        const a = new Audio('../assets/audio/alarm.mp3');
        a.volume = 0.6;
        a.onerror = fallback;
        const p = a.play();
        if (p && p.catch) p.catch(fallback);
      } catch (e) { fallback(); }
    },

    speak(text) {
      if (this.audio.muted || !window.speechSynthesis) return;
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'en-US'; u.rate = 0.95; u.pitch = 0.7;
        window.speechSynthesis.speak(u);
      } catch (e) {}
    }
  };

  window.GameSpace = GameSpace;
})();