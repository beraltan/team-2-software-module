const commands=['lock','unlock','auto'];
export function validVault(d){return d?.module==='vault_door'&&d.event==='state'&&typeof d.device_id==='string'&&d.device_id.length>0&&d.device_id.length<=64&&typeof d.boot_id==='string'&&d.boot_id.length>0&&d.boot_id.length<=64&&Number.isSafeInteger(d.seq)&&d.seq>0&&['auto','manual'].includes(d.mode)&&['none','lock','unlock'].includes(d.commanded)&&['disabled','moving','at_target','error'].includes(d.motion)&&Array.isArray(d.angles)&&d.angles.length===2&&d.angles.every(n=>Number.isInteger(n)&&n>=0&&n<=180)&&Array.isArray(d.target_angles)&&d.target_angles.length===2&&d.target_angles.every(n=>Number.isInteger(n)&&n>=0&&n<=180)&&d.servo_confirmed===false;}
export class VaultDoor {
  constructor(){this.reset();}
  reset(){this.devices=new Map();this.source='';this.manualSource=false;this.pending=null;this.demoCommand='auto';}
  ingest(sender,data,now){
    if(typeof sender!=='string'||!sender||!validVault(data))return false;
    const previous=this.devices.get(sender);if(previous?.data.boot_id===data.boot_id&&data.seq<=previous.data.seq)return false;
    if(!previous&&this.devices.size>=32)return false;
    this.devices.set(sender,{data:{...data,angles:[...data.angles],target_angles:[...data.target_angles]},at:now});
    if(this.pending&&sender===this.source&&data.request_id===this.pending.id)this.pending.result=data.request_result;
    if(!this.manualSource){const fresh=[...this.devices].filter(([,v])=>now-v.at<4);this.source=fresh.length===1?fresh[0][0]:'';}
    return true;
  }
  select(source){if(!this.devices.has(source))throw Error('Choose a discovered vault ESP.');this.source=source;this.manualSource=true;this.pending=null;}
  request(command,now,{scope,session}){
    if(!commands.includes(command)||!['test','presenter'].includes(scope)||typeof session!=='string'||!session)throw Error('Invalid vault command.');
    const s=this.snapshot(now);if(!s.fresh)throw Error('Connect and select a fresh vault ESP before moving the servos.');
    const request_id=crypto.randomUUID();this.pending={id:request_id,command,at:now};
    return {module:'vault_control',event:'command',command,scope,requester_session:session,request_id,device_id:s.data.device_id,boot_id:s.data.boot_id,status_seq:s.data.seq};
  }
  snapshot(now){
    const selected=this.devices.get(this.source),data=selected?.data??null;
    let request='';
    if(this.pending){const result=this.pending.result;request=result?(result==='accepted'?'Command accepted by ESP; verify the latch.':result==='active_heist'?'Live heist active. Use the crew presenter controls.':'ESP rejected this command.'):(now-this.pending.at>6?'No acknowledgement. Check the ESP connection.':'Waiting for ESP acknowledgement…');}
    return {source:this.source,data,fresh:!!selected&&now-selected.at<4,age:selected?Math.max(0,now-selected.at):null,devices:[...this.devices].map(([name,d])=>({name,fresh:now-d.at<4})),request};
  }
  demoSnapshot(game){
    const unlock=game.phase==='escape'&&['running','won'].includes(game.state),active=['armed','running'].includes(game.state);
    const command=this.demoCommand==='auto'?(unlock?'unlock':active?'lock':'none'):this.demoCommand;
    const angle=command==='unlock'?0:90;
    return {source:'Simulated vault',fresh:true,age:0,devices:[],request:'',data:{mode:this.demoCommand==='auto'?'auto':'manual',commanded:command,motion:command==='none'?'disabled':'at_target',angles:[angle,angle],target_angles:[angle,angle],servo_confirmed:false,controller_link:'simulated'}};
  }
}
