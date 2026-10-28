import {test} from 'node:test';
import assert from 'node:assert/strict';
import {VaultDoor,validVault} from './vault.mjs';
import {Connection} from './connection.mjs';
import {Controller} from './controller.mjs';
import {HardwareTest} from './hardware-test.mjs';

const status=(seq=1,extra={})=>({module:'vault_door',event:'state',device_id:'team2-vault-abc',boot_id:'boot-a',seq,mode:'auto',commanded:'none',motion:'disabled',angles:[90,90],target_angles:[90,90],servo_confirmed:false,...extra});

test('vault telemetry requires two plausible commanded angles and never claims measured door position',()=>{
 assert(validVault(status()));
 for(const extra of [{servo_confirmed:true},{angles:[90]},{angles:[-1,90]},{angles:[0,181]},{target_angles:[0,NaN]},{seq:0},{seq:1.5},{mode:'unknown'},{commanded:'open'},{motion:'open'},{device_id:''},{boot_id:''}])assert.equal(validVault(status(1,extra)),false);
});

test('vault selection is automatic for one fresh device; two devices require an explicit choice',()=>{
 const v=new VaultDoor();v.ingest('first',status(),0);assert.equal(v.snapshot(0).source,'first');
 v.ingest('second',status(1,{device_id:'second'}),.1);assert.equal(v.source,'');assert.throws(()=>v.request('unlock',.1,{scope:'test',session:'tester'}),/select/);
 v.select('second');v.ingest('first',status(2),.2);assert.equal(v.source,'second');
 assert.throws(()=>v.select('unknown'));assert.equal(v.snapshot(5).fresh,false);
 assert.throws(()=>v.request('lock',5,{scope:'test',session:'tester'}),/fresh/);
});

test('duplicate status does not renew freshness, while a new boot replaces the old sequence',()=>{
 const v=new VaultDoor();v.ingest('esp',status(20),0);assert.equal(v.ingest('esp',status(20),3.9),false);assert.equal(v.snapshot(4).fresh,false);
 assert(v.ingest('esp',status(1,{boot_id:'new-boot'}),4));assert.equal(v.snapshot(4).data.boot_id,'new-boot');
});

test('vault commands bind to selected device, boot and fresh telemetry; acknowledgements survive later requests',()=>{
 const v=new VaultDoor();v.ingest('esp',status(7),0);
 const cmd=v.request('unlock',.1,{scope:'test',session:'tester'});
 assert.equal(cmd.device_id,'team2-vault-abc');assert.equal(cmd.boot_id,'boot-a');assert.equal(cmd.status_seq,7);assert.equal(cmd.scope,'test');assert(cmd.request_id);
 assert.match(v.snapshot(.2).request,/Waiting/);
 v.ingest('esp',status(8,{request_id:cmd.request_id,request_result:'accepted',mode:'manual',commanded:'unlock',motion:'moving',target_angles:[0,0]}),.3);
 v.ingest('esp',status(9,{request_id:'different-tester',request_result:'active_heist'}),.4);
 assert.match(v.snapshot(.4).request,/accepted/);
 const rejected=v.request('lock',.5,{scope:'test',session:'tester'});
 v.ingest('esp',status(10,{request_id:rejected.request_id,request_result:'active_heist'}),.6);assert.match(v.snapshot(.6).request,/Live heist active/);
 v.request('auto',.7,{scope:'presenter',session:'crew'});assert.match(v.snapshot(7).request,/No acknowledgement/);
 assert.throws(()=>v.request('other',.8,{scope:'test',session:'tester'}));
});

test('test connection sends only an explicit targeted vault command; observation never publishes a heist heartbeat',()=>{
 const socket={readyState:1,sent:[],send(line){this.sent.push(line);},close(){}},v=new VaultDoor();v.ingest('esp',status(),0);
 const c=new Connection({readOnly:true,allowVaultCommands:true,socketFactory:()=>socket});c.connect('OOCSI-things/team-2','tester');socket.onopen();
 c.send({toktik_session:'must-not-send'});c.publish({module:'terminal',event:'solved'});assert.deepEqual(socket.sent,['tester','subscribe OOCSI-things/team-2']);
 const command=v.request('unlock',.1,{scope:'test',session:'tester'});c.sendVaultCommand(command);
 assert.deepEqual(JSON.parse(socket.sent[2].slice(socket.sent[2].indexOf('{'))),command);
 assert.throws(()=>c.sendVaultCommand({...command,toktik_session:'spoof'}));assert.throws(()=>c.sendVaultCommand({...command,scope:'presenter'}));
 const readOnly=new Connection({readOnly:true});assert.throws(()=>readOnly.sendVaultCommand(command));c.close();assert.throws(()=>c.sendVaultCommand(command));
});

test('vault telemetry is visible in the live controller and test bench without solving a module or claiming control',()=>{
 const c=new Controller(0,'crew'),b=new HardwareTest();c.live(0);c.connected=true;b.selectModule('vault');
 const event={sender:'vault',data:status(1,{commanded:'unlock',motion:'at_target',angles:[0,0],target_angles:[0,0]})};
 c.receive(event,0);b.ingest(event,0);assert.equal(c.vault.source,'vault');assert.equal(c.conflict,false);assert.equal(c.game.state,'idle');assert.equal(c.skidule.state,'idle');assert.equal(c.morse.state,'idle');assert.equal(b.snapshot(0).vault.source,'vault');
 b.ingest({sender:'other',data:status(1,{device_id:'other'})},.1);assert.equal(b.snapshot(.1).vault.source,'');assert.equal(b.snapshot(.1).source,'');
});

test('offline vault follows escape and manual testing remains local',()=>{
 const v=new VaultDoor();assert.equal(v.demoSnapshot({state:'idle',phase:'navigation'}).data.commanded,'none');
 assert.equal(v.demoSnapshot({state:'armed',phase:'navigation'}).data.commanded,'lock');
 assert.equal(v.demoSnapshot({state:'running',phase:'escape'}).data.commanded,'unlock');
 v.demoCommand='lock';assert.equal(v.demoSnapshot({state:'running',phase:'escape'}).data.mode,'manual');assert.deepEqual(v.demoSnapshot({state:'won',phase:'escape'}).data.angles,[90,90]);
});
