// beam_broken is an edge event: one unique event_id per physical break.
// The earlier cut/clear protocol remains supported for level-based inputs.
const id=value=>(typeof value==='string'&&value.length>0&&value.length<=96)||
  (Number.isSafeInteger(value)&&value>=0);
export function validLaser(d){
  if(d?.module!=='laser'||!['online','state','cut','clear','beam_broken','button_pressed'].includes(d.event))return false;
  if(d.device_id!==undefined&&(typeof d.device_id!=='string'||!id(d.device_id)))return false;
  if(d.event==='online')return true;
  if(typeof d.round_id!=='string'||!id(d.round_id))return false;
  if(d.event==='button_pressed')return id(d.device_id)&&id(d.event_id);
  if(!id(d.beam_id))return false;
  if(d.event==='beam_broken')return id(d.device_id)&&id(d.event_id);
  if(d.event==='state')return typeof d.broken==='boolean';
  return d.event!=='cut'||id(d.event_id);
}

export class LaserGrid {
  constructor(){this.devices=new Map();this.resetAttempt();}
  reset(){this.devices.clear();this.resetAttempt();}
  resetAttempt(roundId=null){
    this.bypassed=false;this.roundId=roundId||crypto.randomUUID();this.blocked=new Set();this.seen=new Set();
    this.state='idle';this.moduleBypassed=false;this.resultId=null;this.result=null;this.deviceId='';
  }
  beginRound(roundId){if(this.state==='solved')return;this.roundId=roundId;this.blocked.clear();this.seen.clear();}
  ingest(sender,d,game,now){
    if(typeof sender!=='string'||!sender||!validLaser(d))return false;
    const source=d.device_id??sender;
    this.devices.set(source,now);
    if(d.event==='online'||this.state==='solved'||d.round_id!==this.roundId)return false;
    // Practice remains independent; a live heist reaches the grid after Morse.
    if(game.heist_mode&&(game.state!=='running'||game.phase!=='laser'))return false;
    if(d.event==='button_pressed'){
      this.deviceId=source;return this.complete(false,game.round_id,{device_id:source,input_event_id:d.event_id});
    }
    if(game.state!=='running')return false;
    const key=JSON.stringify([source,String(d.beam_id)]);
    if(d.event==='clear'||d.event==='state'&&!d.broken){this.blocked.delete(key);return false;}
    if(d.event==='state'){this.blocked.add(key);return false;} // Baseline, not a new cut.
    const eventKey=JSON.stringify([source,String(d.beam_id),String(d.event_id)]);
    if(this.seen.has(eventKey))return false;
    this.seen.add(eventKey);
    if(d.event==='cut'&&this.blocked.has(key))return false;
    this.blocked.add(key);
    if(this.bypassed)return false;
    return game.tripwire(d.beam_id,d.event_id,now,source);
  }
  complete(bypassed=false,heistRoundId=null,input={}){
    if(this.state==='solved')return false;
    this.state='solved';this.moduleBypassed=bypassed;this.resultId=crypto.randomUUID();
    if(bypassed)this.bypassed=true;
    this.result={module:'laser',event:'solved',solved:true,puzzle_id:'laser',
      result_id:this.resultId,round_id:heistRoundId||this.roundId,puzzle_round_id:this.roundId,
      bypassed,completion_method:bypassed?'presenter_bypass':'played',...input};
    return true;
  }
  bypass(heistRoundId=null){this.complete(true,heistRoundId);}
  takeResult(){const result=this.result;this.result=null;return result;}
  manual(game,now){
    if(this.state==='solved')throw Error('Laser module complete. Reset it before recording another cut.');
    if(this.bypassed)throw Error('Laser penalties are bypassed. Enable them to record a cut.');
    if(game.state!=='running')throw Error('Start camera navigation before recording a laser penalty.');
    if(game.heist_mode&&game.phase!=='laser')throw Error('Complete Camera, Skidule and Morse before the laser stage.');
    return game.tripwire('manual',crypto.randomUUID(),now,'presenter');
  }
  snapshot(now){return {state:this.state,bypassed:this.bypassed,module_bypassed:this.moduleBypassed,
    round_id:this.roundId,result_id:this.resultId,device_id:this.deviceId,
    connected_count:[...this.devices.values()].filter(at=>now-at<6).length};}
}
