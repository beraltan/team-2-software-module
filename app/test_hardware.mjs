import {test} from 'node:test';
import assert from 'node:assert/strict';
import {HardwareTest} from './hardware-test.mjs';
import {Connection} from './connection.mjs';
import {Controller} from './controller.mjs';

const controls=(seq,bar=0,slider=50,press=0,event='state')=>({sender:'friend-c6',data:{module:'skidule_controls',boot_id:'c6',seq,bar_index:bar,slider,button_press_count:press,event}});
const laser=(event,id='edge-1',round='friend-test-round')=>({sender:'laser-c6',data:{module:'laser',device_id:'team2-laser',event,beam_id:1,event_id:id,round_id:round}});
const morse=(on,ms=200)=>({sender:'morse-c6',data:{module:'morse_button',state:on?'pressed':'released',lampo_toggle:on,duration_ms:ms}});

test('two test clients share Team 2 inputs without publishing or conflicting with the live controller',()=>{
  const clients=[],benches=[new HardwareTest(),new HardwareTest()],owner=new Controller(0,'crew-owner');owner.live(0);owner.connected=true;
  benches[0].selectModule('skidule');benches[1].selectModule('morse');
  const conns=benches.map((bench,i)=>new Connection({readOnly:true,onMessage:e=>bench.ingest(e,1),socketFactory:()=>{const socket={readyState:1,sent:[],send(line){this.sent.push(line);},close(){this.readyState=3;}};clients.push(socket);return socket;}}));
  for(const [i,c] of conns.entries()){c.connect('OOCSI-things/team-2','test-person-'+i);clients[i].onopen();}
  const deliver=e=>{for(const socket of clients)socket.onmessage({data:JSON.stringify({recipient:'OOCSI-things/team-2',...e})});};
  deliver(controls(1,3,72));deliver(morse(true));deliver(morse(false));deliver({sender:'live-crew',data:owner.heartbeat(1)});
  assert.equal(benches[0].snapshot(1).skidule.control_height,.72);assert.equal(benches[1].snapshot(1).morse.signal_count,1);
  for(const [i,c] of conns.entries()){c.send({toktik_session:'must-never-send'});c.publish({module:'terminal',event:'solved'});clients[i].onmessage({data:'ping'});assert.deepEqual(clients[i].sent,['test-person-'+i,'subscribe OOCSI-things/team-2','.']);}
  assert.equal(owner.conflict,false);assert.equal(owner.game.state,'idle');
});

test('Skidule bench checks percentages, knob selection and four real button edges locally',()=>{
  const b=new HardwareTest();b.ingest(controls(1,3,72),0);assert.equal(b.snapshot(0).skidule.selected,3);assert.equal(b.snapshot(0).skidule.control_height,.72);
  b.skidule.start(.1,null,()=>.5);for(let i=0;i<4;i++)b.ingest(controls(i+2,i,50,i+1,'pressed'),.2+i*.1);
  assert.equal(b.snapshot(.6).skidule.state,'solved');assert.equal(b.skidule.locked.filter(Boolean).length,4);
  b.ingest(controls(6,0,101,5),.7);assert.equal(b.snapshot(.7).rejected,1);
  b.reset();assert.equal(b.snapshot(.8).skidule.state,'idle');assert.equal(b.snapshot(.8).skidule.control_height,.5);
});

test('Morse bench mirrors button edges and verifies its code independently of a heist',()=>{
  const b=new HardwareTest();b.selectModule('morse');b.ingest(morse(true),0);assert.equal(b.snapshot(0).morse.lamp,true);b.ingest(morse(false,600),.6);
  assert.deepEqual(b.snapshot(.6).morse.signals,['-']);assert.equal(b.morse.verify('2026'),true);assert.equal(b.snapshot(.7).morse.state,'solved');
  b.reset();b.ingest(morse(true),1);b.ingest(morse(false,100),1.1);assert.deepEqual(b.snapshot(1.1).morse.signals,['.']);
});

test('laser bench accepts test round IDs and deduplicates cuts/finish presses through local resets',()=>{
  const b=new HardwareTest();b.selectModule('laser');b.ingest(laser('beam_broken'),0);b.ingest(laser('beam_broken'),.1);b.ingest(laser('button_pressed','finish-1'),.2);b.ingest(laser('button_pressed','finish-1'),.3);
  assert.equal(b.snapshot(.3).laser.cuts,1);assert.equal(b.snapshot(.3).laser.finishes,1);
  b.reset();b.ingest(laser('beam_broken'),.4);assert.equal(b.snapshot(.4).laser.cuts,0);b.ingest(laser('beam_broken','edge-2'),.5);assert.equal(b.snapshot(.5).laser.cuts,1);
  b.ingest(laser('beam_broken','edge-2','new-test-round'),.6);assert.equal(b.snapshot(.6).laser.cuts,2);
});

test('laser baseline and level cut/clear preserve held-beam suppression',()=>{
  const b=new HardwareTest();b.selectModule('laser');b.ingest({...laser('state'),data:{...laser('state').data,broken:true}},0);b.ingest(laser('cut','a'),.1);assert.equal(b.snapshot(.1).laser.cuts,0);
  b.ingest(laser('clear'),.2);b.ingest(laser('cut','b'),.3);assert.equal(b.snapshot(.3).laser.cuts,1);
});

test('camera bench rejects duplicate/out-of-order samples and shows tracking uncertainty/staleness',()=>{
  const b=new HardwareTest();b.selectModule('camera');const packet={sender:'radar',data:{radar_boot:'boot',radar_seq:1,radar_valid:true,radar_x_mm:-200,radar_y_mm:2300}};
  b.ingest(packet,0);b.ingest(packet,.1);assert.equal(b.snapshot(.1).packets,1);assert.equal(b.snapshot(.1).camera.radar_x_mm,-200);
  b.ingest({sender:'radar',data:{radar_boot:'boot',radar_seq:2,radar_valid:false}},.2);assert.equal(b.snapshot(.2).camera.radar_valid,false);assert.equal(b.snapshot(4).fresh,false);
});

test('device choice stays fixed until selected and one tester cannot change another local check',()=>{
  const a=new HardwareTest(),b=new HardwareTest();for(const bench of [a,b]){bench.ingest(controls(1),0);bench.ingest({...controls(1,3,100),sender:'second-c6'},.1);}
  assert.equal(a.snapshot(.1).devices.length,2);a.selectSource('skidule','second-c6');assert.equal(a.snapshot(.2).skidule.control_height,1);assert.equal(b.snapshot(.2).skidule.control_height,.5);
  assert.throws(()=>a.selectSource('skidule','unknown'));a.skidule.start(.2);a.snapshot(3);assert.equal(a.skidule.state,'fault');assert.equal(b.skidule.state,'idle');
});

test('reconnecting clears old channel sources and uses a fresh button baseline',()=>{
  const b=new HardwareTest();b.ingest(controls(1,1,80,9,'pressed'),0);b.clear();
  assert.equal(b.snapshot(1).source,'');assert.equal(b.snapshot(1).devices.length,0);assert.equal(b.snapshot(1).packets,0);
  b.ingest({...controls(1,2,25,20,'pressed'),sender:'new-team-c6'},1);assert.equal(b.snapshot(1).source,'new-team-c6');assert.equal(b.snapshot(1).skidule.control_height,.25);assert.equal(b.skidule.state,'idle');
});

test('laser alignment requires fresh per-beam status; online alone cannot claim detection',()=>{
  const b=new HardwareTest();b.selectModule('laser');b.setLaserAlignment(true);
  b.ingest(laser('online'),0);assert.equal(b.snapshot(0).laser.alignment_status,'waiting');
  const state=broken=>({...laser('state'),data:{...laser('state').data,broken,input_raw:broken?0:1}});
  b.ingest(state(false),1);assert.equal(b.snapshot(1).laser.alignment_status,'detected');assert.equal(b.snapshot(1).laser.beams[0].raw,1);
  b.ingest(state(true),2);assert.equal(b.snapshot(2).laser.alignment_status,'missing');
  b.ingest(laser('online'),8);assert.equal(b.snapshot(8).fresh,true);assert.equal(b.snapshot(8).laser.alignment_status,'stale');
  b.ingest(state(false),9);assert.equal(b.snapshot(9).laser.alignment_status,'detected');
});

test('alignment pauses only local counters and remembers event IDs on exit',()=>{
  const b=new HardwareTest();b.selectModule('laser');b.ingest(laser('beam_broken','before'),0);assert.equal(b.snapshot(0).laser.cuts,1);
  b.setLaserAlignment(true);b.ingest(laser('beam_broken','during'),1);b.ingest(laser('button_pressed','finish-during'),2);
  assert.equal(b.snapshot(2).laser.cuts,1);assert.equal(b.snapshot(2).laser.finishes,0);
  b.setLaserAlignment(false);b.ingest(laser('beam_broken','during'),3);b.ingest(laser('button_pressed','finish-during'),3);
  assert.equal(b.snapshot(3).laser.cuts,1);assert.equal(b.snapshot(3).laser.finishes,0);
  b.ingest(laser('beam_broken','after'),4);b.ingest(laser('button_pressed','finish-after'),4);
  assert.equal(b.snapshot(4).laser.cuts,2);assert.equal(b.snapshot(4).laser.finishes,1);
  b.setLaserAlignment(true);b.reset('laser');assert.equal(b.snapshot(4).laser.alignment,false);
});

test('alignment ignores other selected sources and never assumes all beams are aligned',()=>{
  const b=new HardwareTest();b.selectModule('laser');b.setLaserAlignment(true);
  const state=(beam_id,broken)=>({sender:'one',data:{module:'laser',event:'state',round_id:'test',beam_id,broken,input_raw:broken?0:1}});
  b.ingest(state(1,false),0);b.ingest(state(2,true),0);assert.equal(b.snapshot(0).laser.alignment_status,'missing');
  b.ingest({...state(2,false),sender:'other'},1);assert.equal(b.snapshot(1).laser.alignment_status,'missing');
  b.ingest(state(2,false),2);assert.equal(b.snapshot(2).laser.alignment_status,'detected');
  b.clear();assert.equal(b.snapshot(2).laser.alignment,false);assert.equal(b.snapshot(2).laser.alignment_status,'waiting');
});
