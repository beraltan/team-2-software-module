import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Skidule,CONTROL_TIMEOUT_S,SKIDULE_BARS} from './skidule.mjs';
import {Controller} from './controller.mjs';

function kit(){
 const puzzle=new Skidule();puzzle.selectSource('controls');let seq=0,count=0,t=0;
 const send=(changes={},sender='controls')=>puzzle.ingest(sender,{module:'skidule_controls',event:'state',boot_id:'boot',seq:++seq,bar_index:0,bar_height:.5,button_press_count:count,...changes},t+=.01);
 send();puzzle.start(t,'heist-round',()=>.5); // Targets are .5 in these scenarios.
 const press=(bar=0,height=.5)=>send({event:'pressed',bar_index:bar,bar_height:height,button_press_count:++count});
 return {puzzle,send,press,now:()=>t};
}

test('firmware packet sets selected bar and height; targets stay hidden from display',()=>{
 const {puzzle,send,now}=kit();send({bar_index:3,bar_height:.25});
 const state=puzzle.snapshot(now());assert.equal(state.selected,3);assert.equal(state.heights[3],.25);assert.equal(state.feedback,'cold');assert(!('targets' in state));
 assert.equal(state.bar_count,4);assert.equal(state.heights.length,4);
 send({bar_index:3,bar_height:.4});assert.equal(puzzle.feedback(),'warm');
 send({bar_index:3,bar_height:.48});assert.equal(puzzle.feedback(),'match');
});

test('held state and duplicate press messages never repeatedly toggle a lock',()=>{
 const {puzzle,send,press}=kit();press();assert(puzzle.locked[0]);
 for(let i=0;i<6;i++)send({button_pressed:true,button_press_count:1});
 send({event:'pressed',button_press_count:1});assert(puzzle.locked[0]);
 press();assert(!puzzle.locked[0]);
});

test('press uses height in the same packet; unmatched bars stay unlocked',()=>{
 const {puzzle,send,press}=kit();send({bar_height:.1});press(0,.5);assert(puzzle.locked[0]);
 press(1,.1);assert(!puzzle.locked[1]);assert.match(puzzle.notice,/not matched/);
 send({bar_index:0,bar_height:.9});assert.equal(puzzle.heights[0],.5);
});

test('four correct locks produce one round-scoped completion; three do not finish',()=>{
 const {puzzle,press}=kit();assert.equal(SKIDULE_BARS,4);
 for(let i=0;i<3;i++)press(i);assert.equal(puzzle.state,'running');assert.equal(puzzle.takeResult(),null);
 press(3);
 assert.equal(puzzle.state,'solved');const result=puzzle.takeResult();
 assert.equal(result.round_id,'heist-round');assert.equal(result.locked_count,4);assert.equal(result.bar_count,4);assert(result.result_id);assert(result.puzzle_round_id);
 assert.equal(puzzle.takeResult(),null);press(3,.1);assert.equal(puzzle.state,'solved');assert(puzzle.locked.every(Boolean));
});

test('wrong sender, duplicate sequence and malformed control values cannot alter the puzzle',()=>{
 const {puzzle,send,now}=kit();send({bar_index:2},'another-esp');assert.equal(puzzle.selected,0);
 for(const changes of [{bar_index:4},{bar_index:9},{bar_count:10},{bar_height:NaN},{bar_height:1.1},{button_press_count:-1},{seq:puzzle.seq}])assert.equal(send(changes),false);
 assert.equal(puzzle.snapshot(now()).locked_count,0);
});

test('outage or reboot faults an active lock; recovery cannot silently resume it',()=>{
 const {puzzle,press,now}=kit();press();
 puzzle.ingest('controls',{module:'skidule_controls',event:'pressed',boot_id:'new-boot',seq:1,bar_index:1,bar_height:.5,button_press_count:1},now()+.1);
 assert.equal(puzzle.state,'fault');assert(!puzzle.locked[1]);
 const other=kit();other.puzzle.tick(other.now()+CONTROL_TIMEOUT_S+.1);assert.equal(other.puzzle.state,'fault');
 other.send();assert.equal(other.puzzle.state,'fault');other.puzzle.reset();assert.equal(other.puzzle.state,'idle');assert(!other.puzzle.locked.some(Boolean));
});

test('a held button seen before start is a baseline, not an extra confirmation',()=>{
 const p=new Skidule();p.selectSource('controls');
 const packet={module:'skidule_controls',event:'pressed',boot_id:'b',seq:1,bar_index:0,bar_height:.5,button_press_count:3};
 p.ingest('controls',packet,0);p.start(0,null,()=>.5);p.ingest('controls',{...packet,seq:2},.1);assert(!p.locked[0]);
 p.ingest('controls',{...packet,seq:3,button_press_count:4},.2);assert(p.locked[0]);
});

test('selecting module cards preserves the running camera round and Skidule progress',()=>{
 const c=new Controller(0,'owner');c.game.ingest({radar_boot:'b',radar_seq:1,radar_valid:true,radar_x_mm:-900,radar_y_mm:1800},0);
 c.game.setup_checked=true;c.start(0);const round=c.game.round_id;c.game.guide('left',0);
 c.skidule.locked[3]=true;c.selectModule('skidule');assert.equal(c.game.state,'running');assert.equal(c.game.round_id,round);assert.equal(c.game.signal(0),'stop');
 c.game.tick(.2);assert.equal(c.game.remaining,179.8);c.selectModule('camera');assert(c.skidule.locked[3]);
});

test('Skidule discovery is independent of radar selection and stale discovery cannot enable start',()=>{
 const c=new Controller(0,'owner');c.live(0);c.connected=true;
 const event={sender:'c6',data:{module:'skidule_controls',event:'state',boot_id:'b',seq:1,bar_index:0,bar_height:.5,button_press_count:0}};
 c.receive(event,0);assert(c.controls.has('c6'));assert.equal(c.game.seq,-1);
 c.selectControls('c6',5);assert.throws(()=>c.startSkidule(5),/fresh/);
 c.receive({...event,data:{...event.data,seq:2}},5);c.startSkidule(5);assert.equal(c.skidule.state,'running');
 c.fault('Network lost',5.1);assert.equal(c.skidule.state,'fault');assert.equal(c.game.state,'idle');
});

test('course reconnection preserves an interrupted Skidule attempt until deliberate reset',()=>{
 const c=new Controller(0,'owner');c.skidule.state='fault';c.skidule.notice='Previous lock attempt interrupted';
 c.live(1);assert.equal(c.skidule.state,'fault');assert.equal(c.skidule.notice,'Previous lock attempt interrupted');
 c.resetSkidule(4);assert.equal(c.skidule.state,'idle');
});


test('friend firmware: normalized knob maps all ten positions onto four bars and preserves height',()=>{
 const p=new Skidule();p.selectSource('friend');
 for(let i=0;i<10;i++){
  const knob=i/9;
  assert(p.ingest('friend',{module:'skidule_controls',event:'state',boot_id:'friend',seq:i+1,bar_index:i,knob,slider:.72,bar_height:.72,button_press_count:0},i*.1));
  assert.equal(p.selected,Math.min(3,Math.floor(knob*4)));assert.equal(p.controlHeight,.72);assert.equal(p.snapshot(i*.1).input_mapping,'knob_to_four');
 }
 assert.equal(p.selected,3);assert.equal(p.snapshot(1).input_bar_index,9);
});

test('friend firmware: four press edges complete the lock without retries or held states toggling it',()=>{
 const p=new Skidule();p.selectSource('friend');let seq=0;
 const send=(bar,count,event='state')=>p.ingest('friend',{module:'skidule_controls',boot_id:'f',seq:++seq,event,bar_count:10,bar_index:Math.min(9,Math.floor((bar+.5)/4*10)),knob:(bar+.5)/4,slider:.5,bar_height:.5,button_press_count:count},seq*.01);
 send(0,0);p.start(.01,'round-f',()=>.5);
 for(let bar=0;bar<4;bar++){send(bar,bar+1,'pressed');assert(p.locked[bar]);send(bar,bar+1,'pressed');send(bar,bar+1,'released');assert(p.locked[bar]);}
 assert.equal(p.state,'solved');assert.equal(p.takeResult().bar_count,4);assert.equal(p.takeResult(),null);
});

test('explicit four-bar firmware keeps its index, and ambiguous or malformed legacy inputs are rejected',()=>{
 const p=new Skidule();p.selectSource('friend');const packet={module:'skidule_controls',event:'state',boot_id:'f',seq:1,bar_index:2,bar_count:4,knob:100,slider:100,button_press_count:0};
 assert(p.ingest('friend',packet,0));assert.equal(p.selected,2);assert.equal(p.controlHeight,1);
 for(const change of [{bar_count:10,knob:1.1},{bar_count:10,knob:-.1},{bar_count:10,knob:NaN},{bar_count:10,knob:undefined},{bar_count:undefined,bar_index:9,knob:undefined}])assert.equal(p.ingest('friend',{...packet,...change,seq:2},.1),false);
});
