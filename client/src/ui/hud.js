export function createHUD() {
  const hud = document.createElement('div')
  hud.id = 'hud'
  hud.style.cssText = `
    position:fixed; top:12px; left:12px; color:#fff;
    font:14px/1.5 monospace; background:rgba(0,0,0,.55);
    padding:8px 12px; border-radius:6px; pointer-events:none; z-index:10;
  `
  document.body.appendChild(hud)

  function update({ phase, point, chips, lastRoll, message }) {
    hud.innerHTML = [
      `Phase: <b>${phase ?? '—'}</b>`,
      point ? `Point: <b>${point}</b>` : '',
      chips != null ? `Chips: <b>${chips}</b>` : '',
      lastRoll ? `Last roll: <b>${lastRoll}</b>` : '',
      message ? `<span style="color:#ffcc00">${message}</span>` : '',
    ].filter(Boolean).join('<br>')
  }

  return { update }
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
      <button id="auth-login" style="width:48%;padding:8px;border-radius:4px;border:none;background:#2a7a4c;color:#fff;cursor:pointer;font-size:14px">Login</button>
      <button id="auth-register" style="width:48%;float:right;padding:8px;border-radius:4px;border:none;background:#3a5a8c;color:#fff;cursor:pointer;font-size:14px">Register</button>
      <p id="auth-error" style="color:#ff6b6b;margin:8px 0 0;font-size:12px"></p>
    </div>
  `
  document.body.appendChild(overlay)

  async function submit(isRegister) {
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
      onLogin(token, username)
    } catch (e) {
      errEl.textContent = 'Connection error'
    }
  }

  document.getElementById('auth-login').addEventListener('click', () => submit(false))
  document.getElementById('auth-register').addEventListener('click', () => submit(true))
  document.getElementById('auth-pass').addEventListener('keydown', e => { if (e.key === 'Enter') submit(false) })
}
