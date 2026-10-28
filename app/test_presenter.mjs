import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Controller} from './controller.mjs';

const radar=(sender='camera',seq=1)=>({sender,data:{radar_boot:'boot',radar_seq:seq,radar_valid:true,radar_x_mm:-900,radar_y_mm:1800,guidance_supported:true}});
const controls=(sender='c6',seq=1)=>({sender,data:{module:'skidule_controls',event:'state',boot_id:'boot',seq,bar_index:3,bar_height:.6,button_press_count:0}});
function live(){const c=new Controller(0,'owner');c.live(0);c.connected=true;return c;}

test('sole camera and Skidule controller are selected with their current input',()=>{
  const c=live();c.receive(radar(),0);c.receive(controls(),0);
  assert.equal(c.camera,'camera');assert.equal(c.game.seq,1);assert.equal(c.supported,true);
  assert.equal(c.skidule.source,'c6');assert.equal(c.skidule.selected,3);assert.equal(c.skidule.controlHeight,.6);
  c.startSkidule(.1);assert.equal(c.skidule.state,'running');
});

test('startup listening discovers multiple devices and leaves a choice to the presenter',()=>{
  const c=live();c.quietUntil=3;
  for(const name of ['camera-a','camera-b'])c.receive(radar(name),2.9);
  for(const name of ['c6-a','c6-b'])c.receive(controls(name),2.9);
  c.autoSelectDevices(3);
  assert.equal(c.camera,'');assert.equal(c.skidule.source,'');
  c.selectCamera('camera-b',3);c.selectControls('c6-b',3);
  assert.equal(c.camera,'camera-b');assert(c.game.fresh(3));assert.equal(c.skidule.source,'c6-b');
});

test('a sole device discovered during startup is selected after the quiet period',()=>{
  const c=live();c.quietUntil=3;c.receive(radar(),2.9);c.receive(controls(),2.9);
  assert.equal(c.camera,'');assert.equal(c.skidule.source,'');c.autoSelectDevices(3);
  assert.equal(c.camera,'camera');assert.equal(c.skidule.source,'c6');assert(c.game.fresh(3));
});

test('stale devices, offline transport and malformed discovery do not auto-select',()=>{
  const c=live();c.quietUntil=3;c.receive(radar(),0);c.receive(controls(),0);c.autoSelectDevices(4);
  assert.equal(c.camera,'');assert.equal(c.skidule.source,'');
  c.connected=false;c.receive(radar('fresh-camera',2),4);c.receive(controls('fresh-c6',2),4);
  assert.equal(c.camera,'');assert.equal(c.skidule.source,'');
  const d=live();d.receive(radar('bad',-1),0);d.receive({...controls(),data:{...controls().data,bar_height:2}},0);
  assert.equal(d.camera,'');assert.equal(d.skidule.source,'');
});

test('discovery never replaces selected devices during running or faulted attempts',()=>{
  const c=live();c.receive(radar(),0);c.receive(controls(),0);c.game.setup_checked=true;c.start(0);c.startSkidule(0);
  c.receive(radar('other-camera'),.1);c.receive(controls('other-c6'),.1);
  assert.equal(c.camera,'camera');assert.equal(c.skidule.source,'c6');
  c.game.tick(4);c.skidule.tick(4);c.receive(radar('other-camera',2),4);c.receive(controls('other-c6',2),4);
  assert.equal(c.camera,'camera');assert.equal(c.skidule.source,'c6');assert.equal(c.game.state,'fault');assert.equal(c.skidule.state,'fault');
});

test('presenter can pass both modules with no hardware or network and reset each',()=>{
  const c=new Controller(0,'owner');c.bypassModule('camera',1);c.bypassModule('skidule',1);
  assert.equal(c.game.state,'won');assert.equal(c.game.snapshot(1).bypassed,true);assert(c.game.round_id);
  assert.equal(c.skidule.state,'solved');assert.equal(c.skidule.snapshot(1).bypassed,true);
  const result=c.skidule.takeResult();assert.equal(result.round_id,c.game.round_id);assert.equal(result.bypassed,true);
  assert.equal(result.completion_method,'presenter_bypass');assert.equal(result.locked_count,0);
  c.game.tick(99);c.skidule.tick(99);assert.equal(c.game.state,'won');assert.equal(c.skidule.state,'solved');
  c.reset(100);c.resetSkidule(100);assert.equal(c.game.bypassed,false);assert.equal(c.skidule.bypassed,false);
  assert.equal(c.game.round_id,null);assert.equal(c.skidule.resultId,null);
});

test('bypass recovers a failure, stops guidance, and publishes native pass states with a bypass flag',()=>{
  const c=live();c.receive(radar(),0);c.receive(controls(),0);c.game.setup_checked=true;c.start(0);c.startSkidule(0);
  const round=c.game.round_id;c.game.guide('left',0);c.bypassModule('camera',.1);
  assert.equal(c.game.signal(.1),'stop');assert.equal(c.game.round_id,round);
  c.fault('ESP stopped',.2);assert.equal(c.skidule.state,'fault');c.bypassModule('skidule',.3);
  const h=c.heartbeat(.3);assert.equal(h.toktik_state,'won');assert.equal(h.toktik_bypassed,true);assert.equal(h.toktik_toggle,false);
  assert.equal(h.skidule_state,'solved');assert.equal(h.skidule_solved,true);assert.equal(h.skidule_bypassed,true);
  const id=c.skidule.takeResult().result_id;c.bypassModule('camera',.4);c.bypassModule('skidule',.4);
  assert.equal(c.skidule.takeResult(),null);assert.equal(c.skidule.resultId,id);assert.equal(c.game.events.filter(e=>e.event==='won').length,1);
  c.connected=false;c.fault('network lost',.5);assert.equal(c.game.state,'won');assert.equal(c.skidule.state,'solved');
});

test('camera bypass recovers lost and faulted states without changing an already played win',()=>{
  for(const state of ['lost','fault']){const c=new Controller(0);c.game.finish(state,'failure',0);c.bypassModule('camera',1);assert.equal(c.game.state,'won');assert(c.game.bypassed);}
  const c=new Controller(0);c.game.finish('won','Vault reached',0);c.bypassModule('camera',1);
  assert.equal(c.game.bypassed,false);assert.equal(c.game.events.length,1);
  assert.throws(()=>c.bypassModule('missing',1),/Unknown module/);
});
