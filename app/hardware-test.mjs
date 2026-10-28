import {Skidule,validControls} from './skidule.mjs';
import {Morse,validMorse} from './morse.mjs';
import {validLaser} from './laser.mjs';
import {VaultDoor,validVault} from './vault.mjs';

export const TEST_MODULES=['camera','laser','skidule','morse','vault'];
const freshFor={camera:3,laser:25,skidule:2.5,morse:25,vault:4};
function validRadar(d){return typeof d?.radar_boot==='string'&&d.radar_boot.length>0&&Number.isSafeInteger(d.radar_seq)&&d.radar_seq>=0&&typeof d.radar_valid==='boolean'&&(!d.radar_valid||Number.isFinite(d.radar_x_mm)&&Number.isFinite(d.radar_y_mm));}
function moduleOf(d){return d?.module==='vault_door'?'vault':d?.module==='skidule_controls'?'skidule':['morse_button','suitcase'].includes(d?.module)?'morse':d?.module==='laser'?'laser':d?.radar_seq!==undefined?'camera':null;}

// A local input bench, with no controller, shared clock or outgoing result API.
// Reading a live controller's heartbeat never claims its session or faults this bench.
export class HardwareTest {
  constructor(){this.active='skidule';this.clear();}
  clear(){
    this.devices=Object.fromEntries(TEST_MODULES.map(m=>[m,new Map()]));this.sources=Object.fromEntries(TEST_MODULES.map(m=>[m,'']));
    this.skidule=new Skidule();this.morse=new Morse();this.camera=null;
    this.vault=new VaultDoor();
    this.laser={cuts:0,finishes:0,beam:null,event:'Waiting for a beam or finish button',round:null};
    this.laserSeen=new Set();this.laserBlocked=new Set();
    this.laserAlignment=false;this.laserBeams=new Map();
    this.counts=Object.fromEntries(TEST_MODULES.map(m=>[m,0]));this.arrivals=Object.fromEntries(TEST_MODULES.map(m=>[m,[]]));this.last=Object.fromEntries(TEST_MODULES.map(m=>[m,null]));
    this.rejected=Object.fromEntries(TEST_MODULES.map(m=>[m,0]));
    // Reconnecting starts discovery afresh, including when the team channel changes.
  }
  selectModule(name){if(!TEST_MODULES.includes(name))throw Error('Choose a hardware module.');this.active=name;}
  selectSource(module,source){
    if(!TEST_MODULES.includes(module)||!this.devices[module].has(source))throw Error('Choose a discovered device.');
    if(module==='vault')this.vault.select(source);
    if(this.sources[module]===source)return;
    if(module==='skidule'){this.skidule.reset();this.skidule.selectSource(source);}
    if(module==='morse'){this.morse.clearSignal();this.morse.selectSource(source,this.devices.morse.get(source).at);}
    this.sources[module]=source;this.last[module]=null;this.counts[module]=0;this.arrivals[module]=[];this.rejected[module]=0;
    if(module==='camera')this.camera=null;
    if(module==='laser'){this.laser={cuts:0,finishes:0,beam:null,event:'Waiting for a beam or finish button',round:null};this.laserSeen.clear();this.laserBlocked.clear();this.laserBeams.clear();this.laserAlignment=false;}
    const previous=this.devices[module].get(source);this.ingest({sender:source,data:previous.data},previous.at);
  }
  ingest({sender,data:d}={},now){
    if(typeof sender!=='string'||!sender||sender.length>160||!d||typeof d!=='object')return false;
    const module=moduleOf(d);if(!module)return false;
    const valid=module==='vault'?validVault(d):module==='skidule'?validControls(d):module==='morse'?validMorse(d):module==='laser'?validLaser(d):validRadar(d);
    if(!valid){this.rejected[module]++;return false;}
    const devices=this.devices[module];
    if(!devices.has(sender)&&devices.size>=32)return false;
    devices.set(sender,{data:d,at:now});
    if(module==='vault'){if(!this.vault.ingest(sender,d,now))return false;this.sources.vault=this.vault.source;}
    if(module!=='vault'&&!this.sources[module]){
      this.sources[module]=sender;
      if(module==='skidule')this.skidule.selectSource(sender);
      if(module==='morse')this.morse.selectSource(sender,now);
    }
    if(sender!==this.sources[module])return false;
    if(module==='skidule'&&!this.skidule.ingest(sender,d,now))return false;
    if(module==='morse')this.morse.ingest(sender,d,now);
    if(module==='camera'){
      if(this.camera?.radar_boot===d.radar_boot&&d.radar_seq<=this.camera.radar_seq)return false;
      this.camera={...d};
    }
    if(module==='laser')this.ingestLaser(sender,d,now);
    this.counts[module]++;this.last[module]={data:{...d},at:now};
    this.arrivals[module].push(now);this.arrivals[module]=this.arrivals[module].filter(t=>now-t<2).slice(-2000);
    return true;
  }
  setLaserAlignment(enabled){if(typeof enabled!=='boolean')throw Error('Choose whether alignment mode is enabled.');this.laserAlignment=enabled;}
  ingestLaser(sender,d,now){
    if(d.event==='online')return;
    const source=d.device_id??sender,beam=JSON.stringify([source,d.round_id,String(d.beam_id)]);
    this.laser.event=d.event;this.laser.round=d.round_id;this.laser.beam=d.beam_id??null;
    if(d.event!=='button_pressed')this.laserBeams.set(String(d.beam_id),{beam_id:d.beam_id,broken:d.event==='state'?d.broken:!['clear'].includes(d.event),raw:Number.isFinite(d.input_raw)?d.input_raw:null,at:now});
    if(d.event==='clear'||d.event==='state'&&!d.broken){this.laserBlocked.delete(beam);return;}
    if(d.event==='state'){this.laserBlocked.add(beam);return;}
    const key=JSON.stringify([source,d.round_id,d.event,String(d.beam_id),String(d.event_id)]);
    if(this.laserSeen.has(key))return;
    this.laserSeen.add(key);if(this.laserSeen.size>1000)this.laserSeen.delete(this.laserSeen.values().next().value);
    if(d.event==='button_pressed'){if(!this.laserAlignment)this.laser.finishes++;return;}
    if(d.event==='cut'&&this.laserBlocked.has(beam))return;
    this.laserBlocked.add(beam);if(this.laserBlocked.size>128)this.laserBlocked.delete(this.laserBlocked.values().next().value);
    if(!this.laserAlignment)this.laser.cuts++;
  }
  tick(now){this.skidule.tick(now);this.morse.tick(now);}
  reset(module=this.active){
    if(module==='skidule')this.skidule.reset();
    else if(module==='morse')this.morse.reset();
    else if(module==='laser'){this.laser={cuts:0,finishes:0,beam:null,event:'Counters cleared. Waiting for the next event.',round:null};this.laserAlignment=false;}
    else if(module==='vault')this.vault.pending=null;
    else if(module!=='camera')throw Error('Choose a hardware module.');
    this.counts[module]=0;this.arrivals[module]=[];this.rejected[module]=0;
    // Keep edge IDs and baselines across a counter reset: retries are not new inputs.
  }
  snapshot(now){
    this.tick(now);const m=this.active,last=this.last[m],age=last?Math.max(0,now-last.at):null;
    const beams=[...this.laserBeams.values()].map(b=>({...b,fresh:now-b.at<6}));
    const alignmentStatus=!beams.length?'waiting':beams.some(b=>!b.fresh)?'stale':beams.some(b=>b.broken)?'missing':'detected';
    return {module:m,source:this.sources[m],devices:[...this.devices[m]].map(([name,d])=>({name,fresh:now-d.at<freshFor[m]})),
      fresh:age!==null&&age<freshFor[m],age,packets:this.counts[m],rate:this.arrivals[m].filter(t=>now-t<1).length,rejected:this.rejected[m],last:last?.data??null,
      camera:this.camera,skidule:this.skidule.snapshot(now),morse:this.morse.snapshot(now),laser:{...this.laser,alignment:this.laserAlignment,alignment_status:alignmentStatus,beams},vault:this.vault.snapshot(now)};
  }
}
