import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Controller} from './controller.mjs';
import {validLaser} from './laser.mjs';
function kit(){
 const c=new Controller(0,'owner');c.live(0);c.connected=true;
 c.receive({sender:'camera',data:{radar_seq:1,radar_boot:'camera-boot',radar_valid:true,radar_x_mm:-900,radar_y_mm:1800}},0);
 c.game.setup_checked=true;c.start(0);c.game.layout={zones:[],key:'test'};
 const send=(event,event_id='boot:1',beam_id='A',at=.1,changes={},sender='laser-esp')=>c.receive({sender,data:{module:'laser',event,beam_id,event_id,round_id:c.game.round_id,...changes}},at);
 return {c,send};
}

test('physical laser cut deducts elapsed time plus the configured penalty and adds one anomaly',()=>{
 const {c,send}=kit();send('cut');
 assert.equal(c.game.remaining,174.9);assert.equal(c.game.penalties,1);assert.equal(c.game.laser_cuts,1);
 assert.equal(c.game.state,'running');assert.equal(c.game.events.at(-1).reason,'laser cut');
 const h=c.heartbeat(.1);assert.equal(h.laser_cuts,1);assert.equal(h.toktik_penalties,1);
});

test('a blocked beam counts once until clear; duplicate old cuts cannot block a fresh cut',()=>{
 const {c,send}=kit();send('cut');send('cut');send('cut','boot:2');assert.equal(c.game.penalties,1);
 send('clear');send('cut','boot:1');assert.equal(c.game.penalties,1);
 send('cut','boot:3');assert.equal(c.game.penalties,2);assert.equal(c.game.laser_cuts,2);
});

test('separate beams and ESPs are independent; three combined anomalies cause lockdown',()=>{
 const {c,send}=kit();send('cut','boot:1','A');send('cut','boot:1','B');
 send('cut','boot:1','A',.1,{},'second-laser-esp');
 assert.equal(c.game.penalties,3);assert.equal(c.game.state,'lost');assert.equal(c.game.signal(.1),'stop');
});

test('old rounds, malformed packets, conflicts and disconnected inputs cannot apply a penalty',()=>{
 const {c,send}=kit();send('cut','boot:1','A',.1,{round_id:'old-round'});send('cut',undefined,'A',.1,{event_id:''});
 send('unknown');assert.equal(c.game.penalties,0);c.conflict=true;send('cut');assert.equal(c.game.penalties,0);
 c.conflict=false;c.connected=false;send('cut');assert.equal(c.game.penalties,0);
 for(const d of [{module:'laser',event:'cut'},{module:'laser',event:'state',beam_id:'A',round_id:'r',broken:'true'},{module:'laser',event:'cut',beam_id:'A',round_id:'',event_id:1}])assert.equal(validLaser(d),false);
});

test('laser state is only a baseline and does not penalize starting with a blocked beam',()=>{
 const {c,send}=kit();send('state','unused','A',.1,{broken:true});send('cut');assert.equal(c.game.penalties,0);
 send('state','unused','A',.1,{broken:false});send('cut','boot:2');assert.equal(c.game.penalties,1);
});

test('presenter bypass suppresses cuts without replaying held beams when enabled again',()=>{
 const {c,send}=kit();c.bypassLasers(true);send('cut');assert.equal(c.game.penalties,0);
 c.bypassLasers(false);send('cut','boot:2');assert.equal(c.game.penalties,0);
 send('clear');send('cut','boot:3');assert.equal(c.game.penalties,1);
 c.game.finish('fault','test',.2);c.reset(.2);assert.equal(c.game.laser_cuts,0);assert.equal(c.laser.bypassed,false);assert.equal(c.game.snapshot(.2).last_laser_cut,null);
});

test('manual fallback and offline demo use the same penalty, with no hardware needed for a cut',()=>{
 const {c}=kit();c.mode='demo';c.recordLaserCut(.1);assert.equal(c.game.penalties,1);assert.equal(c.game.laser_cuts,1);
 c.bypassLasers(true);assert.throws(()=>c.recordLaserCut(.2),/bypassed/);
 c.bypassLasers(false);c.bypassModule('camera',.2);assert.throws(()=>c.recordLaserCut(.3),/Start camera/);
});

test('finished, timed out and stale attempts cannot take late penalties',()=>{
 const won=kit();won.c.bypassModule('camera',.1);won.send('cut');assert.equal(won.c.game.penalties,0);
 const stale=kit();stale.send('cut','boot:1','A',1.1);assert.equal(stale.c.game.state,'fault');assert.equal(stale.c.game.penalties,0);
 const expiry=kit();expiry.c.game.remaining=1;expiry.send('cut');assert.equal(expiry.c.game.remaining,0);assert.equal(expiry.c.game.state,'lost');assert.equal(expiry.c.game.laser_cuts,1);
});

test('supplied beam_broken format charges each unique edge without a clear packet',()=>{
 const {c}=kit();c.game.round_id='round-003';c.laser.beginRound('round-003');
 const data={module:'laser',device_id:'team2-laser',event:'beam_broken',beam_id:1,event_id:'boot42-17',round_id:'round-003'};
 c.receive({sender:'laser-socket',data},.1);c.receive({sender:'laser-socket',data},.2);
 assert.equal(c.game.penalties,1);assert.equal(c.game.remaining,174.9);
 c.receive({sender:'reconnected-laser-socket',data},.2);assert.equal(c.game.penalties,1);
 c.receive({sender:'laser-socket',data:{...data,event_id:'boot42-19'}},.3);
 assert.equal(c.game.penalties,2);assert.equal(c.game.laser_cuts,2);
});

test('supplied finish button completes the laser card once without a beam or penalty',()=>{
 const {c}=kit();c.game.round_id='round-003';c.laser.beginRound('round-003');
 const data={module:'laser',device_id:'team2-laser',event:'button_pressed',event_id:'boot42-18',round_id:'round-003'};
 c.selectModule('morse');c.receive({sender:'laser-socket',data},.1);
 assert.equal(c.laser.state,'solved');assert.equal(c.game.penalties,0);assert.equal(c.game.remaining,180);
 assert.equal(c.game.state,'running');c.selectModule('laser');assert.equal(c.laser.state,'solved');
 const result=c.laser.takeResult();assert.equal(result.event,'solved');assert.equal(result.module,'laser');
 assert.equal(result.device_id,'team2-laser');assert.equal(result.input_event_id,'boot42-18');
 assert.equal(result.round_id,'round-003');assert.equal(result.bypassed,false);
 c.receive({sender:'laser-socket',data},.2);assert.equal(c.laser.takeResult(),null);
 const h=c.heartbeat(.2);assert.equal(h.laser_solved,true);assert.equal(h.laser_result_id,result.result_id);
 assert.throws(()=>c.recordLaserCut(.2),/complete/);
});

test('finish is independent of navigation; fresh reset round rejects delayed old button',()=>{
 const c=new Controller(0,'owner');c.live(0);c.connected=true;
 const round=c.heartbeat(.1).laser_round_id;
 const data={module:'laser',device_id:'team2-laser',event:'button_pressed',event_id:'boot42-18',round_id:round};
 c.receive({sender:'laser-socket',data},.1);assert.equal(c.laser.state,'solved');assert.equal(c.game.state,'idle');
 c.resetLaser(.2);assert.notEqual(c.laser.roundId,round);c.receive({sender:'laser-socket',data},.3);
 assert.equal(c.laser.state,'idle');assert.equal(c.laser.resultId,null);
 c.receive({sender:'laser-socket',data:{...data,round_id:c.laser.roundId,event_id:'boot42-20'}},.4);
 assert.equal(c.laser.state,'solved');
});

test('laser penalty bypass and module completion bypass are separate',()=>{
 const {c,send}=kit();c.bypassLasers(true);
 send('beam_broken','boot:1',1,.1,{device_id:'team2-laser'});assert.equal(c.game.penalties,0);
 send('button_pressed','boot:2',undefined,.2,{device_id:'team2-laser'});
 assert.equal(c.laser.state,'solved');assert.equal(c.laser.takeResult().bypassed,false);
 c.resetLaser(.3);c.mode='demo';c.connected=false;c.bypassModule('laser',.4);
 const result=c.laser.takeResult();assert.equal(result.bypassed,true);assert.equal(result.completion_method,'presenter_bypass');
 c.bypassModule('laser',.5);assert.equal(c.laser.takeResult(),null);
});

test('bad, old-round, disconnected and conflicted finish packets cannot complete the module',()=>{
 const {c}=kit();const data={module:'laser',device_id:'team2-laser',event:'button_pressed',event_id:'boot42-18',round_id:c.laser.roundId};
 for(const changes of [{round_id:'old'},{device_id:''},{event_id:''},{round_id:null}]){
  c.receive({sender:'laser-socket',data:{...data,...changes}},.1);assert.equal(c.laser.state,'idle');
 }
 assert.equal(validLaser({...data,event:'beam_broken'}),false);
 c.connected=false;c.receive({sender:'laser-socket',data},.1);assert.equal(c.laser.state,'idle');
 c.connected=true;c.conflict=true;c.receive({sender:'laser-socket',data},.2);assert.equal(c.laser.state,'idle');
 c.conflict=false;c.quietUntil=1;c.receive({sender:'laser-socket',data},.3);assert.equal(c.laser.state,'idle');
});

test('completed laser card survives navigation reset and a new camera attempt',()=>{
 const {c,send}=kit();send('button_pressed','boot:18',undefined,.1,{device_id:'team2-laser'});
 const result=c.laser.takeResult();c.bypassModule('camera',.2);c.reset(.3);
 assert.equal(c.laser.state,'solved');c.game.setup_checked=true;c.start(.4);
 assert.equal(c.laser.state,'solved');assert.equal(c.laser.resultId,result.result_id);
 assert.equal(c.laser.takeResult(),null);c.resetLaser(.5);assert.equal(c.laser.state,'idle');
});
