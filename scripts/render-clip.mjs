// The daily clip for posting: node scripts/render-clip.mjs [day] [place] [style]
// Day defaults to today (local), place to that day's edition, style to lofi. Writes captures/clips/.
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
import {clipFromPage,inspectClip} from './clip-tools.mjs';

const today=new Date(),day=process.argv[2]??`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
const place=process.argv[3],style=process.argv[4]??'lofi';
const server=await createServer({server:{host:'127.0.0.1',port:0},logLevel:'error'});await server.listen();
const browser=await chromium.launch({channel:'chrome'});
try {
  const page=await browser.newPage();await page.goto(server.resolvedUrls.local[0]+`?day=${day}`);
  // No place given: today's edition picks it, exactly as the home page does.
  const scene=place??await page.evaluate(async day=>(await import('/src/scenes/edition.ts')).edition(day).scene,day);
  const {name,bytes}=await clipFromPage(page,scene,day,style);
  mkdirSync('captures/clips',{recursive:true});writeFileSync(`captures/clips/${name}`,bytes);
  console.log(JSON.stringify({path:`captures/clips/${name}`,kb:Math.round(bytes.length/1024),...await inspectClip(`captures/clips/${name}`)},null,1));
} finally {await browser.close();await server.close();}
