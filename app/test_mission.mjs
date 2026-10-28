import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Controller} from './controller.mjs';
import {Skidule,validControls} from './skidule.mjs';

function crew(){
 const c=new Controller(0,'owner');c.enableHeist();c.mode='live';c.connected=true;c.camera='camera';
 let seq=0;
 const radar=(x,y,at)=>c.receive({sender:'camera',data:{radar_boot:'boot',radar_seq:++seq,radar_valid:true,radar_x_mm:x,radar_y_mm:y}},at);
 radar(-900,1800,0);c.game.setup_checked=true;
 return {c,radar};
}
function leave(kit){kit.c.start(0);kit.c.game.layout={zones:[],key:'test'};kit.radar(0,2300,.1);kit.c.tick(.1);}

test('ten-minute mission arms in the safe zone and starts on departure',()=>{
 const kit=crew(),{c,radar}=kit;c.start(0);c.game.layout={zones:[],key:'test'};assert.equal(c.game.state,'armed');assert.equal(c.game.remaining,600);
 radar(-900,1800,.5);c.tick(.5);assert.equal(c.game.remaining,600);
 radar(0,2300,.6);c.tick(.6);assert.equal(c.game.state,'running');
 radar(0,2300,.9);c.tick(1);assert.equal(c.game.remaining,599.6);
 assert.equal(c.heartbeat(1).heist_phase,'navigation');
});

test('reaching vault completes Camera but keeps the shared clock running through all puzzles',()=>{
 const kit=crew(),{c,radar}=kit;leave(kit);
 const goal=c.game.cfg.goal;radar((goal[0]+goal[1])/2,(goal[2]+goal[3])/2,.2);c.tick(.2);
 assert.equal(c.game.navigation_complete,true);assert.equal(c.game.state,'running');assert.equal(c.game.phase,'skidule');
 const time=c.game.remaining;c.tick(10);assert.equal(c.game.state,'running');assert.equal(c.game.remaining,time-9.8);
 c.bypassModule('skidule',10);c.tick(10);assert.equal(c.game.phase,'morse');
 c.bypassModule('morse',11);c.tick(11);assert.equal(c.game.phase,'laser');
 c.bypassModule('laser',12);c.tick(12);assert.equal(c.game.phase,'escape');assert.equal(c.game.state,'running');
 radar(-900,1800,12.1);c.tick(12.1);assert.equal(c.game.state,'won');
 const stopped=c.game.remaining;c.tick(50);assert.equal(c.game.remaining,stopped);
});

test('wall and beam penalties share one clock and anomaly count after navigation',()=>{
 const kit=crew(),{c}=kit;leave(kit);c.game.layout={kind:'maze',zones:[[-100,100,2200,2400]],margin_mm:0,key:'test'};c.tick(.2);assert.equal(c.game.penalties,1);c.bypassModule('camera',.2);c.bypassModule('skidule',.2);c.bypassModule('morse',.2);c.tick(.2);assert.equal(c.game.phase,'laser');
 const event=(id,at)=>c.receive({sender:'laser',data:{module:'laser',device_id:'team2-laser',event:'beam_broken',beam_id:1,event_id:id,round_id:c.laser.roundId}},at);
 event('boot:1',2);assert.equal(c.game.penalties,2);assert(Math.abs(c.game.remaining-588.1)<1e-8);
 event('boot:1',2.1);assert.equal(c.game.penalties,2);
 event('boot:2',2.2);assert.equal(c.game.penalties,3);assert.equal(c.game.state,'lost');
 assert.equal(c.heartbeat(2.2).toktik_state,'lost');
});

test('clock expires during a vault stage without needing a fresh radar sample',()=>{
 const kit=crew(),{c}=kit;leave(kit);c.bypassModule('camera',.2);c.tick(.2);c.tick(601);
 assert.equal(c.game.state,'lost');assert.equal(c.game.remaining,0);
});

test('entry and escape require tracking, while vault stages tolerate an idle camera',()=>{
 const kit=crew();leave(kit);kit.c.tick(2);assert.equal(kit.c.game.state,'fault');
 const other=crew();leave(other);other.c.bypassModule('camera',.2);other.c.tick(2);assert.equal(other.c.game.state,'running');
 other.c.bypassModule('laser',2);other.c.bypassModule('skidule',2);other.c.bypassModule('morse',2);other.c.tick(2);other.c.tick(3.1);
 assert.equal(other.c.game.state,'fault');
});

test('presenter can bypass a failed camera and confirm escape after all modules',()=>{
 const {c,radar}=crew();assert.throws(()=>c.confirmEscape(0),/all four/);c.bypassModule('camera',0);c.start(0);c.game.layout={zones:[],key:'test'};assert.equal(c.game.state,'running');
 radar(0,2300,.1);for(const module of ['laser','skidule','morse'])c.bypassModule(module,.1);c.confirmEscape(.2);
 assert.equal(c.game.state,'won');assert.equal(c.game.escape_bypassed,true);
 c.reset(.3);assert.equal(c.game.state,'idle');assert.equal(c.game.remaining,600);assert.equal(c.game.navigation_complete,false);
 assert.equal(c.skidule.state,'idle');assert.equal(c.morse.state,'idle');assert.equal(c.laser.state,'idle');
});

test('module switches and puzzle resets do not refill the shared heist clock',()=>{
 const kit=crew(),{c}=kit;leave(kit);c.bypassModule('camera',.2);c.tick(5);const time=c.game.remaining;
 for(const name of ['camera','laser','skidule','morse'])c.selectModule(name);
 c.resetSkidule(5);c.resetMorse(5);c.resetLaser(5);assert.equal(c.game.remaining,time);assert.equal(c.game.state,'running');
 assert.throws(()=>c.reset(5),/Abort/);
});

test('percentage slider values map exactly to height, including one percent and endpoints',()=>{
 const p=new Skidule();p.selectSource('c6');let seq=0;
 for(const slider of [0,1,50,100]){const d={module:'skidule_controls',event:'state',boot_id:'b',seq:++seq,bar_index:3,slider,button_press_count:0};assert(validControls(d));p.ingest('c6',d,seq/100);assert.equal(p.controlHeight,slider/100);}
 for(const slider of [-1,101,'50',null,NaN])assert.equal(validControls({module:'skidule_controls',event:'state',boot_id:'b',seq:10,bar_index:0,slider,button_press_count:0}),false);
});

test('camera bypass after arming starts the shared clock and advances to Skidule',()=>{
 const {c}=crew();c.start(0);assert.equal(c.game.state,'armed');c.bypassModule('camera',.1);c.tick(.1);
 assert.equal(c.game.state,'running');assert.equal(c.game.phase,'skidule');c.tick(2);assert.equal(c.game.remaining,598.1);
});

test('a fault resumes only after explicit presenter inspection and preserves remaining time',()=>{
 const kit=crew(),{c}=kit;leave(kit);c.fault('test interruption',.2);const left=c.game.remaining;
 assert.throws(()=>c.resumeHeist(5),/tracking/);c.bypassModule('camera',5);c.resumeHeist(5);
 assert.equal(c.game.state,'running');assert.equal(c.game.remaining,left);c.tick(6);assert.equal(c.game.remaining,left-1);
});

test('laser cuts and finish cannot skip the final-report order or complete a faulted heist',()=>{
 const kit=crew(),{c}=kit;
 const send=(event,at)=>c.receive({sender:'laser',data:{module:'laser',device_id:'laser-board',event,beam_id:1,event_id:'edge-'+at,round_id:c.laser.roundId}},at);
 send('button_pressed',0);assert.equal(c.laser.state,'idle');
 c.start(0);send('button_pressed',.01);assert.equal(c.laser.state,'idle');
 c.bypassModule('camera',.1);c.tick(.1);assert.equal(c.game.phase,'skidule');
 for(const event of ['beam_broken','button_pressed'])send(event,.11);
 assert.equal(c.game.penalties,0);assert.equal(c.laser.state,'idle');
 assert.throws(()=>c.recordLaserCut(.12),/before the laser stage/);
 c.bypassModule('skidule',.2);c.tick(.2);assert.equal(c.game.phase,'morse');
 send('button_pressed',.21);assert.equal(c.laser.state,'idle');
 c.bypassModule('morse',.3);c.tick(.3);assert.equal(c.game.phase,'laser');
 c.fault('inspection',.4);send('button_pressed',.41);assert.equal(c.laser.state,'idle');
 c.resumeHeist(.5);send('beam_broken',.51);assert.equal(c.game.penalties,1);
 send('button_pressed',.6);c.tick(.6);assert.equal(c.game.phase,'escape');
 assert.equal(c.laser.state,'solved');assert.equal(c.game.state,'running');
});
