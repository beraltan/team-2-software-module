import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ThingsConnection,teamChannel,outputs} from './things-connection.mjs';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {Controller} from './controller.mjs';
test('course auto-connect cannot clear a recovered fault',()=>{const c=new Controller(0);c.game.finish('fault','reload',0);c.live(1);assert.equal(c.game.state,'fault');assert.equal(c.game.reason,'reload');assert.equal(c.game.setup_checked,false);});
test('team naming matches course library normalization',()=>{
 assert.equal(teamChannel('Team 2'),'OOCSI-things/team-2');assert.equal(teamChannel(' My Room! '),'OOCSI-things/my-room');
 for(const name of ['','!!!','x'.repeat(71)])assert.throws(()=>teamChannel(name));
});
test('Things registers inputs/outputs and uses shared variables alongside atomic heartbeat',()=>{
 let poll,callback,up=false,left=false;const registrations=[],links=[],sent=[],variables={},statuses=[],received=[];
 const things={register:(...args)=>registrations.push(args),data:key=>variables[key]=(v)=>{variables[key].value=v;},link:(...args)=>links.push(args),subscribe:fn=>callback=fn};
 const c=new ThingsConnection({things,oocsi:{isConnected:()=>up,send:(...args)=>sent.push(args)},every:fn=>poll=fn,leave:()=>left=true,onStatus:s=>statuses.push(s),onMessage:e=>received.push(e)});
 c.connect(teamChannel('Team 2'));assert.deepEqual(registrations[0].slice(1),['toktik',['x_mm','y_mm','valid'],outputs]);assert.deepEqual(links,[['radar','x_mm'],['radar','y_mm'],['radar','valid']]);
 c.send({toktik_state:'running'});assert.equal(sent.length,0);up=true;poll();
 const h={toktik_state:'won',toktik_round_id:'round1',toktik_beat:4,toktik_session:'owner'};c.send(h);assert.deepEqual(sent[0],['OOCSI-things/team-2',h]);assert.equal(variables.state.value,'won');
 callback({data:{radar_seq:1}});assert.equal(received.length,1);up=false;poll();assert.deepEqual(statuses,['connecting','connected','disconnected']);c.close();assert(left);
});
test('single-file deliverable embeds executable sources and course entry point',async()=>{
 const html=await readFile(new URL('../bank-heist.html',import.meta.url),'utf8');
 assert(!/<script[^>]+src=/.test(html));assert(!/<link[^>]+rel="stylesheet"/.test(html));assert(!/^import .+from /m.test(html));
 assert.match(html,/window\.thing=function/);assert.match(html,/oocsiThingsConfig=\{teamspace:''\}/);assert.match(html,/Download this module/);
 for(const [,script] of html.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(script);
});
