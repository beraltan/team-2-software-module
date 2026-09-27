// OOCSI WebSocket framing matches the vendored oocsi-web.js client.
// Deliberately no offline send queue: expired guidance must never be replayed.
export function validChannel(value) {
  if (!/^[A-Za-z0-9_/-]{1,90}$/.test(value)) throw Error('Use a channel of 1–90 letters, digits, /, _ or -.');
  return value;
}
export class Connection {
  constructor({socketFactory=url=>new WebSocket(url), onMessage=()=>{}, onStatus=()=>{}}={}) {
    Object.assign(this,{socketFactory,onMessage,onStatus,socket:null,connected:false});
  }
  connect(channel, name) {
    this.close(); this.channel=validChannel(channel); this.name=name;
    const socket=this.socket=this.socketFactory('wss://oocsi.id.tue.nl/ws');
    this.onStatus('connecting');
    socket.onopen=()=>{
      if(this.socket!==socket)return;
      socket.send(name); socket.send('subscribe '+channel);
      this.connected=true; this.onStatus('connected');
    };
    socket.onmessage=event=>{
      if(this.socket!==socket)return;
      if(event.data==='ping'){socket.send('.');return;}
      try {const e=JSON.parse(event.data);if(e.recipient===channel&&e.data&&typeof e.data==='object'&&!Array.isArray(e.data))this.onMessage(e);} catch {/* Ignore protocol notices and malformed packets. */}
    };
    socket.onerror=()=>{if(this.socket===socket)this.onStatus('error');};
    socket.onclose=()=>{if(this.socket===socket){this.connected=false;this.onStatus('disconnected');}};
  }
  send(data) {if(this.connected&&this.socket?.readyState===1)this.socket.send('sendjson '+this.channel+' '+JSON.stringify(data));}
  close() {const old=this.socket;this.socket=null;this.connected=false;old?.close();}
}
