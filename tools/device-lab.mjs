import {readFile,writeFile,mkdir} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const live=process.argv.includes('--live');
const model=(await readFile(new URL('tools/device-lab-model.mjs',root),'utf8')).replace(/^import .*;$/m,'').replace('export class','class');
const maze=await readFile(new URL('app/maze.mjs',root),'utf8');
const geometry=maze.slice(maze.indexOf('export function crossesWall')).replace('export function','function');
const browser=await readFile(new URL('tools/device-lab-browser.js',root),'utf8');
const script='<script>const LIVE_OOCSI='+live+';\n'+geometry+'\n'+model+'\n'+browser+'</script>';
// A real publisher must never embed a second hacker controller.
const html=live?`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Team 2 | ESP signal sender</title><style>body{margin:0;background:#0c1812;color:#ecede3;font:16px system-ui}button{background:#1b352b;color:#ecede3;border:1px solid #617f6f;border-radius:6px;padding:9px;cursor:pointer}main{max-width:900px;margin:50px auto;padding:24px}a{color:#a7e4bf}</style>${script}</head><body><main><h1>ESP signal sender</h1><p>Camera, Skidule, Morse, laser and vault emulators publish real device messages on <strong>OOCSI-things/team-2</strong>.</p><p>This page has no hacker controller and sends no controller heartbeats. Keep your existing hacker screen open to arm and play the heist.</p><p>The camera stays in the safe zone until you press Walk entry route. Controls above send the corresponding device inputs.</p><p><a href="../bank-heist.html">Open the local hacker screen</a></p></main></body></html>`:(await readFile(new URL('bank-heist.html',root),'utf8')).replace('<head>','<head>'+script);
await mkdir(new URL('test-output/',root),{recursive:true});
const file=live?'live-device-lab.html':'device-lab.html';
await writeFile(new URL('test-output/'+file,root),html);
console.log((live?'Real OOCSI emulator':'Isolated device lab')+': run npm start, then open http://127.0.0.1:'+(process.env.PORT||8080)+'/test-output/'+file);
