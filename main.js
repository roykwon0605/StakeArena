(() => {
  // ===== Helpers / Tabs =====
  const $ = id => document.getElementById(id);
  const tabs = [...document.querySelectorAll('.tab')];
  function showTab(name){
    for(const t of tabs) t.classList.toggle('active', t.dataset.tab===name);
    for(const s of document.querySelectorAll('.content')) s.classList.remove('show');
    $(name).classList.add('show');
  }
  tabs.forEach(t => t.addEventListener('click', () => showTab(t.dataset.tab)));

  // ===== State / Persistence =====
  const START_BAL = 1000;
  const META_KEY = 'steakarena_meta2';
  const BAL_KEY  = 'steakarena_balance2';

  const meta = JSON.parse(localStorage.getItem(META_KEY) || '{"sword":1,"armor":1,"luck":0,"rank":0}');
  let balance = Number(localStorage.getItem(BAL_KEY) || START_BAL);

  function saveMeta(){ localStorage.setItem(META_KEY, JSON.stringify(meta)); }
  function setBalance(v){ balance=v; localStorage.setItem(BAL_KEY, String(balance)); updateHUD(); checkGameOver(); }
  function steaks(n){ return Math.max(0, Math.floor(n)); }

  function updateHUD(){
    $('balance').textContent = `Steaks: ${steaks(balance)}`;
    $('gearBadge').textContent = `Knife ${meta.sword} • Apron ${meta.armor} • Sauce ${meta.luck}`;
    $('rankBadge').textContent = `Rank ${meta.rank}`;
  }

  // ===== Popup & Toast =====
  function showPopup(msg, title="Notice"){
    $('popupTitle').textContent = title;
    $('popupMsg').textContent = msg;
    $('popup').classList.add('show');
    $('popupOk').onclick = () => $('popup').classList.remove('show');
  }
  function showWin(amount){
    const a = steaks(amount);
    $('lastWin').textContent = `Last +${a}`;
    const t = $('toast'); t.textContent = `+${a} 🥩`; t.classList.add('show');
    steakRain(14);
    setTimeout(()=>t.classList.remove('show'), 1500);
  }

  // ===== Steak Rain =====
  function steakRain(count=12){
    const wrap = $('steakRain');
    const W = window.innerWidth;
    for(let i=0;i<count;i++){
      const s = document.createElement('div');
      s.className = 'steakDrop';
      s.textContent = '🥩';
      s.style.left = (Math.random()*W) + 'px';
      s.style.animationDuration = (1.8 + Math.random()*1.8) + 's';
      s.style.transform = `rotate(${Math.random()*90-45}deg)`;
      wrap.appendChild(s);
      setTimeout(()=>wrap.removeChild(s), 2400);
    }
  }

  // ===== Game Over / Restart =====
  function checkGameOver(){
    if(balance <= 0){
      disableAll(true);
      $('finalScore').textContent = `Rank ${meta.rank}`;
      $('gameOver').classList.add('show');
    }
  }
  function disableAll(on){ document.querySelectorAll('button, input').forEach(el=>{ if(el.id!=='restartBtn') el.disabled=on; }); }
  function fullRestart(){
    meta.sword=1; meta.armor=1; meta.luck=0; meta.rank=0; saveMeta();
    balance=START_BAL; localStorage.setItem(BAL_KEY, String(balance));
    resetBoard(); refreshShop(); updateHUD();
    stopCursor();
    $('hpHero').style.width='100%'; $('hpBoss').style.width='100%';
    $('bossInfo').textContent='—'; updatePowerBar();
    $('startFight').disabled=false; $('btnStrike').disabled=true; $('btnFlee').disabled=true;
    document.querySelectorAll('button, input').forEach(el=>el.disabled=false);
    $('gameOver').classList.remove('show'); $('popup').classList.remove('show');
    showTab('mines');
  }
  $('restartBtn').addEventListener('click', fullRestart);
  $('restartAll').addEventListener('click', ()=>{
    showPopup('Restart the whole steakiverse?','Restart Game');
    $('popupOk').onclick = ()=>{ $('popup').classList.remove('show'); fullRestart(); };
  });

  // ===== MINES =====
  const gridEl=$('grid'), tileTpl=$('tileTpl');
  const betInput=$('betInput'), betInc=$('betInc'), betDec=$('betDec'),
        betHalf=$('betHalf'), betDouble=$('betDouble'), betMax=$('betMax');
  const bombsRange=$('bombs'), bombsOut=$('bombsOut');
  const startBtn=$('startBtn'), cashoutBtn=$('cashoutBtn'), resetBtn=$('resetBtn');
  const revealsEl=$('reveals'), safeLeftEl=$('safeLeft'), multEl=$('mult'), potentialEl=$('potential');

  const SIZE=5, CELLS=SIZE*SIZE, HOUSE_EDGE=0.99;
  let mines={inPlay:false,bombs:Number(bombsRange.value),bet:Number(betInput.value),
    bombSet:new Set(),revealed:new Set(),picks:0,multiplier:1,potential:0,shield:0};

  function rndInt(n){return Math.floor(Math.random()*n);}
  function chooseBombs(c){const s=new Set();while(s.size<c)s.add(rndInt(CELLS));return s;}
  function nextStepFactor(N,B,k){const r=N-k,s=(N-B)-k;return r/s;}

  // live preview of next multiplier when NOT in play
  function nextPreview(){
    const B = Number(bombsRange.value);
    return HOUSE_EDGE * (CELLS/(CELLS - B));
  }

  function updateMinesStats(){
    if(mines.inPlay){
      const safeLeft=CELLS-mines.bombs-mines.revealed.size;
      revealsEl.textContent=mines.revealed.size;
      safeLeftEl.textContent=safeLeft;
      multEl.textContent=`${mines.multiplier.toFixed(2)}×`;
      potentialEl.textContent=`${Math.max(0, Math.floor(mines.potential))}`;
      cashoutBtn.disabled=!(mines.inPlay && mines.revealed.size>0);
      startBtn.disabled=true;
    }else{
      // preview mode
      const B = Number(bombsRange.value);
      const safeLeft = CELLS - B;
      revealsEl.textContent = 0;
      safeLeftEl.textContent = safeLeft;
      multEl.textContent = `${nextPreview().toFixed(2)}× next`;
      potentialEl.textContent = `0`;
      cashoutBtn.disabled=true;
      startBtn.disabled=false;
    }
  }

  function renderGrid(){
    gridEl.innerHTML='';
    for(let i=0;i<CELLS;i++){
      const n=tileTpl.content.firstElementChild.cloneNode(true);
      n.dataset.idx=String(i);
      n.addEventListener('click',onTileClick);
      gridEl.appendChild(n);
    }
  }

  function resetBoard(){
    mines={...mines,inPlay:false,bombSet:new Set(),revealed:new Set(),picks:0,multiplier:1,potential:0,shield:0};
    for(const t of gridEl.querySelectorAll('.tile')){
      t.className='tile'; t.disabled=false; t.textContent=''; t.removeAttribute('data-state');
    }
    updateMinesStats();
  }

  function startRound(){
    const bet=Math.floor(Number(betInput.value));
    if(!Number.isFinite(bet)||bet<=0) return showPopup('Enter a valid bet, chef!');
    if(bet>balance) return showPopup('Not enough steaks.');

    mines.bet=bet; mines.bombs=Number(bombsRange.value);
    mines.inPlay=true; mines.bombSet=chooseBombs(mines.bombs);
    mines.revealed.clear(); mines.picks=0; mines.multiplier=1; mines.potential=0;
    mines.shield = meta.luck>0 ? 1 : 0;

    for(const t of gridEl.querySelectorAll('.tile')){
      t.className='tile'; t.disabled=false; t.textContent=''; t.removeAttribute('data-state');
    }
    updateMinesStats();
  }

  function revealAllBombs(){
    for(const tile of gridEl.querySelectorAll('.tile')){
      if(mines.bombSet.has(+tile.dataset.idx)){ tile.classList.add('bomb'); tile.textContent='🔥'; }
      tile.disabled=true;
    }
  }

  function onTileClick(e){
    const tile=e.currentTarget;
    if(!mines.inPlay || tile.dataset.state==='safe' || tile.classList.contains('bomb'))return;
    const idx=+tile.dataset.idx;

    if(mines.bombSet.has(idx)){
      if(mines.shield>0){
        mines.shield=0; meta.luck=0; saveMeta(); refreshShop(); updateHUD();
        tile.classList.add('safe','shield'); tile.textContent='🛡️';
      }else{
        tile.classList.add('bomb'); tile.textContent='🔥'; revealAllBombs();
        mines.inPlay=false;
        setBalance(balance - mines.bet);
      }
      updateMinesStats(); return;
    }

    // Safe tile = steak
    tile.classList.add('safe'); tile.dataset.state='safe'; tile.textContent='🥩';
    mines.revealed.add(idx);

    const step=nextStepFactor(CELLS,mines.bombs,mines.picks);
    mines.picks++; mines.multiplier*=step*HOUSE_EDGE;
    mines.potential=Math.floor(mines.bet*mines.multiplier);

    const profit = Math.max(0, mines.potential - mines.bet);
    const gain=document.createElement('div'); gain.className='gain'; gain.textContent=`+${profit}`;
    tile.appendChild(gain); tile.classList.add('show-gain');

    if(mines.revealed.size >= CELLS - mines.bombs) doCashout(true);
    updateMinesStats();
  }

  function doCashout(auto=false){
    if(!mines.inPlay)return;
    if(mines.revealed.size===0){ if(!auto) showPopup('Reveal at least one safe tile.'); return; }

    const payout=Math.max(0, Math.floor(mines.bet*mines.multiplier));
    const profit=Math.max(0, payout - mines.bet);

    setBalance(balance + profit);
    showWin(profit);
    mines.inPlay=false;
    for(const t of gridEl.querySelectorAll('.tile')) t.disabled=true;
    updateMinesStats();
  }

  // Mines wiring + live preview on slider
  bombsRange.addEventListener('input',()=>{
    bombsOut.textContent=bombsRange.value;
    if(!mines.inPlay){
      mines.bombs = Number(bombsRange.value);
      mines.revealed.clear(); mines.multiplier=1; mines.potential=0;
    }
    updateMinesStats();
  });
  betInc.addEventListener('click',()=>betInput.value=Math.floor(+betInput.value+10));
  betDec.addEventListener('click',()=>betInput.value=Math.max(1,Math.floor(+betInput.value-10)));
  betHalf.addEventListener('click',()=>betInput.value=Math.max(1,Math.floor(+betInput.value/2)));
  betDouble.addEventListener('click',()=>betInput.value=Math.floor(+betInput.value*2));
  betMax.addEventListener('click',()=>betInput.value=Math.max(1,Math.floor(balance)));
  startBtn.addEventListener('click',startRound);
  cashoutBtn.addEventListener('click',()=>doCashout(false));
  resetBtn.addEventListener('click',resetBoard);

  // ===== SHOP =====
  function priceSword(){return 250*meta.sword;}
  function priceArmor(){return 200*meta.armor;}
  function priceLuck(){return 300;}

  function refreshShop(){
    $('swordLvl').textContent=meta.sword;
    $('armorLvl').textContent=meta.armor;

    const luckOwned = meta.luck > 0;
    $('luckLvl').textContent = luckOwned ? '1' : '0';

    $('swordPrice').textContent=`Cost: ${priceSword()} 🥩`;
    $('armorPrice').textContent=`Cost: ${priceArmor()} 🥩`;
    $('luckPrice').textContent = luckOwned ? 'Owned' : `Cost: ${priceLuck()} 🥩`;

    const buyLuckBtn = $('buyLuck');
    buyLuckBtn.disabled = luckOwned;
    buyLuckBtn.classList.toggle('disabled', luckOwned);
    buyLuckBtn.textContent = luckOwned ? 'Owned' : 'Buy';
    updateHUD();
  }
  $('buySword').onclick=()=>{const c=priceSword();if(balance<c)return showPopup('Not enough steaks.','Shop');setBalance(balance-c);meta.sword++;saveMeta();refreshShop();};
  $('buyArmor').onclick=()=>{const c=priceArmor();if(balance<c)return showPopup('Not enough steaks.','Shop');setBalance(balance-c);meta.armor++;saveMeta();refreshShop();};
  $('buyLuck').onclick=()=>{ if(meta.luck>0) return showPopup('You already have Sauce of Fortune. Use it first, then rebuy.','Shop'); const c=priceLuck(); if(balance<c)return showPopup('Not enough steaks.','Shop'); setBalance(balance-c); meta.luck=1; saveMeta(); refreshShop(); };

  // ===== ARENA (Challenge Mode) =====
  const BOSS={name:'Giant Cow',baseHp:140,baseAtk:12,sprite:'🐄'};
  const REWARD_BASE=200, REWARD_PER_RANK=50;

  const startFight=$('startFight'), btnStrike=$('btnStrike'), btnFlee=$('btnFlee');
  const hpHero=$('hpHero'), hpBoss=$('hpBoss'), bossInfo=$('bossInfo');
  const heroSprite=$('heroSprite'), bossSprite=$('bossSprite'), cursor=$('cursor');
  const powerFill=$('powerFill'), powerPct=$('powerPct');

  let fight={active:false,heroHp:0,heroHpMax:0,bossHp:0,bossHpMax:0,turn:0,cursorDir:1,cursorX:0,cursorLoop:null,_atkBase:0};

  function heroAtk(){return 12+8*(meta.sword-1);}
  function heroHP(){return 60+18*(meta.armor-1);}
  function setHp(el,cur,max){el.style.width=Math.max(0,100*cur/max)+'%';}
  function scale(x,p=0.22){return Math.round(x*(1+p*meta.rank));}

  function updatePowerBar(){
    const pct = Math.min(300, 100 + meta.rank*15);
    powerFill.style.width = Math.min(100, pct/3) + '%';
    powerFill.style.filter = `hue-rotate(${Math.min(120, meta.rank*6)}deg)`;
    powerPct.textContent = `${pct}%`;
  }

  function startCursor(){
    cursor.style.left='0%';fight.cursorX=0;fight.cursorDir=1;stopCursor();
    const base = 1.8 + meta.rank*0.35;
    const step = base;
    fight.cursorLoop=setInterval(()=>{
      fight.cursorX+=fight.cursorDir*step;
      if(fight.cursorX>=100){fight.cursorX=100;fight.cursorDir=-1;}
      if(fight.cursorX<=0){fight.cursorX=0;fight.cursorDir=1;}
      cursor.style.left=fight.cursorX+'%';
    },12);
  }
  function stopCursor(){ if(fight.cursorLoop){ clearInterval(fight.cursorLoop); fight.cursorLoop=null; } }

  function startArena(){
    const hp=scale(BOSS.baseHp), atk=scale(BOSS.baseAtk);
    fight.active=true; fight.turn=0; fight._atkBase=atk;
    fight.heroHpMax=heroHP(); fight.heroHp=fight.heroHpMax;
    fight.bossHpMax=hp; fight.bossHp=hp;

    bossSprite.textContent=BOSS.sprite;
    bossInfo.textContent=`${BOSS.name} • ATK ${atk} • Reward +${REWARD_BASE + REWARD_PER_RANK*meta.rank} 🥩`;
    setHp(hpHero,fight.heroHp,fight.heroHpMax);
    setHp(hpBoss,fight.bossHp,fight.bossHpMax);

    btnStrike.disabled=false; btnFlee.disabled=false; startFight.disabled=true;
    updatePowerBar();
    startCursor();
  }

  function heroStrike(){
    if(!fight.active)return;
    const x=fight.cursorX;
    let mult=0; if(x>=40&&x<=60) mult=1.8; else if(x>=30&&x<=70) mult=1.0;
    heroSprite.classList.add('attack'); setTimeout(()=>heroSprite.classList.remove('attack'),180);
    const dmg=Math.round(heroAtk()*mult*(0.9+Math.random()*0.2));
    if(dmg<=0){ bossAttack(); return; }

    bossSprite.classList.add('shake','hit'); setTimeout(()=>bossSprite.classList.remove('shake','hit'),350);
    fight.bossHp-=dmg; setHp(hpBoss,fight.bossHp,fight.bossHpMax);

    if(fight.bossHp<=0){
      const reward = REWARD_BASE + REWARD_PER_RANK*meta.rank;
      setBalance(balance + reward);
      showWin(reward);
      meta.rank++; saveMeta(); updateHUD(); updatePowerBar(); steakRain(18);
      endArena(true); return;
    }
    bossAttack();
  }

  function bossAttack(){
    if(!fight.active)return;
    fight.turn++;
    const enr=Math.floor(fight.turn/3);
    const atkNow=Math.round(fight._atkBase*Math.pow(1.12,enr));
    bossInfo.textContent=`${BOSS.name} • ATK ${atkNow} • Rank ${meta.rank}`;
    bossSprite.classList.add('attack'); setTimeout(()=>bossSprite.classList.remove('attack'),180);
    const dmg=Math.round(atkNow*(0.85+Math.random()*0.3));
    heroSprite.classList.add('shake','hit'); setTimeout(()=>heroSprite.classList.remove('shake','hit'),350);
    fight.heroHp-=dmg; setHp(hpHero,fight.heroHp,fight.heroHpMax);
    if(fight.heroHp<=0){
      stopCursor();
      disableAll(true);
      $('finalScore').textContent = `Rank ${meta.rank}`;
      $('gameOver').classList.add('show');
      fight.active=false;
    }
  }

  function endArena(){
    fight.active=false; btnStrike.disabled=true; btnFlee.disabled=true; startFight.disabled=false; stopCursor();
  }

  // Arena wiring
  $('startFight').addEventListener('click', startArena);
  $('btnStrike').addEventListener('click', heroStrike);
  $('btnFlee').addEventListener('click', ()=>{
    if(!fight.active)return; stopCursor(); disableAll(true);
    $('finalScore').textContent = `Rank ${meta.rank}`;
    $('gameOver').classList.add('show');
  });
  window.addEventListener('keydown', e=>{ if(e.code==='Space'){ e.preventDefault(); heroStrike(); } });

  // ===== Boot =====
  function refreshShop(){
    $('swordLvl').textContent=meta.sword;
    $('armorLvl').textContent=meta.armor;

    const luckOwned = meta.luck > 0;
    $('luckLvl').textContent = luckOwned ? '1' : '0';

    $('swordPrice').textContent=`Cost: ${250*meta.sword} 🥩`;
    $('armorPrice').textContent=`Cost: ${200*meta.armor} 🥩`;
    $('luckPrice').textContent = luckOwned ? 'Owned' : `Cost: 300 🥩`;

    const buyLuckBtn = $('buyLuck');
    buyLuckBtn.disabled = luckOwned;
    buyLuckBtn.classList.toggle('disabled', luckOwned);
    buyLuckBtn.textContent = luckOwned ? 'Owned' : 'Buy';
    updateHUD();
  }

  $('buySword').onclick=()=>{const c=250*meta.sword;if(balance<c)return showPopup('Not enough steaks.','Shop');setBalance(balance-c);meta.sword++;saveMeta();refreshShop();};
  $('buyArmor').onclick=()=>{const c=200*meta.armor;if(balance<c)return showPopup('Not enough steaks.','Shop');setBalance(balance-c);meta.armor++;saveMeta();refreshShop();};
  $('buyLuck').onclick=()=>{ if(meta.luck>0) return showPopup('You already have Sauce of Fortune. Use it first, then rebuy.','Shop'); const c=300; if(balance<c)return showPopup('Not enough steaks.','Shop'); setBalance(balance-c); meta.luck=1; saveMeta(); refreshShop(); };

  function init(){
    updateHUD(); refreshShop(); renderGrid(); resetBoard(); updatePowerBar();
    bombsOut.textContent=bombsRange.value;
    updateMinesStats(); // ensure preview shows at load
  }
  init();
})();
