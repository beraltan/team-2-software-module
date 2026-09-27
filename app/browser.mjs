import {Controller} from './controller.mjs';
import {Connection,validChannel} from './connection.mjs';

const $=id=>document.getElementById(id),now=()=>performance.now()/1000;
const controller=new Controller(now());
let seq=0, demoPoint={x:-900,y:1800},lastBeat=0,lastFrame=now(),lastState='idle',status='Offline demo. No network connection.',storageOK=true;
const storage={get(key){try{return sessionStorage.getItem(key);}catch{storageOK=false;return null;}},set(key,value){try{sessionStorage.setItem(key,value);}catch{storageOK=false;}}};
if(['running','fault'].includes(storage.get('toktik-attempt')))controller.game.finish('fault','Previous attempt interrupted. Inspect and reset.',now());
$('channel').value=storage.get('toktik-channel')||'OOCSI-things/group-'+crypto.randomUUID().slice(0,8);
storage.set('toktik-channel',$('channel').value);
$('channel').addEventListener('change',()=>storage.set('toktik-channel',$('channel').value));
const connection=new Connection({onMessage:e=>controller.receive(e,now()),onStatus:s=>{
  controller.connected=s==='connected';
  status={connecting:'Connecting to OOCSI…',connected:'Connected. Select your camera and check the field.',disconnected:'Connection lost. Reconnect manually; the attempt will not resume.',error:'OOCSI connection failed. Check your internet connection.'}[s];
  if(s==='connected')controller.quietUntil=now()+3;
  if(s==='disconnected'||s==='error')controller.fault('OOCSI connection lost',now());
}});
function report(fn){try{fn();$('actionError').textContent='';}catch(e){$('actionError').textContent=e.message;}}
function stop(reason){controller.fault(reason,now());sendBeat();persist();}
function persist(){storage.set('toktik-attempt',controller.game.state);lastState=controller.game.state;}
function sendBeat(){const beat=controller.heartbeat(now());if(beat)connection.send(beat);}
function demoSample(){controller.game.ingest({radar_seq:++seq,radar_boot:'demo',radar_valid:true,radar_x_mm:demoPoint.x,radar_y_mm:demoPoint.y},now());}
function returnToStart(){const [l,r,n,f]=controller.game.cfg.start;demoPoint={x:(l+r)/2,y:(n+f)/2};}
function move(direction){if(controller.mode!=='demo')return;const step=100;demoPoint.x+=direction==='left'?-step:direction==='right'?step:0;demoPoint.y+=direction==='up'?step:direction==='down'?-step:0;const [l,r,n,f]=controller.game.cfg.play;demoPoint.x=Math.max(l,Math.min(r,demoPoint.x));demoPoint.y=Math.max(n,Math.min(f,demoPoint.y));demoSample();}

$('connect').onclick=()=>report(()=>{
  if(controller.game.state==='running')throw Error('Abort before changing connectivity.');
  const channel=validChannel($('channel').value.trim());
  connection.close();controller.live(now());controller.quietUntil=now()+3;
  storage.set('toktik-channel',channel);connection.connect(channel,'toktik_browser_'+controller.session);
  $('ready').checked=false;persist();
});
$('disconnect').onclick=()=>{stop('Controller disconnected');connection.close();controller.connected=false;status='Disconnected. Reconnect or try the offline demo.';};
$('demo').onclick=()=>report(()=>{
  if(controller.game.state==='running')throw Error('Abort before switching to demo.');
  connection.close();controller.connected=false;controller.mode='demo';controller.conflict=false;controller.supported=true;controller.led='simulated';
  controller.game.reset(now());controller.game.boot=null;controller.game.seq=-1;controller.game.last_sample=null;returnToStart();demoSample();$('ready').checked=false;status='Offline demo. No network connection.';persist();
});
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
document.addEventListener('keydown',e=>{if(/INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName))return;const directions={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down'};if(directions[e.key]&&controller.mode==='demo'){e.preventDefault();move(directions[e.key]);}});

// A browser cannot promise background execution. Losing visibility invalidates play.
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop('Controller tab hidden. Keep it visible during play.');});
window.addEventListener('pagehide',()=>stop('Controller page closed'));
window.addEventListener('blur',()=>{controller.game.guidance='stop';controller.game.guidance_until=0;sendBeat();});

$('configureCamera').onclick=async()=>{
  let port,writer;const button=$('configureCamera');button.disabled=true;
  try {
    if(controller.game.state==='running')throw Error('Abort before configuring the camera.');
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
  const live=controller.mode==='live',running=controller.game.state==='running';
  $('modeBadge').textContent=live?'LIVE OOCSI':'OFFLINE DEMO';$('demoControls').hidden=live;
  $('sessionStatus').textContent=controller.conflict?'Controller conflict. Close other controllers (including the USB service), wait three seconds, then reset.':status;
  if(!storageOK)$('sessionStatus').textContent+=' Session storage unavailable: reload recovery cannot be recorded.';
  $('connect').disabled=running||controller.connected;$('disconnect').disabled=!controller.connected;
  $('channel').disabled=controller.connected||running;$('camera').disabled=running||!controller.connected;
  $('ready').disabled=controller.game.state!=='idle';$('apply').disabled=controller.game.state!=='idle';
  const cameras=[...controller.cameras].filter(([,v])=>t-v.at<3).map(([name])=>name);
  if(controller.camera&&!cameras.includes(controller.camera))cameras.push(controller.camera);
  const key=cameras.join('|');if($('camera').dataset.list!==key){$('camera').dataset.list=key;$('camera').replaceChildren(new Option('Select a camera',''),...cameras.map(name=>new Option(name,name)));$('camera').value=controller.camera;}
}
setInterval(()=>{
  const t=now();
  if(t-lastFrame>1&&controller.game.state==='running')controller.fault('Controller suspended for over one second',t);
  lastFrame=t;
  if(controller.mode==='demo'&&!document.hidden)demoSample();
  controller.game.tick(t);
  if(controller.game.state!==lastState)persist();
  if(t-lastBeat>=.2){sendBeat();lastBeat=t;}
  refreshSetup(t);
},50);
export const runtime={
  async requestState(){const t=now();return {ok:true,json:async()=>({game:controller.game.snapshot(t),connected:controller.connected,
    fresh:controller.game.fresh(t),guidance_supported:controller.supported,led:controller.led,
    network:{enabled:controller.mode==='live',connected:controller.connected,channel:connection.channel||''}})};},
  async requestAction({action,direction}){let error;try{if(action==='start')controller.start(now());else if(action==='guide')controller.game.guide(direction,now());else throw Error('Unknown action');persist();sendBeat();}catch(e){error=e.message;}return {ok:!error,json:async()=>error?{error}:{ok:true}};}
};
