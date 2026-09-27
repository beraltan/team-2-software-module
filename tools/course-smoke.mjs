// Local test fixture only: replace WebSocket with an in-browser fake camera.
// No network traffic is sent. Never distribute this fixture as the real module.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
await mkdir(new URL('test-output/',root),{recursive:true});
const mock=`<script>
window.WebSocket=class {
 static OPEN=1;static CONNECTING=0;
 constructor(){this.readyState=0;setTimeout(()=>{this.readyState=1;this.onopen?.({});},50);}
 send(line){
  if(line.startsWith('subscribe ')&&!this.timer){this.channel=line.slice(10);let seq=0;this.timer=setInterval(()=>this.onmessage?.({data:JSON.stringify({sender:'smoke_camera',recipient:this.channel,data:{radar_boot:'smoke',radar_seq:++seq,radar_valid:true,radar_x_mm:-900,radar_y_mm:1800,guidance_supported:true}})}),200);}
 }
 close(){clearInterval(this.timer);this.readyState=3;this.onclose?.({});}
};
</script>`;
const html=(await readFile(new URL('bank-heist.html',root),'utf8')).replace('<head>','<head>'+mock);
await writeFile(new URL('test-output/course-smoke.html',root),html);
console.log('Local fixture: http://localhost:8080/test-output/course-smoke.html (all WebSockets mocked)');
