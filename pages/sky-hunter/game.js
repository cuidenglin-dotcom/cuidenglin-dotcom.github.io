(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const canvas = $('game'), ctx = canvas.getContext('2d'), hero = $('hero'), hc = hero.getContext('2d');
  const names = ['初次展翅','顺风飞翔','空中追逐','敏捷对决','急速闪避','疾风猎手','极限反应','天空霸主'];
  const descriptions = ['小鸽子慢慢飞，轻松练习火圈。','小鸽子开始加速，偶尔换个方向。','小鸽子频繁转弯，要跟紧它。','鸽子发现你靠近，就会侧身闪避。','更快的转向、更远的警戒范围。','鸽子会突然加速，抓住转弯的时机。','高速飞行和连续变向，考验你的反应。','最高速度、最灵活的闪躲，挑战天空霸主！'];
  const ROUND_SECONDS = 60, DOVE_COUNT = 3, SCORE_KEY = 'sky-hunter-scores-v2-minute';
  let W = 0, H = 0, dpr = 1, level = 1, state = 'menu', score = 0, remaining = ROUND_SECONDS;
  let last = performance.now(), elapsed = 0, cooldown = 0, ring = null, particles = [], toastTime = 0;
  let eagle = { x: 0, y: 0, facing: 1 }, doves = [];
  let pointer = null, sound = false, audio = null, boardLevel = 1;
  const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
  const random = (a,b) => a + Math.random()*(b-a);
  const radius = () => Math.min(112, Math.max(72, W * .15));
  const birdScale = () => W < 600 ? .65 : .85;
  function storageRead(key, fallback) { try { const value = JSON.parse(localStorage.getItem(key)); return value ?? fallback; } catch { return fallback; } }
  const cleanName = value => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,12) : '';
  let playerName = '', lastPlayerName = cleanName(storageRead('sky-hunter-player-name', ''));
  let scores = storageRead(SCORE_KEY, []);
  if (!Array.isArray(scores)) scores = [];
  scores = scores.filter(s => s && Number.isFinite(s.score) && s.level >= 1 && s.level <= 8 && typeof s.date === 'string');
  function best(l) { return Math.max(0, ...scores.filter(s => s.level === l).map(s => s.score)); }
  function choose(l) {
    level = l;
    $('levels').querySelectorAll('button').forEach((b,i) => { b.classList.toggle('active',i+1 === l); b.setAttribute('aria-pressed', String(i+1 === l)); });
    $('level-name').textContent = `${l} 层 · ${names[l-1]}`;
    $('level-description').textContent = descriptions[l-1];
    $('record').textContent = best(l) ? `第 ${l} 层一分钟最高：${best(l)} 分 · 你能打破纪录吗？` : '每局 1 分钟 · 三只鸽子同时飞行';
  }
  for (let l=1; l<=8; l++) {
    const b = document.createElement('button'); b.textContent = l; b.setAttribute('aria-label',`难度 ${l} 层`); b.onclick = () => choose(l); $('levels').append(b);
    const c = document.createElement('button'); c.textContent = l; c.setAttribute('aria-label',`查看第 ${l} 层排行榜`); c.onclick = () => renderBoard(l); $('board-levels').append(c);
  }
  choose(1);
  function path(c, points, fill, stroke, width=1) { c.beginPath(); points.forEach((p,i) => i ? c.lineTo(...p) : c.moveTo(...p)); c.closePath(); if(fill){ c.fillStyle=fill;c.fill(); } if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();} }
  function ellipse(c,x,y,rx,ry,color,angle=0) { c.beginPath();c.ellipse(x,y,rx,ry,angle,0,Math.PI*2);c.fillStyle=color;c.fill(); }
  function drawEagle(c,x,y,s,t,facing=1,heroMode=false) {
    c.save();c.translate(x,y);c.scale(s*facing,s);c.rotate(heroMode ? -.16 : Math.sin(t*2)*.035);
    const flap = Math.sin(t*5)*7;
    // Long, broad wings with individually cut flight feathers.
    path(c,[[-6,-10],[-44,-49+flap],[-92,-63+flap],[-153,-42+flap],[-174,-17+flap],[-137,-28+flap],[-162,2+flap],[-124,-11+flap],[-142,18+flap],[-104,3+flap],[-115,28+flap],[-78,10+flap],[-85,34+flap],[-48,20],[-20,20]],'#403b32');
    path(c,[[-11,-10],[-54,-42+flap],[-96,-47+flap],[-151,-29+flap],[-110,-28+flap],[-81,-22+flap],[-48,-9],[-24,17]],'#7b6950');
    path(c,[[6,-10],[50,-66-flap],[100,-89-flap],[166,-79-flap],[190,-53-flap],[153,-61-flap],[180,-33-flap],[142,-42-flap],[161,-15-flap],[124,-27-flap],[137,4-flap],[99,-10-flap],[110,19-flap],[71,6],[45,27],[18,23]],'#403b32');
    path(c,[[12,-9],[59,-55-flap],[102,-71-flap],[166,-67-flap],[125,-51-flap],[91,-39-flap],[51,-17],[24,19]],'#8b7857');
    for(let i=0;i<5;i++) {path(c,[[30+i*23,-27-i*7-flap],[44+i*23,-15-i*7-flap],[39+i*23,-32-i*7-flap]],'#a08a61');path(c,[[-32-i*21,-10-i*4+flap],[-43-i*21,3-i*4+flap],[-49-i*21,-13-i*4+flap]],'#927c56');}
    path(c,[[-20,23],[-33,69],[-16,60],[-7,75],[2,62],[16,71],[24,31]],'#4c4638');
    path(c,[[-10,30],[-14,60],[-5,57],[2,63],[7,35]],'#9a875f');
    ellipse(c,1,11,28,46,'#6f5a3e',-.15);ellipse(c,11,7,18,35,'#a48b5b',-.22);
    for(let i=0;i<4;i++) path(c,[[-12,11+i*9],[-4,17+i*9],[3,9+i*9],[0,22+i*9]],'#584832');
    // Powerful golden feet and curved black talons.
    path(c,[[7,34],[13,50],[30,55],[24,59],[9,55],[0,42]],'#d3a43f');path(c,[[-7,35],[-11,54],[-26,63],[-21,65],[-5,61],[3,44]],'#d9ae48');
    c.strokeStyle='#302e2a';c.lineWidth=3;c.lineCap='round';[[24,57,31,66],[-22,63,-27,72],[13,55,17,65]].forEach(p=>{c.beginPath();c.moveTo(p[0],p[1]);c.quadraticCurveTo(p[2]+4,p[3],p[2],p[3]);c.stroke();});
    path(c,[[-14,-12],[-20,-37],[-9,-34],[-13,-48],[3,-43],[17,-42],[32,-34],[36,-15],[24,2],[12,8],[0,-1],[-9,4]],'#e8e5d8');
    path(c,[[-14,-28],[-7,-31],[-4,-20],[-12,-10],[-4,-8],[-1,2],[-14,-6]],'#b9b9a7');
    path(c,[[28,-25],[52,-18],[50,-5],[39,2],[40,-11],[29,-9]],'#dbad3f');path(c,[[40,-11],[50,-5],[39,2]],'#9b6d25');
    ellipse(c,22,-26,6,4,'#e4b345');ellipse(c,24,-26,2.2,3,'#181e18');c.strokeStyle='#383c31';c.lineWidth=4;c.beginPath();c.moveTo(11,-34);c.lineTo(31,-29);c.stroke();
    c.restore();
  }
  function drawDove(c,x,y,s,t,facing=1) {
    c.save();c.translate(x,y);c.scale(s*facing,s);c.rotate(Math.sin(t*4)*.06);
    const f = Math.sin(t*12)*10;
    path(c,[[-7,-4],[-30,-34-f],[-65,-43-f],[-49,-24-f],[-59,-24-f],[-39,-10],[-22,8]],'#bcc9c5','#93a6a0');
    path(c,[[1,-3],[17,-36+f],[49,-48+f],[42,-28+f],[56,-30+f],[35,-9],[17,12]],'#fafcf2','#c6d2c7');
    path(c,[[-18,8],[-43,24],[-23,24],[-32,33],[-8,23]],'#a8b9b5');
    ellipse(c,0,5,23,15,'#eff3e9',-.2);ellipse(c,-5,8,14,9,'#d6e0d8',-.1);
    ellipse(c,19,-8,13,14,'#fcfcf5');path(c,[[29,-9],[41,-5],[30,-2]],'#d6a180');ellipse(c,23,-10,2.6,3,'#324139');ellipse(c,24,-11,0.8,1,'#fff');
    c.strokeStyle='#cb9380';c.lineWidth=2;c.beginPath();c.moveTo(6,18);c.lineTo(10,25);c.lineTo(17,25);c.stroke();c.restore();
  }
  function background(c,w,h,t) {
    const g = c.createLinearGradient(0,0,0,h);g.addColorStop(0,'#e7eddf');g.addColorStop(.6,'#edf0dd');g.addColorStop(1,'#d8e0c8');c.fillStyle=g;c.fillRect(0,0,w,h);
    c.fillStyle='#f9f6dd';c.beginPath();c.arc(w*.79,h*.23,Math.min(w,h)*.14,0,Math.PI*2);c.fill();
    c.strokeStyle='#cbd5c34a';c.lineWidth=1;for(let i=1;i<6;i++){c.beginPath();c.arc(w*.79,h*.23,Math.min(w,h)*(.14+i*.09),0,Math.PI*2);c.stroke();}
    for(let i=0;i<4;i++){let x=(w*(i*.28)+t*(4+i))%(w+200)-100,y=h*(.17+i*.13);ellipse(c,x,y,90+i*10,12,'#faf9ea60');}
    path(c,[[0,h*.82],[w*.09,h*.70],[w*.19,h*.79],[w*.34,h*.61],[w*.46,h*.8],[w*.59,h*.68],[w*.75,h*.8],[w*.91,h*.65],[w,h*.75],[w,h],[0,h]],'#cad4bf');
    path(c,[[0,h*.92],[w*.18,h*.81],[w*.29,h*.91],[w*.44,h*.77],[w*.62,h*.93],[w*.76,h*.80],[w,h*.91],[w,h],[0,h]],'#b8c6ac');
    for(let i=0;i<Math.ceil(w/35);i++){const x=i*38,hh=22+(Math.sin(i*18)+1)*20;path(c,[[x,h],[x+14,h-hh],[x+28,h]],'#a4b89955');}
  }
  function resize() {
    const oldW=W,oldH=H;const r=canvas.getBoundingClientRect();W=r.width;H=r.height;dpr=Math.min(window.devicePixelRatio||1,2);
    canvas.width=W*dpr;canvas.height=H*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);
    if(oldW&&oldH){eagle.x=eagle.x/oldW*W;eagle.y=eagle.y/oldH*H;doves.forEach(dove=>{dove.x=dove.x/oldW*W;dove.y=dove.y/oldH*H;});}
    const hr=hero.getBoundingClientRect();hero.width=hr.width*dpr;hero.height=hr.height*dpr;hc.setTransform(dpr,0,0,dpr,0,0);
  }
  new ResizeObserver(resize).observe(canvas);
  function spawn() {
    let x,y;for(let i=0;i<20;i++){x=random(42,W-42);y=random(135,H-65);if(Math.hypot(x-eagle.x,y-eagle.y)>radius()*1.6 && doves.every(d=>!d.alive||Math.hypot(x-d.x,y-d.y)>70))break;}
    const a=random(0,Math.PI*2),speed=(35+level*19)*(W<600?.8:1);
    return {x,y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,alive:true,turn:random(.4,1.2),burst:0,seed:Math.random()*10,respawn:0};
  }
  function toast(message) {$('toast').textContent=message;$('toast').classList.add('show');toastTime=1.25;}
  function ensureAudio(){try{audio??=new(window.AudioContext||window.webkitAudioContext)();audio.resume().catch(()=>{});}catch{}}
  function tone(freq,duration,type='sine',volume=.06,countdown=false) {
    if(!sound&&!countdown)return;try{ensureAudio();if(!audio)return;const o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.setValueAtTime(freq,audio.currentTime);if(!countdown)o.frequency.exponentialRampToValueAtTime(freq*.5,audio.currentTime+duration);g.gain.setValueAtTime(volume,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+duration);}catch{}
  }
  function start() {
    if(!playerName)return;
    ensureAudio();state='playing';score=0;remaining=ROUND_SECONDS;elapsed=0;cooldown=0;ring=null;particles=[];pointer=null;toastTime=0;$('toast').classList.remove('show');
    eagle={x:W*.35,y:H*.58,facing:1};doves=[];for(let i=0;i<DOVE_COUNT;i++)doves.push(spawn());['intro','result','pause-panel'].forEach(id=>$(id).classList.add('hidden'));['hud','attack-status'].forEach(id=>$(id).classList.remove('hidden'));$('hud-level').textContent=level;$('player-caption').textContent=`玩家：${playerName}`;last=performance.now();updateHud();toast('三只鸽子来了！轻点释放火圈，每只得 1 分。');
  }
  function menu() {state='menu';pointer=null;ring=null;particles=[];['hud','result','pause-panel','attack-status'].forEach(id=>$(id).classList.add('hidden'));$('intro').classList.remove('hidden');$('toast').classList.remove('show');$('player-caption').textContent='自由飞行区';choose(level);resize();}
  function pause(){if(state!=='playing')return;state='paused';pointer=null;$('pause-panel').classList.remove('hidden');}
  function resume(){if(state!=='paused')return;ensureAudio();state='playing';$('pause-panel').classList.add('hidden');last=performance.now();}
  function finish() {
    state='result';pointer=null;remaining=0;updateHud();const prior=best(level);const entry={name:playerName,level,score,date:new Date().toISOString()};scores.push(entry);
    scores=scores.sort((a,b)=>b.score-a.score).filter((s,i,all)=>all.slice(0,i).filter(v=>v.level===s.level).length<5);
    let saved=true;try{localStorage.setItem(SCORE_KEY,JSON.stringify(scores));}catch{saved=false;}
    $('final-score').textContent=score;$('result-title').textContent=score===0?'再练练你的火圈！':score>prior?'新的天空纪录！':'漂亮的捕猎！';$('result-description').textContent=`${playerName} · 第 ${level} 层 · ${names[level-1]} · 每只鸽子 1 分`;
    $('best-result').replaceChildren(document.createTextNode(`本层最高 ${best(level)} 分${saved?'':' · 本次成绩暂未保存'} · `));const b=document.createElement('button');b.textContent='查看排行榜';b.onclick=()=>openBoard(level);$('best-result').append(b);$('result').classList.remove('hidden');
  }
  function attack(){
    if(state!=='playing'||cooldown>0)return;
    cooldown=.65;ring={x:eagle.x,y:eagle.y,r:radius(),age:0};tone(130,.18,'sawtooth',.035);
    let hits=0;
    // Resolve every living pigeon in the instantaneous fire circle once.
    doves.forEach(dove=>{if(dove.alive&&Math.hypot(dove.x-eagle.x,dove.y-eagle.y)<=ring.r){
      dove.alive=false;score++;hits++;dove.respawn=.7;
      for(let i=0;i<20;i++){const a=random(0,Math.PI*2),v=random(30,150);particles.push({x:dove.x,y:dove.y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:random(.4,.9),color:i%2?'#f8f3d9':'#eaa24e'});}
    }});
    if(hits){toast(hits>1?`一圈命中 ${hits} 只！+${hits} 分`:'命中！+1 分');tone(650,.22,'sine');}updateHud();
  }
  function updateHud() {
    const secs=Math.ceil(remaining);$('timer').textContent=`${String(Math.floor(secs/60)).padStart(2,'0')}:${String(secs%60).padStart(2,'0')}`;$('score').textContent=score;$('time-bar').style.width=`${remaining/ROUND_SECONDS*100}%`;$('hud').classList.toggle('time-low',remaining<=10);$('hud').classList.toggle('final-countdown',remaining>0&&remaining<=3);
    $('attack-status').classList.toggle('cooldown',cooldown>0);$('attack-label').textContent=cooldown>0?'火圈蓄力中…':'火圈就绪 · 轻点出击';
  }
  function moveDove(dt,dove,index){
    if(!dove.alive){dove.respawn-=dt;if(dove.respawn<=0)doves[index]=spawn();return;}
    dove.turn-=dt;dove.burst=Math.max(0,dove.burst-dt);
    const distance=Math.hypot(dove.x-eagle.x,dove.y-eagle.y);const base=(35+level*19)*(W<600?.8:1);
    if(dove.turn<=0){
      let angle=Math.atan2(dove.vy,dove.vx)+random(-.25-level*.13,.25+level*.13);
      if(level>=4&&distance<radius()*(1.15+level*.1)){angle=Math.atan2(dove.y-eagle.y,dove.x-eagle.x)+random(-.65,.65);dove.burst=level>=6?.35:0;}
      const speed=base*(dove.burst>0?1.35:1);dove.vx=Math.cos(angle)*speed;dove.vy=Math.sin(angle)*speed;dove.turn=random(.35,1.8)/(1+level*.24);
    }
    if(level>=4&&distance<radius()*.9){const a=Math.atan2(dove.y-eagle.y,dove.x-eagle.x);const agility=(level-3)*1.9;dove.vx+=(Math.cos(a)*base-dove.vx)*Math.min(1,dt*agility);dove.vy+=(Math.sin(a)*base-dove.vy)*Math.min(1,dt*agility);}
    dove.x+=dove.vx*dt;dove.y+=dove.vy*dt;
    const margin=32,top=Math.min(140,H*.26);if(dove.x<margin){dove.x=margin;dove.vx=Math.abs(dove.vx);}if(dove.x>W-margin){dove.x=W-margin;dove.vx=-Math.abs(dove.vx);}if(dove.y<top){dove.y=top;dove.vy=Math.abs(dove.vy);}if(dove.y>H-50){dove.y=H-50;dove.vy=-Math.abs(dove.vy);}
  }
  function drawRing(){
    if(!ring)return;const a=1-ring.age/.48,r=ring.r;ctx.save();ctx.globalAlpha=Math.max(0,a);
    const g=ctx.createRadialGradient(ring.x,ring.y,0,ring.x,ring.y,r);g.addColorStop(0,'#ffc34a08');g.addColorStop(.8,'#ffb13a18');g.addColorStop(1,'#f26d345c');ctx.fillStyle=g;ctx.beginPath();ctx.arc(ring.x,ring.y,r,0,Math.PI*2);ctx.fill();
    ctx.shadowColor='#f48a31';ctx.shadowBlur=20;ctx.strokeStyle='#f07932';ctx.lineWidth=9*a+2;ctx.beginPath();ctx.arc(ring.x,ring.y,r,0,Math.PI*2);ctx.stroke();ctx.shadowBlur=0;ctx.strokeStyle='#ffe49a';ctx.lineWidth=3;ctx.stroke();
    for(let i=0;i<32;i++){const theta=i/32*Math.PI*2,flare=10+Math.sin(i*19+ring.age*29)*6;const x=ring.x+Math.cos(theta)*r,y=ring.y+Math.sin(theta)*r;path(ctx,[[x+Math.sin(theta)*4,y-Math.cos(theta)*4],[x+Math.cos(theta)*flare,y+Math.sin(theta)*flare],[x-Math.sin(theta)*4,y+Math.cos(theta)*4]],i%2?'#f7af37':'#e85e2b');}
    ctx.restore();
  }
  function frame(now){
    const raw=Math.max(0,(now-last)/1000),dt=Math.min(raw,.05);last=now;
    if(state==='playing'){elapsed+=dt;const before=remaining;remaining=Math.max(0,remaining-raw);for(const second of [3,2,1]){if(before>second&&remaining<=second)tone(880,.18,'sine',.13,true);}cooldown=Math.max(0,cooldown-dt);doves.forEach((dove,i)=>moveDove(dt,dove,i));if(ring){ring.age+=dt;if(ring.age>.48)ring=null;}particles.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;});particles=particles.filter(p=>p.life>0);if(toastTime>0){toastTime-=dt;if(toastTime<=0)$('toast').classList.remove('show');}updateHud();if(remaining<=0)finish();}
    background(ctx,W,H,elapsed);
    if(state!=='menu'){
      // The guide indicates the exact hit radius.
      ctx.save();ctx.strokeStyle='#8f9d7c50';ctx.lineWidth=1;ctx.setLineDash([3,7]);ctx.beginPath();ctx.arc(eagle.x,eagle.y,radius(),0,Math.PI*2);ctx.stroke();ctx.restore();
      ellipse(ctx,eagle.x,eagle.y+65,54*birdScale(),8,'#52663e13');
      drawEagle(ctx,eagle.x,eagle.y,birdScale(),elapsed,eagle.facing);
      doves.forEach(dove=>{if(dove.alive)drawDove(ctx,dove.x,dove.y,W<600?.65:.8,elapsed+dove.seed,dove.vx>=0?1:-1);});
      drawRing();particles.forEach(p=>{ctx.globalAlpha=Math.min(1,p.life*2);ellipse(ctx,p.x,p.y,3,4,p.color);});ctx.globalAlpha=1;
    }else{
      const hw=hero.width/dpr,hh=hero.height/dpr;hc.clearRect(0,0,hw,hh);const mobile=W<600,scale=mobile?.50:Math.min(1.42,hw/450);
      drawEagle(hc,hw*.50,hh*(mobile?.41:.39),scale,now/1000,1,true);drawDove(hc,hw*.73,hh*(mobile?.67:.73),mobile?.5:.8,now/1000,-1);
      hc.save();hc.setLineDash([3,7]);hc.strokeStyle='#92a18166';hc.beginPath();hc.ellipse(hw*.58,hh*.59,hw*.28,hh*.26,-.35,.5,2.6);hc.stroke();hc.restore();
    }
    requestAnimationFrame(frame);
  }
  function point(e){const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};}
  canvas.addEventListener('pointerdown',e=>{
    if(state!=='playing'||pointer)return;e.preventDefault();const p=point(e);pointer={id:e.pointerId,start:p,last:p,canDrag:Math.hypot(p.x-eagle.x,p.y-eagle.y)<Math.max(75,100*birdScale()),dragged:false,ox:eagle.x-p.x,oy:eagle.y-p.y};canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove',e=>{
    if(!pointer||pointer.id!==e.pointerId||state!=='playing')return;const p=point(e);if(Math.hypot(p.x-pointer.start.x,p.y-pointer.start.y)>6)pointer.dragged=true;
    if(pointer.canDrag&&pointer.dragged){const dx=p.x-pointer.last.x;if(Math.abs(dx)>1)eagle.facing=dx>=0?1:-1;eagle.x=clamp(p.x+pointer.ox,35,W-35);eagle.y=clamp(p.y+pointer.oy,115,H-40);}pointer.last=p;
  });
  canvas.addEventListener('pointerup',e=>{if(!pointer||pointer.id!==e.pointerId)return;const wasDrag=pointer.dragged;pointer=null;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);if(!wasDrag)attack();});
  canvas.addEventListener('pointercancel',()=>pointer=null);canvas.addEventListener('lostpointercapture',()=>pointer=null);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
  document.addEventListener('keydown',e=>{if(e.code==='Space'&&state==='playing'){e.preventDefault();attack();}if(e.code==='Escape'){if(!$('name-panel').classList.contains('hidden'))cancelName();else if(!$('board').classList.contains('hidden'))closeBoard();else if(state==='playing')pause();else if(state==='paused')resume();}});
  function renderBoard(l){boardLevel=l;$('board-levels').querySelectorAll('button').forEach((b,i)=>{b.classList.toggle('active',i+1===l);b.setAttribute('aria-pressed',String(i+1===l));});const list=$('board-list');list.replaceChildren();const rows=scores.filter(s=>s.level===l).sort((a,b)=>b.score-a.score).slice(0,5);
    if(!rows.length){const e=document.createElement('div');e.className='empty-board';e.textContent='这里还没有成绩，来当第一位猎手吧！';list.append(e);}
    rows.forEach((s,i)=>{const row=document.createElement('div');row.className='board-row';const rank=document.createElement('span');rank.className='rank';rank.textContent=String(i+1).padStart(2,'0');const title=document.createElement('span');title.className='board-name';title.textContent=cleanName(s.name)||'未署名玩家';title.title=title.textContent;const date=document.createElement('span');date.className='board-date';date.textContent=new Date(s.date).toLocaleDateString('zh-CN',{month:'2-digit',day:'2-digit'});const points=document.createElement('strong');points.textContent=`${s.score} 分`;row.append(rank,title,date,points);list.append(row);});
  }
  function openBoard(l){renderBoard(l);$('board').classList.remove('hidden');$('close-board').focus();}
  function closeBoard(){$('board').classList.add('hidden');if(state==='menu')$('show-board').focus();}
  function requestName(){if(state!=='menu'&&state!=='result')return;$('player-name').value=lastPlayerName;$('player-name').removeAttribute('aria-invalid');$('name-error').textContent='';$('name-panel').classList.remove('hidden');$('player-name').focus();$('player-name').select();}
  function cancelName(){$('name-panel').classList.add('hidden');$(state==='result'?'again':'start').focus();}
  $('name-form').addEventListener('submit',e=>{e.preventDefault();const name=cleanName($('player-name').value);if(!name){$('name-error').textContent='先输入你的名字或昵称哦。';$('player-name').setAttribute('aria-invalid','true');$('player-name').focus();return;}playerName=name;lastPlayerName=name;try{localStorage.setItem('sky-hunter-player-name',JSON.stringify(name));}catch{}$('name-panel').classList.add('hidden');start();});
  $('cancel-name').onclick=cancelName;
  $('start').onclick=requestName;$('again').onclick=requestName;$('pause').onclick=pause;$('resume').onclick=resume;$('return-menu').onclick=menu;$('change-level').onclick=menu;$('show-board').onclick=()=>openBoard(level);$('close-board').onclick=closeBoard;
  $('sound').onclick=()=>{sound=!sound;$('sound-label').textContent=sound?'音效开':'音效关';$('sound').setAttribute('aria-label',sound?'关闭捕猎音效':'开启捕猎音效');tone(500,.12);};
  requestAnimationFrame(frame);
})();
