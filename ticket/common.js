/* DEVAN Ticket 共通スクリプト
   - Firebase 接続（DEVAN 本体と同じプロジェクト）。データは tk/ 以下に置く
   - ?demo=1 を付けると Firebase に触らない「お試しモード」（端末内だけで動く）
*/
(function(){
  'use strict';
  const firebaseConfig = {
    apiKey:            "AIzaSyD9V0PN0cDS03yxLKLEmXsNNP13r-R0_0E",
    authDomain:        "kantogakurenshorinji-progress.firebaseapp.com",
    databaseURL:       "https://kantogakurenshorinji-progress-default-rtdb.firebaseio.com",
    projectId:         "kantogakurenshorinji-progress",
    storageBucket:     "kantogakurenshorinji-progress.firebasestorage.app",
    messagingSenderId: "214167530097",
    appId:             "1:214167530097:web:8decc086a778b07e2e89d0"
  };
  const FUNCTIONS_REGION = 'asia-northeast1';
  const Q = new URLSearchParams(location.search);
  const DEMO = Q.get('demo') === '1';

  const KIND = {
    pre:  { label:'前売券',   short:'前売', color:'info' },
    door: { label:'当日券',   short:'当日', color:'warn' },
    free: { label:'拳士（無料）', short:'拳士', color:'ok' },
    comp: { label:'招待券',   short:'招待', color:'gold' }
  };
  const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 紛らわしい文字(I,O,0,1)を除く
  function rand(n){
    const a = new Uint8Array(n); crypto.getRandomValues(a);
    let s=''; for (let i=0;i<n;i++) s += ALPHA[a[i] % ALPHA.length]; return s;
  }
  function newTid(){ return rand(20); }
  function newCode(){ return rand(6); }
  function kindLabel(t){ if (t && t.kind==='pre' && t.tier==='door') return '当日券（オンライン）'; if (t && t.kind==='pre' && t.tier==='advset') return '前売券（記念品付き）'; return (KIND[t&&t.kind]||{}).label || 'チケット'; }
  function countKey(t){ return (t.kind==='pre' && t.tier==='door') ? 'door' : t.kind; }
  function yen(n){ return '¥' + Number(n||0).toLocaleString(); }
  function nameKey(s){ return String(s||'').normalize('NFKC').replace(/[\s\u3000・･,.、。]/g,'').toLowerCase().replace(/[.#$\/\[\]]/g,'_'); }
  function ticketNo(kind, tid){
    const p = {pre:'P',door:'D',free:'K',comp:'G'}[kind] || 'T';
    return p + '-' + tid.slice(-6);
  }
  function fmtTime(ms){
    if (!ms) return '';
    const d = new Date(ms); const z=n=>String(n).padStart(2,'0');
    return `${d.getMonth()+1}/${d.getDate()} ${z(d.getHours())}:${z(d.getMinutes())}`;
  }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function qrSvg(text, cell){
    const qr = qrcode(0, 'M'); qr.addData(text); qr.make();
    return qr.createSvgTag({ cellSize: cell||4, margin: 0, scalable: true });
  }
  function baseUrl(){
    // このフォルダ（/ticket/）の URL。QR にはこの URL を入れる
    const p = location.pathname.replace(/[^/]*$/, '');
    return location.origin + p;
  }
  function ticketUrl(eid, tid){ return baseUrl() + '?e=' + encodeURIComponent(eid) + '&t=' + encodeURIComponent(tid); }
  function parseTicketUrl(s){
    // QR の中身（URL）から e と t を取り出す。URL でなければ「番号」として扱う
    try {
      const u = new URL(s);
      const e = u.searchParams.get('e'), t = u.searchParams.get('t');
      if (t) return { eid:e, tid:t };
    } catch(_){}
    return null;
  }
  function beep(ok){
    try{
      const ctx = beep.ctx || (beep.ctx = new (window.AudioContext||window.webkitAudioContext)());
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type='sine'; o.frequency.value = ok ? 1180 : 300; g.gain.value = .08;
      o.connect(g); g.connect(ctx.destination); o.start();
      o.stop(ctx.currentTime + (ok ? .12 : .35));
    }catch(_){}
    if (navigator.vibrate) navigator.vibrate(ok ? 60 : [80,60,80]);
  }
  function download(name, text, type){
    const b = new Blob([text], {type: type||'text/plain'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href), 2000);
  }
  function csv(rows){ return '﻿' + rows.map(r => r.map(v => '"' + String(v==null?'':v).replace(/"/g,'""') + '"').join(',')).join('\r\n'); }

  /* ---------- お試しモード用の擬似 DB ---------- */
  function makeFakeDb(){
    const KEY = 'tk_demo_db';
    let root = {};
    try { root = JSON.parse(localStorage.getItem(KEY) || 'null') || {}; } catch(_){}
    if (!root.tk) {
      const eid = 'demo2026';
      root.sj = { roles: { 'demo-admin':'admin' } };
      root.tk = {
        pending: { 'demo-gate-1': { email:'uketsuke@example.com', at: Date.now()-600000 } },
        config: { currentEvent: eid },
        events: { [eid]: {
          pub: { name:'第60回少林寺拳法全日本学生大会', date:'2026年11月1日（日）', venue:'日本武道館', open:'開場 9:00 ／ 開会式 10:00', price:500, doorPrice:1000, setPrice:700, setGoods:'g1', donateOpen:true, donate:{ links:{ '1000':'https://buy.stripe.com/test_d1', '3000':'https://buy.stripe.com/test_d3', '10000':'https://buy.stripe.com/test_d10', custom:'https://buy.stripe.com/test_dc' } }, donateTotal:42000, donateCount:11, setGoodsName:'第60回少林寺拳法全日本学生大会 記念ステッカー', setGoodsPrice:300, payLink:'https://buy.stripe.com/test_demo_adv', doorLink:'https://buy.stripe.com/test_demo_door', setLink:'https://buy.stripe.com/test_demo_set', saleOpen:true, doorOpen:true, feePercent:7, goodsOpen:true, goodsNote:'北口 売店（10:00〜16:00）' },
          goods: { g1:{ name:'記念ステッカー（色①）', price:300, desc:'大会ロゴ入り。耐水加工。', stock:150, open:true, sort:1 }, g2:{ name:'記念ステッカー（色②）', price:300, desc:'大会ロゴ入り。耐水加工。', stock:150, open:true, sort:2 }, g3:{ name:'記念ステッカー 2色セット', price:500, desc:'色①＋色②。別々に買うより100円お得。', stock:100, open:true, sort:3 } },
          univs: { u1:{name:'明治大学',code:'MEIJI1',cap:100}, u2:{name:'早稲田大学',code:'WASED2',cap:100}, u3:{name:'日本大学',code:'NIHON3',cap:100} },
          codes: { MEIJI1:'u1', WASED2:'u2', NIHON3:'u3' }
        }},
        counts: { [eid]: { u1:2 } },
        names: { [eid]: { u1: { '佐藤花子':true, '鈴木一郎':true } } },
        tickets: { [eid]: {
          'DEMOPREAAAAAAAAAAAA7': { kind:'pre', tier:'advset', qty:2, name:'記念 花子', email:'demo3@example.com', goods:[{gid:'g1', name:'第60回少林寺拳法全日本学生大会 記念ステッカー', qty:2}], created:Date.now()-900000, used:0 },
          'DEMOPREAAAAAAAAAAAA6': { kind:'pre', tier:'door', qty:1, name:'高橋 次郎', email:'demo2@example.com', created:Date.now()-1800000, used:0 },
          'DEMOPREAAAAAAAAAAAA1': { kind:'pre', tier:'adv', qty:2, name:'山田 太郎', email:'demo@example.com', created:Date.now()-86400000, used:0 },
          'DEMOFREEAAAAAAAAAAA2': { kind:'free', qty:1, name:'佐藤 花子', univ:'u1', univName:'明治大学', code:'MEIJI1', created:Date.now()-3600000, used:0 },
          'DEMOFREEAAAAAAAAAAA3': { kind:'free', qty:1, name:'鈴木 一郎', univ:'u1', univName:'明治大学', code:'MEIJI1', created:Date.now()-3000000, used:1, usedAt:Date.now()-600000 },
          'DEMODOORAAAAAAAAAAA4': { kind:'door', qty:1, batch:'B1', created:Date.now()-7200000, used:0 },
          'DEMOCOMPAAAAAAAAAAA5': { kind:'comp', qty:3, name:'関東学生OB会連合会', note:'来賓', created:Date.now()-7200000, used:0 }
        }}
      };
      save();
    }
    function save(){ try{ localStorage.setItem(KEY, JSON.stringify(root)); }catch(_){} }
    const listeners = [];
    function get(path){ return path.split('/').filter(Boolean).reduce((o,k)=> (o==null?undefined:o[k]), root); }
    function setAt(path, val){
      const ks = path.split('/').filter(Boolean); if (!ks.length){ root = val||{}; return; }
      let o = root; for (let i=0;i<ks.length-1;i++){ if (o[ks[i]]==null || typeof o[ks[i]]!=='object') o[ks[i]]={}; o=o[ks[i]]; }
      if (val === null || val === undefined) delete o[ks[ks.length-1]]; else o[ks[ks.length-1]] = val;
    }
    function resolveTs(v){ // ServerValue.TIMESTAMP の置き換え
      if (v && typeof v==='object'){ if (v['.sv']==='timestamp') return Date.now(); const r=Array.isArray(v)?[]:{}; for (const k in v) r[k]=resolveTs(v[k]); return r; }
      return v;
    }
    function fire(){ save(); listeners.forEach(l => { try{ l.cb(snap(l.path)); }catch(e){ console.error(e);} }); }
    function snap(path){
      const v = get(path); const key = path.split('/').filter(Boolean).pop() || null;
      return { key, val:()=> v===undefined?null:JSON.parse(JSON.stringify(v)), exists:()=> v!==undefined && v!==null, exportVal:()=>v,
        forEach(fn){ if (v && typeof v==='object') Object.keys(v).forEach(k=> fn(snap(path+'/'+k))); }, child:(k)=>snap(path+'/'+k) };
    }
    function ref(path){
      path = (path||'').replace(/^\/+|\/+$/g,'');
      return {
        key: path.split('/').pop() || null, path,
        child: (k)=> ref(path + '/' + k),
        orderByKey: ()=> ref(path), orderByChild: ()=> ref(path), limitToLast: ()=> ref(path),
        push: ()=> ref(path + '/' + ('-' + rand(18))),
        once: (ev)=> Promise.resolve(snap(path)),
        on: (ev, cb)=> { const l={path,cb}; listeners.push(l); setTimeout(()=>cb(snap(path)),0); return cb; },
        off: (ev, cb)=> { for (let i=listeners.length-1;i>=0;i--) if (listeners[i].path===path && (!cb || listeners[i].cb===cb)) listeners.splice(i,1); },
        set: (v)=> { setAt(path, resolveTs(v)); fire(); return Promise.resolve(); },
        remove: ()=> { setAt(path, null); fire(); return Promise.resolve(); },
        update: (obj)=> { for (const k in obj){ const p = k.startsWith('/')||path==='' ? k : path + '/' + k; setAt(p.replace(/^\//,''), resolveTs(obj[k])); } fire(); return Promise.resolve(); },
        transaction: (fn)=> { const cur = get(path); const nv = fn(cur===undefined?null:cur); if (nv!==undefined){ setAt(path, resolveTs(nv)); fire(); } return Promise.resolve({committed:nv!==undefined, snapshot:snap(path)}); }
      };
    }
    return { ref, _reset(){ root={}; save(); location.reload(); } };
  }
  function makeFakeAuth(){
    let user = null; const cbs=[];
    try { user = JSON.parse(sessionStorage.getItem('tk_demo_user')||'null'); } catch(_){}
    const notify = ()=> cbs.forEach(c=>c(user));
    return {
      get currentUser(){ return user; },
      onAuthStateChanged(cb){ cbs.push(cb); setTimeout(()=>cb(user),0); },
      signInWithEmailAndPassword(email){ user={uid:'demo-admin', email: email||'demo@example.com'}; sessionStorage.setItem('tk_demo_user', JSON.stringify(user)); notify(); return Promise.resolve({user}); },
      signOut(){ user=null; sessionStorage.removeItem('tk_demo_user'); notify(); return Promise.resolve(); }
    };
  }

  /* ---------- 初期化 ---------- */
  let db, auth, fns;
  if (DEMO) {
    db = makeFakeDb(); auth = makeFakeAuth(); fns = null;
    document.addEventListener('DOMContentLoaded', ()=>{
      const b = document.createElement('div');
      b.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:99;background:#9A7A2E;color:#fff;font-size:12px;text-align:center;padding:5px;letter-spacing:.08em';
      b.innerHTML = 'お試しモード（データは端末内だけ。決済・保存は本番では動きません） <a href="#" style="color:#fff;margin-left:8px" id="demoReset">初期化</a>';
      document.body.appendChild(b);
      b.querySelector('#demoReset').onclick = e => { e.preventDefault(); localStorage.removeItem('tk_demo_db'); sessionStorage.removeItem('tk_demo_user'); location.reload(); };
    });
  } else {
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    db = firebase.database(); auth = firebase.auth();
    fns = (firebase.functions ? firebase.app().functions(FUNCTIONS_REGION) : null);
  }
  const TS = DEMO ? {'.sv':'timestamp'} : firebase.database.ServerValue.TIMESTAMP;

  async function isAdmin(user){
    if (!user) return false;
    if (DEMO) return true;
    const roles = await db.ref('sj/roles').once('value');
    if (!roles.exists()) return true; // DEVAN 本体と同じ扱い（roles 未設定なら全員管理者）
    return roles.child(user.uid).val() === 'admin';
  }
  async function loadEventPub(eid){
    const s = await db.ref('tk/events/' + eid + '/pub').once('value'); return s.val();
  }
  async function currentEventId(){
    const q = Q.get('e'); if (q) return q;
    const s = await db.ref('tk/config/currentEvent').once('value'); return s.val();
  }

  // 試験運用中の表示（tk/config/beta）: 全チケット画面のヘッダー下に帯を出す
  document.addEventListener('DOMContentLoaded', ()=>{
    try { db.ref('tk/config/beta').on('value', s => { const v = s.val(); const on = !!(v && v.on); let bar = document.getElementById('betabar');
      if (!bar) { bar = document.createElement('div'); bar.id='betabar'; bar.style.cssText='display:none;align-items:center;justify-content:center;gap:8px;margin:-6px 0 14px;padding:6px 10px;border:1px solid var(--line2);border-radius:999px;font-size:11.5px;color:var(--ink2);background:var(--card)'; bar.innerHTML='<span style="font-family:var(--mark);font-weight:600;font-size:11px;letter-spacing:.22em;color:var(--gold);border:1px solid var(--gold);border-radius:999px;padding:1px 8px">BETA</span><span id="betamsg"></span>'; const top = document.querySelector('.top'); if (top && top.parentNode) top.parentNode.insertBefore(bar, top.nextSibling); }
      bar.style.display = on ? 'flex' : 'none'; bar.querySelector('#betamsg').textContent = (v && v.message) || '試験運用中です。表示が乱れることがあります。'; }, ()=>{}); } catch(_){}
  });

  window.TK = { DEMO, Q, db, auth, fns, TS, yen, nameKey, KIND, kindLabel, countKey, newTid, newCode, ticketNo, fmtTime, esc, qrSvg, baseUrl, ticketUrl, parseTicketUrl, beep, download, csv, isAdmin, loadEventPub, currentEventId };
})();
