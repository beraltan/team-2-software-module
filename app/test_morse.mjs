import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Morse,validMorse,MORSE_TIMEOUT_S,MORSE_MAX_HOLD_S} from './morse.mjs';
import {Controller} from './controller.mjs';
const heartbeat=uptime_s=>({module:'suitcase',event:'online',uptime_s});
const press={module:'morse_button',state:'pressed',lampo_toggle:true};
const release={module:'morse_button',state:'released',lampo_toggle:false,duration_ms:120};
function receiver(){const m=new Morse();m.selectSource('button');m.ingest('button',heartbeat(100),0);return m;}

test('original button packets mirror short and long flashes without translating Morse',()=>{
  const m=receiver();m.ingest('button',press,.1);assert.equal(m.lamp,true);assert.equal(m.state,'receiving');
  m.ingest('button',release,.22);assert.equal(m.lamp,false);
  m.ingest('button',{module:'morse_button',state:'pressed'},.5);assert.equal(m.lamp,true);
  m.ingest('button',{...release,duration_ms:1200},1.7);assert.equal(m.lamp,false);
  assert.equal(m.state,'receiving');assert.equal(m.takeResult(),null);assert(!('decoded' in m.snapshot(1.7)));
});

test('clear extinguishes the lamp and keeps the terminal ready for another transmission',()=>{
  const m=receiver();m.ingest('button',press,.1);m.clearSignal();assert.equal(m.lamp,false);assert.equal(m.state,'idle');
  m.ingest('button',release,.2);assert.equal(m.state,'idle');
  m.ingest('button',press,.3);assert.equal(m.lamp,true);assert.equal(m.state,'receiving');
});

test('received marks use device duration and collect in five-signal groups without duplicate releases',()=>{
  const m=receiver();let t=.1;
  for(const duration_ms of [100,399,400,600,1000]){m.ingest('button',press,t);m.ingest('button',{...release,duration_ms},t+=.01);t+=.01;}
  const s=m.snapshot(t);assert.deepEqual(s.signals,['.','.','-','-','-']);assert.equal(s.signal_count,5);
  m.ingest('button',{...release,duration_ms:1000},t+.1);assert.equal(m.signalCount,5);
  s.signals.push('.');assert.equal(m.signals.length,5);
  m.clearSignal();assert.deepEqual(m.signals,[]);assert.equal(m.signalCount,0);
  m.ingest('button',release,t+.2);assert.equal(m.signalCount,0);
});

test('demo timing supplies marks when no device duration exists and history retains complete rows',()=>{
  const m=receiver();m.ingest('button',press,.1);m.ingest('button',{module:'morse_button',state:'released'},.7);
  assert.deepEqual(m.signals,['-']);m.clearSignal();let t=1;
  for(let i=0;i<35;i++){m.ingest('button',press,t);m.ingest('button',release,t+=.2);t+=.1;}
  assert.equal(m.signalCount,35);assert.equal(m.signals.length,30);
  m.verify('2026');assert.equal(m.signals.length,30);m.reset();assert.deepEqual(m.signals,[]);
});

test('original passcode works without hardware and produces one compatible terminal result',()=>{
  const m=new Morse();assert.equal(m.verify(''),false);assert.match(m.feedback,/Type/);
  assert.equal(m.verify('1234'),false);assert.match(m.feedback,/Wrong/);assert.equal(m.state,'idle');
  assert(m.verify(' 2026 ','heist'));const result=m.takeResult();
  assert.equal(result.module,'terminal');assert.equal(result.event,'solved');assert.equal(result.puzzle_id,'morse');
  assert.equal(result.round_id,'heist');assert(result.result_id);assert.equal(result.bypassed,false);
  m.verify('2026','another');m.bypass();assert.equal(m.takeResult(),null);assert.equal(m.resultId,result.result_id);assert.equal(m.bypassed,false);
  assert(!('passcode' in m.snapshot(0)));m.reset();assert.equal(m.state,'idle');assert.equal(m.resultId,null);
});

test('heartbeat loss, missing release and device restart turn the lamp off until reset',()=>{
  const stale=receiver();stale.ingest('button',press,.1);stale.tick(.1+MORSE_TIMEOUT_S);assert.equal(stale.state,'fault');assert.equal(stale.lamp,false);
  stale.ingest('button',press,26);assert.equal(stale.lamp,false);stale.reset();stale.ingest('button',release,26.1);stale.ingest('button',press,26.2);assert.equal(stale.lamp,true);
  const held=receiver();held.ingest('button',press,.1);held.ingest('button',heartbeat(105),5);held.ingest('button',press,6);held.tick(.1+MORSE_MAX_HOLD_S);
  assert.equal(held.state,'fault');assert.equal(held.lamp,false);
  const reboot=receiver();reboot.ingest('button',press,.1);reboot.ingest('button',heartbeat(1),.2);assert.equal(reboot.state,'fault');assert.equal(reboot.lamp,false);
});

test('unselected senders and malformed messages cannot light the lamp',()=>{
  const m=receiver();m.ingest('other',press,.1);assert.equal(m.lamp,false);
  for(const d of [{module:'terminal',event:'solved'},{module:'morse_button',state:'unknown'},{module:'suitcase',event:'online',uptime_s:-1}]){assert.equal(validMorse(d),false);assert.equal(m.ingest('button',d,.2),false);}
});

test('sole Morse sender is selected immediately so the first flash survives startup listening',()=>{
  const c=new Controller(0,'owner');c.live(0);c.quietUntil=3;
  c.receive({sender:'original_suitcase',data:press},.1);
  assert.equal(c.morse.source,'original_suitcase');assert.equal(c.morse.lamp,true);assert.equal(c.heartbeat(.1),null);
  c.receive({sender:'original_suitcase',data:release},.22);assert.equal(c.morse.lamp,false);
  c.selectModule('camera');c.selectModule('morse');assert.equal(c.morse.state,'receiving');
});

test('extra Morse senders do not take over; an explicit choice does not replay old edges',()=>{
  const c=new Controller(0);c.live(0);c.connected=true;
  c.receive({sender:'a',data:heartbeat(1)},0);c.receive({sender:'b',data:press},.1);
  assert.equal(c.morse.source,'a');assert.equal(c.morse.lamp,false);assert.equal(c.morseDevices(.1).length,2);
  c.selectMorse('b',.2);assert.equal(c.morse.lamp,false);assert.equal(c.morse.fresh(.2),true);
  c.receive({sender:'b',data:release},.3);c.receive({sender:'b',data:press},.4);assert(c.morse.lamp);
  assert.throws(()=>c.selectMorse('a',.5),/Clear/);
  c.fault('Disconnected',.6);c.receive({sender:'a',data:press},.7);assert.equal(c.morse.source,'b');assert.equal(c.morse.lamp,false);
});

test('Morse bypass is available without hardware, stays passed and publishes explicit metadata',()=>{
  const c=new Controller(0,'owner');c.bypassModule('morse',1);assert.equal(c.morse.state,'solved');assert(c.morse.bypassed);
  c.morse.tick(99);c.fault('Network gone',100);assert.equal(c.morse.state,'solved');
  const result=c.morse.takeResult();assert.equal(result.bypassed,true);assert.equal(result.completion_method,'presenter_bypass');
  c.bypassModule('morse',101);assert.equal(c.morse.takeResult(),null);
  c.mode='live';c.connected=true;const h=c.heartbeat(101);assert.equal(h.morse_solved,true);assert.equal(h.morse_lamp,false);assert.equal(h.morse_result_id,result.result_id);
  c.resetMorse(102);assert.equal(c.morse.bypassed,false);assert.equal(c.morse.state,'idle');
});
