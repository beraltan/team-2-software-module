import {Game} from './engine.mjs';
// The controller is independent of DOM, clocks and network implementation.
export class Controller {
  constructor(now=0, session=crypto.randomUUID()) {
    this.session=session;this.game=new Game(now);this.mode='demo';this.camera='';
    this.connected=false;this.conflict=false;this.quietUntil=0;this.beat=0;
    this.supported=true;this.led='simulated';this.cameras=new Map();
  }
  fault(reason,now){if(this.game.state==='running')this.game.finish('fault',reason,now);this.game.guidance='stop';this.game.guidance_until=0;}
  live(now){this.fault('Connection changed',now);const priorFault=this.game.state==='fault'?this.game.reason:null;this.mode='live';this.connected=false;this.conflict=false;this.camera='';this.cameras.clear();this.game.reset(now);if(priorFault)this.game.finish('fault',priorFault,now);this.game.point=null;this.game.last_sample=null;this.supported=false;this.led='Not reported over OOCSI';}
  receive(e,now) {
    const d=e.data;
    if(d.toktik_session&&d.toktik_session!==this.session){
      this.conflict=true;this.quietUntil=now+3;this.fault('Another controller is on this channel. Close it before resetting.',now);return;
    }
    if(typeof e.sender!=='string'||!Number.isSafeInteger(d.radar_seq)||typeof d.radar_boot!=='string')return;
    this.cameras.set(e.sender,{at:now,boot:d.radar_boot});
    if(e.sender!==this.camera)return;
    this.game.ingest(d,now);this.supported=d.guidance_supported===true;
  }
  selectCamera(name,now){if(this.game.state==='running')throw Error('Abort before changing cameras.');this.camera=name;this.game.point=null;this.game.last_sample=null;this.game.boot=null;this.game.seq=-1;this.game.setup_checked=false;}
  start(now){if(this.mode==='live'&&(!this.connected||this.conflict||now<this.quietUntil||!this.camera))throw Error('Connect, select a camera and resolve any controller conflict first.');this.game.start(now);}
  reset(now){if(this.mode==='live'&&now<this.quietUntil)throw Error('Another controller is still broadcasting. Close it and wait three seconds.');this.game.reset(now);this.conflict=false;}
  heartbeat(now){
    if(this.mode!=='live'||!this.connected||this.conflict||now<this.quietUntil)return null;
    const s=this.game.snapshot(now);
    return {toktik_session:this.session,toktik_beat:++this.beat,toktik_state:s.state,toktik_time_s:s.remaining_s,
      toktik_suspicion:s.suspicion,toktik_penalties:s.penalties,toktik_ready:s.setup_checked,
      toktik_guide:this.game.signal(now),toktik_play:s.config.play,toktik_start:s.config.start,toktik_goal:s.config.goal,
      toktik_mirror_x:s.config.mirror_x,toktik_zones:s.zones,toktik_max_anomalies:s.config.max_anomalies,
      toktik_tick:s.tick,toktik_toggle:s.toggle,toktik_round_id:s.round_id,toktik_camera:this.camera};
  }
}
