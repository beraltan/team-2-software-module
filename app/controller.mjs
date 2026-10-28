import {Game} from './engine.mjs';
import {Skidule,validControls} from './skidule.mjs';
import {Morse,validMorse} from './morse.mjs';
import {LaserGrid,validLaser} from './laser.mjs';
import {VaultDoor,validVault} from './vault.mjs';
// The controller is independent of DOM, clocks and network implementation.
export class Controller {
  constructor(now=0, session=crypto.randomUUID()) {
    this.session=session;this.game=new Game(now);this.mode='demo';this.camera='';
    this.connected=false;this.conflict=false;this.quietUntil=0;this.beat=0;
    this.supported=true;this.led='simulated';this.cameras=new Map();
    this.activeModule='camera';this.skidule=new Skidule();this.controls=new Map();
    this.morse=new Morse();this.morseSources=new Map();
    this.laser=new LaserGrid();
    this.vault=new VaultDoor();
  }
  enableHeist(){this.game.enableHeist();}
  busy(){return ['armed','running'].includes(this.game.state)||this.skidule.state==='running'||this.morse.state==='receiving';}
  fault(reason,now){if(['armed','running'].includes(this.game.state))this.game.finish('fault',reason,now);this.skidule.fault(reason);this.morse.fault(reason);this.game.guidance='stop';this.game.guidance_until=0;}
  advance(now){
    if(!this.game.heist_mode)return;
    if(this.game.state==='armed'&&this.game.navigation_complete){this.game.state='running';this.game.started=now;this.game.last_tick=now;this.game.event('start',now,{camera_bypassed:true});}
    const phase=!this.game.navigation_complete?'navigation':this.skidule.state!=='solved'?'skidule':this.morse.state!=='solved'?'morse':this.laser.state!=='solved'?'laser':'escape';
    if(phase!==this.game.phase){this.game.phase=phase;this.game.phase_since=now;this.game.armed=true;this.game.maze_contact=false;this.game.overlap_since=null;this.game.out_since=null;this.game.guidance='stop';this.game.guidance_until=0;this.game.event('phase',now,{phase});}
  }
  tick(now){this.advance(now);this.game.tick(now);this.skidule.tick(now);this.morse.tick(now);this.advance(now);if(this.game.heist_mode&&this.game.state==='running'&&((this.game.phase==='skidule'&&this.skidule.state==='fault')||(this.game.phase==='morse'&&this.morse.state==='fault')))this.game.finish('fault','The active puzzle lost its connection. Reset the heist or use presenter controls.',now);}
  confirmEscape(now){this.tick(now);if(!this.game.heist_mode||this.game.state!=='running'||this.game.phase!=='escape')throw Error('Complete all four modules before confirming the safe-zone return.');this.game.escape_bypassed=true;this.game.finish('won','Safe-zone return confirmed by presenter',now);}
  resumeHeist(now){
    if(!this.game.heist_mode||this.game.state!=='fault')throw Error('Only an interrupted heist can be resumed after inspection.');
    if(this.mode==='live'&&(!this.connected||this.conflict||now<this.quietUntil))throw Error('Restore the crew connection and resolve controller conflicts first.');
    this.advance(now);
    if(this.game.needsTracking()&&!this.game.fresh(now))throw Error('Restore radar tracking or bypass the entry module first.');
    if(this.game.phase==='skidule'&&this.skidule.state==='fault'||this.game.phase==='morse'&&this.morse.state==='fault')throw Error('Reset or bypass the interrupted puzzle first.');
    this.game.state=this.game.started===null&&this.game.phase==='navigation'?'armed':'running';this.game.last_tick=now;this.game.reason='';this.game.event('resume',now,{presenter:true});
  }
  live(now){
    this.fault('Connection changed',now);
    const priorFault=this.game.state==='fault'?this.game.reason:null;
    const priorLockFault=this.skidule.state==='fault'?this.skidule.notice:null;
    const priorMorseFault=this.morse.state==='fault'?this.morse.notice:null;
    this.mode='live';this.connected=false;this.conflict=false;this.camera='';this.cameras.clear();
    this.game.reset(now);if(priorFault)this.game.finish('fault',priorFault,now);
    this.game.point=null;this.game.last_sample=null;this.supported=false;this.led='Not reported over OOCSI';
    this.skidule=new Skidule();if(priorLockFault){this.skidule.state='fault';this.skidule.notice=priorLockFault;}this.controls.clear();
    this.morse=new Morse();if(priorMorseFault){this.morse.state='fault';this.morse.notice=priorMorseFault;}this.morseSources.clear();
    this.laser.reset();
    this.vault.reset();
  }
  selectModule(name){if(!['camera','skidule','morse','laser'].includes(name))throw Error('Unknown module');this.activeModule=name;this.game.guidance='stop';this.game.guidance_until=0;}
  selectControls(name,now){this.skidule.selectSource(name);const device=this.controls.get(name);if(device)this.skidule.ingest(name,device.data,device.at);}
  startSkidule(now){if(this.mode==='live'&&(!this.connected||this.conflict||now<this.quietUntil))throw Error('Connect and resolve any controller conflict first.');this.skidule.start(now,this.game.round_id);}
  resetSkidule(now){if(this.mode==='live'&&now<this.quietUntil)throw Error('Close the other controller and wait three seconds before resetting.');this.skidule.reset();this.conflict=false;}
  selectMorse(name,now){this.morse.selectSource(name,this.morseSources.get(name)?.at??null);}
  resetMorse(now){if(this.mode==='live'&&now<this.quietUntil)throw Error('Close the other controller and wait three seconds before resetting.');this.morse.reset();this.conflict=false;}
  clearConflict(now){if(this.mode!=='live'||!this.connected)throw Error('Connect to live hardware first.');if(now<this.quietUntil)throw Error('The other screen is still connected. Close it, then try again.');this.conflict=false;}
  recordLaserCut(now){if(this.mode==='live'&&(!this.connected||this.conflict||now<this.quietUntil))throw Error('Reconnect and resolve the other controller before recording penalties.');if(!this.laser.manual(this.game,now))throw Error('This navigation attempt is no longer running.');}
  bypassLasers(value){if(typeof value!=='boolean')throw Error('Invalid laser bypass');this.laser.bypassed=value;}
  resetLaser(now){if(this.mode==='live'&&now<this.quietUntil)throw Error('Close the other controller and wait three seconds before resetting.');this.laser.resetAttempt();}
  bypassModule(name,now){
    if(name==='camera')this.game.bypass(now);
    else if(name==='skidule')this.skidule.bypass(this.game.round_id);
    else if(name==='morse')this.morse.bypass(this.game.round_id);
    else if(name==='laser')this.laser.bypass(this.game.round_id);
    else throw Error('Unknown module');
    this.game.guidance='stop';this.game.guidance_until=0;
  }
  cameraDevices(now){return [...this.cameras].filter(([,v])=>now-v.at<3).map(([name])=>name);}
  controlDevices(now){return [...this.controls].filter(([,v])=>now-v.at<2.5).map(([name])=>name);}
  morseDevices(now){return [...this.morseSources].filter(([,v])=>now-v.at<25).map(([name])=>name);}
  autoSelectMorse(now){
    if(this.mode!=='live'||this.conflict||this.morse.source||this.morse.state!=='idle')return;
    const devices=this.morseDevices(now);if(devices.length===1)this.selectMorse(devices[0],now);
  }
  autoSelectDevices(now){
    // Discover on the subscribed team channel. Never replace a chosen or failed device.
    if(this.mode!=='live'||!this.connected||this.conflict)return;
    // Listen immediately: waiting for discovery must not hide the first short flash.
    this.autoSelectMorse(now);
    if(now<this.quietUntil)return;
    const cameras=this.cameraDevices(now),controls=this.controlDevices(now);
    if(!this.camera&&this.game.state==='idle'&&cameras.length===1)this.selectCamera(cameras[0],now);
    if(!this.skidule.source&&this.skidule.state==='idle'&&controls.length===1)this.selectControls(controls[0],now);
  }
  receive(e,now) {
    const d=e.data;
    if(!d||typeof d!=='object')return;
    if(validVault(d)){this.vault.ingest(e.sender,d,now);return;}
    if(d.toktik_session&&d.toktik_session!==this.session){
      this.conflict=true;this.quietUntil=now+3;this.fault('Another controller is on this channel. Close it before resetting.',now);return;
    }
    if(validLaser(d)){
      if(this.mode==='live'&&this.connected&&!this.conflict&&now>=this.quietUntil)this.laser.ingest(e.sender,d,this.game,now);
      return;
    }
    if(typeof e.sender==='string'&&validMorse(d)){
      this.morseSources.set(e.sender,{at:now});
      // A packet can precede the course adapter's 100 ms connection-status poll.
      this.autoSelectMorse(now);
      this.morse.ingest(e.sender,d,now);return;
    }
    if(typeof e.sender==='string'&&validControls(d)){
      this.controls.set(e.sender,{at:now,data:d});
      this.autoSelectDevices(now);
      this.skidule.ingest(e.sender,d,now);return;
    }
    if(typeof e.sender!=='string'||!Number.isSafeInteger(d.radar_seq)||d.radar_seq<0||typeof d.radar_boot!=='string')return;
    this.cameras.set(e.sender,{at:now,boot:d.radar_boot,data:d});
    this.autoSelectDevices(now);
    if(e.sender!==this.camera)return;
    this.game.ingest(d,now);this.supported=d.guidance_supported===true;
  }
  selectCamera(name,now){if(['armed','running'].includes(this.game.state))throw Error('Abort before changing cameras.');this.camera=name;this.game.point=null;this.game.last_sample=null;this.game.boot=null;this.game.seq=-1;this.game.setup_checked=false;const device=this.cameras.get(name);if(device){this.game.ingest(device.data,device.at);this.supported=device.data.guidance_supported===true;}}
  start(now){
    if(this.mode==='live'&&(!this.connected||this.conflict||now<this.quietUntil||!this.camera&&!(this.game.heist_mode&&this.game.bypassed)))throw Error('Connect, select a camera and resolve any controller conflict first.');
    this.game.start(now);
    if(this.game.heist_mode){if(!this.skidule.bypassed)this.skidule.reset();if(!this.morse.bypassed)this.morse.reset();if(!this.laser.moduleBypassed)this.laser.resetAttempt();}
    this.laser.beginRound(this.game.round_id);this.advance(now);
  }
  reset(now){if(this.mode==='live'&&now<this.quietUntil)throw Error('Another controller is still broadcasting. Close it and wait three seconds.');this.game.reset(now);this.conflict=false;if(this.game.heist_mode){this.skidule.reset();this.morse.reset();this.laser.resetAttempt();}else if(this.laser.state!=='solved')this.laser.resetAttempt();}
  heartbeat(now){
    if(this.mode!=='live'||!this.connected||this.conflict||now<this.quietUntil)return null;
    this.advance(now);const s=this.game.snapshot(now);
    return {toktik_session:this.session,toktik_beat:++this.beat,toktik_state:s.state==='armed'?'idle':s.state,toktik_time_s:s.remaining_s,
      heist_state:s.state,heist_phase:s.phase,heist_navigation_complete:s.navigation_complete,heist_escape_bypassed:s.escape_bypassed,
      toktik_suspicion:s.suspicion,toktik_penalties:s.penalties,toktik_ready:s.setup_checked,
      toktik_guide:this.game.signal(now),toktik_play:s.config.play,toktik_start:s.config.start,toktik_goal:s.config.goal,
      toktik_mirror_x:s.config.mirror_x,toktik_zones:s.zones,toktik_max_anomalies:s.config.max_anomalies,
      toktik_tick:s.tick,toktik_toggle:s.toggle,toktik_round_id:s.round_id,toktik_camera:this.camera,toktik_bypassed:s.bypassed,
      skidule_state:this.skidule.state,skidule_round_id:this.skidule.roundId,
      skidule_feedback:this.skidule.feedback(),skidule_selected_bar:this.skidule.selected,
      skidule_locked_count:this.skidule.locked.filter(Boolean).length,skidule_bar_count:this.skidule.locked.length,skidule_solved:this.skidule.state==='solved',skidule_result_id:this.skidule.resultId,skidule_bypassed:this.skidule.bypassed,
      morse_state:this.morse.state,morse_lamp:this.morse.lamp,morse_solved:this.morse.state==='solved',
      morse_bypassed:this.morse.bypassed,morse_round_id:this.morse.roundId,morse_result_id:this.morse.resultId,
      laser_cuts:s.laser_cuts,laser_bypassed:this.laser.bypassed,laser_state:this.laser.state,
      laser_solved:this.laser.state==='solved',laser_round_id:this.laser.roundId,
      laser_result_id:this.laser.resultId,laser_completion_bypassed:this.laser.moduleBypassed};
  }
}
