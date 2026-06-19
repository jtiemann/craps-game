const PHASE_COLOR = { come_out: '#2a7a4c', point: '#8b5a1a' }
const BET_LABELS = {
  pass_line: 'Pass', dont_pass: "Don't Pass", come: 'Come', dont_come: "Don't Come",
  pass_odds: 'Pass Odds', dont_pass_odds: "DP Odds", field: 'Field',
  any_seven: 'Any 7', any_craps: 'Any Craps', yo: 'Yo (11)',
  aces: 'Aces', ace_deuce: 'Ace Deuce', boxcars: 'Boxcars', horn: 'Horn',
  place_4: 'Place 4', place_5: 'Place 5', place_6: 'Place 6',
  place_8: 'Place 8', place_9: 'Place 9', place_10: 'Place 10',
  hard_4: 'Hard 4', hard_6: 'Hard 6', hard_8: 'Hard 8', hard_10: 'Hard 10',
  big_6: 'Big 6', big_8: 'Big 8',
}

export function createHUD() {
  const hud = document.createElement('div')
  hud.id = 'hud'
  hud.style.cssText = `
    position:fixed; top:12px; left:12px; color:#fff;
    font:14px/1.5 monospace; background:rgba(0,0,0,.55);
    padding:8px 12px; border-radius:6px; pointer-events:none; z-index:10;
    min-width:160px;
  `
  document.body.appendChild(hud)

  // Flash overlay for outcomes
  const flash = document.createElement('div')
  flash.id = 'outcome-flash'
  flash.style.cssText = `
    position:fixed; top:50%; left:50%; transform:translate(-50%,-50%);
    font:bold 28px/1.2 monospace; color:#fff; text-align:center;
    text-shadow:0 2px 8px rgba(0,0,0,.8); pointer-events:none; z-index:50;
    opacity:0; transition:opacity 0.15s;
  `
  document.body.appendChild(flash)

  let flashTimer = null

  function showFlash(text, color = '#ffcc00') {
    flash.textContent = text
    flash.style.color = color
    flash.style.opacity = '1'
    if (flashTimer) clearTimeout(flashTimer)
    flashTimer = setTimeout(() => { flash.style.opacity = '0' }, 1800)
  }

  function update({ phase, point, chips, lastRoll, bets, mySocketId, shooter } = {}) {
    const phaseColor = PHASE_COLOR[phase] ?? '#555'
    const phaseLabel = phase === 'come_out' ? 'Come Out' : phase === 'point' ? `Point: ${point}` : (phase ?? '—')
    const myBets = (bets ?? []).filter(b => b.socketId === mySocketId)

    const betsHtml = myBets.length
      ? '<hr style="border:0;border-top:1px solid rgba(255,255,255,.2);margin:6px 0">' +
        myBets.map(b => {
          const label = BET_LABELS[b.type] ?? b.type
          const target = b.target ? ` →${b.target}` : ''
          return `<span style="color:#aef">${label}${target}</span> <b>$${b.amount}</b>`
        }).join('<br>')
      : ''

    hud.innerHTML = [
      `<span style="background:${phaseColor};padding:1px 6px;border-radius:3px">${phaseLabel}</span>`,
      chips != null ? `Chips: <b>$${chips}</b>` : '',
      shooter ? `Shooter: <b>${shooter}</b>` : '',
      lastRoll ? `Roll: <b>${lastRoll}</b>` : '',
      betsHtml,
    ].filter(Boolean).join('<br>')
  }

  return { update, showFlash }
}

export function createAuthUI(onLogin) {
  const overlay = document.createElement('div')
  overlay.id = 'auth-overlay'
  overlay.style.cssText = `
    position:fixed; inset:0; display:flex; align-items:center; justify-content:center;
    background:rgba(0,0,0,.75); z-index:100;
  `
  overlay.innerHTML = `
    <div style="background:#1e2a3a;padding:24px;border-radius:10px;min-width:280px;color:#fff;font-family:monospace">
      <h2 style="margin:0 0 16px">Craps</h2>
      <input id="auth-user" placeholder="Username" style="width:100%;box-sizing:border-box;padding:8px;margin-bottom:8px;border-radius:4px;border:none;font-size:14px"><br>
      <input id="auth-pass" type="password" placeholder="Password" style="width:100%;box-sizing:border-box;padding:8px;margin-bottom:12px;border-radius:4px;border:none;font-size:14px"><br>
      <button id="auth-login" style="width:32%;padding:8px;border-radius:4px;border:none;background:#2a7a4c;color:#fff;cursor:pointer;font-size:14px">Login</button>
      <button id="auth-register" style="width:32%;margin:0 2%;padding:8px;border-radius:4px;border:none;background:#3a5a8c;color:#fff;cursor:pointer;font-size:14px">Register</button>
      <button id="auth-spectate" style="width:32%;padding:8px;border-radius:4px;border:none;background:#5a4a2c;color:#fff;cursor:pointer;font-size:14px">Watch</button>
      <p id="auth-error" style="color:#ff6b6b;margin:8px 0 0;font-size:12px"></p>
    </div>
  `
  document.body.appendChild(overlay)

  async function submit(isRegister, spectate = false) {
    const username = document.getElementById('auth-user').value.trim()
    const password = document.getElementById('auth-pass').value
    const errEl = document.getElementById('auth-error')
    errEl.textContent = ''
    if (!username || !password) { errEl.textContent = 'Username and password required'; return }

    const endpoint = isRegister ? '/auth/register' : '/auth/login'
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()
      if (!res.ok) { errEl.textContent = data.error || 'Error'; return }
      const token = isRegister ? (await (await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })).json()).token : data.token
      overlay.remove()
      onLogin(token, username, spectate)
    } catch (e) {
      errEl.textContent = 'Connection error'
    }
  }

  document.getElementById('auth-login').addEventListener('click', () => submit(false))
  document.getElementById('auth-register').addEventListener('click', () => submit(true))
  document.getElementById('auth-spectate').addEventListener('click', () => submit(false, true))
  document.getElementById('auth-pass').addEventListener('keydown', e => { if (e.key === 'Enter') submit(false) })
}
