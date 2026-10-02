// The offline score from GOAL.md. Every gate must pass before a change ships; the
// online numbers decide whether it stays. Judged dimensions S1–S3 are not automated yet.
//
//   npm run score                         build, tests and the fast gates (G2, G3, G5, G6)
//   npm run score -- --full               also the whole browser and audio verify suite (G1, G4)
//   npm run score -- --refresh-reference  re-measure the YouTube tab this machine is compared with
//   npm run score -- --strict             exit non-zero when any gate fails
//   npm run score -- --headless           no visible windows (CPU figures then use software rendering)
//
// Results print as a table and are written to captures/score.json.
import {createServer,preview} from 'vite';
import {chromium} from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import sharp from 'sharp';
import {spawn,spawnSync} from 'node:child_process';
import {existsSync,mkdirSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import os from 'node:os';

const args=new Set(process.argv.slice(2)),headless=args.has('--headless');
const gates=[];
const gate=(id,name,pass,detail,measured={})=>{gates.push({id,name,pass,detail,measured});console.log(`${id} ${pass===null?'—   ':pass?'PASS':'FAIL'} ${name}: ${detail}`);};
const run=(command,commandArgs)=>spawnSync(command,commandArgs,{shell:true,stdio:'inherit'}).status===0;
// The verify suite runs against a dev server inside this process, so it must not block the event loop.
const runAsync=(command,commandArgs,env)=>new Promise(resolve=>spawn(command,commandArgs,{shell:true,stdio:'inherit',env:{...process.env,...env}}).on('exit',code=>resolve(code===0)));
mkdirSync('captures',{recursive:true});

// G1 Correctness: tests and a production build always; the browser suite with --full.
const tested=run('npx',['vitest','run','--reporter=dot']),built=run('npm',['run','build']);
if(!built){gate('G1','Correctness',false,'the production build failed');process.exit(1);}
const suite={correctness:['verify-scenes.mjs','verify-sessions.mjs','verify-ios-audio.mjs'],audio:['verify-music.mjs','verify-mix.mjs','verify-mix.mjs synthwave','verify-synthwave.mjs','verify-synthwave-sound.mjs']};
const passed={correctness:[],audio:[]},failed={correctness:[],audio:[]};
if(args.has('--full')) {
  const dev=await createServer({server:{host:'127.0.0.1',port:0},logLevel:'error'});await dev.listen();
  const url=dev.resolvedUrls.local[0].replace(/\/$/,'');
  for(const [kind,scripts] of Object.entries(suite))for(const script of scripts)
    (await runAsync('node',[`scripts/${script}`],{MOTES_URL:url})?passed:failed)[kind].push(script);
  await dev.close();
}
const full=args.has('--full');
gate('G1','Correctness',tested&&failed.correctness.length===0,
  `${tested?'unit tests pass':'unit tests FAIL'}, build ok${full?`, browser checks ${passed.correctness.length}/${suite.correctness.length}${failed.correctness.length?` (failed: ${failed.correctness.join(', ')})`:''}`:', browser checks not run (use --full)'}`);

const server=await preview({preview:{host:'127.0.0.1',port:0},logLevel:'error'});
const base=server.resolvedUrls.local[0].replace(/\/$/,'');
const launchArgs=['--mute-audio','--autoplay-policy=no-user-gesture-required','--window-size=1280,800','--window-position=40,40',
  '--disable-features=CalculateNativeWinOcclusion','--disable-backgrounding-occluded-windows','--disable-renderer-backgrounding','--disable-background-timer-throttling'];
async function launch(reference=false){
  // Prefer installed Chrome: real GPU paths, the same browser listeners use. YouTube
  // stops streaming to sessions that announce automation, so the reference hides it.
  const options={headless,args:reference?[...launchArgs,'--disable-blink-features=AutomationControlled']:launchArgs,...reference?{ignoreDefaultArgs:['--enable-automation']}:{}};
  try{return await chromium.launch({channel:'chrome',...options});}catch{return chromium.launch(options);}
}

// G2 Lightness: CPU of a listening Motes tab against a YouTube lofi live tab, same machine, same browser.
async function cpuOf(url,prepare,{warm=20,measure=60,reference=false,keep=()=>true}={}) {
  const browser=await launch(reference),cdp=await browser.newBrowserCDPSession();
  try {
    const page=await browser.newPage({viewport:{width:1280,height:720}});
    if(!reference)await page.addInitScript(()=>{window.__frames=0;const raf=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>raf(t=>{window.__frames++;cb(t);});});
    await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
    const state=await prepare(page);
    await page.waitForTimeout(warm*1000);
    // Ten-second windows, so a reference can keep only the windows where its stream played.
    const sample=async()=>({at:Date.now(),cpu:new Map((await cdp.send('SystemInfo.getProcessInfo')).processInfo.map(p=>[p.id,p.cpuTime])),state:state?await state():'',frames:await page.evaluate(()=>window.__frames??0)});
    const samples=[await sample()];
    for(let i=0;i<measure/10;i++){await page.waitForTimeout(10000);samples.push(await sample());}
    const windows=samples.slice(1).map((end,i)=>{
      const start=samples[i];let cpu=0;for(const [id,time] of end.cpu)cpu+=time-(start.cpu.get(id)??0);
      return {percentOfCore:100*cpu/((end.at-start.at)/1000),state:end.state,clean:keep(start.state)&&keep(end.state),fps:(end.frames-start.frames)/((end.at-start.at)/1000)};
    });
    const used=windows.filter(w=>w.clean),mean=list=>list.reduce((sum,w)=>sum+w.percentOfCore,0)/list.length;
    const states=windows.map(w=>w.state).filter(Boolean),note=[...new Set(states)].join(' / ');
    return {percentOfCore:Math.round(10*mean(used.length?used:windows))/10,windows:windows.length,cleanWindows:used.length,
      fps:Math.round(windows.reduce((sum,w)=>sum+w.fps,0)/windows.length),browser:browser.version(),note,states};
  } finally {await browser.close();}
}
const motes=await cpuOf(`${base}/places/neon-rain/?day=2026-09-17`,async page=>{
  await page.click('#listen');await page.waitForFunction(()=>document.querySelector('#listen')?.getAttribute('aria-pressed')==='true',null,{timeout:30000});
});
const referenceFile='captures/score-reference.json',machine=`${os.cpus()[0]?.model.trim()} · ${os.platform()} · Chrome ${motes.browser.split('.')[0]}`;
let reference=existsSync(referenceFile)?JSON.parse(readFileSync(referenceFile,'utf8')):undefined;
const fresh=reference&&reference.machine===machine&&reference.youtube?.cleanWindows>=3&&Date.now()-Date.parse(reference.measuredAt)<14*86400000;
// The reference must be the stream itself: ads cost more and would flatter Motes, so
// only windows where the stream played from start to end count.
const streaming=state=>/^playing \d+p$/.test(state),steady=youtube=>youtube.cleanWindows>=3;
if(!fresh||args.has('--refresh-reference')) for(let attempt=1;;attempt++) {
  // Lofi Girl's 24/7 stream: the tab Motes is meant to replace.
  const youtube=await cpuOf('https://www.youtube.com/watch?v=rFZHOHl-L8A',async page=>{
    try{await page.locator('button:has-text("Accept all")').first().click({timeout:10000});}catch{/* No consent prompt in this region. */}
    await page.waitForSelector('video',{timeout:30000});
    const playing=()=>page.evaluate(()=>{const v=document.querySelector('video');return !!v&&!v.paused;});
    // Ask the video to play rather than pressing the player's toggle, which would pause it.
    for(let attempt=0;attempt<8&&!await playing();attempt++) {
      await page.evaluate(()=>document.querySelector('video')?.play().catch(()=>{}));
      await page.waitForTimeout(2500);
    }
    return ()=>page.evaluate(()=>{const v=document.querySelector('video');return v?`${v.paused?'paused':'playing'} ${v.videoHeight}p${document.querySelector('.ad-showing')?', ad':''}`:'no video';});
  },{warm:30,measure:90,reference:true,keep:streaming});
  if(steady(youtube)){reference={machine,measuredAt:new Date().toISOString(),youtube};writeFileSync(referenceFile,JSON.stringify(reference,null,2));break;}
  if(attempt===3)throw new Error(`The YouTube reference never played steadily (${youtube.note}); run again with --refresh-reference.`);
  console.log(`YouTube reference attempt ${attempt} was not steady (${youtube.note}); measuring again.`);
}
const ratio=Math.round(100*motes.percentOfCore/reference.youtube.percentOfCore)/100;
// --detail separates the picture's cost from the music's.
const detail=args.has('--detail')?{
  visualsOnly:await cpuOf(`${base}/places/neon-rain/?day=2026-09-17`,async()=>{}),
  listeningStill:await cpuOf(`${base}/places/neon-rain/?day=2026-09-17`,async page=>{
    await page.click('#listen');await page.click('#mix-toggle');await page.click('#motion');await page.keyboard.press('Escape');
  }),
}:undefined;
gate('G2','Lightness',ratio<=1,`Motes listening ${motes.percentOfCore}% of a core at ${motes.fps} fps vs YouTube lofi live ${reference.youtube.percentOfCore}% (${reference.youtube.cleanWindows} ad-free windows, ${reference.youtube.note}) → ratio ${ratio}${detail?`; visuals only ${detail.visualsOnly.percentOfCore}%, listening with Still ${detail.listeningStill.percentOfCore}%`:''}${headless?' [headless]':''}`,{motes,youtube:reference.youtube,ratio,machine,detail});

// G3 First load: a phone on Lighthouse's slow-4G profile with a 4× slower CPU.
async function firstLoad(path) {
  const browser=await chromium.launch({args:['--mute-audio']});
  try {
    const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true});
    const page=await context.newPage(),cdp=await context.newCDPSession(page),urls=new Map();let bytes=0,painting=0;
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:1.6e6/8,uploadThroughput:7.5e5/8});
    await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
    cdp.on('Network.responseReceived',event=>urls.set(event.requestId,event.response.url));
    cdp.on('Network.loadingFinished',event=>{bytes+=event.encodedDataLength;if(/\/scenes\/[^/]+\.(avif|webp|png)$/.test(urls.get(event.requestId)??''))painting=Math.max(painting,event.encodedDataLength);});
    await page.goto(base+path,{waitUntil:'commit',timeout:120000});
    await page.waitForFunction(()=>performance.getEntriesByName('motes:painting').length>0,null,{timeout:120000,polling:100});
    const ms=Math.round(await page.evaluate(()=>performance.getEntriesByName('motes:painting')[0].startTime));
    return {path,ms,paintingKB:Math.round(painting/1024),totalKB:Math.round(bytes/1024)};
  } finally {await browser.close();}
}
const loads=[await firstLoad('/'),await firstLoad('/places/last-light-station/')];
const slowest=loads.reduce((a,b)=>a.ms>b.ms?a:b),heaviest=Math.max(...loads.map(load=>load.paintingKB));
gate('G3','First load',heaviest<=350&&slowest.ms<=2500,
  `${loads.map(load=>`${load.path} painting ${load.paintingKB} KB, ${load.totalKB} KB in total, on screen at ${(load.ms/1000).toFixed(2)} s`).join('; ')} (slow 4G, 4× CPU)`,{loads});

// G5 Accessibility: no serious or critical axe violations, desktop and phone, every panel.
const browser=await chromium.launch(),violations=[];
try {
  for(const viewport of [{width:1280,height:800},{width:390,height:844}]) {
    const context=await browser.newContext({viewport,reducedMotion:'reduce'}),page=await context.newPage();
    await page.goto(`${base}/?day=2026-09-17`);await page.waitForFunction(()=>performance.getEntriesByName('motes:painting').length>0);
    for(const panel of [null,'mix','scenes','edition']) {
      if(panel)await page.click(`#${panel}-toggle`);
      const found=(await new AxeBuilder({page}).analyze()).violations.filter(v=>v.impact==='serious'||v.impact==='critical');
      violations.push(...found.map(v=>`${viewport.width}px${panel?` ${panel} panel`:''}: ${v.id} (${v.nodes.length})`));
      if(panel)await page.keyboard.press('Escape');
    }
    await context.close();
  }
} finally {await browser.close();}
gate('G5','Accessibility',violations.length===0,violations.length?violations.join('; '):'no serious or critical violations on desktop or phone, with each panel open',{violations});

// G6 Shareable: preview cards for every page, a share action and clip export.
const pages=['index.html',...readdirSync('dist/places').map(slug=>`places/${slug}/index.html`)],cards=[];
for(const file of pages) {
  const html=readFileSync(`dist/${file}`,'utf8'),meta=key=>new RegExp(`<meta (?:property|name)="${key}" content="([^"]*)"`).exec(html)?.[1];
  const image=meta('og:image'),local=image?.startsWith('https://motes.sh/')?`dist/${image.slice('https://motes.sh/'.length)}`:undefined;
  const size=local&&existsSync(local)?await sharp(local).metadata():undefined;
  if(meta('og:title')&&meta('og:description')&&meta('og:url')&&meta('twitter:card')==='summary_large_image'&&size?.width===1200&&size?.height===630)cards.push(file);
}
const app=readFileSync(`dist/${pages[0]}`,'utf8'),share=/data-share/.test(app),clip=/data-clip/.test(app);
gate('G6','Shareable',cards.length===pages.length&&pages.length===5&&share&&clip,
  `preview cards ${cards.length}/${pages.length} pages, share action ${share?'present':'not built yet'}, clip export ${clip?'present':'not built yet'}`,{cards,share,clip});
gate('G4','Audio health',full?failed.audio.length===0:null,full?`${passed.audio.length}/${suite.audio.length} audio checks pass${failed.audio.length?` (failed: ${failed.audio.join(', ')})`:''}`:'not run (use --full)');
gate('S1–S3','Judged picture, clip and music',null,'not automated yet');
await server.close();

const order=['G1','G2','G3','G4','G5','G6','S1–S3'];gates.sort((a,b)=>order.indexOf(a.id)-order.indexOf(b.id));
writeFileSync('captures/score.json',JSON.stringify({measuredAt:new Date().toISOString(),machine,gates},null,2));
console.log('\nMotes score',new Date().toISOString().slice(0,10),'·',machine);
for(const g of gates)console.log(` ${g.id.padEnd(6)} ${g.pass===null?'—   ':g.pass?'PASS':'FAIL'}  ${g.name.padEnd(30)} ${g.detail}`);
const failing=gates.filter(g=>g.pass===false).map(g=>g.id);
console.log(failing.length?`\n${failing.length} gate(s) failing: ${failing.join(', ')}`:'\nAll measured gates pass.');
if(args.has('--strict')&&failing.length)process.exitCode=1;
