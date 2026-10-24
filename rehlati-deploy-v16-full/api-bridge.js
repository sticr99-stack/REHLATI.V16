/* ============================================================
   رحلتي | Rehlati — جسر الربط بالسيرفر (api-bridge.js)
   v1.0 — طبقة الربط مع Next.js API (بحث + حجوزات + حسابات)
   ------------------------------------------------------------
   • يعمل تلقائياً عند فتح الموقع من استضافة (http/https).
   • يتوقف تماماً عند الفتح عبر file:// — الموقع يعمل كما كان
     محلياً بلا أي تأثير (وضع احتياطي كامل).
   • لا يعتمد على أي مكتبة خارجية — Vanilla JS خالص.
   • كل دواله آمنة: لا ترمي استثناءات ولا تعلّق الصفحة أبداً.
   ============================================================ */
(function () {
  'use strict';
  if (window.RehlatiAPI) return; /* حماية من التحميل المزدوج */

  var DEBUG = false;
  try { DEBUG = localStorage.getItem('rehlati_api_debug') === '1'; } catch (e) {}
  function log() { if (DEBUG && window.console) console.log.apply(console, ['[RehlatiAPI]'].concat([].slice.call(arguments))); }

  /* ---------- حالة الجسر ---------- */
  var state = {
    available: false,   /* هل السيرفر متاح؟ */
    checking: true,     /* جارٍ الفحص الأول */
    provider: null,     /* amadeus | mock */
    version: null
  };

  /* ---------- تخزين آمن ---------- */
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }

  /* معرّف الجهاز — يُنشأ مرة واحدة ويمنع تعداد حجوزات الغير على السيرفر */
  function deviceId() {
    var d = lsGet('rehlati_device');
    if (d && /^[-a-z0-9]{6,64}$/i.test(d)) return d;
    d = 'dev-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
    lsSet('rehlati_device', d);
    return d;
  }

  /* بريد الجلسة: من تسجيل الدخول أو آخر حجز */
  function sessionEmail() {
    try {
      var u = JSON.parse(lsGet('rehlati_user') || 'null');
      if (u && u.email) return u.email;
    } catch (e) {}
    return lsGet('rehlati_api_email') || null;
  }

  /* اقتناص بريد الحجز [v1.5]: كائن الحجز ← حقول النموذج الظاهرة ← الجلسة
     (الأسبقية لما يكتبه المستخدم فعلاً — بريد الجلسة القديم صار آخر حلول ملاذ) */
  function pickEmail(booking) {
    if (booking && booking.email && String(booking.email).indexOf('@') > 0) return String(booking.email).trim();
    try {
      var el = document.getElementById('cEmail');
      if (el && el.value && el.value.indexOf('@') > 0) return el.value.trim();
      var ge = document.getElementById('gEmail');
      if (ge && ge.value && ge.value.indexOf('@') > 0) return ge.value.trim();
      var inp = document.querySelector('input[type="email"]');
      if (inp && inp.value && inp.value.indexOf('@') > 0) return inp.value.trim();
    } catch (e) {}
    return sessionEmail() || '';
  }

  function token() { return lsGet('rehlati_token') || null; }
  function setSession(tok, user) {
    if (tok) lsSet('rehlati_token', tok);
    if (user) { lsSet('rehlati_server_user', JSON.stringify(user)); lsSet('rehlati_user', JSON.stringify({ email: user.email, name: user.name, ts: Date.now() })); }
  }
  function clearSession() { lsDel('rehlati_token'); lsDel('rehlati_server_user'); }

  /* ---------- إرسال طلبات موحّد (لا يرمي أبداً) ---------- */
  function req(method, path, body, timeoutMs) {
    return new Promise(function (resolve) {
      var done = false;
      var ctl = null;
      var ms = timeoutMs || 8000;
      try {
        if (typeof AbortController !== 'undefined') ctl = new AbortController();
      } catch (e) {}
      var timer = setTimeout(function () { done = true; if (ctl) try { ctl.abort(); } catch (e) {} resolve({ ok: false, offline: true, error: 'timeout' }); }, ms);
      var opts = { method: method, headers: { 'Accept': 'application/json' }, cache: 'no-store' };
      if (ctl) opts.signal = ctl.signal;
      if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
      var t = token();
      if (t) opts.headers['Authorization'] = 'Bearer ' + t;

      fetch(path, opts).then(function (res) {
        if (done) return;
        clearTimeout(timer); done = true;
        res.json().then(function (j) {
          if (j && typeof j === 'object') resolve(Object.assign({ status: res.status }, j));
          else resolve({ ok: false, status: res.status, error: 'bad json' });
        }).catch(function () {
          resolve({ ok: false, status: res.status, error: 'unreadable response' });
        });
      }).catch(function () {
        if (done) return;
        clearTimeout(timer); done = true;
        resolve({ ok: false, offline: true, error: 'network' });
      });
    });
  }

  /* مسار نسبي آمن يعمل من أي صفحة ومجلد */
  function api(path) {
    try { return new URL(path, location.href).pathname + new URL(path, location.href).search; }
    catch (e) { return path; }
  }

  /* ---------- فحص توفر السيرفر ---------- */
  function probe() {
    /* file:// أو بروتوكول غير ويب → وضع محلي صامت */
    if (location.protocol !== 'http:' && location.protocol !== 'https:') {
      state.checking = false;
      log('file protocol → bridge dormant');
      return Promise.resolve(state);
    }
    return req('GET', api('api/health'), undefined, 4000).then(function (r) {
      state.checking = false;
      if (r && r.ok && r.service === 'rehlati-api') {
        state.available = true;
        state.provider = r.flightProvider || 'mock';
        state.version = r.version || null;
        log('server online:', state.provider);
      } else {
        state.available = false;
        log('server offline');
      }
      return state;
    });
  }
  var ready = probe();

  /* ---------- واجهة عامة ---------- */
  var API = {
    ready: ready,
    state: state,
    get available() { return state.available; },
    get provider() { return state.provider; },
    retry: function () { state.checking = true; return probe(); },

    /* هوية */
    device: deviceId,
    sessionEmail: sessionEmail,
    token: token,
    setSession: setSession,
    clearSession: clearSession,

    /* ---------- بحث ---------- */
    searchFlights: function (p) {
      if (!state.available) return Promise.resolve({ ok: false, offline: true });
      var qs = new URLSearchParams();
      qs.set('from', (p && p.from) || 'CMN');
      qs.set('to', (p && p.to) || 'DXB');
      if (p && p.date) qs.set('date', p.date);
      qs.set('pax', String((p && p.pax) || 1));
      if (p && p.cls) qs.set('cls', p.cls);
      return req('GET', api('api/flights/search?' + qs.toString()));
    },
    searchHotels: function (p) {
      if (!state.available) return Promise.resolve({ ok: false, offline: true });
      var qs = new URLSearchParams();
      qs.set('city', (p && p.city) || 'DXB');
      if (p && p.ci) qs.set('ci', p.ci);
      if (p && p.co) qs.set('co', p.co);
      qs.set('guests', String((p && p.guests) || 2));
      qs.set('rooms', String((p && p.rooms) || 1));
      return req('GET', api('api/hotels/search?' + qs.toString()));
    },
    searchPackages: function (p) {
      if (!state.available) return Promise.resolve({ ok: false, offline: true });
      var qs = new URLSearchParams();
      qs.set('pax', String((p && p.pax) || 2));
      qs.set('nights', String((p && p.nights) || 5));
      return req('GET', api('api/packages/search?' + qs.toString()));
    },
    airports: function (q, lang) {
      if (!state.available) return Promise.resolve({ ok: false, offline: true });
      return req('GET', api('api/airports?q=' + encodeURIComponent(q || '') + '&lang=' + (lang || 'ar')));
    },

    /* ---------- الحجوزات ---------- */
    createBooking: function (booking) {
      if (!state.available || !booking) return Promise.resolve({ ok: false, offline: true });
      var email = pickEmail(booking);
      if (!email) return Promise.resolve({ ok: false, error: 'no email' });
      lsSet('rehlati_api_email', email);
      var payload = Object.assign({}, booking);
      var body = {
        ref: booking.ref,
        type: booking.type || 'flight',
        email: email,
        device: deviceId(),
        totalMad: Number(booking.totalMad) || 0,
        cur: booking.cur || 'MAD',
        lang: booking.lang || (document.documentElement.getAttribute('dir') === 'ltr' ? 'en' : 'ar'),
        visa: !!booking.visa,
        title: [booking.from, booking.to, booking.hotel, booking.city].filter(Boolean).join(' → ').slice(0, 160),
        payload: payload
      };
      return req('POST', api('api/bookings'), body);
    },
    listBookings: function (opts) {
      if (!state.available) return Promise.resolve({ ok: false, offline: true });
      var email = (opts && opts.email) || sessionEmail();
      if (!email) return Promise.resolve({ ok: false, error: 'no session email' });
      var qs = new URLSearchParams();
      qs.set('email', email);
      qs.set('device', deviceId());
      return req('GET', api('api/bookings?' + qs.toString()));
    },
    cancelBooking: function (ref) {
      if (!state.available || !ref) return Promise.resolve({ ok: false, offline: true });
      var qs = new URLSearchParams();
      qs.set('device', deviceId());
      return req('DELETE', api('api/bookings/' + encodeURIComponent(ref) + '?' + qs.toString()));
    },

    /* ---------- الحساب ---------- */
    login: function (p) {
      if (!state.available) return Promise.resolve({ ok: false, offline: true });
      return req('POST', api('api/auth/login'), { email: (p && p.email) || '', password: (p && p.password) || '' });
    },
    register: function (p) {
      if (!state.available) return Promise.resolve({ ok: false, offline: true });
      return req('POST', api('api/auth/register'), {
        name: (p && p.name) || '',
        email: (p && p.email) || '',
        password: (p && p.password) || '',
        lang: (p && p.lang) || (document.documentElement.getAttribute('dir') === 'ltr' ? 'en' : 'ar')
      });
    },
    me: function () {
      if (!state.available) return Promise.resolve({ ok: false, offline: true });
      return req('GET', api('api/auth/me'));
    }
  };

  window.RehlatiAPI = API;
  log('bridge installed, probing…');
})();
