import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Controller} from '../app/controller.mjs';
import {DeviceLab} from './device-lab-model.mjs';
function kit(legacy=true){
  const c=new Controller(0,'lab-crew');c.enableHeist();c.mode='live';c.connected=true;
  const lab=new DeviceLab({legacy});let now=0;
  const send=(kind,data)=>data&&c.receive({sender:'emulated_'+kind,data},now);
  function step(dt=.1){now+=dt;lab.advance(now);send('camera',lab.radar());send('skidule',lab.controls());send('morse',{module:'suitcase',event:'online',uptime_s:Math.floor(now)});send('laser',{module:'laser',event:'online'});send('vault',lab.vaultStatus());c.tick(now);lab.heartbeat(c.heartbeat(now),now);}
  step();c.game.setup_checked=true;
  const walk=returning=>{for(const b of lab.route(returning)){const a={...lab.position},steps=Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/75);for(let k=1;k<=steps;k++){lab.position={x:a.x+(b.x-a.x)*k/steps,y:a.y+(b.y-a.y)*k/steps};step(.2);}}};
  return {c,lab,step,send,walk,now:()=>now};
}
for(const legacy of [true,false])test('full heist, no bypass: '+(legacy?'friend ten-position firmware':'native four-bar percentage firmware'),()=>{
  const {c,lab,step,send,walk,now}=kit(legacy);c.start(now());step();step();
  assert.equal(c.game.state,'armed');assert.equal(c.game.remaining,600);assert.equal(lab.vault.command,'lock');
  walk(false);assert.equal(c.game.phase,'skidule');assert.equal(c.game.penalties,0);
  send('laser',lab.laser('button_pressed'));step();assert.equal(c.laser.state,'idle');assert.equal(lab.vault.command,'lock');
  c.startSkidule(now());
  // A player can solve using only broadcast feedback; hidden targets are never read.
  for(let bar=0;bar<4;bar++){lab.bar=bar;let matched=false;for(let slider=0;slider<=100;slider+=5){lab.slider=slider;step();if(lab.beat.skidule_feedback==='match'){const press=lab.press();send('skidule',press);send('skidule',{...press,seq:++lab.controlSeq});send('skidule',lab.controls('released'));step();matched=true;break;}}assert(matched);}
  assert.equal(c.skidule.state,'solved');assert.equal(c.game.phase,'morse');assert.equal(lab.vault.command,'lock');
  for(const row of ['..---','-----','..---','-....'])for(const signal of row){send('morse',lab.morse(true));const duration=signal==='.'?200:600;for(let ms=0;ms<duration;ms+=100)step();send('morse',lab.morse(false,duration));step();}
  assert.deepEqual(c.morse.signals.join(''),'..--------..----....');assert.equal(c.morse.signalCount,20);
  assert.equal(c.morse.verify('0000',c.game.round_id),false);assert.equal(c.game.phase,'morse');
  c.morse.verify('2026',c.game.round_id);step();assert.equal(c.game.phase,'laser');assert.equal(lab.vault.command,'lock');
  send('laser',lab.laser());const afterCut=c.game.remaining;assert.equal(c.game.penalties,1);
  send('laser',lab.laser('beam_broken',{duplicate:true}));assert.equal(c.game.penalties,1);assert.equal(c.game.remaining,afterCut);
  send('laser',lab.laser('button_pressed',{round:'old-round'}));assert.equal(c.laser.state,'idle');
  send('laser',lab.laser('button_pressed'));step();assert.equal(c.game.phase,'escape');assert.equal(lab.vault.command,'unlock');
  for(let k=0;k<46;k++)step();assert.equal(lab.vaultStatus().motion,'at_target');assert.equal(lab.vault.angle,0);
  walk(true);assert.equal(c.game.state,'won');assert.equal(c.game.escape_bypassed,false);assert.equal(c.game.bypassed,false);
  assert.equal(c.laser.moduleBypassed,false);assert.equal(c.skidule.bypassed,false);assert.equal(c.morse.bypassed,false);
  assert.equal(c.game.penalties,1);assert(c.game.remaining>0);const stopped=c.game.remaining;
  for(let k=0;k<10;k++)step();assert.equal(c.game.remaining,stopped);
  c.reset(now());step();assert.equal(c.game.remaining,600);assert.equal(c.skidule.state,'idle');assert.equal(c.morse.signalCount,0);assert.equal(c.laser.state,'idle');assert.equal(lab.vault.command,'unlock');
  c.game.setup_checked=true;c.start(now());step();assert.equal(lab.vault.command,'lock');
});
test('camera and Skidule outages fault the active mission and require deliberate recovery',()=>{
  const a=kit();a.c.start(a.now());a.c.tick(a.now()+1.1);assert.equal(a.c.game.state,'fault');
  const b=kit();b.c.start(b.now());b.step();b.walk(false);b.send('laser',b.lab.laser('button_pressed'));b.step();b.c.startSkidule(b.now());
  const left=b.c.game.remaining;b.c.tick(b.now()+3);assert.equal(b.c.skidule.state,'fault');assert.equal(b.c.game.state,'fault');assert(b.c.game.remaining<left);
  b.step();assert.equal(b.c.game.state,'fault');b.c.resetSkidule(b.now());b.c.resumeHeist(b.now());assert.equal(b.c.game.state,'running');
});
test('three separate beam breaks trigger lockdown and never unlock the vault',()=>{
  const k=kit();k.c.start(k.now());k.step();k.walk(false);k.c.bypassModule('skidule',k.now());k.c.bypassModule('morse',k.now());k.step();
  for(let i=0;i<3;i++){k.send('laser',k.lab.laser());k.step();}
  assert.equal(k.c.game.penalties,3);assert.equal(k.c.game.state,'lost');assert.equal(k.lab.vault.command,'lock');
});
test('vault protocol model requires two beats, rejects replay/conflict and keeps an opened round open',()=>{
  const l=new DeviceLab(),b={toktik_session:'owner',toktik_round_id:'r1',toktik_beat:1,heist_state:'armed',heist_phase:'navigation'};
  l.heartbeat(b,0);assert.equal(l.vault.command,'none');l.heartbeat(b,.1);assert.equal(l.vault.confirmations,1);
  l.heartbeat({...b,toktik_beat:2},.2);assert.equal(l.vault.command,'lock');
  l.heartbeat({...b,toktik_session:'other',toktik_beat:1},.3);
  const unlock={...b,heist_state:'running',heist_phase:'escape',heist_navigation_complete:true,laser_solved:true,skidule_solved:true,morse_solved:true};
  l.heartbeat({...unlock,toktik_beat:3},.4);assert.equal(l.vault.command,'lock');
  l.heartbeat({...unlock,toktik_beat:4},3.4);l.heartbeat({...unlock,toktik_beat:5},3.5);assert.equal(l.vault.command,'unlock');
  l.heartbeat({...b,toktik_beat:6},3.6);assert.equal(l.vault.command,'unlock');
  l.heartbeat({...b,toktik_round_id:'r2',toktik_beat:7},3.7);assert.equal(l.vault.command,'lock');
});
