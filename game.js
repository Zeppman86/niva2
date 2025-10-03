/* ====== Responsive scale ====== */
const STAGE = document.getElementById('stage');
const WRAP  = document.getElementById('wrap');
const cv = document.getElementById('cv'), cx = cv.getContext('2d');

function fitGame(){
  const gw = 420, gh = 720;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const scale = Math.min(vw/gw, vh/gh);
  WRAP.style.transform = `scale(${scale})`;
  WRAP.style.left = `${(vw - gw*scale)/2}px`;
  WRAP.style.top  = `${(vh - gh*scale)/2}px`;
}
window.addEventListener('resize', fitGame);
window.addEventListener('orientationchange', ()=>setTimeout(fitGame, 100));

/* ====== Assets ====== */
/* ВАРИАНТ 1 (рекомендовано): локальные файлы в ./assets/ */
const IMG = {
  car: './assets/car.png',
  c1:  './assets/duet-1.png',
  c2:  './assets/duet-2.png',
  c3:  './assets/duet-3.png',
  c4:  './assets/duet-4.png',
  o1:  './assets/rocky1.png',
  o2:  './assets/rocky2.png',
};
/* ВАРИАНТ 2 (временный): оставить внешние ссылки
   — просто закомментируй блок выше и раскомментируй ниже

const IMG = {
  car: 'https://static.tildacdn.com/tild6664-6236-4434-b836-643337316236/niva.png',
  c1:  'https://static.tildacdn.com/tild3966-3164-4231-b362-373361386363/duet-1.png',
  c2:  'https://static.tildacdn.com/tild3865-3861-4664-a435-363563396436/duet-2.png',
  c3:  'https://static.tildacdn.com/tild6538-3337-4261-a137-656363396164/duet-3.png',
  c4:  'https://static.tildacdn.com/tild3566-6261-4035-a161-383962663065/duet-4.png',
  o1:  'https://static.tildacdn.com/tild3638-6235-4861-b131-353330636434/rocky1.png',
  o2:  'https://static.tildacdn.com/tild3536-3931-4338-b061-393664343732/rocky2.png',
};
*/

/* Геометрия дороги */
const ROAD = { x: 90, w: 240 }, LANES=3; let laneW = ROAD.w/LANES;

/* ====== Difficulty/state ====== */
const PRESETS = {
  easy:   { spawn: 860, itemBase:3.0, sizeScale:1.00, target:100, obstacles:false },
  normal: { spawn: 700, itemBase:3.4, sizeScale:0.90, target:200, obstacles:true, obsGameOver:false },
  hard:   { spawn: 560, itemBase:3.9, sizeScale:0.82, target:300, obstacles:true, obsGameOver:true },
};
let st={}, images={}; let isStarting=false;

/* ====== Themes ====== */
const THEMES = [
  { name:'morning', sky:['#e8f1ff','#b7d3ff'], hills:'#9ab1c7', near:'#3b4752', stars:0.0 },
  { name:'day',     sky:['#cfe8ff','#8fccff'], hills:'#8aa3bb', near:'#34404a', stars:0.0 },
  { name:'sunset',  sky:['#ffd0a8','#ff8f7a'], hills:'#9c7c89', near:'#2e2b35', stars:0.1 },
  { name:'night',   sky:['#0d1220','#1e2440'], hills:'#3b4560', near:'#1c2230', stars:1.0 },
];
let themeIndex=0, nextThemeIndex=1, themeBlend=0, themeTimer=0;
const SEGMENT_DURATION = 30000, FADE_DURATION = 2000;
function lerp(a,b,t){ return a+(b-a)*t; }
function lerpHex(h1,h2,t){
  const c1=parseInt(h1.slice(1),16), c2=parseInt(h2.slice(1),16);
  const r1=(c1>>16)&255, g1=(c1>>8)&255, b1=c1&255;
  const r2=(c2>>16)&255, g2=(c2>>8)&255, b2=c2&255;
  const r=Math.round(lerp(r1,r2,t)), g=Math.round(lerp(g1,g2,t)), b=Math.round(lerp(b1,b2,t));
  return `rgb(${r},${g},${b})`;
}
function mixThemes(t1,t2,t){ return { sky:[lerpHex(t1.sky[0],t2.sky[0],t), lerpHex(t1.sky[1],t2.sky[1],t)], hills:lerpHex(t1.hills,t2.hills,t), near:lerpHex(t1.near,t2.near,t), stars:lerp(t1.stars,t2.stars,t) }; }
let curTheme = mixThemes(THEMES[0], THEMES[1], 0);

/* ====== Parallax */
const bg = { araratY:0 };
const SEG_ARARAT = 260;

/* ====== Audio ====== */
let AC=null; function getAC(){ if(!AC){ const C=window.AudioContext||window.webkitAudioContext; AC=new C(); } return AC; }
function unlockAudio(){ try{ const ac=getAC(); if(ac.state==='suspended') ac.resume(); }catch(e){} }

/* музыка: локальный файл в assets */
const MUSIC_SRC = './assets/niva.mp3';
let bgm = null;
function initMusic(){ if (bgm) return; bgm = document.getElementById('bgm'); if (!bgm) return; bgm.src = MUSIC_SRC; bgm.volume = 0.35; }
async function tryPlayMusic(){ try{ initMusic(); if (bgm && bgm.paused) await bgm.play(); }catch(e){} }
['pointerdown','touchstart','keydown'].forEach(ev=>window.addEventListener(ev, ()=>{ unlockAudio(); tryPlayMusic(); }, {once:true}));

function playSip(){ try{ const ac=getAC(); const t=ac.currentTime, len=.18*ac.sampleRate, b=ac.createBuffer(1,len,ac.sampleRate), ch=b.getChannelData(0); for(let i=0;i<len;i++) ch[i]=(Math.random()*2-1)*Math.pow(1-i/len,2.2); const src=ac.createBufferSource(); src.buffer=b; const lp=ac.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=1000; const g=ac.createGain(); g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(.5,t+.02); g.gain.exponentialRampToValueAtTime(0.0001,t+.18); src.connect(lp).connect(g).connect(ac.destination); src.start(); src.stop(t+.2);}catch(e){} if(navigator.vibrate) navigator.vibrate(8); }
function playCoin(){ try{ const ac=getAC(); const t=ac.currentTime; const o=ac.createOscillator(); o.type='triangle'; o.frequency.setValueAtTime(980,t); o.frequency.exponentialRampToValueAtTime(1960,t+.08); const g=ac.createGain(); g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(.6,t+.01); g.gain.exponentialRampToValueAtTime(0.0001,t+.22); const hp=ac.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=600; o.connect(hp).connect(g).connect(ac.destination); o.start(); o.stop(t+.24);}catch(e){} if(navigator.vibrate) navigator.vibrate([8,20,8]); }
function playThud(){ try{ const ac=getAC(); const t=ac.currentTime; const o=ac.createOscillator(); o.type='sine'; o.frequency.setValueAtTime(90,t); const g=ac.createGain(); g.gain.setValueAtTime(0.6,t); g.gain.exponentialRampToValueAtTime(0.001,t+.25); const lp=ac.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=220; o.connect(lp).connect(g).connect(ac.destination); o.start(); o.stop(t+.26);}catch(e){} const fl=qs('#flash'); fl.classList.remove('show'); void fl.offsetWidth; fl.classList.add('show'); }

/* GOLD banner */
let goldTimer=null;
function goldFullText(){ const el=qs('#goldText'); el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); if(goldTimer) clearTimeout(goldTimer); goldTimer=setTimeout(()=>el.classList.remove('show'), 800); }

/* ====== Helpers/State ====== */
const DIFF_RU = { easy:'Сох', normal:'Кярт', hard:'Арарат' };
let lastTsFrame=0;
function resetState(){
  laneW = ROAD.w / LANES;
  const carW = laneW * 0.9;
  const carH = carW * 1.35;
  st = {
    difficulty:'normal', running:false, paused:false, startTime:0, elapsed:0,
    score:0, target:100,
    lane:1, laneTarget:1, laneAnim:0, laneFromX:0, laneToX:0,
    carW: carW, carH: carH,
    carY: cv.height - carH - 60, carX: 0, tilt:0,
    items:[], obstacles:[], speedBoost:1, roadShift:0,
    particles:[], burst:[],
    laneCooldown:[0,0,0],
    nextCupAt:null, nextObsAt:null
  };
  st.carX = laneToX(st.lane) + (laneW - st.carW) / 2;
  bg.araratY = 0;
  themeIndex=0; nextThemeIndex=1; themeTimer=0; themeBlend=0; curTheme = mixThemes(THEMES[0], THEMES[1], 0);
  lastTsFrame=0;
  qs('#diffLabel').textContent = DIFF_RU['normal'];
}
function laneToX(i){ return ROAD.x + i*laneW; }

function loadImages(map){
  const entries = Object.entries(map);
  return Promise.all(entries.map(([k,src]) => new Promise(res=>{
    const i=new Image();
    i.onload=()=>res([k,i]);
    i.onerror=()=>{ console.warn('image failed:', src); res([k,null]); };
    i.src=src;
  }))).then(arr=>{ arr.forEach(([k,i])=>images[k]=i); });
}

/* Показ/скрытие оверлеев */
const qs=(sel)=>document.querySelector(sel.startsWith('#')?sel:'#'+sel);
function show(id){
  const el = qs(id);
  el.classList.add('show');
  el.style.zIndex = 5000;
  cv.style.pointerEvents = 'none';
}
function hide(id){
  const el = qs(id);
  el.classList.remove('show');
  const anyOpen = ['menu','win','lose'].some(i => qs('#'+i).classList.contains('show'));
  cv.style.pointerEvents = anyOpen ? 'none' : 'auto';
}

function openMenu(){
  st.running=false; st.paused=true;
  hide('win'); hide('lose'); show('menu');
  const title = document.querySelector('#menu .title');
  if (title) title.textContent = (st.startTime ? 'Пауза' : '🇦🇲🏁☕🥊 Armenian Racing');
  renderHiscores();
}
function startGame(diff){
  if(isStarting) return; isStarting=true; setTimeout(()=>isStarting=false, 50);
  hide('win'); hide('lose'); hide('menu');
  st.difficulty=diff; qs('#diffLabel').textContent = DIFF_RU[diff] || 'Сложность';
  st.target=PRESETS[diff].target; qs('#target').textContent=st.target;
  st.running=true; st.paused=false; st.startTime=performance.now(); st.elapsed=0; st.score=0;
  st.items=[]; st.obstacles=[]; st.speedBoost=1; st.roadShift=0; st.particles=[]; st.burst=[];
  st.laneCooldown=[0,0,0]; st.nextCupAt=null; st.nextObsAt=null;
  document.getElementById('score').textContent=0; document.getElementById('time').textContent='00:00';
  hide('goldText'); lastTsFrame=0; tryPlayMusic();
}
function restart(){ hide('win'); hide('lose'); startGame(st.difficulty); }

/* HiScores */
const STORE_KEY = 'aracing_scores_v1';
const OLD_KEYS = ['aracing_v74_scores','aracing_v741_scores','aracing_v742_scores'];
function getStore(){ try{ return window.localStorage; } catch { return null; } }
function loadScores(){
  const ls=getStore(); if(!ls) return {};
  let hs={}; try{ hs=JSON.parse(ls.getItem(STORE_KEY)||'{}'); }catch{}
  for(const k of OLD_KEYS){ try{ const d=JSON.parse(ls.getItem(k)||'null'); if(d&&typeof d==='object'){ hs={...d,...hs}; ls.removeItem(k);} }catch{} }
  return hs;
}
function saveScores(data){ const ls=getStore(); if(!ls) return; try{ ls.setItem(STORE_KEY, JSON.stringify(data)); }catch{} }
function renderHiscores(){
  const h=loadScores();
  const f=ms=>{ const s=Math.floor(ms/1000), m=Math.floor(s/60); return m.toString().padStart(2,'0')+':'+(s%60).toString().padStart(2,'0'); };
  const el = document.getElementById('hiscores'); if(!el) return;
  el.innerHTML = ['easy','normal','hard'].map(d=>d+': '+(h[d]?f(h[d]):'—')).join(' | ');
}

/* ====== Spawn scheduling ====== */
function laneCooldownMs(){ return PRESETS[st.difficulty].spawn*0.85; }
function scheduleIfNull(ts){
  if(st.nextCupAt===null) st.nextCupAt = ts + PRESETS[st.difficulty].spawn*0.6;
  if(PRESETS[st.difficulty].obstacles && st.nextObsAt===null) st.nextObsAt = ts + PRESETS[st.difficulty].spawn*5*0.8;
}
function spawnCup(ts){
  const cooldown=laneCooldownMs();
  for(let attempt=0;attempt<4;attempt++){
    const r=Math.random(); let key,points,type='cup';
    if(r<0.30){ key='c3'; points=3; }
    else if(r<0.55){ key='c2'; points=2; }
    else if(r<0.90){ key='c1'; points=1; }
    else { key='c4'; points=5; type='gold'; }
    const size=(laneW*0.8)*PRESETS[st.difficulty].sizeScale;
    const lane=Math.floor(Math.random()*LANES);
    if(ts<st.laneCooldown[lane]) continue;
    const x=laneToX(lane)+(laneW-size)/2; const h=size*1.1;
    const speed=(PRESETS[st.difficulty].itemBase+Math.random()*1.2)*st.speedBoost;
    const y=-h;
    st.items.push({type,imgKey:key,points,lane,x,y,w:size,h,speed});
    st.laneCooldown[lane]=ts+cooldown; return true;
  }
  return false;
}
function spawnObstacle(ts){
  if(!PRESETS[st.difficulty].obstacles) return false;
  const cooldown=laneCooldownMs()*1.2;
  for(let attempt=0;attempt<4;attempt++){
    const key=Math.random()<0.5?'o1':'o2';
    const w=laneW*0.9,h=laneW*1.8;
    const lane=Math.floor(Math.random()*LANES);
    if(ts<st.laneCooldown[lane]) continue;
    const x=laneToX(lane)+(laneW-w)/2;
    const speed=(PRESETS[st.difficulty].itemBase+1.0)*st.speedBoost;
    const y=-h;
    st.obstacles.push({imgKey:key,lane,x,y,w,h,speed,type:'ob'});
    st.laneCooldown[lane]=ts+cooldown; return true;
  }
  return false;
}

/* ====== Update loop ====== */
function update(ts){
  if(!st.running || st.paused){ lastTsFrame=ts; return; }
  const dt = lastTsFrame? Math.min(48, ts-lastTsFrame) : 16.7; lastTsFrame=ts;

  // theme
  themeTimer+=dt; const cur=THEMES[themeIndex], nxt=THEMES[nextThemeIndex];
  const inFade = themeTimer>(SEGMENT_DURATION-FADE_DURATION);
  themeBlend = inFade ? (themeTimer-(SEGMENT_DURATION-FADE_DURATION))/FADE_DURATION : 0;
  if(themeBlend>1) themeBlend=1;
  if(themeTimer>=SEGMENT_DURATION){ themeTimer=0; themeIndex=nextThemeIndex; nextThemeIndex=(nextThemeIndex+1)%THEMES.length; themeBlend=0; }
  curTheme = mixThemes(cur,nxt,themeBlend);

  const minutes=(ts-st.startTime)/60000; st.speedBoost=1+Math.min(0.7, minutes*0.25);

  // spawn schedule
  scheduleIfNull(ts);
  const cupInterval = PRESETS[st.difficulty].spawn/st.speedBoost;
  const obsInterval = (PRESETS[st.difficulty].spawn*5)/st.speedBoost;
  if(ts>=st.nextCupAt){ if(spawnCup(ts)) st.nextCupAt+=cupInterval; else st.nextCupAt=ts+60; }
  if(PRESETS[st.difficulty].obstacles && ts>=st.nextObsAt){ if(spawnObstacle(ts)) st.nextObsAt+=obsInterval; else st.nextObsAt=ts+120; }

  st.elapsed=ts-st.startTime; document.getElementById('time').textContent=formatTime(st.elapsed);

  for(const it of st.items) it.y+=it.speed*(dt/16.7);
  for(const ob of st.obstacles) ob.y+=ob.speed*(dt/16.7);

  st.roadShift = (st.roadShift - (PRESETS[st.difficulty].itemBase+3)*st.speedBoost*(dt/16.7)); if(st.roadShift<0) st.roadShift+=56;
  tickLaneTween(dt);
  const minX=ROAD.x; const maxX=ROAD.x+ROAD.w-st.carW; st.carX=Math.max(minX, Math.min(maxX, st.carX));

  st.particles = st.particles.filter(p=> (p.life-=dt/1000)>0 ); for(const p of st.particles){ p.x+=p.vx*(dt/16.7); p.y+=p.vy*(dt/16.7); }
  st.burst = st.burst.filter(b=> (b.life-=dt/1000)>0 ); for(const b of st.burst){ b.x+=b.vx*(dt/16.7); b.y+=b.vy*(dt/16.7); }

  st.items = st.items.filter(it=>{
    if(hit(st.carX,st.carY,st.carW,st.carH, it.x,it.y,it.w,it.h)){
      st.score += it.points; document.getElementById('score').textContent=st.score;
      if(it.type==='gold'){ playCoin(); goldFullText(); spawnBurst(); } else { playSip(); }
      if(st.score>=st.target){
        st.running=false; show('win');
        try{
          const ac=getAC(); const now=ac.currentTime; const dur=1.0;
          const nbuf=ac.createBuffer(1, ac.sampleRate*dur, ac.sampleRate);
          const ch=nbuf.getChannelData(0); for(let i=0;i<ch.length;i++){ ch[i]=(Math.random()*2-1)*0.3; }
          const nsrc=ac.createBufferSource(); nsrc.buffer=nbuf;
          const g=ac.createGain(); g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(0.6, now+0.06); g.gain.exponentialRampToValueAtTime(0.001, now+dur);
          nsrc.connect(g).connect(ac.destination); nsrc.start(now); nsrc.stop(now+dur);
        }catch(e){}
        const key=st.difficulty, hs=loadScores(), t=st.elapsed;
        if(!hs[key]||t<hs[key]){ hs[key]=t; saveScores(hs); }
        renderHiscores();
      }
      return false;
    }
    return it.y < cv.height+70;
  });
  st.obstacles = st.obstacles.filter(ob=>{
    if(hit(st.carX,st.carY,st.carW,st.carH, ob.x,ob.y,ob.w,ob.h)){
      if(PRESETS[st.difficulty].obsGameOver){ st.running=false; show('lose'); }
      else { st.score=Math.max(0,st.score-10); document.getElementById('score').textContent=st.score; }
      playThud();
      return false;
    }
    return ob.y < cv.height+70;
  });

  const base = (PRESETS[st.difficulty].itemBase+1.5)*st.speedBoost*(dt/16.7);
  bg.araratY = (bg.araratY - base*0.08); if(bg.araratY<0) bg.araratY+=SEG_ARARAT;
}

function spawnBurst(){ const cx0=st.carX+st.carW/2, cy0=st.carY+st.carH/2; for(let i=0;i<18;i++){ const ang=(Math.PI*2)*i/18; st.burst.push({x:cx0,y:cy0,vx:Math.cos(ang)*2.2,vy:Math.sin(ang)*2.2,life:.35,r:2+Math.random()*2}); } }
function hit(ax,ay,aw,ah,bx,by,bw,bh){ return !(ax>bx+bw || ax+aw<bx || ay>by+bh || ay+ah<by); }
function formatTime(ms){ const s=Math.floor(ms/1000), m=Math.floor(s/60); return m.toString().padStart(2,'0')+':'+(s%60).toString().padStart(2,'0'); }

/* ====== Rendering ====== */
function render(){
  drawSky(); drawAraratV(); drawRoad();
  const t=performance.now()/1000;
  for(const it of st.items){
    const img = images[it.imgKey];
    if(img){
      if(it.type==='gold'){
        const pulse=.6+.4*Math.abs(Math.sin(t*6));
        const cx0=it.x+it.w/2, cy0=it.y+it.h/2;
        const r=it.w*.95*pulse;
        const g=cx.createRadialGradient(cx0,cy0,r*.2,cx0,cy0,r);
        g.addColorStop(0,'rgba(255,230,120,.95)');
        g.addColorStop(1,'rgba(255,230,120,0)');
        cx.save(); cx.globalCompositeOperation='lighter'; cx.fillStyle=g; cx.beginPath(); cx.arc(cx0,cy0,r,0,2*Math.PI); cx.fill(); cx.restore();
        cx.save(); cx.globalAlpha=pulse; cx.drawImage(img,it.x,it.y,it.w,it.h); cx.restore();
      } else {
        cx.drawImage(img,it.x,it.y,it.w,it.h);
      }
    }
  }
  for(const ob of st.obstacles){
    const img = images[ob.imgKey];
    if(img) cx.drawImage(img,ob.x,ob.y,ob.w,ob.h);
  }
  for(const p of st.particles){ cx.save(); cx.globalAlpha=Math.max(0,p.life)*0.9; cx.fillStyle='rgba(200,200,200,1)'; cx.beginPath(); cx.arc(p.x,p.y,p.r,0,2*Math.PI); cx.fill(); cx.restore(); }
  for(const b of st.burst){ cx.save(); cx.globalAlpha=Math.max(0,b.life)*0.9; cx.fillStyle='rgba(255,216,61,1)'; cx.beginPath(); cx.arc(b.x,b.y,b.r,0,2*Math.PI); cx.fill(); cx.restore(); }
  const car = images.car;
  if(car){ cx.save(); cx.translate(st.carX+st.carW/2, st.carY+st.carH/2); cx.rotate(st.tilt); cx.translate(-st.carW/2, -st.carH/2); cx.drawImage(car, 0, 0, st.carW, st.carH); cx.restore(); }

  if(new URLSearchParams(location.search).get('debug')==='1'){
    if(!render._last){ render._last=performance.now(); render._frames=0; }
    render._frames++; const now=performance.now();
    if(now-render._last>500){
      const fps=Math.round(1000*(render._frames)/(now-render._last));
      const dbg=document.getElementById('dbg'); dbg.classList.add('show');
      dbg.textContent=`FPS:${fps} items:${st.items.length} obs:${st.obstacles.length}`;
      render._last=now; render._frames=0;
    }
  }
}

/* ---- Background painters ---- */
function drawSky(){
  const g=cx.createLinearGradient(0,0,0,cv.height);
  g.addColorStop(0, curTheme.sky[0]); g.addColorStop(1, curTheme.sky[1]);
  cx.fillStyle=g; cx.fillRect(0,0,cv.width,cv.height);
  const starsAlpha = curTheme.stars;
  if(starsAlpha>0.01){
    cx.save(); cx.globalAlpha = starsAlpha; cx.fillStyle='rgba(255,255,255,0.9)';
    for(let i=0;i<40;i++){ const x=((i*97)%cv.width); const y=(i*17)%300; cx.fillRect(x, y, 1, 1); }
    cx.restore();
  }
}
function drawAraratV(){
  cx.save();
  const w=cv.width;
  const yOff = (bg.araratY % SEG_ARARAT);
  for(let seg=-1; seg<=3; seg++){
    const baseY = -yOff + seg*SEG_ARARAT + 220;

    cx.fillStyle = curTheme.hills;
    cx.beginPath();
    cx.moveTo(-40, baseY+140);
    cx.lineTo( 80, baseY+110);
    cx.lineTo(160, baseY+135);
    cx.lineTo(240, baseY+ 95);
    cx.lineTo(360, baseY+125);
    cx.lineTo(500, baseY+100);
    cx.lineTo(620, baseY+140);
    cx.lineTo(760, baseY+150);
    cx.lineTo(760, baseY+240);
    cx.lineTo(-40, baseY+240);
    cx.closePath();
    cx.fill();

    const bigX = 300, bigY = baseY+120, bigW = 320, bigH = 180;
    cx.fillStyle = curTheme.hills;
    cx.beginPath();
    cx.moveTo(bigX - bigW*0.55, bigY + bigH);
    cx.lineTo(bigX - bigW*0.18, bigY + bigH*0.40);
    cx.lineTo(bigX - bigW*0.05, bigY + bigH*0.26);
    cx.lineTo(bigX + bigW*0.08, bigY + bigH*0.22);
    cx.lineTo(bigX + bigW*0.30, bigY + bigH*0.47);
    cx.lineTo(bigX + bigW*0.55, bigY + bigH);
    cx.lineTo(bigX + bigW*0.57, bigY + bigH + 4);
    cx.lineTo(bigX - bigW*0.57, bigY + bigH + 4);
    cx.closePath();
    cx.fill();

    const smallX = 150, smallY = baseY+150, smallW = 190, smallH = 130;
    cx.beginPath();
    cx.moveTo(smallX - smallW*0.58, smallY + smallH);
    cx.lineTo(smallX,                smallY);
    cx.lineTo(smallX + smallW*0.58, smallY + smallH);
    cx.lineTo(smallX + smallW*0.60, smallY + smallH + 4);
    cx.lineTo(smallX - smallW*0.60, smallY + smallH + 4);
    cx.closePath();
    cx.fill();

    function snowCap(cx0, cy0, w0, h0){
      const grad = cx.createLinearGradient(0, cy0-h0, 0, cy0+h0);
      grad.addColorStop(0, 'rgba(255,255,255,0.95)');
      grad.addColorStop(1, 'rgba(255,255,255,0.10)');
      cx.fillStyle = grad;
      cx.beginPath();
      cx.moveTo(cx0,            cy0-h0*0.92);
      cx.lineTo(cx0-w0*0.28,    cy0-h0*0.22);
      cx.lineTo(cx0-w0*0.13,    cy0-h0*0.06);
      cx.lineTo(cx0+w0*0.10,    cy0-h0*0.08);
      cx.lineTo(cx0+w0*0.32,    cy0-h0*0.26);
      cx.closePath();
      cx.fill();
    }
    cx.save();
    cx.globalAlpha = 0.9;  snowCap(bigX,   bigY+30, 160, 80);
    cx.globalAlpha = 0.95; snowCap(smallX, smallY+18, 96,  52);
    cx.restore();

    const haz = cx.createLinearGradient(0, baseY+120, 0, baseY+200);
    haz.addColorStop(0, 'rgba(255,255,255,0.06)');
    haz.addColorStop(1, 'rgba(255,255,255,0.00)');
    cx.fillStyle = haz;
    cx.fillRect(0, baseY+110, w, 120);
  }
  cx.restore();
}
function drawRoad(){
  const h=cv.height;
  cx.fillStyle='rgba(43,47,54,0.98)'; cx.fillRect(ROAD.x,0,ROAD.w,h);
  cx.fillStyle='#ced4da'; cx.fillRect(ROAD.x+4,0,4,h); cx.fillRect(ROAD.x+ROAD.w-8,0,4,h);
  cx.fillStyle='#f2f5f8'; const dashH=28,gap=28,off=st.roadShift;
  for(let i=1;i<LANES;i++){ const x=ROAD.x+i*laneW-4; for(let y=-off;y<h;y+=dashH+gap) cx.fillRect(x,y,8,dashH); }
}

/* ====== Loop ====== */
let _errShown=false;
function gameLoop(ts){
  try{ update(ts); render(); }
  catch(e){
    if(!_errShown){
      console.error(e);
      const dbg=document.getElementById('dbg'); if(dbg){ dbg.classList.add('show'); dbg.textContent='Ошибка: '+e; }
      _errShown=true;
    }
  }
  requestAnimationFrame(gameLoop);
}

/* ====== Input ====== */
function onKey(e){
  const k=e.key.toLowerCase();
  if(k==='arrowleft'||k==='a') moveLane(-1);
  if(k==='arrowright'||k==='d') moveLane(1);
  if(k==='r') restart();
  if(k==='p') openMenu();
}
window.addEventListener('keydown', onKey);
cv.addEventListener('pointerdown', ev=>{
  const r=cv.getBoundingClientRect(); const x=ev.clientX-r.left;
  if(x<cv.width/2) moveLane(-1); else moveLane(1);
});

/* ====== Lane tween ====== */
function moveLane(delta){
  const newLane=Math.max(0,Math.min(LANES-1, st.laneTarget+delta));
  if(newLane===st.laneTarget) return;
  st.lane=st.laneTarget; st.laneTarget=newLane; st.laneAnim=0; st.laneFromX=st.carX; st.laneToX=laneToX(newLane)+(laneW-st.carW)/2;
}
function tickLaneTween(dt){
  if(st.laneAnim<1){
    st.laneAnim = Math.min(1, st.laneAnim + dt/180);
    let t=st.laneAnim; t = t<.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2;
    st.carX = st.laneFromX + (st.laneToX - st.laneFromX)*t;
    st.tilt = (st.laneToX>st.laneFromX?1:-1) * (1-t) * 0.18;
    st.particles.push({x: st.carX+st.carW*0.5 + (Math.random()*40-20), y: st.carY+st.carH-10, vx:(Math.random()*2-1)*0.4, vy:1.2+Math.random(), life:.7, r:1.5+Math.random()*2});
  } else st.tilt*=0.9;
}

/* ====== Boot ====== */
requestAnimationFrame(gameLoop);
(async function(){
  fitGame();
  resetState();
  renderHiscores();
  show('menu');
  await loadImages(IMG);

  const dbg = document.getElementById('dbg');
  if(new URLSearchParams(location.search).get('debug')==='1'){
    dbg.classList.add('show');
    const missing = Object.entries(IMG).filter(([k,src])=>!images[k]).map(([k,src])=>k+': '+src);
    dbg.textContent = missing.length? ('Проблемы с картинками: '+missing.join(', ')) : 'Картинки загружены ок';
  }
  document.addEventListener('visibilitychange', ()=>{ if(document.hidden){ if(st.running && !st.paused){ openMenu(); } } });
})();
