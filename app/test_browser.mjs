import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Controller} from './controller.mjs';
import {Connection,validChannel} from './connection.mjs';
const radar=(seq=1,boot='boot')=>({sender:'any_group_camera',data:{radar_seq:seq,radar_boot:boot,radar_valid:true,radar_x_mm:-900,radar_y_mm:1800,guidance_supported:true}});
function live(){const c=new Controller(0,'owner');c.live(0);c.connected=true;c.selectCamera('any_group_camera',0);c.receive(radar(),0);c.game.setup_checked=true;return c;}
test('camera discovery accepts other groups; only selected camera controls game',()=>{
 const c=live();c.receive({...radar(2),sender:'other_camera'},.1);assert.equal(c.cameras.size,2);assert.equal(c.game.seq,1);c.receive(radar(2),.2);assert.equal(c.game.seq,2);
});
test('live start requires a connection and a camera',()=>{const c=live();c.connected=false;assert.throws(()=>c.start(0));c.connected=true;c.camera='';assert.throws(()=>c.start(0));});
test('conflicting authority faults round, suppresses sends and requires quiet reset',()=>{
 const c=live();c.start(0);c.game.guide('left',0);c.receive({sender:'other',data:{toktik_session:'other',toktik_beat:1}},.1);
 assert.equal(c.game.state,'fault');assert.equal(c.game.signal(.1),'stop');assert.equal(c.heartbeat(.1),null);assert.throws(()=>c.reset(3));c.reset(3.2);assert.equal(c.conflict,false);assert.equal(c.game.setup_checked,false);
});
test('own messages do not conflict and startup listening period suppresses heartbeat',()=>{const c=live();c.receive({data:{toktik_session:c.session}},0);assert.equal(c.conflict,false);c.quietUntil=3;assert.equal(c.heartbeat(2),null);assert.throws(()=>c.start(0));assert(c.heartbeat(3));});
test('live heartbeat supports firmware and publishes integration outcome',()=>{const c=live();c.start(0);const h=c.heartbeat(.1);assert.equal(h.toktik_state,'running');assert.equal(h.toktik_camera,'any_group_camera');assert(h.toktik_round_id);assert.equal(h.toktik_beat,1);c.fault('hidden',.2);assert.equal(c.heartbeat(.2).toktik_guide,'stop');assert.equal(c.game.state,'fault');});
test('camera change invalidates calibration and old position',()=>{const c=live();c.selectCamera('next',.2);assert.equal(c.game.point,null);assert.equal(c.game.setup_checked,false);assert.equal(c.game.seq,-1);});
test('camera boot restart and stale data cannot resume an attempt',()=>{const c=live();c.start(0);c.receive(radar(2,'new'),.1);assert.equal(c.game.state,'fault');const d=live();d.start(0);d.game.tick(1.1);d.receive(radar(2),1.2);assert.equal(d.game.state,'fault');});
test('channel rejects command injection and firmware-overlength input',()=>{assert.equal(validChannel('OOCSI-things/group-9'),'OOCSI-things/group-9');for(const s of ['', 'a b','a\nsubscribe other','x'.repeat(91)])assert.throws(()=>validChannel(s));});
test('WebSocket protocol: handshake, recipient filter, ping, no offline replay',()=>{
 let socket;const messages=[],statuses=[];
 const c=new Connection({socketFactory:()=>socket={readyState:0,sent:[],send(s){this.sent.push(s);},close(){this.readyState=3;}},onMessage:e=>messages.push(e),onStatus:s=>statuses.push(s)});
 c.connect('group','client');c.send({toktik_guide:'left'});assert.equal(socket.sent.length,0);socket.readyState=1;socket.onopen();assert.deepEqual(socket.sent,['client','subscribe group']);
 socket.onmessage({data:'ping'});assert.equal(socket.sent.at(-1),'.');socket.onmessage({data:'not json'});
 socket.onmessage({data:JSON.stringify({recipient:'other',data:{radar_seq:1}})});assert.equal(messages.length,0);
 socket.onmessage({data:JSON.stringify({recipient:'group',data:{radar_seq:1}})});assert.equal(messages.length,1);
 c.send({toktik_state:'idle'});assert.match(socket.sent.at(-1),/^sendjson group /);const previous=socket;c.close();previous.onopen();assert.equal(c.connected,false);assert.equal(previous.sent.length,4);
});
