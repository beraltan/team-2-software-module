import {Controller} from './controller.mjs';
import {Connection,validChannel} from './connection.mjs';
import {SKIDULE_BARS} from './skidule.mjs';

const $=id=>document.getElementById(id),now=()=>performance.now()/1000;
const controller=new Controller(now());
controller.enableHeist();
let seq=0, demoPoint={x:-900,y:1800},lastBeat=0,lastFrame=now(),lastState='idle',lastLockState='idle',lastMorseState='idle',status='Offline demo. No network connection.',storageOK=true;
let demoControlSeq=0,demoPressCount=0,demoBar=0,demoHeight=.5,lastDemoControlAt=0;
let demoMorseAt=0,demoMorseDown=false;
const morseListeners=new Set();
function notifyMorse(){const state=controller.morse.snapshot(now());for(const listener of morseListeners)listener(state);}
const storage={get(key){try{return sessionStorage.getItem(key);}catch{storageOK=false;return null;}},set(key,value){try{sessionStorage.setItem(key,value);}catch{storageOK=false;}}};
if(['armed','running','fault'].includes(storage.get('toktik-attempt')))controller.game.finish('fault','Previous heist interrupted. Reset before trying again.',now());
if(['running','fault'].includes(storage.get('skidule-attempt'))){controller.skidule.state='fault';controller.skidule.notice='Previous lock attempt was interrupted. Inspect and reset.';}
if(['receiving','fault'].includes(storage.get('morse-attempt'))){controller.morse.state='fault';controller.morse.notice='Previous Morse transmission was interrupted. Reset the receiver.';}
if(['skidule','morse','laser'].includes(storage.get('toktik-module')))controller.selectModule(storage.get('toktik-module'));
$('channel').value=storage.get('toktik-channel')||'OOCSI-things/team-2';
storage.set('toktik-channel',$('channel').value);
$('channel').addEventListener('change',()=>storage.set('toktik-channel',$('channel').value));
const connection=new Connection({onMessage:e=>{controller.receive(e,now());notifyMorse();},onStatus:s=>{
  controller.connected=s==='connected';
  status={connecting:'Connecting to hardware…',connected:'Devices connect automatically.',disconnected:'Connection lost. Reconnect to continue.',error:'Could not connect. Check your internet connection.'}[s];
  if(s==='connected')controller.quietUntil=now()+3;
  if(s==='disconnected'||s==='error')controller.fault('OOCSI connection lost',now());
  notifyMorse();
}});
function report(fn){try{fn();$('actionError').textContent='';}catch(e){$('actionError').textContent=e.message;}}
function stop(reason){controller.fault(reason,now());notifyMorse();sendBeat();persist();}
function persist(){storage.set('toktik-attempt',controller.game.state);storage.set('skidule-attempt',controller.skidule.state);storage.set('morse-attempt',controller.morse.state);lastState=controller.game.state;lastLockState=controller.skidule.state;lastMorseState=controller.morse.state;}
function sendBeat(){
  const beat=controller.heartbeat(now());if(!beat)return;connection.send(beat);
  for(const puzzle of [controller.skidule,controller.morse,controller.laser]){
    const result=puzzle.takeResult();if(!result)continue;
    const team=connection.channel?.match(/\/team-(\d+)$/)?.[1];
    if(['terminal','laser'].includes(result.module)&&team!==undefined)result.team=Number(team);
    connection.publish({...result,controller_session:controller.session});
  }
}
function demoSample(){controller.game.ingest({radar_seq:++seq,radar_boot:'demo',radar_valid:true,radar_x_mm:demoPoint.x,radar_y_mm:demoPoint.y},now());}
function demoControlSample(event='state'){
  controller.receive({sender:'demo_skidule',data:{module:'skidule_controls',event,boot_id:'demo-controls',seq:++demoControlSeq,bar_index:demoBar,bar_height:demoHeight,button_press_count:demoPressCount}},now());
}
controller.skidule.source='demo_skidule';demoControlSample();
function demoMorseSample(pressed){
  const data=pressed===undefined?{module:'suitcase',event:'online',uptime_s:Math.floor(now())}:{module:'morse_button',state:pressed?'pressed':'released',lampo_toggle:pressed};
  controller.receive({sender:'demo_morse',data},now());notifyMorse();
}
controller.morse.source='demo_morse';demoMorseSample();
function returnToStart(){const [l,r,n,f]=controller.game.cfg.start;demoPoint={x:(l+r)/2,y:(n+f)/2};}
function move(direction){if(controller.mode!=='demo')return;const step=100;demoPoint.x+=direction==='left'?-step:direction==='right'?step:0;demoPoint.y+=direction==='up'?step:direction==='down'?-step:0;const [l,r,n,f]=controller.game.cfg.play;demoPoint.x=Math.max(l,Math.min(r,demoPoint.x));demoPoint.y=Math.max(n,Math.min(f,demoPoint.y));demoSample();}

$('connect').onclick=()=>report(()=>{
  if(controller.busy())throw Error('Finish, clear or reset the active module before changing connectivity.');
  const channel=validChannel($('channel').value.trim());
  connection.close();controller.live(now());controller.quietUntil=now()+3;
  storage.set('toktik-channel',channel);connection.connect(channel,'toktik_browser_'+controller.session);
  $('ready').checked=false;persist();
});
$('demo').onclick=()=>report(()=>{
  if(controller.busy())stop('Switched to offline demo');
  connection.close();controller.connected=false;controller.mode='demo';controller.conflict=false;controller.supported=true;controller.led='simulated';
  controller.game.reset(now());controller.game.boot=null;controller.game.seq=-1;controller.game.last_sample=null;returnToStart();demoSample();$('ready').checked=false;status='Offline demo. No network connection.';persist();
  controller.controls.clear();controller.skidule.selectSource('demo_skidule');demoControlSample();persist();
  controller.morseSources.clear();controller.morse.selectSource('demo_morse');demoMorseDown=false;demoMorseSample();persist();
  controller.laser.reset();
});
$('resumeController').onclick=()=>report(()=>{controller.clearConflict(now());sendBeat();persist();});
$('camera').onchange=()=>report(()=>{controller.selectCamera($('camera').value,now());$('ready').checked=false;});
$('apply').onclick=()=>report(()=>{
  // Validate on a temporary game to avoid partially applied forms.
  const candidate=new Controller(now()).game;
  candidate.field(+$('fieldWidth').value,+$('fieldDepth').value,+$('fieldNear').value,$('mirrorX').checked);
  candidate.difficulty($('difficulty').value);
  candidate.rules(+$('limit').value,+$('penalty').value);
  controller.game.field(+$('fieldWidth').value,+$('fieldDepth').value,+$('fieldNear').value,$('mirrorX').checked);
  controller.game.difficulty($('difficulty').value);
  controller.game.rules(+$('limit').value,+$('penalty').value);$('ready').checked=false;returnToStart();
});
$('ready').onchange=()=>report(()=>{if(controller.game.state!=='idle'){$('ready').checked=controller.game.setup_checked;throw Error('Reset before checking the setup.');}controller.game.setup_checked=$('ready').checked;});
$('abort').onclick=()=>stop('Round aborted by facilitator');
$('reset').onclick=()=>report(()=>{controller.reset(now());$('ready').checked=false;persist();});
$('demoStart').onclick=()=>{returnToStart();demoSample();};
document.querySelectorAll('[data-move]').forEach(b=>b.onclick=()=>move(b.dataset.move));
document.addEventListener('keydown',e=>{if(/INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName))return;const directions={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down'};if(directions[e.key]&&controller.mode==='demo'&&controller.activeModule==='camera'){e.preventDefault();move(directions[e.key]);}});

// A browser cannot promise background execution. Losing visibility invalidates play.
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop('Controller tab hidden. Keep it visible during play.');});
window.addEventListener('pagehide',()=>stop('Controller page closed'));
window.addEventListener('blur',()=>{controller.game.guidance='stop';controller.game.guidance_until=0;sendBeat();});

$('configureCamera').onclick=async()=>{
  let port,writer;const button=$('configureCamera');button.disabled=true;
  try {
    if(controller.busy())throw Error('Finish, clear or reset the active module before configuring the camera.');
    if(!navigator.serial)throw Error('Use Chrome or Edge on a computer over HTTPS (or localhost) for USB setup.');
    const channel=validChannel($('channel').value.trim()),ssid=$('ssid').value,password=$('wifiPassword').value;
    if(!ssid||new TextEncoder().encode(ssid).length>32||new TextEncoder().encode(password).length>64)throw Error('Use a Wi-Fi name of 1–32 bytes and a password of up to 64 bytes.');
    port=await navigator.serial.requestPort();await port.open({baudRate:115200});writer=port.writable.getWriter();
    await writer.write(new TextEncoder().encode(JSON.stringify({command:'wifi_config',ssid,password,channel,enabled:$('shareCamera').checked})+'\n'));
    $('cameraStatus').textContent='Settings sent. The camera should restart. Connect to OOCSI and verify that it appears; USB write success alone does not confirm Wi-Fi connectivity.';
  }catch(e){$('cameraStatus').textContent=e.message;}
  finally{$('wifiPassword').value='';writer?.releaseLock();if(port)try{await port.close();}catch{}button.disabled=false;}
};

function refreshSetup(t){
  const live=controller.mode==='live',running=['armed','running'].includes(controller.game.state),busy=controller.busy();
  $('modeBadge').textContent=live?'LIVE HARDWARE':'OFFLINE DEMO';$('demoControls').hidden=live;
  const team=$('channel').value.split('/').at(-1);
  $('teamName').textContent=team.startsWith('team-')?'Team '+team.slice(5):team;$('teamName').hidden=!live;
  $('sessionStatus').textContent=controller.conflict?'Another screen has control.':live?status:'Practice without hardware.';
  $('controllerConflict').hidden=!live||!controller.conflict;
  const waiting=Math.max(0,Math.ceil(controller.quietUntil-t));
  $('resumeController').disabled=!controller.connected||waiting>0;
  $('conflictWait').textContent=waiting>0?'Still receiving from the other screen.':'Ready to continue.';
  if(!storageOK)$('sessionStatus').textContent+=' Session storage unavailable: reload recovery cannot be recorded.';
  $('connect').disabled=busy||controller.connected;$('demo').disabled=!live;
  if($('changeTeam'))$('changeTeam').textContent=live?'Change team':'Use live hardware';
  $('channel').disabled=controller.connected||busy;$('camera').disabled=running||!controller.connected;
  $('ready').disabled=controller.game.state!=='idle';$('ready').checked=controller.game.setup_checked;$('apply').disabled=controller.game.state!=='idle';
  const cameras=controller.cameraDevices(t),single=live&&controller.connected&&cameras.length===1&&cameras[0]===controller.camera;
  if(controller.camera&&!cameras.includes(controller.camera))cameras.push(controller.camera);
  const key=cameras.join('|');if($('camera').dataset.list!==key){$('camera').dataset.list=key;$('camera').replaceChildren(new Option('Select a camera',''),...cameras.map(name=>new Option(name,name)));}
  $('camera').value=controller.camera;$('camera').hidden=single;
  $('cameraAuto').hidden=!single;$('cameraAuto').textContent=single?'Connected: '+controller.camera:'';
}
setInterval(()=>{
  const t=now();
  if(t-lastFrame>1&&controller.busy())controller.fault('Controller suspended for over one second',t);
  lastFrame=t;
  if(controller.mode==='demo'&&!document.hidden)demoSample();
  if(controller.mode==='demo'&&!document.hidden&&t-lastDemoControlAt>=.1){demoControlSample();lastDemoControlAt=t;}
  if(controller.mode==='demo'&&!document.hidden&&t-demoMorseAt>=1){demoMorseSample();demoMorseAt=t;}
  controller.autoSelectDevices(t);
  controller.tick(t);notifyMorse();
  if(controller.game.state!==lastState||controller.skidule.state!==lastLockState||controller.morse.state!==lastMorseState)persist();
  if(t-lastBeat>=.2){sendBeat();lastBeat=t;}
  refreshSetup(t);
},50);
export const runtime={
  observeMorse(listener){morseListeners.add(listener);listener(controller.morse.snapshot(now()));return ()=>morseListeners.delete(listener);},
  async requestState(){const t=now();return {ok:true,json:async()=>({game:controller.game.snapshot(t),connected:controller.connected,
    fresh:controller.game.fresh(t),guidance_supported:controller.supported,led:controller.led,
    active_module:controller.activeModule,skidule:controller.skidule.snapshot(t),morse:controller.morse.snapshot(t),laser:controller.laser.snapshot(t),vault:controller.mode==='demo'?controller.vault.demoSnapshot(controller.game):controller.vault.snapshot(t),vault_can_control:controller.mode==='demo'||controller.connected&&!controller.conflict&&t>=controller.quietUntil,mode:controller.mode,
    skidule_can_start:(controller.mode==='demo'||(controller.connected&&!controller.conflict&&t>=controller.quietUntil))&&controller.skidule.fresh(t),
    skidule_devices:[...controller.controls].filter(([name,v])=>t-v.at<3||controller.skidule.source===name).map(([name,v])=>({name,fresh:t-v.at<2.5})),
    morse_devices:[...controller.morseSources].filter(([name,v])=>t-v.at<25||controller.morse.source===name).map(([name,v])=>({name,fresh:t-v.at<25})),
    network:{enabled:controller.mode==='live',connected:controller.connected,channel:connection.channel||''}})};},
  async requestAction({action,direction,module,source,bar,height,code,pressed,bypassed,command}){let error;try{
    if(action==='start')controller.start(now());
    else if(action==='guide')controller.game.guide(direction,now());
    else if(action==='module'){controller.selectModule(module);storage.set('toktik-module',module);}
    else if(action==='bypass')controller.bypassModule(module,now());
    else if(action==='vault_source')controller.vault.select(source);
    else if(action==='vault_command'){
      if(!['lock','unlock','auto'].includes(command))throw Error('Choose a valid vault command.');
      if(controller.mode==='demo')controller.vault.demoCommand=command;
      else{if(!controller.connected||controller.conflict||now()<controller.quietUntil)throw Error('Resolve the crew connection before controlling the vault.');connection.publish(controller.vault.request(command,now(),{scope:'presenter',session:controller.session}));}
    }
    else if(action==='laser_cut')controller.recordLaserCut(now());
    else if(action==='laser_bypass')controller.bypassLasers(bypassed);
    else if(action==='laser_reset')controller.resetLaser(now());
    else if(action==='escape_confirm')controller.confirmEscape(now());
    else if(action==='heist_abort')controller.fault('Heist aborted by presenter',now());
    else if(action==='heist_resume')controller.resumeHeist(now());
    else if(action==='heist_reset'){controller.reset(now());$('ready').checked=false;returnToStart();}
    else if(action==='laser_demo_finish'){
      if(controller.mode!=='demo')throw Error('Demo controls are only available offline.');
      if(controller.game.heist_mode&&(controller.game.state!=='running'||controller.game.phase!=='laser'))throw Error('Complete Camera, Skidule and Morse before the laser stage.');
      controller.laser.complete(false,controller.game.round_id,{completion_method:'offline_demo'});
    }
    else if(action==='skidule_source')controller.selectControls(source,now());
    else if(action==='skidule_start')controller.startSkidule(now());
    else if(action==='skidule_reset')controller.resetSkidule(now());
    else if(action==='morse_source')controller.selectMorse(source,now());
    else if(action==='morse_clear')controller.morse.clearSignal();
    else if(action==='morse_reset'){controller.resetMorse(now());demoMorseDown=false;}
    else if(action==='morse_verify'){
      if(['armed','running'].includes(controller.game.state)&&controller.skidule.state!=='solved')throw Error('Complete the vault lock before entering the final override.');
      controller.morse.verify(code,controller.game.round_id);
    }
    else if(action==='morse_press'){
      if(controller.mode!=='demo')throw Error('Demo controls are only available offline.');
      if(typeof pressed!=='boolean')throw Error('Invalid button state');
      if(pressed!==demoMorseDown){demoMorseDown=pressed;demoMorseSample(pressed);}
    }
    else if(action==='skidule_demo'||action==='skidule_press'){
      if(controller.mode!=='demo')throw Error('Demo controls are only available offline.');
      if(bar!==undefined){if(!Number.isInteger(bar)||bar<0||bar>=SKIDULE_BARS)throw Error('Invalid bar');demoBar=bar;}
      if(height!==undefined){if(!Number.isFinite(height)||height<0||height>1)throw Error('Invalid height');demoHeight=height;}
      if(action==='skidule_press'){++demoPressCount;demoControlSample('pressed');demoControlSample('released');}
      else demoControlSample();
    }else throw Error('Unknown action');
    notifyMorse();persist();sendBeat();
  }catch(e){error=e.message;}return {ok:!error,json:async()=>error?{error}:{ok:true}};}
};
