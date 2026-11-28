/* =====================================================================
   Chatbot — uçdan-uca şifrələmə (E2E)
   - Hər istifadəçinin brauzerində ECDH P-256 açar cütü yaranır.
   - Gizli açar PIN ilə (PBKDF2 600 000 + AES-GCM) şifrələnib serverdə
     ehtiyat kimi saxlanır; PIN serverə heç vaxt getmir.
   - Hər qrupun AES-256-GCM açarı var; o, hər üzv üçün ayrıca
     (ECDH + HKDF ilə) bükülür və group_keys cədvəlində saxlanır.
   - Mesajlar yalnız şifrəli halda bazaya yazılır: "e2e1:{...}".
   ===================================================================== */
const te = new TextEncoder(), td = new TextDecoder();
const C = crypto.subtle;
const ECDH = { name: 'ECDH', namedCurve: 'P-256' };
const PBKDF2_ITER = 600000;
const PREFIX = 'e2e1:';

export const b64 = buf => {
  const a = new Uint8Array(buf); let s = '';
  for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000));
  return btoa(s);
};
export const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const rnd = n => crypto.getRandomValues(new Uint8Array(n));

/* ---------- IndexedDB: gizli açar bu cihazda, çıxarıla bilməyən formada ---------- */
let dbp = null;
function db() {
  if (!dbp) dbp = new Promise((res, rej) => {
    const r = indexedDB.open('chatbot-e2e', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('keys');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbp;
}
async function idb(mode, fn) {
  const d = await db();
  return new Promise((res, rej) => {
    const tx = d.transaction('keys', mode);
    const req = fn(tx.objectStore('keys'));
    tx.oncomplete = () => res(req && req.result);
    tx.onerror = () => rej(tx.error);
  });
}
const idbGet = k => idb('readonly', s => s.get(k));
const idbPut = (k, v) => idb('readwrite', s => s.put(v, k));
const idbDel = k => idb('readwrite', s => s.delete(k));

/* ---------- PIN → açar ---------- */
async function pinKey(pin, salt, iter) {
  const base = await C.importKey('raw', te.encode(pin), 'PBKDF2', false, ['deriveKey']);
  return C.deriveKey({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

/* ---------- şəxsi açar (identity) ---------- */
async function store(uid, pkcs8, pub) {
  const priv = await C.importKey('pkcs8', pkcs8, ECDH, false, ['deriveBits']);
  const id = { priv, pub };
  try { await idbPut('id:' + uid, id); } catch (e) { console.warn('IndexedDB yoxdur', e); }
  return id;
}

export async function encryptPrivate(pkcs8, pin) {
  const salt = rnd(16), iv = rnd(12);
  const ct = await C.encrypt({ name: 'AES-GCM', iv }, await pinKey(pin, salt, PBKDF2_ITER), pkcs8);
  return { v: 1, iter: PBKDF2_ITER, salt: b64(salt), iv: b64(iv), ct: b64(ct) };
}
export async function decryptPrivate(e, pin) {
  try {
    const key = await pinKey(pin, unb64(e.salt), e.iter);
    return await C.decrypt({ name: 'AES-GCM', iv: unb64(e.iv) }, key, unb64(e.ct));
  } catch (_) { throw new Error('wrong_pin'); }
}

async function createIdentity(sb, uid, pin) {
  const kp = await C.generateKey(ECDH, true, ['deriveBits']);
  const pub = await C.exportKey('jwk', kp.publicKey);
  const pkcs8 = await C.exportKey('pkcs8', kp.privateKey);
  const { error } = await sb.from('user_keys').upsert({
    user_id: uid, public_key: pub, enc_private: await encryptPrivate(pkcs8, pin),
    updated_at: new Date().toISOString()
  });
  if (error) throw error;
  return store(uid, pkcs8, pub);
}

async function restoreIdentity(uid, row, pin) {
  const pkcs8 = await decryptPrivate(row.enc_private, pin);
  return store(uid, pkcs8, row.public_key);
}

/* Çıxışda bu cihazdakı açarı sil (növbəti girişdə PIN soruşulacaq) */
export async function forget(uid) { try { await idbDel('id:' + uid); } catch (_) {} }

/* Girişdən sonra çağırılır: açar varsa qaytarır, yoxdursa PIN pəncərəsini açır */
export async function ensureIdentity(sb, user) {
  const { data: row, error } = await sb.from('user_keys')
    .select('public_key,enc_private').eq('user_id', user.id).maybeSingle();
  if (error) throw error;
  let local = null;
  try { local = await idbGet('id:' + user.id); } catch (_) {}
  if (local && row && local.pub.x === row.public_key.x && local.pub.y === row.public_key.y) return local;
  if (local) await forget(user.id);
  if (!row) return dialog('create', pin => createIdentity(sb, user.id, pin));
  return dialog('restore',
    pin => restoreIdentity(user.id, row, pin),
    async pin => {
      await sb.from('group_keys').delete().eq('user_id', user.id);
      return createIdentity(sb, user.id, pin);
    });
}

/* ---------- qrup açarlarının bükülməsi ---------- */
async function kdf(bits) {
  const base = await C.importKey('raw', bits, 'HKDF', false, ['deriveKey']);
  return C.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: te.encode('chatbot-group-key-v1') },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export const newGroupKey = () => rnd(32);

/* Qrup açarını konkret istifadəçinin açıq açarı üçün bük */
export async function wrapFor(pubJwk, raw) {
  const pub = await C.importKey('jwk', pubJwk, ECDH, false, []);
  const eph = await C.generateKey(ECDH, true, ['deriveBits']);
  const k = await kdf(await C.deriveBits({ name: 'ECDH', public: pub }, eph.privateKey, 256));
  const iv = rnd(12);
  return {
    v: 1, epk: await C.exportKey('jwk', eph.publicKey), iv: b64(iv),
    ct: b64(await C.encrypt({ name: 'AES-GCM', iv }, k, raw))
  };
}
export async function unwrap(priv, w) {
  const epk = await C.importKey('jwk', w.epk, ECDH, false, []);
  const k = await kdf(await C.deriveBits({ name: 'ECDH', public: epk }, priv, 256));
  return new Uint8Array(await C.decrypt({ name: 'AES-GCM', iv: unb64(w.iv) }, k, unb64(w.ct)));
}

/* ---------- açar dəsti: mesajları şifrələ / aç ---------- */
export function keyring(sb, uid, priv) {
  const cache = new Map();
  const imp = raw => C.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);

  async function entry(gid, v) {
    const id = gid + ':' + v;
    if (!cache.has(id)) cache.set(id, (async () => {
      const { data, error } = await sb.from('group_keys').select('wrapped')
        .eq('group_id', gid).eq('user_id', uid).eq('version', v).maybeSingle();
      if (error || !data) return null;
      try { const raw = await unwrap(priv, data.wrapped); return { raw, key: await imp(raw) }; }
      catch (e) { console.error('Açar açılmadı', e); return null; }
    })());
    const r = await cache.get(id);
    if (!r) cache.delete(id);
    return r;
  }

  return {
    async raw(gid, v) { return (await entry(gid, v))?.raw || null; },
    remember(gid, v, raw) { cache.set(gid + ':' + v, imp(raw).then(key => ({ raw, key }))); },
    async encrypt(gid, v, text) {
      const e = v ? await entry(gid, v) : null;
      if (!e) { const x = new Error('no_group_key'); x.code = 'no_group_key'; throw x; }
      const iv = rnd(12);
      const ct = await C.encrypt({ name: 'AES-GCM', iv, additionalData: te.encode(gid) }, e.key, te.encode(text));
      return PREFIX + JSON.stringify({ v, iv: b64(iv), ct: b64(ct) });
    },
    async decrypt(gid, body) {
      if (typeof body !== 'string' || !body.startsWith(PREFIX)) return { text: body ?? '', state: 'plain' };
      try {
        const m = JSON.parse(body.slice(PREFIX.length));
        const e = await entry(gid, m.v);
        if (!e) return { text: '🔒 Bu mesaj sizdən əvvəl yazılıb və ya açarınız yoxdur', state: 'locked' };
        const pt = await C.decrypt({ name: 'AES-GCM', iv: unb64(m.iv), additionalData: te.encode(gid) }, e.key, unb64(m.ct));
        return { text: td.decode(pt), state: 'ok' };
      } catch (_) {
        return { text: '⚠ Mesaj açıla bilmədi', state: 'locked' };
      }
    }
  };
}

/* ---------- PIN pəncərəsi ---------- */
function dialog(mode, onSubmit, onReset) {
  return new Promise(resolve => {
    const wrap = document.createElement('div');
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'true');
    wrap.style.cssText = 'position:fixed;inset:0;z-index:100;display:grid;place-items:center;padding:20px;background:rgba(5,7,13,.8);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)';
    wrap.innerHTML = `<form class="glass" novalidate style="width:min(420px,100%);padding:28px;border-radius:20px;text-align:center">
      <div style="font-size:40px;margin-bottom:6px">🔐</div>
      <h2 data-t style="font-size:20px;margin-bottom:8px"></h2>
      <p data-p style="color:var(--muted);font-size:13px;margin-bottom:16px;text-align:left;line-height:1.55"></p>
      <input class="field" data-a type="password" autocomplete="off" placeholder="PIN (ən azı 8 simvol)">
      <input class="field" data-b type="password" autocomplete="off" placeholder="PIN-i təkrarlayın" style="margin-top:10px">
      <div data-e role="alert" style="color:var(--pink);font-size:13px;min-height:18px;margin-top:10px"></div>
      <button class="btn primary" data-s type="submit" style="width:100%;padding:12px;margin-top:6px"></button>
      <button data-r type="button" style="border:0;background:none;color:var(--muted);font-size:12px;margin-top:14px;cursor:pointer;text-decoration:underline">PIN-i unutmuşam</button>
    </form>`;
    const q = s => wrap.querySelector(s);
    let submit = onSubmit;

    function setMode(m) {
      const create = m === 'create';
      q('[data-t]').textContent = create ? 'Şifrələmə PIN-i yaradın' : 'Şifrələmə PIN-ini daxil edin';
      q('[data-p]').textContent = create
        ? 'Mesajlarınız cihazınızda şifrələnir və yalnız qrup üzvləri oxuya bilir. Bu PIN açarınızı qoruyur — onu heç kim, admin də bilmir. Başqa cihazdan girəndə PIN lazım olacaq. PIN-i unutsanız, köhnə mesajları oxuya bilməyəcəksiniz.'
        : 'Bu cihazda şifrələmə açarınız yoxdur. Mesajları oxumaq üçün əvvəl yaratdığınız PIN-i yazın.';
      q('[data-b]').hidden = !create;
      q('[data-r]').hidden = create || !onReset;
      q('[data-s]').textContent = create ? 'PIN yarat' : 'Davam et';
      q('[data-e]').textContent = '';
      q('[data-a]').value = ''; q('[data-b]').value = '';
      wrap.dataset.mode = m;
      setTimeout(() => q('[data-a]').focus(), 30);
    }

    q('form').onsubmit = async e => {
      e.preventDefault();
      const a = q('[data-a]').value, create = wrap.dataset.mode === 'create';
      if (a.length < 8) { q('[data-e]').textContent = 'PIN ən azı 8 simvol olmalıdır.'; return; }
      if (create && a !== q('[data-b]').value) { q('[data-e]').textContent = 'PIN-lər eyni deyil.'; return; }
      const btn = q('[data-s]'), label = btn.textContent;
      btn.disabled = true; btn.textContent = 'Yoxlanılır...'; q('[data-e]').textContent = '';
      try { const id = await submit(a); wrap.remove(); resolve(id); }
      catch (x) {
        console.error(x);
        q('[data-e]').textContent = x.message === 'wrong_pin' ? 'PIN yanlışdır.' : 'Xəta: ' + (x.message || x);
      } finally { btn.disabled = false; btn.textContent = label; }
    };
    q('[data-r]').onclick = () => {
      if (!confirm('Yeni açar yaradılacaq. Əvvəlki mesajlar bu hesab üçün həmişəlik oxunmaz olacaq. Davam edilsin?')) return;
      submit = onReset; setMode('create');
    };

    setMode(mode);
    document.body.append(wrap);
  });
}
