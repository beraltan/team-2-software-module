// LD2450 Cartesian millimetres. No camera perspective warp or invented height correction.
export const nominalCoverage=(x,y)=>Number.isFinite(x)&&Number.isFinite(y)&&y>0&&Math.hypot(x,y)<=6000&&Math.abs(Math.atan2(x,y))<=Math.PI/3;
export function rectangularField(width=3000,depth=2000,near=1500){
  if(![width,depth,near].every(Number.isFinite)||width<2100||width>3000||depth<1800||depth>3000||near<1500||near+depth>4500)throw Error('Use width 2100–3000 mm, depth 1800–3000 mm, near edge ≥1500 mm and far edge ≤4500 mm.');
  const play=[-width/2,width/2,near,near+depth];
  if(![play[0],play[1]].every(x=>[play[2],play[3]].every(y=>nominalCoverage(x,y))))throw Error('Field extends outside nominal radar coverage.');
  const cw=width/3,ch=depth/3,pad=100;
  return {play,start:[play[0]+pad,play[0]+cw-pad,near+pad,near+ch-pad],goal:[play[1]-cw+pad,play[1]-pad,play[3]-ch+pad,play[3]-pad]};
}
export function mapProjection(play,width,height,pad=44){
  // Show the sensor origin as well as the playable rectangle. Equal scale on both axes.
  const bounds=[Math.min(play[0],0)-200,Math.max(play[1],0)+200,0,play[3]+200];
  const scale=Math.min((width-2*pad)/(bounds[1]-bounds[0]),(height-2*pad)/(bounds[3]-bounds[2]));
  const left=(width-(bounds[1]-bounds[0])*scale)/2,top=(height-(bounds[3]-bounds[2])*scale)/2;
  return {scale,point:(x,y)=>[left+(x-bounds[0])*scale,top+(bounds[3]-y)*scale]};
}
