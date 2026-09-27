// Adapter for the course's unmodified OOCSI Things library.
export function teamChannel(team) {
  const slug=team.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'').replace(/^-+|-+$/g,'');
  if(!slug||slug.length>70)throw Error('Choose a team name containing letters or digits (up to 70 characters after normalization).');
  return 'OOCSI-things/'+slug;
}
export const outputs=['state','time_s','suspicion','penalties','guide','round_id','tick','toggle'];
export class ThingsConnection {
  constructor({onMessage=()=>{},onStatus=()=>{},things=globalThis.oocsiThings,oocsi=globalThis.OOCSI,
    every=(fn,ms)=>setInterval(fn,ms),leave=()=>{location.search='?demo=1';}}={}) {
    Object.assign(this,{onMessage,onStatus,things,oocsi,every,leave,connected:false,started:false,variables:{}});
  }
  connect(channel) {
    if(!this.things){location.search='';return;}
    if(this.started)return;
    this.channel=channel;this.started=true;this.onStatus('connecting');
    this.things.register('Bank Heist','toktik',['x_mm','y_mm','valid'],outputs);
    for(const key of ['x_mm','y_mm','valid']){
      this.things.data(key);this.things.link('radar',key);
    }
    for(const key of outputs)this.variables[key]=this.things.data(key);
    // Gameplay uses whole source messages, never separately linked coordinates.
    this.things.subscribe(e=>this.onMessage(e));
    this.every(()=>{
      const connected=this.oocsi.isConnected();
      if(connected!==this.connected){this.connected=connected;this.onStatus(connected?'connected':'disconnected');}
    },100);
  }
  send(data){
    if(!this.connected||!this.oocsi.isConnected())return;
    // Atomic 5 Hz heartbeat keeps sequence, state and guidance coherent for firmware.
    this.oocsi.send(this.channel,data);
    // Course variables expose the same fields to other Things and their link() API.
    for(const key of outputs)this.variables[key](data['toktik_'+key]);
  }
  close(){
    if(!this.started)return;
    // The stock client reconnects automatically. Unload it to truly disconnect.
    this.connected=false;this.leave();
  }
}
