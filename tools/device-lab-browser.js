// This file is injected only into test-output/device-lab.html by device-lab.mjs.
const lab=new DeviceLab({legacy:true}),sockets=[];
const realOocsi=typeof LIVE_OOCSI!=='undefined'&&LIVE_OOCSI;
const deviceSockets=new Map(),deviceStates=new Map(),realChannel='OOCSI-things/team-2';
const observedControllers=new Map();
const runId=crypto.randomUUID().slice(0,8);
let cameraOn=true,controlsOn=true,walking=false,solving=false,sending=false,movementPaused=false;
const stats={camera:0,skidule:0,morse:0,laser:0,vault:0,heartbeats:0};
const labActions=new Map();
document.addEventListener('click',e=>{const button=e.target.closest('[data-lab-action]');if(button)labActions.get(button.dataset.labAction)?.();});
const stamp=()=>performance.now()/1000;
function deliver(kind,data){if(!data)return;
  if(realOocsi){const socket=deviceSockets.get(kind);if(socket?.readyState===1){socket.send('sendjson '+realChannel+' '+JSON.stringify(data));stats[kind]++;}return;}
  stats[kind]++;for(const s of sockets)if(s.channel&&s.readyState===1)s.onmessage?.({data:JSON.stringify({sender:'emulated_'+kind,recipient:s.channel,data})});
}
function startRealDevices(){
  if(deviceSockets.size)return;
  for(const kind of ['camera','skidule','morse','laser','vault']){
    deviceStates.set(kind,'connecting');
    const socket=new WebSocket('wss://oocsi.id.tue.nl/ws');deviceSockets.set(kind,socket);
    socket.onopen=()=>{socket.send('team2_emulator_'+kind+'_'+runId);socket.send('subscribe '+realChannel);deviceStates.set(kind,'online');};
    socket.onmessage=event=>{if(event.data==='ping'){socket.send('.');return;}try{const e=JSON.parse(event.data);if(e.recipient!==realChannel)return;if(e.data?.toktik_session){lab.heartbeat(e.data,stamp());stats.heartbeats++;observedControllers.set(e.data.toktik_session,{sender:e.sender,at:stamp(),state:e.data.heist_state});}}catch{}};
    socket.onerror=()=>deviceStates.set(kind,'error');socket.onclose=()=>deviceStates.set(kind,'offline');
  }
}
function stopRealDevices(){for(const socket of deviceSockets.values())socket.close();deviceSockets.clear();note('All device emulators disconnected from Team 2.');}
function note(message){const el=document.getElementById('labStatus');if(el)el.textContent=message;}
const pause=ms=>new Promise(r=>setTimeout(r,ms));
function focusModule(name){
  document.getElementById(name+'Card')?.click();
  document.body.classList.add('lab-watch');
  window.scrollTo({top:0,behavior:'instant'});
}
async function walk(returning){if(walking)return;walking=true;try{
  focusModule('camera');movementPaused=false;
  const path=lab.route(returning);note(returning?'Camera walking back to safety…':'Camera walking the entry maze…');
  for(const point of path){const a={...lab.position},steps=Math.ceil(Math.hypot(point.x-a.x,point.y-a.y)/50);
    for(let k=1;k<=steps;k++){while(movementPaused)await pause(100);lab.position={x:a.x+(point.x-a.x)*k/steps,y:a.y+(point.y-a.y)*k/steps};await pause(300);}
  }note(returning?'Camera arrived in the safe zone.':'Camera arrived at the vault.');
}catch(e){note(e.message);}finally{walking=false;}}
async function solveLock(){if(solving)return;solving=true;try{
  focusModule('skidule');
  if(lab.beat?.skidule_state!=='running')throw Error('Click Start lock in the Skidule card first.');
  // Search using public cold/warm/match feedback. No hidden target access.
  for(let bar=0;bar<4;bar++){lab.bar=bar;let matched=false;
    for(let slider=0;slider<=100;slider+=5){lab.slider=slider;deliver('skidule',lab.controls());note('Skidule: bar '+(bar+1)+' / slider '+slider+'%');
      const before=lab.beat.toktik_beat;for(let k=0;k<20&&lab.beat.toktik_beat===before;k++)await pause(100);
      if(lab.beat.skidule_selected_bar===bar&&lab.beat.skidule_feedback==='match'){deliver('skidule',lab.press());deliver('skidule',lab.controls('released'));matched=true;await pause(400);break;}
    }if(!matched)throw Error('No MATCH found for bar '+(bar+1));
  }note('Four real button edges sent; all four bars matched.');
}catch(e){note(e.message);}finally{solving=false;}}
async function sendCode(){if(sending)return;sending=true;try{
  focusModule('morse');
  note('Morse sending 2026: 20 timed dot/dash presses…');
  for(const row of ['..---','-----','..---','-....']){for(const signal of row){const ms=signal==='.'?200:600;deliver('morse',lab.morse(true));await pause(ms);deliver('morse',lab.morse(false,ms));await pause(200);}await pause(600);}
  note('2026 sent as four rows of real Morse. Enter the decoded passcode.');
}finally{sending=false;}}
document.addEventListener('DOMContentLoaded',()=>{
  const style=document.createElement('style');style.textContent=`
    body.lab-watch main{padding-top:12px!important}
    body.lab-watch main>.desk-header,body.lab-watch .phase-steps,body.lab-watch .module-picker,body.lab-watch .module-overview,body.lab-watch .session-strip,body.lab-watch .presenter-controls,body.lab-watch .vault-system,body.lab-watch main>footer,body.lab-watch main>#network,body.lab-watch main>details{display:none!important}
    body.lab-watch .heist-console{padding:16px!important;margin-bottom:12px!important;gap:18px!important}
    body.lab-watch .heist-console .timer{font-size:40px!important}
    body.lab-watch .heist-console h2{font-size:20px!important;margin:5px 0!important}
    body.lab-watch .heist-console p,body.lab-watch #sound,body.lab-watch .heist-security .anomaly-dots{display:none!important}
    body.lab-watch #cameraModule .camera-device,body.lab-watch #cameraModule .camera-ready-row,body.lab-watch #cameraModule .camera-settings{display:none!important}
    body.lab-watch #cameraModule,body.lab-watch #skiduleModule,body.lab-watch #morseModule{padding:18px!important;scroll-margin-top:145px}
    body.lab-watch #map{height:480px!important;min-height:0!important}
    body.lab-watch .camera-information{font-size:11px!important}
    body.lab-watch #cameraGuidance p{display:none!important}
    body.lab-watch .lock-bars{height:320px!important}
  `;document.head.append(style);
  const panel=document.createElement('aside');panel.id='deviceLab';panel.setAttribute('aria-label',realOocsi?'Real OOCSI device publishers':'Isolated device emulator');
  panel.style.cssText='position:sticky;top:0;z-index:10000;background:#13251f;border:2px solid #c5ae72;padding:10px 20px;color:#f3ead2;font:12px system-ui;';
  panel.innerHTML='<strong>'+(realOocsi?'REAL OOCSI DEVICE EMULATORS · OOCSI-things/team-2':'ISOLATED DEVICE EMULATION · NO LIVE OOCSI')+'</strong><div id="labButtons" style="display:flex;gap:5px;flex-wrap:wrap;margin:6px 0"></div><div id="labStatus">Connect your crew, choose Team 2, check the play area and arm the heist.</div><div id="labConnections" style="margin:5px 0;color:#a7e4bf"></div><div id="labControllers" style="margin:5px 0"></div><div id="labCounts" style="font:10px monospace;margin-top:4px"></div>';
  document.body.prepend(panel);
  for(const [label,action] of [['Walk entry route',()=>walk(false)],['Pause / resume movement',()=>{movementPaused=!movementPaused;note(movementPaused?'Movement paused. Click Pause / resume movement to continue.':'Camera movement resumed.');}],['Show normal page',()=>document.body.classList.remove('lab-watch')],['Cut laser beam',()=>{deliver('laser',lab.laser());note('Laser cut sent.');}],['Repeat same laser event',()=>{deliver('laser',lab.laser('beam_broken',{duplicate:true}));note('Repeated identical event ID.');}],['Finish laser',()=>{deliver('laser',lab.laser('button_pressed'));note('Laser finish button sent.');}],['Solve four bars',solveLock],['Send Morse 2026',sendCode],['Walk escape route',()=>walk(true)],['Toggle camera',()=>{cameraOn=!cameraOn;note('Camera '+(cameraOn?'online':'offline'));}],['Toggle Skidule',()=>{controlsOn=!controlsOn;note('Skidule '+(controlsOn?'online':'offline'));}]]){
    const button=document.createElement('button');button.textContent=label;button.style.cssText='font-size:11px;padding:6px 8px';button.dataset.labAction=label;labActions.set(label,action);panel.querySelector('#labButtons').append(button);
  }
  if(realOocsi){
    const startButton=document.createElement('button');startButton.textContent='Start device emulators';startButton.dataset.labAction='start-emulators';labActions.set('start-emulators',()=>{startRealDevices();note('Device emulators started. Keep only one emulator set connected to Team 2.');});panel.querySelector('#labButtons').prepend(startButton);
    const button=document.createElement('button');button.textContent='Disconnect emulators';button.dataset.labAction='disconnect';labActions.set('disconnect',stopRealDevices);panel.querySelector('#labButtons').append(button);
    note('Emulators are stopped. Start them only if another emulator set is not already online. Opening this page does not start a second set.');
  }
});
if(!realOocsi)window.WebSocket=class {
  static OPEN=1;static CONNECTING=0;
  constructor(){sockets.push(this);this.readyState=0;setTimeout(()=>{this.readyState=1;this.onopen?.({});},50);}
  send(line){
    if(line.startsWith('sendjson ')){const data=JSON.parse(line.slice(line.indexOf('{')));if(data.toktik_session){lab.heartbeat(data,stamp());stats.heartbeats++;}}
    if(line.startsWith('subscribe '))this.channel=line.slice(10);
  }
  close(){this.readyState=3;this.onclose?.({});}
};
setInterval(()=>{lab.advance(stamp());if(controlsOn)deliver('skidule',lab.controls());},100);
setInterval(()=>{if(cameraOn)deliver('camera',lab.radar());},200);
setInterval(()=>{deliver('vault',lab.vaultStatus());const el=document.getElementById('labCounts');if(el)el.textContent=JSON.stringify(stats)+' | S3 commanded '+lab.vault.command+' / '+Math.round(lab.vault.angle)+'°';const connections=document.getElementById('labConnections');if(connections&&realOocsi)connections.textContent=[...deviceStates].map(([kind,state])=>kind.toUpperCase()+': '+state.toUpperCase()).join(' · ');const controllers=document.getElementById('labControllers');if(controllers&&realOocsi){const active=[...observedControllers.values()].filter(c=>stamp()-c.at<3);controllers.textContent='Active hacker controllers received: '+active.length+(active.length?' · '+active.map(c=>c.sender+' ('+c.state+')').join(' · '):'');}},500);
setInterval(()=>{deliver('morse',{module:'suitcase',event:'online',uptime_s:Math.floor(stamp())});deliver('laser',{module:'laser',event:'online',device_id:'team2-laser-lab'});},2000);
