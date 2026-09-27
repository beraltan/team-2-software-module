import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Game,makeLayout,inside} from './engine.mjs';
test('every generated layout has a connected start-to-vault route',()=>{
  for(let a=0;a<3;a++)for(let b=0;b<3;b++){
    let i=0;const layout=makeLayout(()=>[a/3+.01,b/3+.01][i++]);
    const cells=layout.route,seen=new Set([0]),queue=[0];
    while(queue.length){const k=queue.shift(),p=cells[k];for(let j=0;j<cells.length;j++){const q=cells[j];const adjacent=(p[0]===q[0]&&(p[3]===q[2]||q[3]===p[2]))||(p[2]===q[2]&&(p[1]===q[0]||q[1]===p[0]));if(adjacent&&!seen.has(j)){seen.add(j);queue.push(j)}}}
    assert.equal(seen.size,cells.length);assert(cells.some(c=>inside(-900,1800,c)));assert(cells.some(c=>inside(900,3200,c)));assert(layout.zones.length>0);
  }
});
function session(config={}){const g=new Game(0,config);let seq=0;const sample=(t,x=-900,y=1800)=>{g.ingest({radar_seq:++seq,radar_boot:'test',radar_valid:true,radar_x_mm:x,radar_y_mm:y},t);g.tick(t)};sample(0);g.setup_checked=true;g.start(0);return {g,sample}}
test('layout is frozen throughout a round',()=>{const {g,sample}=session(),zones=JSON.stringify(g.zones(0));for(let i=1;i<20;i++)sample(i*.2);assert.equal(JSON.stringify(g.zones(4)),zones)});
test('one anomaly per encounter and limit causes lockdown',()=>{
 const {g,sample}=session({max_anomalies:2});g.layout={zones:[[-300,300,2400,3400]],key:'test'};
 for(let i=1;i<=35;i++)sample(i*.1,0,2800);assert.equal(g.penalties,1);
 for(let i=36;i<=50;i++)sample(i*.1,-900,2800);
 for(let i=51;i<=65;i++)sample(i*.1,0,2800);
 assert.equal(g.penalties,2);assert.equal(g.state,'lost');assert.match(g.reason,/Anomaly limit/);
});
test('brief edge noise does not count; invalid samples break confirmation',()=>{
 const {g,sample}=session();g.layout={zones:[[-300,300,2400,3400]]};
 for(let i=1;i<=20;i++)sample(i*.1,250,2800);assert.equal(g.penalties,0);
 sample(2.1,0,2800);sample(2.2,0,2800);g.ingest({radar_seq:999,radar_boot:'test',radar_valid:false},2.3);g.tick(2.6);assert.equal(g.penalties,0);
});
test('guidance validates directions, expires and stops on tracking loss',()=>{
 const {g,sample}=session();g.guide('left',0);assert.equal(g.signal(.2),'left');assert.throws(()=>g.guide('wrong',.2));sample(.4);sample(.8);assert.equal(g.signal(1.01),'stop');g.guide('right',.8);assert.equal(g.signal(.8),'right');g.point=null;assert.equal(g.signal(.9),'stop');g.finish('lost','test',1);assert.throws(()=>g.guide('left',1));
});
test('facilitator rules validate and cannot change mid-round',()=>{const g=new Game(0);g.rules(4,7);assert.equal(g.cfg.max_anomalies,4);assert.throws(()=>g.rules(0,5));assert.throws(()=>g.rules(2,NaN));const {g:running}=session();assert.throws(()=>running.rules(2,5))});
