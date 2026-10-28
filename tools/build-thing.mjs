import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url);
const read=p=>readFile(new URL(p,root),'utf8');
const moduleCode=async(file,imports,names)=>{
  const source=(await read('app/'+file)).replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'');
  return `(()=>{${imports}\n${source}\nreturn {${names}};})()`;
};
let bundle='const modules={};\n';
bundle+='modules.spatial='+await moduleCode('spatial.mjs','','rectangularField,mapProjection,nominalCoverage')+';\n';
bundle+='modules.maze='+await moduleCode('maze.mjs','','mazeSettings,makeMaze,crossesWall')+';\n';
bundle+='modules.engine='+await moduleCode('engine.mjs','const {rectangularField}=modules.spatial;const {mazeSettings,makeMaze,crossesWall}=modules.maze;','Game,DEFAULTS,makeLayout,inside')+';\n';
bundle+='modules.skidule='+await moduleCode('skidule.mjs','','Skidule,validControls,SKIDULE_BARS,MATCH_TOLERANCE,WARM_TOLERANCE,CONTROL_TIMEOUT_S')+';\n';
bundle+='modules.morse='+await moduleCode('morse.mjs','','Morse,validMorse,MORSE_TIMEOUT_S,MORSE_MAX_HOLD_S')+';\n';
bundle+='modules.laser='+await moduleCode('laser.mjs','','LaserGrid,validLaser')+';\n';
bundle+='modules.vault='+await moduleCode('vault.mjs','','VaultDoor,validVault')+';\n';
bundle+='modules.vaultUI='+await moduleCode('vault-ui.mjs','','mountVaultPanel')+';\n';
bundle+='modules.controller='+await moduleCode('controller.mjs','const {Game}=modules.engine;const {Skidule,validControls}=modules.skidule;const {Morse,validMorse}=modules.morse;const {LaserGrid,validLaser}=modules.laser;const {VaultDoor,validVault}=modules.vault;','Controller')+';\n';
bundle+='modules.connection='+await moduleCode('connection.mjs','','validChannel,Connection')+';\n';
bundle+='modules.things='+await moduleCode('things-connection.mjs','','ThingsConnection,teamChannel')+';\n';
bundle+='modules.hardwareTest='+await moduleCode('hardware-test.mjs','const {Skidule,validControls}=modules.skidule;const {Morse,validMorse}=modules.morse;const {validLaser}=modules.laser;const {VaultDoor,validVault}=modules.vault;','HardwareTest,TEST_MODULES')+';\n';
bundle+='modules.testUI='+await moduleCode('test-ui.mjs','const {HardwareTest,TEST_MODULES}=modules.hardwareTest;const {Connection,validChannel}=modules.connection;const {mountVaultPanel}=modules.vaultUI;','bootHardwareTest')+';\n';
let browser=(await read('app/browser.mjs')).replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'');
browser=browser.replace("$('channel').value=storage.get('toktik-channel')||'OOCSI-things/team-2';","$('channel').value=window.courseChannel||storage.get('toktik-channel')||'OOCSI-things/team-2';");
let app=(await read('app/app.js')).replace(/^import .*;\r?\n/gm,'').replaceAll("$('connection')","$('networkStatus')");
bundle+=`\nfunction boot(){
  if(window.toktikBooted)return;window.toktikBooted=true;
  document.body.classList.add('ready');
  const runtime=(()=>{const {Controller}=modules.controller;const {validChannel}=modules.connection;const {SKIDULE_BARS}=modules.skidule;const Connection=modules.things.ThingsConnection;
  ${browser}
  return runtime;})();
  (()=>{const {mapProjection}=modules.spatial;const {SKIDULE_BARS}=modules.skidule;const {bootHardwareTest}=modules.testUI;const {mountVaultPanel}=modules.vaultUI;${app}})();
  document.getElementById('connect').hidden=true;
  if(!demo){
    document.getElementById('connect').click();
    document.getElementById('channel').readOnly=true;
    document.body.style.overflow='auto';
  }
  document.getElementById('changeTeam').onclick=()=>{location.search='';};
}
window.thing=function(){window.courseChannel=window.getCourseChannel();boot();};
if(demo&&!testing)window.addEventListener('DOMContentLoaded',boot);
if(testing)window.addEventListener('DOMContentLoaded',()=>modules.testUI.bootHardwareTest());
`;
let html=await read('app/index.html');
html=html.replace('<link rel="stylesheet" href="./style.css">','').replace('<link rel="stylesheet" href="./heist.css">','').replace('<script type="module" src="./app.js"></script>','');
html=html.replace('id="connection"','id="networkStatus"').replace('Group channel<input','Team channel<input');
html=html.replace('<button id="connect" class="primary">Connect hardware</button>','<button id="connect" class="primary">Choose team and connect</button><button id="changeTeam">Change team</button>');
html=html.replace('<footer>','<footer><a href="" download="bank-heist.html">Download this module</a> · ');
html=html.replace('href="../docs/DIY.md"','href="https://github.com/beraltan/team-2-software-module/blob/main/docs/DIY.md"').replace('href="../docs/INTERFACE.md"','href="https://github.com/beraltan/team-2-software-module/blob/main/docs/INTERFACE.md"');
const safe=s=>s.replace(/<\/script/gi,'<\\/script');
// Libraries stay inline and unmodified. This file needs no sibling assets or modules.
const libraries=(await read('app/vendor/oocsi-web.js'))+'\n'+await read('app/vendor/oocsi-things.min.js');
const css=await read('app/style.css')+'\n'+await read('app/heist.css');
html=html.replace('</head>',`<style>${css}
body:not(.ready) main{display:none}#header{position:static!important;padding:12px!important}#canvasContainer{position:static!important}
#team-modal{position:fixed;inset:0;z-index:10;width:100%;height:100%;max-width:none;max-height:none;border:0;background:#090f17;color:#eaf4fc;display:grid;place-items:center}
#team-modal article{max-width:560px;width:calc(100% - 36px);padding:28px;border:1px solid #354c60;border-radius:18px;background:#11202c}#team-modal fieldset{border:0;padding:0;display:flex;gap:12px}#team-modal input[type=submit]{width:auto}#team-modal small{display:block;line-height:1.7}
#courseHelp{position:fixed;z-index:11;bottom:20px;left:0;right:0;text-align:center;background:#090f17;padding:12px}body.ready #courseHelp{display:none}input{user-select:text!important}
</style><script>
// Adapted from Toktik, Copyright (c) 2024–2026 Mathias Funk / TU/e.
// Team 2 adaptations; see THIRD_PARTY.md in the source repository.
const demo=new URLSearchParams(location.search).get('demo')==='1';
const testing=new URLSearchParams(location.search).has('test');
window.oocsiThingsConfig={teamspace:''};
if(!demo&&!testing){${safe(libraries)}\nwindow.getCourseChannel=()=>globalSettings.channel;}
</script><script>${safe(bundle)}</script></head>`);
// Guard team selection before the stock click handler runs; no network connection on empty input.
html=html.replace('</body>',`<div id="courseHelp">Choose a team to share game data on public OOCSI. <a href="?demo=1">Try offline demo</a><p id="teamError" role="status"></p></div>
<script>document.addEventListener('click',e=>{if(e.target.matches('#team-modal input[type=submit]')){try{modules.things.teamChannel(document.getElementById('team-choice').value);}catch(error){e.preventDefault();e.stopImmediatePropagation();document.getElementById('teamError').textContent=error.message;}}},true);</script></body>`);
html=html.replace('<head>', '<head><!-- Team-owned code: '+await read('LICENSE')+'\nUpstream Toktik/OOCSI material retains its existing attribution and terms. -->');
const destination=new URL('bank-heist.html',root);await writeFile(destination,html);
console.log('Built '+fileURLToPath(destination));
