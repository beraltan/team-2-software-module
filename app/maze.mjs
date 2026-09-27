// Perfect mazes: a randomized spanning tree gives one route between any two rooms.
export function mazeSettings(play,difficulty='hard') {
  const levels={normal:[3,3],hard:[4,3],expert:[5,4]};
  if(!Object.hasOwn(levels,difficulty))throw Error('Choose normal, hard or expert maze difficulty.');
  const [l,r,n,f]=play,[maxCols,maxRows]=levels[difficulty];
  // 200 mm walls and >=600 mm cell pitch leave >=400 mm clear corridors.
  const cols=Math.min(maxCols,Math.floor((r-l)/600)),rows=Math.min(maxRows,Math.floor((f-n)/600));
  const w=(r-l)/cols,h=(f-n)/rows,wall_mm=200,pad=wall_mm/2+40;
  return {cols,rows,wall_mm,start:[l+pad,l+w-pad,n+pad,n+h-pad],goal:[r-w+pad,r-pad,f-h+pad,f-pad]};
}
const edge=(a,b)=>a<b?`${a}:${b}`:`${b}:${a}`;
function solve(edges,cols,rows){
  const graph=Array.from({length:cols*rows},()=>[]);
  for(const key of edges){const [a,b]=key.split(':').map(Number);graph[a].push(b);graph[b].push(a);}
  const parent=new Map([[0,-1]]),queue=[0];
  for(const a of queue)for(const b of graph[a])if(!parent.has(b)){parent.set(b,a);queue.push(b);}
  const path=[];for(let at=cols*rows-1;at!==-1;at=parent.get(at))path.push(at);path.reverse();
  return {path,graph,deadEnds:graph.filter((v,i)=>v.length===1&&!path.includes(i)).length};
}
export function makeMaze(random=Math.random,play=[-1500,1500,1500,3500],difficulty='hard'){
  const settings=mazeSettings(play,difficulty),{cols,rows,wall_mm}=settings,count=cols*rows;
  const neighbours=a=>[a%cols<cols-1?a+1:-1,Math.floor(a/cols)<rows-1?a+cols:-1,a%cols>0?a-1:-1,a>=cols?a-cols:-1].filter(v=>v>=0);
  let best=null;const candidates=[];
  for(let attempt=0;attempt<96;attempt++){
    const edges=new Set(),seen=new Set([0]),stack=[0];
    while(stack.length){const a=stack.at(-1),options=neighbours(a).filter(b=>!seen.has(b));if(!options.length){stack.pop();continue;}
      const b=options[Math.min(options.length-1,Math.floor(random()*options.length))];edges.add(edge(a,b));seen.add(b);stack.push(b);}
    const info=solve(edges,cols,rows);
    // Prefer a long solution, but retain wrong turns rather than only one corridor.
    const score=info.path.length+(info.deadEnds?3:0);
    if(info.path.length>=cols+rows+1&&info.deadEnds>0)candidates.push({edges,...info,score});
    if(!best||score>best.score)best={edges,...info,score};
  }
  if(candidates.length)best=candidates[Math.min(candidates.length-1,Math.floor(random()*candidates.length))];
  // Deterministic fallback guarantees a detour even with a constant RNG.
  if(best.path.length<cols+rows+1){
    const edges=new Set(),snake=[];
    if(rows%2){for(let y=0;y<rows;y++)for(let x=0;x<cols;x++)snake.push(y*cols+(y%2?cols-1-x:x));}
    else {const usedCols=cols%2?cols:cols-1;for(let x=0;x<usedCols;x++)for(let y=0;y<rows;y++)snake.push((x%2?rows-1-y:y)*cols+x);
      if(usedCols<cols){snake.push(count-1);for(let y=rows-2;y>=0;y--)snake.push(y*cols+cols-1);}}
    for(let i=1;i<snake.length;i++)edges.add(edge(snake[i-1],snake[i]));best={edges,...solve(edges,cols,rows)};
  }
  const [l,r,n,f]=play,w=(r-l)/cols,h=(f-n)/rows,t=wall_mm/2,zones=[];
  // Overlap wall ends at junctions and extend to the field edge: no corner gaps.
  for(let y=0;y<rows;y++)for(let x=0;x<cols-1;x++)if(!best.edges.has(edge(y*cols+x,y*cols+x+1)))zones.push([l+(x+1)*w-t,l+(x+1)*w+t,n+y*h-t,n+(y+1)*h+t]);
  for(let y=0;y<rows-1;y++)for(let x=0;x<cols;x++)if(!best.edges.has(edge(y*cols+x,(y+1)*cols+x)))zones.push([l+x*w-t,l+(x+1)*w+t,n+(y+1)*h-t,n+(y+1)*h+t]);
  const centers=Array.from({length:count},(_,i)=>[l+(i%cols+.5)*w,n+(Math.floor(i/cols)+.5)*h]);
  return {...settings,kind:'maze',difficulty,zones,edges:[...best.edges],solution:best.path,centers,dead_ends:best.deadEnds,
    margin_mm:35,key:[cols,rows,...[...best.edges].sort()].join('|')};
}
// Segment/core intersection catches walls crossed between two fresh radar samples.
export function crossesWall(a,b,box,margin=35){
  let lo=0,hi=1;
  for(const [origin,delta,min,max] of [[a.x,b.x-a.x,box[0]+margin,box[1]-margin],[a.y,b.y-a.y,box[2]+margin,box[3]-margin]]){
    if(min>max)return false;
    if(delta===0){if(origin<min||origin>max)return false;continue;}
    const p=(min-origin)/delta,q=(max-origin)/delta;lo=Math.max(lo,Math.min(p,q));hi=Math.min(hi,Math.max(p,q));if(lo>hi)return false;
  }
  return true;
}
