import {HardwareTest,TEST_MODULES} from './hardware-test.mjs';
import {Connection,validChannel} from './connection.mjs';
import {mountVaultPanel} from './vault-ui.mjs';

export function bootHardwareTest(){
  const $=id=>document.getElementById(id),bench=new HardwareTest(),now=()=>performance.now()/1000;
  const params=new URLSearchParams(location.search),chosen=params.get('test');if(TEST_MODULES.includes(chosen))bench.selectModule(chosen);
  document.body.classList.add('hardware-testing','ready');$('startScreen').hidden=true;$('hardwareBench').hidden=false;
  const names={camera:'Camera',laser:'Laser',skidule:'Skidule',morse:'Morse',vault:'Vault door'},testSession=crypto.randomUUID();
  let status='Connect to receive your physical module.',connected=false,deviceKey='',lastPacket='',lampKey='';
  const connection=new Connection({readOnly:true,allowVaultCommands:true,onMessage:e=>{bench.ingest(e,now());render();},onStatus:s=>{
    connected=s==='connected';status={connecting:'Connecting to OOCSI…',connected:'Listening for your ESP.',disconnected:'Disconnected. Connect again when ready.',error:'Connection failed. Check Wi-Fi and reconnect.'}[s];render();
  }});
  function error(fn){try{fn();$('testError').textContent='';}catch(e){$('testError').textContent=e.message;}render();}
  const renderVault=mountVaultPanel($('test-vault'),{test:true,onSelect:source=>error(()=>bench.selectSource('vault',source)),onCommand:command=>error(()=>connection.sendVaultCommand(bench.vault.request(command,now(),{scope:'test',session:testSession})))});
  const text=(id,value)=>{if($(id).textContent!==String(value))$(id).textContent=value;};
  const bars=Array.from({length:4},(_,i)=>{
    const bar=document.createElement('div');bar.className='lock-bar';
    const label=document.createElement('span');label.className='bar-number';label.textContent=String(i+1).padStart(2,'0');
    const track=document.createElement('div');track.className='bar-track';const fill=document.createElement('div');fill.className='bar-fill';track.append(fill);
    const state=document.createElement('span');state.className='bar-state';bar.append(label,track,state);$('testBars').append(bar);return {bar,fill,state};
  });
  function render(){
    const s=bench.snapshot(now()),m=s.module;
    for(const name of TEST_MODULES){$(`test-${name}`).hidden=m!==name;const b=$('testPick-'+name);b.classList.toggle('selected',m===name);b.setAttribute('aria-pressed',String(m===name));}
    text('testConnection',connected?'INPUTS CONNECTED':'HARDWARE TEST');$('testConnection').className='badge '+(connected?'live':'');
    text('testModuleTitle',names[m]+' test');text('testLinkStatus',status);
    $('testSourceRow').hidden=m==='vault';$('testModuleHeader').hidden=m==='vault';renderVault(s.vault,{connected});
    $('testConnect').disabled=connected||status==='Connecting to OOCSI…';$('testDisconnect').disabled=!connected&&status!=='Connecting to OOCSI…';$('testChannel').disabled=connected||status==='Connecting to OOCSI…';
    const key=JSON.stringify([m,s.source,s.devices]);
    if(deviceKey!==key){deviceKey=key;$('testDevice').replaceChildren(new Option('Waiting for your ESP',''),...s.devices.map(d=>new Option(d.name+(d.fresh?'':' · offline'),d.name)));$('testDevice').value=s.source;}
    const single=s.devices.length===1;$('testDevice').hidden=single;$('testDeviceName').hidden=!single;text('testDeviceName',s.source||'Waiting for your ESP');
    text('testFresh',!connected?'Not connected':s.fresh?'Receiving inputs':s.source?'No recent inputs':'Waiting for device');
    $('testFresh').className='badge '+(connected&&s.fresh?'live':'');
    text('testPackets',s.packets);text('testRate',s.rate+' / s');text('testAge',s.age===null?'—':s.age.toFixed(1)+'s ago');text('testInvalid',s.rejected);
    const packet=JSON.stringify(s.last,null,2)||'Move a control or press the button to see its incoming message.';
    if(lastPacket!==packet){lastPacket=packet;$('testPacket').textContent=packet;}
    const k=s.skidule,percent=Math.round(k.control_height*100);
    text('testSlider',percent+'%');text('testSelected','Bar '+(k.selected+1)+' / 4');
    text('testPresses',m==='skidule'&&s.last?s.last.button_press_count:0);
    text('testButton',m==='skidule'&&s.last?.event==='pressed'?'PRESSED':'Released');
    text('testLockSignal',k.state==='solved'?'COMPLETE':k.state==='running'?k.feedback.toUpperCase():k.state==='fault'?'RESET NEEDED':'INPUT CHECK');
    text('testLockNotice',k.state==='idle'?'Turn the knob, move the slider and press the button. Start a local lock check to try matching all four bars.':k.notice);
    if(k.input_mapping==='knob_to_four')$('testLockNotice').textContent+=' Legacy knob input is mapped to four bars.';
    $('testLockStart').disabled=!connected||!k.fresh||k.state!=='idle';
    bars.forEach(({bar,fill,state},i)=>{const height=k.state==='idle'?(i===k.selected?k.control_height:0):k.heights[i];fill.style.height=height*100+'%';bar.classList.toggle('selected',i===k.selected);bar.classList.toggle('locked',k.locked[i]);bar.dataset.feedback=i===k.selected?k.feedback:'ready';state.textContent=k.locked[i]?'●':'—';bar.setAttribute('aria-label',`Bar ${i+1}, ${Math.round(height*100)} percent, ${k.locked[i]?'locked':'unlocked'}`);});
    const morse=s.morse;$('testLamp').classList.toggle('on',morse.lamp);$('testLamp').setAttribute('aria-label',morse.lamp?'Morse lamp on':'Morse lamp off');text('testLampState',morse.lamp?'ON':'OFF');text('testSignalCount',morse.signal_count);
    const signals=JSON.stringify(morse.signals);if(lampKey!==signals){lampKey=signals;const rows=[];for(let i=0;i<morse.signals.length;i+=5){const row=document.createElement('div');row.className='morse-signal-row';for(let j=0;j<5;j++){const signal=morse.signals[i+j],cell=document.createElement('span');cell.className='morse-signal-cell'+(signal?'':' pending');cell.textContent=signal==='.'?'•':signal==='-'?'—':'';cell.setAttribute('aria-label',signal==='.'?'Dot':signal==='-'?'Dash':'Waiting');row.append(cell);}rows.push(row);}if(!rows.length){const p=document.createElement('p');p.textContent='Received dots and dashes appear here.';rows.push(p);}$('testSignals').replaceChildren(...rows);}
    text('testMorseNotice',morse.state==='solved'?'Passcode accepted locally. Reset to test again.':morse.feedback||morse.notice);
    $('testCode').disabled=morse.state==='solved';$('testVerify').disabled=!connected||!morse.fresh||morse.state==='solved'||morse.state==='fault';
    text('testCuts',s.laser.cuts);text('testFinishes',s.laser.finishes);text('testLaserEvent',s.laser.event);text('testLaserRound',s.laser.round||'No round received yet');
    const alignment=s.laser.alignment,beamState=!connected?'disconnected':s.laser.alignment_status;
    $('testLaserAlignPanel').hidden=!alignment;$('testLaserAlign').setAttribute('aria-pressed',String(alignment));$('testLaserAlign').disabled=!connected;
    text('testLaserAlign',alignment?'Stop alignment mode':'Start alignment mode');
    $('testLaserAlignPanel').dataset.beam=beamState;
    text('testLaserBeamState',{detected:'BEAM DETECTED',missing:'BEAM MISSING',waiting:'WAITING FOR BEAM STATUS',stale:'BEAM STATUS LOST',disconnected:'INPUTS DISCONNECTED'}[beamState]);
    text('testLaserBeamRaw',s.laser.beams.length?s.laser.beams.map(b=>'Beam '+b.beam_id+': '+(!b.fresh?'status stale':b.broken?'blocked':'received')+' / raw '+(b.raw??'not reported')).join(' · '):'Waiting for receiver state reports (normally every 2 seconds).');
    const c=s.camera,valid=c?.radar_valid&&s.fresh&&connected;
    text('testRadarState',valid?'PLAYER TRACKED':c&&!c.radar_valid?'NO SINGLE PLAYER':'WAITING FOR RADAR');text('testRadarX',valid?(c.radar_x_mm/1000).toFixed(2)+' m':'—');text('testRadarY',valid?(c.radar_y_mm/1000).toFixed(2)+' m':'—');
    text('testRadarSeq',c?.radar_seq??'—');$('testRadarDot').style.display=valid?'':'none';
    if(valid){$('testRadarDot').setAttribute('cx',Math.max(0,Math.min(600,300+c.radar_x_mm/10)));$('testRadarDot').setAttribute('cy',Math.max(0,Math.min(600,600-c.radar_y_mm/10)));}
    text('testCameraSupport',c?.guidance_supported?'Camera reports guidance support':'Guidance support not reported');
  }
  $('testConnect').onclick=()=>error(()=>{
    const channel=validChannel($('testChannel').value.trim());bench.clear();connection.connect(channel,'bank_heist_test_'+crypto.randomUUID());
  });
  $('testDisconnect').onclick=()=>{connection.close();connected=false;status='Disconnected. Your local checks are kept.';render();};
  $('testHome').onclick=()=>{connection.close();location.search='';};
  document.querySelectorAll('[data-test-module]').forEach(b=>b.onclick=()=>error(()=>{bench.selectModule(b.dataset.testModule);const url=new URL(location.href);url.searchParams.set('test',bench.active);history.replaceState(null,'',url);render();}));
  $('testDevice').onchange=()=>error(()=>bench.selectSource(bench.active,$('testDevice').value));
  $('testReset').onclick=()=>error(()=>bench.reset());
  $('testLockStart').onclick=()=>error(()=>bench.skidule.start(now()));
  $('testLaserAlign').onclick=()=>error(()=>bench.setLaserAlignment(!bench.laserAlignment));
  $('testMorseForm').onsubmit=e=>{e.preventDefault();error(()=>bench.morse.verify($('testCode').value));$('testCode').value='';};
  window.addEventListener('pagehide',()=>connection.close());
  document.addEventListener('visibilitychange',()=>{if(document.hidden)bench.morse.fault('Test screen hidden.');});
  const timer=setInterval(render,100);window.addEventListener('pagehide',()=>clearInterval(timer),{once:true});render();
}
