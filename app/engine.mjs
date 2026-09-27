import {rectangularField} from './spatial.mjs';
// Team 2 game authority. Pure JavaScript for Node or browser modules.
export const DEFAULTS={round_s:180,penalty_s:5,max_anomalies:3,layout_mode:'random',overlap_s:.6,cooldown_s:1,fault_s:1,sample_fresh_s:.45,patrol_period_s:16,...rectangularField(),mirror_x:false,grid_rows:3,zone_width:600,zone_y:[2400,3400],patrol_x:1200,boundary_margin_mm:0,zone_margin_mm:100};
// Carve a connected, monotonic route in a 3-column grid. Each passage is
// derived from the configured field before boundary tolerance; no diagonal-only connections.
export function makeLayout(random=Math.random,play=DEFAULTS.play,rows=3) {
  const [l,r,n,f]=play,w=(r-l)/3,h=(f-n)/rows;
  const turns=[Math.floor(random()*rows),Math.floor(random()*rows)].sort((a,b)=>a-b);
  const safe=new Set();let col=0;
  for(let row=0;row<rows;row++){safe.add(`${col},${row}`);while(col<2&&turns[col]===row){col++;safe.add(`${col},${row}`);}}
  const zones=[],route=[];
  for(let row=0;row<rows;row++)for(let c=0;c<3;c++){
    const b=[l+c*w,l+(c+1)*w,n+row*h,n+(row+1)*h];
    (safe.has(`${c},${row}`)?route:zones).push(b);
  }
  return {zones,route,key:turns.join('-')};
}
export const inside=(x,y,[left,right,near,far],margin=0)=>x>=left+margin&&x<=right-margin&&y>=near+margin&&y<=far-margin;
export class Game {
  constructor(now,config={}) {
    Object.assign(this,{cfg:{...DEFAULTS,...config},state:'idle',suspicion:0,penalties:0,events:[],last_tick:now,started:null,last_sample:null,boot:null,seq:-1,point:null,targets:[],bad_since:null,overlap_since:null,out_since:null,armed:true,setup_checked:false,round_id:null,reason:'',tripwire_seen:[],last_beat:0});
    this.elapsed_s=0;this.remaining=this.cfg.round_s;this.layout=null;this.guidance='stop';this.guidance_until=0;
  }
  event(name,now,data={}) {this.events.push({event:name,at:Math.round(now*1000)/1000,round_id:this.round_id,...data});this.events=this.events.slice(-1000);}
  ingest(data,now) {
    this.tick(now);
    const seq=data.radar_seq,boot=String(data.radar_boot??'legacy');
    if(!Number.isSafeInteger(seq)||seq<0||(boot===this.boot&&seq<=this.seq))return false;
    if(this.boot!==null&&boot!==this.boot&&this.state==='running')this.finish('fault','Radar restarted during the round',now);
    this.boot=boot;this.seq=seq;this.last_sample=now;this.targets=data.targets??[];
    const x=data.radar_x_mm*(this.cfg.mirror_x?-1:1),y=data.radar_y_mm;
    const valid=data.radar_valid===true&&Number.isFinite(data.radar_x_mm)&&Number.isFinite(x)&&Number.isFinite(y)&&inside(x,y,this.cfg.play);
    this.point=valid?{x,y}:null;
    if(!valid){this.bad_since??=now;this.overlap_since=null;this.out_since=null;}else this.bad_since=null;
    return true;
  }
  fresh(now){return this.point!==null&&this.last_sample!==null&&now-this.last_sample<=this.cfg.sample_fresh_s;}
  zone(now){const elapsed=this.started===null?0:Math.max(0,now-this.started),c=this.cfg.patrol_x*Math.sin(2*Math.PI*elapsed/this.cfg.patrol_period_s);return[c-this.cfg.zone_width/2,c+this.cfg.zone_width/2,...this.cfg.zone_y];}
  zones(now){return this.cfg.layout_mode==='patrol'?[this.zone(now)]:(this.layout?.zones??[]);}
  guide(direction,now){
    this.tick(now);
    if(this.state!=='running')throw Error('Guidance is available during a running round.');
    if(!['left','right','forward','back','stop'].includes(direction))throw Error('Unknown direction');
    this.guidance=direction;this.guidance_until=now+1;
  }
  signal(now){return this.state==='running'&&this.fresh(now)&&now<this.guidance_until?this.guidance:'stop';}
  field(width,depth,near,mirror=false){
    if(this.state!=='idle')throw Error('Reset before changing the field.');
    Object.assign(this.cfg,rectangularField(width,depth,near),{mirror_x:mirror===true});
    this.setup_checked=false;this.point=null;this.layout=null;
  }
  rules(limit,penalty){
    if(this.state!=='idle')throw Error('Rules can only change before a round.');
    if(!Number.isInteger(limit)||limit<1||limit>10||!Number.isFinite(penalty)||penalty<1||penalty>60)throw Error('Use 1–10 anomalies and a 1–60 second penalty.');
    this.cfg.max_anomalies=limit;this.cfg.penalty_s=penalty;
  }
  start(now){
    if(this.state!=='idle')throw Error('Only the facilitator can reset a finished or faulted attempt.');
    if(!this.setup_checked)throw Error('Facilitator must check the floor layout and enable the round first.');
    if(!this.fresh(now)||!inside(this.point.x,this.point.y,this.cfg.start))throw Error('Exactly one tracked infiltrator must stand in the marked start region.');
    if(this.cfg.layout_mode==='random'){let next=makeLayout(Math.random,this.cfg.play,this.cfg.grid_rows);for(let i=0;i<20&&next.key===this.previous_layout;i++)next=makeLayout(Math.random,this.cfg.play,this.cfg.grid_rows);this.layout=next;this.previous_layout=next.key;}
    this.state='running';this.started=now;this.last_tick=now;this.round_id=globalThis.crypto.randomUUID().replaceAll('-','').slice(0,10);this.event('start',now,{layout:this.layout?.key});
  }
  finish(state,reason,now){this.state=state;this.reason=reason;this.event(state,now,{reason,remaining_s:Math.round(this.remaining*1000)/1000,penalties:this.penalties});}
  reset(now){
    if(this.state==='running')throw Error('Abort the active attempt before resetting.');
    this.event('reset',now);Object.assign(this,{state:'idle',remaining:this.cfg.round_s,elapsed_s:0,suspicion:0,started:null,round_id:null,reason:'',penalties:0,armed:true,overlap_since:null,out_since:null,setup_checked:false,last_tick:now,tripwire_seen:[],layout:null,guidance:'stop',guidance_until:0});
  }
  tick(now){
    const dt=Math.max(0,now-this.last_tick);this.last_tick=now;if(this.state!=='running')return;
    this.elapsed_s+=dt;this.remaining=Math.max(0,this.remaining-dt);
    if(this.last_sample===null||now-this.last_sample>=this.cfg.fault_s||(this.bad_since!==null&&now-this.bad_since>=this.cfg.fault_s)){this.finish('fault','Tracking missing, stale or ambiguous for one second',now);return;}
    if(this.remaining<=0){this.finish('lost','Time ran out',now);return;}
    if(!this.fresh(now)){this.overlap_since=null;this.out_since=null;return;}
    const {x,y}=this.point;
    const zones=this.zones(now),margin=this.cfg.layout_mode==='patrol'?0:this.cfg.zone_margin_mm;
    if(zones.some(b=>inside(x,y,b,margin))){
      this.out_since=null;this.overlap_since??=now;this.suspicion=Math.min(1,this.suspicion+dt/this.cfg.overlap_s);
      if(this.armed&&now-this.overlap_since>=this.cfg.overlap_s){this.remaining=Math.max(0,this.remaining-this.cfg.penalty_s);this.penalties++;this.armed=false;this.event('penalty',now,{reason:'surveillance overlap',seconds:this.cfg.penalty_s});}
    }else{
      this.overlap_since=null;this.suspicion=Math.max(0,this.suspicion-dt/this.cfg.overlap_s);
      if(zones.some(b=>inside(x,y,b,-margin)))this.out_since=null;
      else{this.out_since??=now;if(now-this.out_since>=this.cfg.cooldown_s)this.armed=true;}
    }
    if(this.penalties>=this.cfg.max_anomalies)this.finish('lost','Anomaly limit reached — bank lockdown',now);
    else if(this.remaining<=0)this.finish('lost','Time ran out after a penalty',now);
    else if(inside(x,y,this.cfg.goal,this.cfg.boundary_margin_mm))this.finish('won','Vault reached',now);
  }
  tripwire(beam,eventID,now){
    const key=JSON.stringify([String(beam),String(eventID)]);
    if(this.state!=='running'||this.tripwire_seen.includes(key))return false;
    this.tripwire_seen.push(key);this.remaining=Math.max(0,this.remaining-this.cfg.penalty_s);this.penalties++;
    this.event('penalty',now,{reason:'tripwire',beam:String(beam),seconds:this.cfg.penalty_s});if(this.penalties>=this.cfg.max_anomalies)this.finish('lost','Anomaly limit reached — bank lockdown',now);else if(this.remaining===0)this.finish('lost','Time ran out after tripwire',now);return true;
  }
  snapshot(now){return{state:this.state,tick:Math.floor(this.elapsed_s),toggle:this.state==='running',remaining_s:Math.round(this.remaining*1000)/1000,suspicion:Math.round(this.suspicion*1000)/1000,penalties:this.penalties,valid:this.fresh(now),point:this.fresh(now)?this.point:null,zone:this.zone(now),zones:this.zones(now),layout_id:this.layout?.key??null,guidance:this.signal(now),config:this.cfg,reason:this.reason,round_id:this.round_id,setup_checked:this.setup_checked,sample_age_s:this.last_sample===null?null:now-this.last_sample,events:this.events.slice(-12)};}
}
