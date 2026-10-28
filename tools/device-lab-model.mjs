// Protocol emulator for local integration tests. Never connects to real hardware.
import {crossesWall} from '../app/maze.mjs';
export class DeviceLab {
  constructor({legacy=true}={}) {
    this.legacy=legacy;this.now=0;this.beat=null;this.position={x:-1125,y:1833};
    this.radarSeq=0;this.controlSeq=0;this.bar=0;this.slider=0;this.presses=0;
    this.controlBoot='lab-c6-boot';this.laserSeq=0;this.lastLaser=null;
    this.vault={owner:'',lastAt:-Infinity,lastSeq:0,confirmations:0,conflictAt:-Infinity,
      round:'',openedRound:'',command:'none',mode:'auto',angle:90,target:90,seq:0};
  }
  advance(now){const dt=Math.max(0,now-this.now);this.now=now;const v=this.vault;
    if(v.command!=='none')v.angle+=Math.sign(v.target-v.angle)*Math.min(Math.abs(v.target-v.angle),dt*20);
  }
  heartbeat(b,now){
    this.advance(now);if(!b?.toktik_session||!Number.isSafeInteger(b.toktik_beat)||b.toktik_beat<1)return;
    const v=this.vault,fresh=now-v.lastAt<3;
    if(v.owner&&v.owner!==b.toktik_session&&fresh){v.conflictAt=now;return;}
    if(v.owner!==b.toktik_session){v.owner=b.toktik_session;v.lastSeq=0;v.confirmations=0;}
    if(b.toktik_beat<=v.lastSeq)return;
    if(!fresh)v.confirmations=0;
    v.lastAt=now;v.lastSeq=b.toktik_beat;v.confirmations=Math.min(2,v.confirmations+1);
    v.round=b.toktik_round_id;this.beat=b;
    let command='none';
    if(['running','won'].includes(b.heist_state)&&b.heist_phase==='escape'&&b.heist_navigation_complete&&b.laser_solved&&b.skidule_solved&&b.morse_solved)command='unlock';
    else if(b.heist_state==='armed'||b.heist_state==='running'&&b.heist_phase!=='escape')command='lock';
    if(command==='lock'&&v.openedRound===v.round)command='none';
    if(v.confirmations>=2&&now-v.conflictAt>=3&&v.mode==='auto'&&command!=='none'){
      v.command=command;v.target=command==='unlock'?0:90;if(command==='unlock')v.openedRound=v.round;
    }
  }
  radar(){return {radar_boot:'lab-camera-boot',radar_seq:++this.radarSeq,radar_valid:true,
    radar_x_mm:Math.round(this.position.x),radar_y_mm:Math.round(this.position.y),guidance_supported:true};}
  controls(event='state') {const knob=(this.bar+.5)/4;
    return {module:'skidule_controls',event,boot_id:this.controlBoot,seq:++this.controlSeq,
      ...(this.legacy?{bar_index:Math.min(9,Math.floor(knob*10)),knob,bar_height:this.slider/100,slider:this.slider/100}:{bar_index:this.bar,bar_count:4,slider:this.slider}),button_press_count:this.presses};
  }
  press(){this.presses++;return this.controls('pressed');}
  laser(event='beam_broken',{duplicate=false,round}={}) {
    if(duplicate)return this.lastLaser;
    const v=this.vault,b=this.beat,fresh=this.now-v.lastAt<3;
    if(fresh&&(v.confirmations<2||this.now-v.conflictAt<3||['fault','lost','won'].includes(b.heist_state)||b.laser_solved))return null;
    const packet={module:'laser',device_id:'team2-laser-lab',event,
      ...(event==='button_pressed'?{}:{beam_id:1}),event_id:'lab-laser-boot-'+(++this.laserSeq),
      round_id:round??(fresh?b.laser_round_id:'test-lab-laser-boot')};
    this.lastLaser=packet;return packet;
  }
  morse(on,duration=0){return {module:'morse_button',state:on?'pressed':'released',lampo_toggle:on,duration_ms:duration};}
  vaultStatus(){const v=this.vault;return {module:'vault_door',event:'state',device_id:'team2-vault-lab',boot_id:'lab-s3-boot',seq:++v.seq,mode:v.mode,commanded:v.command,
    motion:v.command==='none'?'disabled':Math.abs(v.target-v.angle)>.01?'moving':'at_target',angles:[Math.round(v.angle),Math.round(v.angle)],target_angles:[v.target,v.target],servo_confirmed:false,
    controller_link:this.now-v.lastAt<3?'fresh':'waiting',controller_session:v.owner,round_id:v.round};}
  // Infer open room connections from the same public geometry the ESP receives.
  route(returning=false){
    const b=this.beat;if(!b?.toktik_play)throw Error('Connect and arm the heist first.');
    const [l,r,n,f]=b.toktik_play,cols=Math.round((r-l)/(b.toktik_start[1]-b.toktik_start[0]+280)),rows=Math.round((f-n)/(b.toktik_start[3]-b.toktik_start[2]+280));
    const points=Array.from({length:cols*rows},(_,i)=>({x:l+(i%cols+.5)*(r-l)/cols,y:n+(Math.floor(i/cols)+.5)*(f-n)/rows}));
    const start=returning?points.length-1:0,end=returning?0:points.length-1,parents=new Map([[start,-1]]),queue=[start];
    for(const a of queue)for(const c of [a%cols? a-1:-1,a%cols<cols-1?a+1:-1,a-cols,a+cols]){
      if(c<0||c>=points.length||parents.has(c)||(b.toktik_zones||[]).some(z=>crossesWall(points[a],points[c],z,0)))continue;
      parents.set(c,a);queue.push(c);
    }
    if(!parents.has(end))throw Error('No route in published maze geometry.');
    const path=[];for(let at=end;at!==-1;at=parents.get(at))path.push(points[at]);return path.reverse();
  }
}
