// Local test fixture only: fake camera, Skidule, Morse and laser devices.
// No network traffic is sent. Never distribute this fixture as the real module.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const multiple=process.argv.includes('--multiple');
const hardwareTest=process.argv.includes('--hardware-test');
const legacy=process.argv.includes('--legacy-skidule');
await mkdir(new URL('test-output/',root),{recursive:true});
const mock=`<script>
${hardwareTest?'Math.random=()=>.5; // Deterministic local lock targets in this fixture only.':''}
const mockSockets=[];
let mockPosition={x:-900,y:1800};
let mockControlSeq=0,mockControlBar=3,mockControlSlider=72,mockControlPress=0,mockAppMessages=0;
function mockControlData(event='state'){const knob=mockControlBar===3?1:(mockControlBar+.5)/4;return {module:'skidule_controls',event,boot_id:'smoke-c6',seq:++mockControlSeq,bar_index:${legacy?'Math.min(9,Math.floor(knob*10))':'mockControlBar'},${legacy?'knob,bar_height:mockControlSlider/100,slider:mockControlSlider/100':'bar_count:4,slider:mockControlSlider'},button_press_count:mockControlPress};}
function mockControls(event='state'){for(const socket of mockSockets)if(socket.channel)socket.onmessage?.({data:JSON.stringify({sender:'smoke_skidule_C6',recipient:socket.channel,data:mockControlData(event)})});}
let mockVaultSeq=0,mockVaultMode='auto',mockVaultCommand='none',mockVaultRequest='',mockVaultResult='',mockLiveHeist=false;
function mockVault(socket){socket.onmessage?.({data:JSON.stringify({sender:'smoke_vault_S3',recipient:socket.channel,data:{module:'vault_door',event:'state',device_id:'smoke-vault',boot_id:'s3-boot',seq:++mockVaultSeq,mode:mockVaultMode,commanded:mockVaultCommand,motion:mockVaultCommand==='none'?'disabled':'at_target',angles:mockVaultCommand==='unlock'?[0,0]:[90,90],target_angles:mockVaultCommand==='unlock'?[0,0]:[90,90],servo_confirmed:false,controller_link:mockLiveHeist?'fresh':'waiting',request_id:mockVaultRequest,request_result:mockVaultResult}})});}
function mockMove(action){for(const socket of mockSockets){const area=action==='vault'?socket.goal:socket.start;if(action==='depart')mockPosition={x:0,y:2300};else if(area)mockPosition={x:(area[0]+area[1])/2,y:(area[2]+area[3])/2};}}
let mockLaserSequence=0;
function mockLaser(action){
 if(action==='cut'||action==='finish')mockLaserSequence++;
 for(const socket of mockSockets)if(socket.channel&&(socket.laserRoundId||${hardwareTest}))socket.onmessage?.({data:JSON.stringify({sender:'smoke_laser',recipient:socket.channel,data:{module:'laser',device_id:'team2-laser',event:action==='clear'?'clear':action==='finish'?'button_pressed':'beam_broken',...(action==='finish'?{}:{beam_id:1}),event_id:'boot42-'+mockLaserSequence,round_id:socket.laserRoundId||'friend-test-round'}})});
}
function mockMorse(on,duration=200){for(const socket of mockSockets)if(socket.channel)socket.onmessage?.({data:JSON.stringify({sender:'smoke_morse',recipient:socket.channel,data:{module:'morse_button',state:on?'pressed':'released',lampo_toggle:on,duration_ms:on?0:duration}})});}
document.addEventListener('click',e=>{
 const vault=e.target.closest('[data-mock-vault]');if(vault){mockLiveHeist=!mockLiveHeist;vault.textContent=mockLiveHeist?'Mock end live heist':'Mock start live heist';return;}
 const control=e.target.closest('[data-mock-control]');if(control){const action=control.dataset.mockControl;if(action==='press')mockControlPress++;else if(action.startsWith('bar'))mockControlBar=Number(action.slice(3));else mockControlSlider=Number(action);mockControls(action==='press'?'pressed':'state');if(action==='press')mockControls('released');return;}
 const move=e.target.closest('[data-mock-move]');if(move){mockMove(move.dataset.mockMove);return;}
 const laser=e.target.closest('[data-mock-laser]');if(laser){mockLaser(laser.dataset.mockLaser);return;}
 const button=e.target.closest('[data-mock-morse]');if(!button)return;
 const action=button.dataset.mockMorse;
 if(action==='conflict'){for(const socket of mockSockets)if(socket.channel)socket.onmessage?.({data:JSON.stringify({sender:'extra_hacker_screen',recipient:socket.channel,data:{toktik_session:'extra-test-controller',toktik_beat:1}})});}
 else if(action==='dot'||action==='dash'){mockMorse(true);mockMorse(false,action==='dot'?200:600);}
 else mockMorse(action==='true');
});
document.addEventListener('DOMContentLoaded',()=>{
 const panel=document.createElement('aside');panel.setAttribute('aria-label','Mock hardware test inputs');panel.style.cssText='padding:20px;border:2px dashed #edb66e;margin:20px;';
 const note=document.createElement('p');note.textContent='TEST FIXTURE: simulated devices; no OOCSI connection.';panel.append(note);
 for(const [label,action] of [['Mock Morse press','true'],['Mock Morse release','false'],['Mock dot','dot'],['Mock dash','dash'],['Mock controller conflict','conflict']]){const button=document.createElement('button');button.textContent=label;button.dataset.mockMorse=action;panel.append(button);}
 for(const [label,action] of [['Mock laser cut','cut'],['Mock duplicate laser cut','duplicate'],['Mock laser clear','clear'],['Mock laser finish button','finish']]){const button=document.createElement('button');button.textContent=label;button.dataset.mockLaser=action;panel.append(button);}
 for(const [label,action] of [['Mock leave safe zone','depart'],['Mock arrive at vault','vault'],['Mock return to safety','safe']]){const button=document.createElement('button');button.textContent=label;button.dataset.mockMove=action;panel.append(button);}
 for(const [label,action] of [['Mock slider 20','20'],['Mock slider 50','50'],['Mock slider 72','72'],['Mock knob bar 1','bar0'],['Mock knob bar 2','bar1'],['Mock knob bar 3','bar2'],['Mock knob bar 4','bar3'],['Mock lock press','press']]){const button=document.createElement('button');button.textContent=label;button.dataset.mockControl=action;panel.append(button);}
 const transmissions=document.createElement('p');transmissions.id='mockAppMessages';transmissions.textContent='Application messages sent: 0';panel.append(transmissions);
 const active=document.createElement('button');active.dataset.mockVault='active';active.textContent='Mock start live heist';panel.append(active);
 const vaultResult=document.createElement('pre');vaultResult.id='mockVaultResult';vaultResult.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;';vaultResult.textContent='No vault commands sent';panel.append(vaultResult);
 const laserResult=document.createElement('pre');laserResult.id='mockLaserResult';laserResult.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;';laserResult.textContent='No laser completion sent';panel.append(laserResult);
 const result=document.createElement('pre');result.id='mockMorseResult';result.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;';result.textContent='No Morse completion sent';panel.append(result);document.body.append(panel);
});
window.WebSocket=class {
 static OPEN=1;static CONNECTING=0;
 constructor(){mockSockets.push(this);this.readyState=0;setTimeout(()=>{this.readyState=1;this.onopen?.({});},50);}
 send(line){
  if(line.startsWith('sendjson ')){mockAppMessages++;if(document.getElementById('mockAppMessages'))document.getElementById('mockAppMessages').textContent='Application messages sent: '+mockAppMessages;const data=JSON.parse(line.slice(line.indexOf(' ',9)+1));if(data.toktik_goal)this.goal=data.toktik_goal;if(data.toktik_start)this.start=data.toktik_start;if(data.toktik_round_id)this.roundId=data.toktik_round_id;if(data.laser_round_id)this.laserRoundId=data.laser_round_id;if(data.puzzle_id==='morse')document.getElementById('mockMorseResult').textContent=JSON.stringify(data);if(data.puzzle_id==='laser')document.getElementById('mockLaserResult').textContent=JSON.stringify(data);
   if(data.module==='vault_control'){mockVaultRequest=data.request_id;mockVaultResult=data.scope==='test'&&mockLiveHeist?'active_heist':'accepted';if(mockVaultResult==='accepted'){mockVaultMode=data.command==='auto'?'auto':'manual';if(data.command!=='auto')mockVaultCommand=data.command;}document.getElementById('mockVaultResult').textContent=JSON.stringify(data);mockVault(this);}
   if(data.heist_state){mockLiveHeist=['armed','running'].includes(data.heist_state);if(mockVaultMode==='auto'){if(data.heist_phase==='escape'&&data.heist_navigation_complete&&data.laser_solved&&data.skidule_solved&&data.morse_solved)mockVaultCommand='unlock';else if(mockLiveHeist)mockVaultCommand='lock';}}
  }
  if(line.startsWith('subscribe ')&&!this.timer){this.channel=line.slice(10);let seq=0;this.timer=setInterval(()=>{
    seq++;
    for(const sender of ${JSON.stringify(multiple?['smoke_camera','smoke_camera_2']:['smoke_camera'])})this.onmessage?.({data:JSON.stringify({sender,recipient:this.channel,data:{radar_boot:'smoke',radar_seq:seq,radar_valid:true,radar_x_mm:mockPosition.x,radar_y_mm:mockPosition.y,guidance_supported:true}})});
    for(const sender of ${JSON.stringify(multiple?['smoke_skidule_C6','smoke_skidule_C6_2']:['smoke_skidule_C6'])})this.onmessage?.({data:JSON.stringify({sender,recipient:this.channel,data:mockControlData()})});
    mockVault(this);
    this.onmessage?.({data:JSON.stringify({sender:'smoke_morse',recipient:this.channel,data:{module:'suitcase',event:'online',uptime_s:Math.floor(seq/5)}})});
    this.onmessage?.({data:JSON.stringify({sender:'smoke_laser',recipient:this.channel,data:{module:'laser',event:'online'}})});
  },200);}
 }
 close(){clearInterval(this.timer);this.readyState=3;this.onclose?.({});}
};
</script>`;
const html=(await readFile(new URL('bank-heist.html',root),'utf8')).replace('<head>','<head>'+mock);
const name=hardwareTest?'hardware-smoke.html':multiple?'course-smoke-multiple.html':'course-smoke.html';
await writeFile(new URL('test-output/'+name,root),html);
console.log('Local fixture: test-output/'+name+' (all WebSockets mocked)');
