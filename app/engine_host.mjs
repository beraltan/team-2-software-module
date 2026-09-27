// Local stdin/stdout bridge. No network connections.
import {createInterface} from 'node:readline';
import {Game} from './engine.mjs';
const games=new Map();
for await(const line of createInterface({input:process.stdin})){
  let game;
  try{
    const q=JSON.parse(line);let value=null;
    if(q.method==='create'){game=new Game(...q.args);games.set(q.id,game);}
    else{
      game=games.get(q.id);if(!game)throw Error('Unknown game instance');
      if(q.method==='set'){const [key,v]=q.args;if(!Object.hasOwn(game,key))throw Error('Unknown field');game[key]=v;}
      else if(['ingest','fresh','zone','start','finish','reset','tick','tripwire','snapshot','guide','signal','rules','field'].includes(q.method))value=game[q.method](...q.args)??null;
      else throw Error('Unknown operation');
    }
    process.stdout.write(JSON.stringify({value,state:game})+'\n');
  }catch(e){process.stdout.write(JSON.stringify({error:e.message,state:game??null})+'\n');}
}
