import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeMaze,mazeSettings,crossesWall} from './maze.mjs';
import {Game,inside} from './engine.mjs';
const seeded=seed=>()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/2**32;};
test('mazes have one traversable route, detours, and physically sized corridors across fields',()=>{
 const keys=new Set();let branches=0;
 for(const play of [[-1500,1500,1500,3500],[-1050,1050,1500,3300],[-1500,1500,1500,4500]])for(const difficulty of ['normal','hard','expert'])for(let seed=1;seed<=60;seed++){
  const m=makeMaze(seeded(seed),play,difficulty),graph=Array.from({length:m.cols*m.rows},()=>[]);
  assert.equal(m.edges.length,graph.length-1);
  for(const e of m.edges){const [a,b]=e.split(':').map(Number);graph[a].push(b);graph[b].push(a);
   const p={x:m.centers[a][0],y:m.centers[a][1]},q={x:m.centers[b][0],y:m.centers[b][1]};assert(!m.zones.some(z=>crossesWall(p,q,z,0)),'Open passage crosses a wall');}
  const seen=new Set([0]),queue=[0];for(const a of queue)for(const b of graph[a])if(!seen.has(b)){seen.add(b);queue.push(b);}assert.equal(seen.size,graph.length);
  assert.equal(m.solution[0],0);assert.equal(m.solution.at(-1),graph.length-1);assert(m.solution.length>=m.cols+m.rows+1,'Maze has no required detour');
  assert((play[1]-play[0])/m.cols-m.wall_mm>=400);assert((play[3]-play[2])/m.rows-m.wall_mm>=400);
  assert(inside(...m.centers[0],m.start));assert(inside(...m.centers.at(-1),m.goal));
  for(const gate of [m.start,m.goal])for(const x of [gate[0],gate[1]])for(const y of [gate[2],gate[3]])assert(!m.zones.some(z=>inside(x,y,z)),'Gate overlaps a wall');
  if(difficulty==='hard'&&play[3]===3500){keys.add(m.key);branches+=m.dead_ends>0;}
 }
 assert(keys.size>20);assert(branches>40);
});
test('constant random sources still produce a winding connected layout',()=>{for(const difficulty of ['normal','hard','expert'])for(const r of [0,.999999]){const m=makeMaze(()=>r,[-1500,1500,1500,4500],difficulty);assert(m.solution.length>=m.cols+m.rows+1);assert.equal(new Set(m.solution).size,m.solution.length);}});
test('closed room boundaries cannot be bypassed at the outer field edge',()=>{
 const play=[-1500,1500,1500,3500],m=makeMaze(seeded(8),play);
 for(const z of m.zones){if(z[2]<play[2])assert(crossesWall({x:z[0]-10,y:play[2]},{x:z[1]+10,y:play[2]},z));if(z[0]<play[0])assert(crossesWall({x:play[0],y:z[2]-10},{x:play[0],y:z[3]+10},z));}
});
test('fast fresh sample crossing hits a maze wall even with endpoints outside it',()=>{
 const g=new Game(0);let seq=0;const sample=(t,x,y)=>g.ingest({radar_seq:++seq,radar_boot:'test',radar_valid:true,radar_x_mm:x,radar_y_mm:y},t);
 sample(0,-1000,1800);g.setup_checked=true;g.start(0);g.layout={kind:'maze',margin_mm:35,zones:[[-200,0,1500,3500]]};
 sample(.1,-300,2200);g.tick(.1);assert.equal(g.penalties,0);sample(.3,100,2200);g.tick(.3);assert.equal(g.penalties,1);
 g.tick(.31);assert.equal(g.penalties,1);
});
test('difficulty validates and invalidates setup, and cannot change during a round',()=>{
 const g=new Game(0);g.setup_checked=true;g.difficulty('expert');assert.equal(g.cfg.cols,5);assert.equal(g.cfg.rows,3);assert.equal(g.setup_checked,false);assert.throws(()=>g.difficulty('impossible'));g.state='running';assert.throws(()=>g.difficulty('normal'));assert.equal(mazeSettings([-1050,1050,1500,3300],'expert').cols,3);
});
test('walking the generated solution wins without wall penalties',()=>{
 for(const level of ['normal','hard','expert'])for(let seed=1;seed<=12;seed++){
  const g=new Game(0,{difficulty:level}),m=makeMaze(seeded(seed),g.cfg.play,level);let seq=0,t=0;
  const sample=(x,y)=>{g.ingest({radar_seq:++seq,radar_boot:'walk',radar_valid:true,radar_x_mm:x,radar_y_mm:y},t);g.tick(t);};
  sample(...m.centers[0]);g.setup_checked=true;g.start(t);g.layout=m;
  for(let i=1;i<m.solution.length;i++){const a=m.centers[m.solution[i-1]],b=m.centers[m.solution[i]],steps=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/75);
   for(let k=1;k<=steps;k++){t+=.1;sample(a[0]+(b[0]-a[0])*k/steps,a[1]+(b[1]-a[1])*k/steps);}}
  assert.equal(g.penalties,0);assert.equal(g.state,'won');
 }
});
