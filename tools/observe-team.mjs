// Listen-only diagnosis. Never sends a heist heartbeat or puzzle input.
const socket=new WebSocket('wss://oocsi.id.tue.nl/ws');
const controllers=new Map(),cameras=new Map();
socket.onopen=()=>{socket.send('team2_observer_'+crypto.randomUUID().slice(0,8));socket.send('subscribe OOCSI-things/team-2');};
socket.onmessage=e=>{
  if(e.data==='ping'){socket.send('.');return;}
  try{const p=JSON.parse(e.data),d=p.data;if(!d)return;
    if(d.toktik_session)controllers.set(d.toktik_session,{sender:p.sender,state:d.heist_state,camera:d.toktik_camera,ready:d.toktik_ready,start:d.toktik_start});
    if(d.radar_boot)cameras.set(p.sender,{x:d.radar_x_mm,y:d.radar_y_mm,valid:d.radar_valid,seq:d.radar_seq});
  }catch{}
};
socket.onerror=()=>console.error('OOCSI observer connection error');
setTimeout(()=>{console.log(JSON.stringify({controllers:[...controllers.values()],cameras:[...cameras]},null,2));socket.close();},4000);
