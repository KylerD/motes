// Encodes every web copy of the paintings from the finished PNGs that scripts/finish.py makes from
// the masters in art/scenes: AVIF and WebP for both tiers, small place thumbnails, link-preview
// cards, the made page's pictures and app icons. Nothing is encoded from an unfinished master.
// Run after changing a painting: uv run scripts/finish.py && node scripts/encode-scenes.mjs
import sharp from 'sharp';
import {existsSync,mkdirSync,readdirSync,statSync} from 'node:fs';

const masters='art/scenes',finished='.cache/scenes/finished',scenes='public/scenes';
const TIERS=['','@3840'];
// Quality chosen by eye at 2× zoom against the masters; colour stays full resolution
// so neon edges and lamp light do not bleed.
const AVIF={quality:60,effort:6,chromaSubsampling:'4:4:4'},WEBP={quality:86,effort:6};
// Each place's arrival and evening paintings, in the order a preview card reads them.
const PLACES={'neon-rain':'neon-rain-night','golden-hour':'golden-hour-dusk','last-light-station':'last-light-station-night','the-last-chapter':'the-last-chapter-night'};
const kb=file=>`${Math.round(statSync(file).size/1024)} KB`;
const painting=name=>`${finished}/${name}.png`;

// The served look must not drift from the masters, so a missing or stale finish stops the run.
const names=readdirSync(masters).filter(file=>file.endsWith('.png')).map(file=>file.slice(0,-4));
for(const name of names)for(const tier of TIERS) {
  const file=painting(name+tier);
  if(!existsSync(file)||statSync(file).mtimeMs<statSync(`${masters}/${name}.png`).mtimeMs)
    throw new Error(`${file} is missing or older than its master. Run: uv run scripts/finish.py`);
}

for(const name of names)for(const tier of TIERS) {
  const source=painting(name+tier),out=`${scenes}/${name}${tier}`;
  await sharp(source).avif(AVIF).toFile(`${out}.avif`);
  await sharp(source).webp(WEBP).toFile(`${out}.webp`);
  console.log(`${name}${tier}`.padEnd(42),'avif',kb(`${out}.avif`),'· webp',kb(`${out}.webp`));
}

mkdirSync(`${scenes}/thumbs`,{recursive:true});
for(const place of Object.keys(PLACES)) {
  // The place list shows thumbnails at 94×67 CSS pixels; this covers 2× displays.
  await sharp(painting(place)).resize(240,170,{fit:'cover'}).webp({quality:80,effort:6}).toFile(`${scenes}/thumbs/${place}.webp`);
}

// Link previews show the hook: the same place, arrival on the left, evening on the right.
mkdirSync(`${scenes}/og`,{recursive:true});
const WIDTH=1200,HEIGHT=630;
const pixels=file=>sharp(file).resize(WIDTH,HEIGHT,{fit:'cover'}).removeAlpha().raw().toBuffer();
const smooth=x=>{const t=Math.max(0,Math.min(1,x));return t*t*(3-2*t);};
const logo=await sharp('public/brand/motes-logo.svg',{density:300}).resize({width:220}).png().toBuffer();
for(const [place,evening] of Object.entries(PLACES)) {
  const day=await pixels(painting(place)),night=await pixels(painting(evening)),out=Buffer.alloc(day.length);
  for(let x=0;x<WIDTH;x++) {
    const mix=smooth((x/WIDTH-.32)/.36);
    for(let y=0;y<HEIGHT;y++)for(let c=0;c<3;c++) {const i=(y*WIDTH+x)*3+c;out[i]=Math.round(day[i]*(1-mix)+night[i]*mix);}
  }
  const shade=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset=".68" stop-color="#1b1410" stop-opacity="0"/><stop offset="1" stop-color="#1b1410" stop-opacity=".55"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`);
  await sharp(out,{raw:{width:WIDTH,height:HEIGHT,channels:3}})
    .composite([{input:shade},{input:logo,left:44,top:HEIGHT-44-Math.round(220*114/486)}])
    .jpeg({quality:86,mozjpeg:true}).toFile(`${scenes}/og/${place}.jpg`);
  console.log('preview card',place,kb(`${scenes}/og/${place}.jpg`));
}

// The made page's card shows all four places as soft-edged bands, each centred on its
// cover-crop anchor from src/scenes/edition.ts, so it reads as Motes rather than one place.
const ANCHORS={'neon-rain':.43,'golden-hour':.60,'last-light-station':.43,'the-last-chapter':.56},BAND=WIDTH/4,FEATHER=36;
const card=Buffer.alloc(WIDTH*HEIGHT*3),weight=new Float32Array(WIDTH*HEIGHT);
for(const [i,[place,anchor]] of Object.entries(ANCHORS).entries()) {
  const {data,info}=await sharp(painting(place)).resize({height:HEIGHT}).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const start=i*BAND-FEATHER,width=BAND+2*FEATHER,left=Math.round(Math.min(info.width-width,Math.max(0,anchor*info.width-width/2)));
  for(let x=Math.max(0,start);x<Math.min(WIDTH,start+width);x++) {
    const w=Math.min(smooth((x-start)/(2*FEATHER)),smooth((start+width-x)/(2*FEATHER)))||1e-3;
    for(let y=0;y<HEIGHT;y++) {
      const o=y*WIDTH+x,s=(y*info.width+left+x-start)*3;weight[o]+=w;
      for(let c=0;c<3;c++)card[o*3+c]=Math.round((card[o*3+c]*(weight[o]-w)+data[s+c]*w)/weight[o]);
    }
  }
}
const cardShade=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset=".68" stop-color="#1b1410" stop-opacity="0"/><stop offset="1" stop-color="#1b1410" stop-opacity=".55"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`);
await sharp(card,{raw:{width:WIDTH,height:HEIGHT,channels:3}})
  .composite([{input:cardShade},{input:logo,left:44,top:HEIGHT-44-Math.round(220*114/486)}])
  .jpeg({quality:86,mozjpeg:true}).toFile(`${scenes}/og/made.jpg`);
console.log('preview card made',kb(`${scenes}/og/made.jpg`));

// The made page shows one place's two paintings side by side, at its reading width.
mkdirSync(`${scenes}/made`,{recursive:true});
for(const file of ['neon-rain','neon-rain-night']) {
  await sharp(painting(file)).resize(640,360,{fit:'cover'}).webp({quality:82,effort:6}).toFile(`${scenes}/made/${file}.webp`);
}

// Installable app icons: the shelter-and-mote symbol on the toasted-brown radio colour,
// inside the maskable safe zone.
for(const [size,name] of [[180,'apple-touch-icon'],[192,'icon-192'],[512,'icon-512']]) {
  const symbol=await sharp('public/brand/motes-symbol.svg',{density:600}).resize({width:Math.round(size*.58)}).png().toBuffer();
  const meta=await sharp(symbol).metadata();
  await sharp({create:{width:size,height:size,channels:4,background:'#302721'}})
    .composite([{input:symbol,left:Math.round((size-meta.width)/2),top:Math.round((size-meta.height)/2)}])
    .png().toFile(`public/brand/${name}.png`);
}
console.log('app icons written');
