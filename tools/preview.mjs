import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const port=Number(process.env.PORT||8080);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.md':'text/plain; charset=utf-8'};
createServer(async(req,res)=>{
  try {
    const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file=resolve(root,'.'+(path.endsWith('/')?path+'index.html':path));
    const relative=file.slice(root.length+1).split(/[\\/]/);
    if(!file.startsWith(root+sep)||relative.some(p=>p.startsWith('.'))||relative[0]==='logs'||!mime[extname(file)]){res.writeHead(404);res.end('Not found');return;}
    res.writeHead(200,{'Content-Type':mime[extname(file)],'Cache-Control':'no-store'});res.end(await readFile(file));
  }catch{if(!res.headersSent)res.writeHead(404);res.end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log(`Toktik preview: http://localhost:${port} (no OOCSI connection until you click Connect)`));
