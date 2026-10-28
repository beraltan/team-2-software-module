import {runtime} from './browser.mjs';
import {mapProjection} from './spatial.mjs';
import {SKIDULE_BARS} from './skidule.mjs';
import {bootHardwareTest} from './test-ui.mjs';
import {mountVaultPanel} from './vault-ui.mjs';
if(new URLSearchParams(location.search).has('test'))bootHardwareTest();else{
const $=id=>document.getElementById(id);
let snapshot=null,audio=null,sound=false,lastEvent=null,dismissedOutcome=null,shownOutcome=null;
let vaultError='';
const renderVault=mountVaultPanel($('vaultDoorPanel'),{onSelect:source=>vaultAction({action:'vault_source',source}),onCommand:command=>vaultAction({action:'vault_command',command})});
async function vaultAction(data){try{const r=await runtime.requestAction(data),d=await r.json();vaultError=d.error||'';}catch(e){vaultError=e.message;}}
function beep(freq=440){if(!sound)return;audio??=new AudioContext();const o=audio.createOscillator(),g=audio.createGain();o.connect(g);g.connect(audio.destination);o.frequency.value=freq;g.gain.setValueAtTime(.07,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.25);o.start();o.stop(audio.currentTime+.25)}
function draw(){
 if(!snapshot)return;const game=snapshot.game,c=$('map'),r=c.getBoundingClientRect(),dpr=window.devicePixelRatio||1;
 if(!r.width)return;
 c.width=r.width*dpr;c.height=r.height*dpr;const g=c.getContext('2d');g.scale(dpr,dpr);
 const {point,scale}=mapProjection(game.config.play,r.width,r.height),[l,rr,n,f]=game.config.play;
 function box(b,color,label){const [x,y]=point(b[0],b[3]);g.fillStyle=color+'22';g.strokeStyle=color;g.lineWidth=1.5;g.fillRect(x,y,(b[1]-b[0])*scale,(b[3]-b[2])*scale);g.strokeRect(x,y,(b[1]-b[0])*scale,(b[3]-b[2])*scale);g.fillStyle=color;g.font='bold 10px system-ui';g.fillText(label,x+4,y+13)}
 const [ox,oy]=point(0,0);g.save();g.beginPath();const [bx,by]=point(l-200,f+200);g.rect(bx,by,(rr-l+400)*scale,(f+200)*scale);g.clip();g.setLineDash([5,5]);g.strokeStyle='#587081';g.beginPath();for(const sign of [-1,1]){g.moveTo(ox,oy);g.lineTo(...point(sign*6000*Math.sin(Math.PI/3),3000))}g.stroke();g.restore();
 box(game.config.play,'#486677','PLAY AREA');g.strokeStyle='#233b4e';g.lineWidth=1;
 for(let x=Math.ceil(l/500)*500;x<=rr;x+=500){g.beginPath();g.moveTo(...point(x,n));g.lineTo(...point(x,f));g.stroke()}
 for(let y=Math.ceil(n/500)*500;y<=f;y+=500){g.beginPath();g.moveTo(...point(l,y));g.lineTo(...point(rr,y));g.stroke()}
 for(const z of game.zones??[])box(z,'#ff6c75',game.maze?'':'RESTRICTED');box(game.config.start,'#8eb8d2','START');box(game.config.goal,'#79e6c4','VAULT');
 g.fillStyle='#8aa1b6';g.font='11px system-ui';for(const y of [n,f]){const [x,p]=point(l,y);g.fillText((y/1000).toFixed(1)+' m',x-40,p)}
 g.fillStyle='#79e6c4';g.beginPath();g.arc(ox,oy,5,0,Math.PI*2);g.fill();g.textAlign='center';g.fillText('RADAR (0, 0) · +Y ↑',ox,oy+20);g.textAlign='left';
 if(game.valid&&game.point){const [x,y]=point(game.point.x,game.point.y);g.fillStyle='#75d5ff';g.beginPath();g.arc(x,y,7,0,Math.PI*2);g.fill();g.fillStyle='#e8f7ff';g.fillText('PLAYER ESTIMATE',x+10,y-8)}
 else{g.fillStyle='#ffb391';g.fillText('No unambiguous player position',20,20)}
 $('fieldSize').textContent=((rr-l)/1000).toFixed(1)+' × '+((f-n)/1000).toFixed(1)+' m play area';$('fieldDimensions').textContent='X '+l/1000+' to '+rr/1000+' m · Y '+n/1000+' to '+f/1000+' m. ';
}
const objectiveCopy={
 navigation:['ACT 01 / SURVEILLANCE','Guide your partner across the floor.','Only you can see the security walls. Use the camera light to get your partner to the vault.'],
 skidule:['ACT 02 / VAULT LOCK','Four tumblers. One secret code.','Your partner turns the potentiometer and moves the slider. Match and lock all four bars to obtain the numerical Morse clue.'],
 morse:['ACT 03 / SYSTEM OVERRIDE','Read the signal. Decode the code.','Your partner sends the numerical clue through Morse. Decode the pulses and enter the passcode to reach the laser stage.'],
 laser:['ACT 04 / LASER GRID','Cross the beams. Release the vault.','Every broken beam costs your shared clock. Reach the physical finish button to release the vault.'],
 escape:['ACT 05 / GETAWAY','Take the money. Get back to safety.','All four stages are complete and the vault release has been commanded. Guide your partner back to the marked safe zone before the clock runs out.']
};
async function update(){
 try{
  const response=await runtime.requestState();if(!response.ok)throw Error('Controller unavailable');snapshot=await response.json();const g=snapshot.game,t=Math.ceil(g.remaining_s);
  $('timer').textContent=String(Math.floor(t/60)).padStart(2,'0')+':'+String(t%60).padStart(2,'0');
  $('phase').textContent={idle:'BRIEFING',armed:'ARMED',running:'HEIST LIVE',won:'ESCAPED',lost:'LOCKDOWN',fault:'CONNECTION FAULT'}[g.state];
  document.querySelector('.heist-console').dataset.state=g.state;
  const copy=objectiveCopy[g.phase];$('actLabel').textContent=copy[0];$('headline').textContent=copy[1];$('message').textContent=copy[2];
  if(g.state==='idle'){$('headline').textContent='Get your partner back with the money.';$('message').textContent='Check the play area and place your partner in the safe zone. Arm the heist when your crew is ready.';}
  if(g.state==='armed'){$('headline').textContent='Crew ready. Make your move.';$('message').textContent='The ten-minute clock starts when your partner leaves the safe zone. The map controls move the infiltrator in offline practice.';}
  if(g.state==='won'){$('headline').textContent='The money is out. So are you.';$('message').textContent='Heist complete. Your crew made it back to the safe zone.';}
  if(g.state==='lost'){$('headline').textContent='The bank is in lockdown.';$('message').textContent=g.reason+'. Reset the heist for another attempt.';}
  if(g.state==='fault'){$('headline').textContent='Your connection to the inside is down.';$('message').textContent=g.reason+'. Check the kit, then reset the heist.';}
  $('penalties').textContent=g.penalties+' / '+g.config.max_anomalies;
  $('timeDeducted').textContent=(g.penalties*g.config.penalty_s)+' seconds lost to security';
  const dots=$('anomalyDots');if(dots.children.length!==g.config.max_anomalies)dots.replaceChildren(...Array.from({length:g.config.max_anomalies},()=>document.createElement('i')));[...dots.children].forEach((dot,i)=>dot.classList.toggle('hit',i<g.penalties));
  $('rulesText').textContent='Wall or beam violation: -'+g.config.penalty_s+'s and one anomaly. '+g.config.max_anomalies+' anomalies trigger lockdown.';
  const phaseIndex=Object.keys(objectiveCopy).indexOf(g.phase);document.querySelectorAll('[data-phase]').forEach((el,i)=>{el.classList.toggle('current',i===phaseIndex&&g.state!=='won');el.classList.toggle('done',i<phaseIndex||g.state==='won');if(i===phaseIndex)el.setAttribute('aria-current','step');else el.removeAttribute('aria-current');});
  const b=g.config.start,p=g.point,inStart=p&&p.x>=b[0]&&p.x<=b[1]&&p.y>=b[2]&&p.y<=b[3];
  $('start').disabled=!(g.state==='idle'&&(g.bypassed||g.setup_checked&&g.valid&&inStart));$('start').hidden=g.state!=='idle';
  const active=['armed','running'].includes(g.state);$('abortHeist').disabled=!active;$('resumeHeist').disabled=g.state!=='fault';$('resetHeist').disabled=active;$('confirmEscape').disabled=g.state!=='running'||g.phase!=='escape';
  $('suspicion').textContent=Math.round(g.suspicion*100)+'%';$('fill').style.width=(g.suspicion*100)+'%';
  $('tracking').textContent=g.valid?'One valid player':snapshot.fresh?'Tracking uncertain':'Waiting for radar';
  $('position').textContent=g.point?`${(g.point.x/1000).toFixed(2)} / ${(g.point.y/1000).toFixed(2)} m`:'-';
  $('cameraStatusLabel').textContent=g.phase==='escape'?'Return to the safe zone':g.navigation_complete?'Floor crossed':'Entry route';
  $('guideState').textContent=snapshot.guidance_supported?g.guidance.toUpperCase():'Waiting for compatible camera';$('led').textContent=snapshot.led;
  document.querySelectorAll('[data-guide]').forEach(button=>button.disabled=g.state!=='running'||!['navigation','escape'].includes(g.phase)||!g.valid||!snapshot.guidance_supported);
  $('mazeInfo').textContent=g.phase==='escape'?'Return through the floor to the blue safe zone. The heist ends when your partner is safely back.':g.maze?'Hidden security layout / '+g.maze.difficulty+' / '+g.maze.cols+' x '+g.maze.rows+' passages. Guide your partner around the red walls.':'The security layout is generated when you arm the heist.';
  $('connection').textContent=snapshot.mode==='demo'?'OFFLINE PRACTICE':snapshot.connected?'CREW CONNECTED':'CREW OFFLINE';$('connection').className='badge '+(snapshot.mode==='demo'||snapshot.connected?'live':'bad');
  $('network').textContent=snapshot.mode==='demo'?'Offline practice. Your crew is simulated.':snapshot.connected?'Team 2 control link active.':'Waiting for the crew connection.';
  const penalty=g.last_penalty,recent=penalty&&performance.now()/1000-penalty.at<6;$('laserPenaltyNotice').hidden=!recent;
  if(penalty){$('laserPenaltyTitle').textContent=(penalty.reason==='laser cut'?'Beam broken':'Security wall crossed')+' / -'+penalty.seconds+'s';$('laserPenaltyText').textContent='Shared heist clock / '+g.penalties+' of '+g.config.max_anomalies+' anomalies';}
  $('events').replaceChildren(...g.events.slice().reverse().map(e=>Object.assign(document.createElement('li'),{textContent:e.event.toUpperCase()+(e.reason?' / '+e.reason:'')})));
  const event=g.events.at(-1);if(event&&lastEvent!==event.at+event.event){if(lastEvent!==null)beep(event.event==='won'?880:event.event==='penalty'?220:440);lastEvent=event.at+event.event;}
  renderModules(snapshot);renderVault(snapshot.vault,{connected:snapshot.connected,demo:snapshot.mode==='demo',canControl:snapshot.vault_can_control,error:vaultError});$('vaultDoorSummary').textContent=snapshot.mode==='demo'?'Simulated latch':!snapshot.vault.fresh?'Waiting for ESP':snapshot.vault.data.mode==='manual'?'Manual override':snapshot.vault.data.commanded==='unlock'?'Unlock commanded':'Automatic latch';renderOutcome(snapshot);draw();
 }catch(error){$('connection').textContent='CONTROLLER OFFLINE';$('start').disabled=true;$('headline').textContent='Control link interrupted';$('message').textContent=error.message;snapshot=null;document.querySelectorAll('[data-guide]').forEach(b=>b.disabled=true);releaseGuide();}
 setTimeout(update,100);
}
async function heistAction(data){try{const response=await runtime.requestAction(data);const result=await response.json();$('actionError').textContent=result.error||'';}catch(error){$('actionError').textContent=error.message;}}
$('start').onclick=()=>heistAction({action:'start'});
$('openObjective').onclick=()=>moduleAction({action:'module',module:({navigation:'camera',escape:'camera'})[snapshot?.game.phase]||snapshot?.game.phase||'camera'});
$('abortHeist').onclick=()=>heistAction({action:'heist_abort'});
$('resumeHeist').onclick=()=>heistAction({action:'heist_resume'});
$('resetHeist').onclick=()=>heistAction({action:'heist_reset'});
$('confirmEscape').onclick=()=>heistAction({action:'escape_confirm'});
$('sound').onclick=()=>{sound=!sound;$('sound').textContent=sound?'Sound on':'Sound off';if(sound)beep(660)};
window.addEventListener('resize',draw);update();

// Dead-man controls: renew while held; release/focus loss stops, and authority expires stale input.
let heldGuide=null,guideTimer=null,guideBusy=false;
async function sendGuide(direction){if(guideBusy&&direction!=='stop')return;guideBusy=true;try{const r=await runtime.requestAction({action:'guide',direction});const d=await r.json();if(d.error&&direction!=='stop')$('actionError').textContent=d.error;}catch(e){if(direction!=='stop')$('actionError').textContent='Guidance connection lost';}finally{guideBusy=false}}
function releaseGuide(){if(!heldGuide)return;heldGuide=null;clearInterval(guideTimer);sendGuide('stop');}
document.querySelectorAll('[data-guide]').forEach(b=>{b.style.touchAction='none';b.addEventListener('pointerdown',e=>{if(b.disabled)return;e.preventDefault();releaseGuide();heldGuide=b.dataset.guide;b.setPointerCapture(e.pointerId);sendGuide(heldGuide);guideTimer=setInterval(()=>heldGuide&&sendGuide(heldGuide),250);});b.addEventListener('pointerup',releaseGuide);b.addEventListener('pointercancel',releaseGuide);b.addEventListener('lostpointercapture',releaseGuide);b.addEventListener('keydown',e=>{if((e.key===' '||e.key==='Enter')&&!e.repeat&&!b.disabled){e.preventDefault();heldGuide=b.dataset.guide;sendGuide(heldGuide);guideTimer=setInterval(()=>heldGuide&&sendGuide(heldGuide),250);}});b.addEventListener('keyup',releaseGuide);b.addEventListener('blur',releaseGuide);});
window.addEventListener('blur',releaseGuide);document.addEventListener('visibilitychange',()=>{if(document.hidden)releaseGuide()});

// Both panels share runtime and transport; choosing a card never unloads the game.
const lockBarElements=[];
for(let i=0;i<SKIDULE_BARS;i++){
 const bar=document.createElement('div');bar.className='lock-bar';
 const number=document.createElement('span');number.className='bar-number';number.textContent=String(i+1).padStart(2,'0');
 const track=document.createElement('div');track.className='bar-track';
 const fill=document.createElement('div');fill.className='bar-fill';track.append(fill);
 const state=document.createElement('span');state.className='bar-state';state.setAttribute('aria-hidden','true');state.textContent='—';
 bar.append(number,track,state);$('lockBars').append(bar);lockBarElements.push({bar,fill,state});
 const option=document.createElement('option');option.value=i;option.textContent='Bar '+(i+1);$('demoLockBar').append(option);
}
let lockDeviceOptions='';
const setText=(id,text)=>{if($(id).textContent!==text)$(id).textContent=text;};
function renderModules(s){
 const lock=s.skidule,morse=s.morse,active=s.active_module,isLock=active==='skidule',isMorse=active==='morse',demo=s.mode==='demo';
 $('cameraModule').hidden=active!=='camera';$('skiduleModule').hidden=!isLock;$('morseModule').hidden=!isMorse;$('laserModule').hidden=active!=='laser';$('cameraGuidance').hidden=active!=='camera';
 for(const name of ['camera','skidule','morse','laser']){
  const model=name==='camera'?s.game:s[name];
  const complete=name==='camera'?model.navigation_complete:model.state==='solved';
  const card=$(name+'Card');card.classList.toggle('selected',active===name);card.classList.toggle('complete',complete);card.classList.toggle('bypassed',name==='laser'?model.module_bypassed:model.bypassed);card.setAttribute('aria-pressed',String(active===name));
 }
 const cameraLabel={idle:'Ready',armed:'Awaiting departure',running:'In progress',won:'✓ Complete',lost:'Reset needed',fault:'Check connection'}[s.game.state];
 setText('cameraCardState',s.game.bypassed?'Passed \u00b7 bypass':s.game.navigation_complete?'Floor crossed':cameraLabel);
 setText('skiduleCardState',lock.bypassed?'Passed \u00b7 bypass':lock.state==='solved'?'✓ Complete':lock.state==='running'?lock.locked_count+' / '+SKIDULE_BARS+' locked':lock.state==='fault'?'Check connection':'Ready');
 setText('moduleSummary',((s.game.navigation_complete?1:0)+(lock.state==='solved'?1:0)+(morse.state==='solved'?1:0)+(s.laser.state==='solved'?1:0))+' of 4 modules complete');
 $('bypassCamera').disabled=s.game.navigation_complete;$('bypassSkidule').disabled=lock.state==='solved';$('bypassMorse').disabled=morse.state==='solved';
 $('bypassLaser').disabled=s.laser.state==='solved';
 const bypasses=[s.game.bypassed?'Camera':null,lock.bypassed?'Skidule':null,morse.bypassed?'Morse':null,s.laser.module_bypassed?'Laser':null].filter(Boolean);
 setText('bypassStatus',bypasses.length?'Passed by presenter bypass: '+bypasses.join(', ')+'.':'');
 setText('lockProgress',lock.bypassed?'PRESENTER PASS':lock.locked_count+' / '+SKIDULE_BARS+' LOCKED');
 $('lockSelected').replaceChildren(document.createTextNode(String(lock.selected+1).padStart(2,'0')),Object.assign(document.createElement('small'),{textContent:' / '+SKIDULE_BARS}));
 const feedback=lock.bypassed?'bypass':lock.state==='solved'?'match':lock.state==='running'?lock.feedback:'ready';
 const labels={ready:['○','READY'],cold:['◇','COLD'],warm:['△','WARM'],match:['◎','MATCH'],bypass:['\u21b7','BYPASSED']};
 $('lockFeedback').dataset.feedback=feedback;setText('lockFeedbackSymbol',labels[feedback][0]);setText('lockFeedbackText',labels[feedback][1]);
 lockBarElements.forEach(({bar,fill,state},i)=>{
  bar.classList.toggle('selected',i===lock.selected);bar.classList.toggle('locked',lock.locked[i]);bar.dataset.feedback=i===lock.selected?feedback:'ready';
  fill.style.height=(lock.heights[i]*100)+'%';state.textContent=lock.locked[i]?'●':'—';
  bar.setAttribute('aria-label',`Bar ${i+1}, ${Math.round(lock.heights[i]*100)} percent, ${lock.locked[i]?'locked':'unlocked'}${i===lock.selected?', selected':''}`);
 });
 setText('lockNotice',lock.notice);$('lockNotice').classList.toggle('solved',lock.state==='solved');$('lockNotice').classList.toggle('bypassed',lock.bypassed);
 $('lockDemo').hidden=!demo;
 const devices=s.skidule_devices;
 const key=JSON.stringify(devices.map(d=>[d.name,d.fresh]));
 if(lockDeviceOptions!==key){
  lockDeviceOptions=key;
  $('lockDevice').replaceChildren(new Option(demo?'Demo controls':'Select Skidule controls',''),...devices.map(d=>new Option(d.name==='demo_skidule'?'Demo controls':d.name+(d.fresh?'':' · offline'),d.name)));
 }
 $('lockDevice').value=lock.source;$('lockDevice').disabled=demo||lock.state==='running';
 const freshDevices=devices.filter(d=>d.fresh),single=demo||(s.connected&&freshDevices.length===1&&freshDevices[0].name===lock.source);
 $('lockDevice').hidden=single;$('lockAuto').hidden=!single;
 setText('lockAuto',demo?'Demo controls':single?'Connected: '+lock.source:'');
 $('lockDeviceLabel').htmlFor=single?'lockAuto':'lockDevice';
 setText('lockDeviceStatus',demo?'Offline demo · no network data':!s.connected?'OOCSI disconnected':lock.fresh?'Controls connected':lock.source?'Controls offline · check ESP power and Wi-Fi':freshDevices.length>1?'Several controls found. Choose your ESP.':'Waiting for the Skidule ESP on this team channel');
 if(lock.input_mapping==='knob_to_four')$('lockDeviceStatus').textContent+=' · legacy knob mapped to four bars';
 $('lockDeviceStatus').classList.toggle('online',demo||lock.fresh&&s.connected);
 $('lockStart').disabled=lock.state!=='idle'||!s.skidule_can_start;
 $('lockReset').disabled=lock.state==='idle';
 $('demoLockBar').value=String(lock.selected);
 if(document.activeElement!==$('demoLockHeight'))$('demoLockHeight').value=String(Math.round(lock.control_height*1000));
 setText('demoLockHeightValue',(lock.control_height*100).toFixed(1)+'%');
 $('demoLockPress').disabled=lock.state!=='running';
 $('demoLockHeight').disabled=lock.state==='solved';$('demoLockBar').disabled=lock.state==='solved';
 setText('cameraCardDetail',s.game.bypassed?'Presenter pass / entry skipped':s.game.navigation_complete?'Entry route secured':s.game.valid?'Radar tracking live':'Radar + directional light cues');
 setText('skiduleCardDetail',lock.bypassed?'Presenter pass / '+lock.locked_count+' bars locked':lock.state==='solved'?'All four tumblers secured':lock.locked_count+' / 4 locked / '+(lock.state==='running'?lock.feedback.toUpperCase():'potentiometer + slider'));
 setText('morseCardDetail',morse.bypassed?'Presenter pass / override skipped':morse.state==='solved'?'Final override accepted':morse.signal_count+' signals received / '+(morse.lamp?'lamp on':'lamp off'));
 setText('laserCardDetail',s.laser.module_bypassed?'Presenter pass / grid skipped':s.laser.state==='solved'?'Finish button reached':s.game.laser_cuts+' beam cuts / '+(s.laser.connected_count?'grid online':'physical finish button'));
 renderMorse(s);renderLaser(s);
}
async function moduleAction(data){
 const errorBox=data.action.startsWith('laser')||data.module==='laser'?'laserModuleError':data.action.startsWith('morse')||data.module==='morse'?'morseError':'lockError';
 try{const response=await runtime.requestAction(data);const result=await response.json();$(errorBox).textContent=result.error||'';}
 catch(error){$(errorBox).textContent=error.message;}
}
document.querySelectorAll('[data-module]').forEach(button=>button.addEventListener('click',()=>{
 releaseGuide();moduleAction({action:'module',module:button.dataset.module});
}));

let morseDeviceOptions='';
let morseSignalKey='';
function renderMorseSignal(morse){
 $('morseLamp').classList.toggle('on',morse.lamp);
 $('morseLamp').setAttribute('aria-label',morse.lamp?'Morse lamp on':'Morse lamp off');
 $('morseLampState').classList.toggle('on',morse.lamp);setText('morseLampState',morse.lamp?'ON':'OFF');
 const key=JSON.stringify([morse.signals,morse.signal_count]);
 if(morseSignalKey!==key){
  morseSignalKey=key;const signals=morse.signals||[],rows=[];
  for(let i=0;i<signals.length;i+=5){
   const row=document.createElement('div');row.className='morse-signal-row';row.setAttribute('role','list');row.setAttribute('aria-label','Five-signal row '+(Math.floor((morse.signal_count-signals.length+i)/5)+1));
   for(let j=0;j<5;j++){const mark=signals[i+j],cell=document.createElement('span');cell.className='morse-signal-cell'+(mark?'':' pending');cell.setAttribute('role','listitem');cell.setAttribute('aria-label',mark==='.'?'Dot':mark==='-'?'Dash':'Waiting for signal');cell.textContent=mark==='.'?'\u2022':mark==='-'?'\u2014':'';row.append(cell);}
   rows.push(row);
  }
  if(!rows.length){const empty=document.createElement('p');empty.textContent='Your partner\'s signals will appear here.';rows.push(empty);}
  $('morseSignals').replaceChildren(...rows);setText('morseSignalCount',String(morse.signal_count||0));
 }
}
function renderMorse(s){
 const m=s.morse,demo=s.mode==='demo',devices=s.morse_devices,fresh=devices.filter(d=>d.fresh);
 renderMorseSignal(m);
 setText('morseCardState',m.bypassed?'Passed \u00b7 bypass':m.state==='solved'?'\u2713 Complete':m.state==='receiving'?'Receiving':m.state==='fault'?'Check connection':m.fresh?'Listening':'Ready');
 setText('morseProgress',m.bypassed?'PRESENTER PASS':m.state==='solved'?'COMPLETE':m.state==='fault'?'RESET NEEDED':m.state==='receiving'?'RECEIVING':'LISTENING');
 const key=JSON.stringify(devices.map(d=>[d.name,d.fresh]));
 if(morseDeviceOptions!==key){morseDeviceOptions=key;$('morseDevice').replaceChildren(new Option('Select Morse device',''),...devices.map(d=>new Option(d.name+(d.fresh?'':' \u00b7 offline'),d.name)));}
 const single=demo||(s.connected&&fresh.length===1&&fresh[0].name===m.source);
 $('morseDevice').value=m.source;$('morseDevice').hidden=single;$('morseDevice').disabled=demo||m.state==='receiving';
 $('morseAuto').hidden=!single;setText('morseAuto',demo?'Demo Morse button':single?'Connected: '+m.source:'');
 $('morseDeviceLabel').htmlFor=single?'morseAuto':'morseDevice';
 setText('morseDeviceStatus',demo?'Offline demo \u00b7 no network data':!s.connected?'OOCSI disconnected':m.fresh?'Morse device connected':m.source?'Device offline \u00b7 check ESP power and Wi-Fi':fresh.length>1?'Several Morse devices found. Choose your ESP.':'Waiting for the Morse ESP on this team channel');
 $('morseDeviceStatus').classList.toggle('online',demo||s.connected&&m.fresh);
 const solved=m.state==='solved';$('morseForm').hidden=solved;$('morseSuccess').hidden=!solved;
 $('morseSuccess').classList.toggle('bypassed',m.bypassed);setText('morseSuccessText',m.notice);
 setText('morseNotice',m.notice);setText('morseFeedback',m.feedback);
 $('morseDemo').hidden=!demo;$('demoMorseButton').disabled=solved||m.state==='fault';
 $('morseClear').disabled=solved;$('morseReset').disabled=m.state==='idle'&&!m.feedback;
 $('morseVerify').disabled=solved||(['armed','running'].includes(s.game.state)&&s.skidule.state!=='solved');
 if(['armed','running'].includes(s.game.state)&&s.skidule.state!=='solved'){setText('morseNotice','The vault lock must be complete before the final override can be accepted. You can still read incoming signals.');}
}
$('morseDevice').onchange=()=>moduleAction({action:'morse_source',source:$('morseDevice').value});
$('morseClear').onclick=async()=>{await moduleAction({action:'morse_clear'});$('morseCode').focus();};
$('morseReset').onclick=async()=>{await moduleAction({action:'morse_reset'});$('morseCode').value='';};
$('morseForm').onsubmit=async e=>{e.preventDefault();await moduleAction({action:'morse_verify',code:$('morseCode').value});$('morseCode').value='';};
let demoMorseHeld=false;
function releaseMorse(){if(!demoMorseHeld)return;demoMorseHeld=false;moduleAction({action:'morse_press',pressed:false});}
const morseButton=$('demoMorseButton');morseButton.style.touchAction='none';
morseButton.addEventListener('pointerdown',e=>{if(morseButton.disabled)return;e.preventDefault();demoMorseHeld=true;morseButton.setPointerCapture(e.pointerId);moduleAction({action:'morse_press',pressed:true});});
for(const event of ['pointerup','pointercancel','lostpointercapture','keyup','blur'])morseButton.addEventListener(event,releaseMorse);
morseButton.addEventListener('keydown',e=>{if([' ','Enter'].includes(e.key)&&!e.repeat&&!morseButton.disabled){e.preventDefault();demoMorseHeld=true;moduleAction({action:'morse_press',pressed:true});}});
window.addEventListener('blur',releaseMorse);
document.addEventListener('visibilitychange',()=>{if(document.hidden)releaseMorse();});
runtime.observeMorse(renderMorseSignal);

function renderLaser(s){
 const g=s.game,laser=s.laser,running=g.state==='running'&&(!g.heist_mode||g.phase==='laser'),seconds=g.config.penalty_s,solved=laser.state==='solved';
 setText('laserCardState',laser.module_bypassed?'Passed \u00b7 bypass':solved?'\u2713 Complete':laser.connected_count?'Connected':'Ready');
 setText('laserProgress',laser.module_bypassed?'BYPASSED':solved?'COMPLETE':'READY');
 setText('laserOutcome',laser.module_bypassed?'Passed by presenter':solved?'Laser grid complete':'Awaiting finish button');
 setText('laserModuleNotice',solved?'Continue to the next module.':'Complete the camera, lock and Morse stages, then cross the grid and press its finish button.');
 $('laserReadout').classList.toggle('solved',solved);$('laserReadout').classList.toggle('bypassed',laser.module_bypassed);
 setText('laserDeviceStatus',s.mode==='demo'?'Offline demo':!s.connected?'OOCSI disconnected':laser.connected_count?'Laser ESP connected':'Waiting for the laser ESP');
 setText('laserCutCount',String(g.laser_cuts));
 setText('laserRules',`Each beam cut costs ${seconds} seconds and one anomaly during the laser stage. The finish button completes Laser and permits the automatic vault release.`);
 $('laserDemo').hidden=s.mode!=='demo';$('demoLaserFinish').disabled=solved||!running||(g.heist_mode&&g.phase!=='laser');
 setText('laserCut',(s.mode==='demo'?'Simulate':'Record')+' laser cut (-'+seconds+'s)');
 $('laserCut').disabled=solved||!running||laser.bypassed||(s.mode==='live'&&!s.connected);
 setText('laserBypass',laser.bypassed?'Enable laser penalties':'Bypass laser penalties');$('laserBypass').setAttribute('aria-pressed',String(laser.bypassed));
 setText('laserStatus',solved?'Laser module complete.':laser.bypassed?'Laser penalties bypassed for this presentation.':!running?'Complete Camera, Skidule and Morse to reach the laser stage.':`${g.laser_cuts} laser cut${g.laser_cuts===1?'':'s'} \u00b7 -${seconds}s and one anomaly per cut${laser.connected_count?' \u00b7 laser ESP connected':''}.`);
}
async function laserAction(data){try{const response=await runtime.requestAction(data);const result=await response.json();$('laserError').textContent=result.error||'';}catch(error){$('laserError').textContent=error.message;}}
$('laserCut').onclick=()=>laserAction({action:'laser_cut'});
$('laserBypass').onclick=()=>laserAction({action:'laser_bypass',bypassed:!snapshot?.laser.bypassed});
$('laserReset').onclick=()=>moduleAction({action:'laser_reset'});
$('demoLaserFinish').onclick=()=>moduleAction({action:'laser_demo_finish'});
$('lockDevice').onchange=()=>moduleAction({action:'skidule_source',source:$('lockDevice').value});
$('lockStart').onclick=()=>moduleAction({action:'skidule_start'});
$('lockReset').onclick=()=>moduleAction({action:'skidule_reset'});
$('demoLockBar').onchange=()=>moduleAction({action:'skidule_demo',bar:Number($('demoLockBar').value)});
$('demoLockHeight').oninput=()=>moduleAction({action:'skidule_demo',height:Number($('demoLockHeight').value)/1000});
$('demoLockPress').onclick=()=>moduleAction({action:'skidule_press'});
document.querySelectorAll('[data-bypass]').forEach(button=>button.addEventListener('click',async()=>{
 releaseGuide();
 try{const response=await runtime.requestAction({action:'bypass',module:button.dataset.bypass});const result=await response.json();$('bypassError').textContent=result.error||'';}
 catch(error){$('bypassError').textContent=error.message;}
}));

function renderOutcome(s){
 const g=s.game,won=g.state==='won',ended=won||g.state==='lost',key=g.round_id+':'+g.state;
 const show=ended&&dismissedOutcome!==key;$('heistOutcome').hidden=!show;
 if(!show){shownOutcome=null;return;}
 $('heistOutcome').dataset.result=won?'won':'lost';
 setText('outcomeEyebrow',won?'OPERATION BANK HEIST / COMPLETE':'OPERATION BANK HEIST / LOCKDOWN');
 setText('outcomeSeal',won?'\u2713':'!');
 $('outcomeTitle').replaceChildren(document.createTextNode(won?'Money secured.':'The bank locked down.'),document.createElement('br'),document.createTextNode(won?'Crew escaped.':'The money stays inside.'));
 setText('outcomeStory',won?'You got in, cracked the vault and brought the money back. Every signal counted. You made it out together.':g.reason+'. Regroup with your partner, check the room and plan your next attempt.');
 setText('outcomeTime',$('timer').textContent);setText('outcomeAnomalies',g.penalties+' / '+g.config.max_anomalies);
 const complete=Number(g.navigation_complete)+Number(s.laser.state==='solved')+Number(s.skidule.state==='solved')+Number(s.morse.state==='solved');setText('outcomeModules',complete+' / 4');
 const bypasses=[g.bypassed?'floor':null,s.laser.module_bypassed?'laser':null,s.skidule.bypassed?'lock':null,s.morse.bypassed?'override':null,g.escape_bypassed?'safe-zone return':null].filter(Boolean);
 $('outcomeBypass').hidden=!bypasses.length;setText('outcomeBypass','Presenter assistance: '+bypasses.join(', ')+'.');
 if(shownOutcome!==key){shownOutcome=key;$('heistOutcome').focus();}
}
$('playAgain').onclick=async()=>{await heistAction({action:'heist_reset'});dismissedOutcome=null;shownOutcome=null;$('heistOutcome').hidden=true;await moduleAction({action:'module',module:'camera'});$('start').focus();};
$('reviewHeist').onclick=()=>{dismissedOutcome=snapshot.game.round_id+':'+snapshot.game.state;$('heistOutcome').hidden=true;$('headline').focus();};
$('heistOutcome').addEventListener('keydown',e=>{if(e.key==='Escape'){$('reviewHeist').click();return;}if(e.key==='Tab'){const first=$('playAgain'),last=$('reviewHeist');if(e.shiftKey&&(document.activeElement===first||document.activeElement===$('heistOutcome'))){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
}
