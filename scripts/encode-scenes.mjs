// Derives every web copy of the paintings from their PNG masters: AVIF and WebP for
// the scene, small place thumbnails, link-preview cards and app icons.
// Run after changing a painting: node scripts/encode-scenes.mjs
import sharp from 'sharp';
import {mkdirSync,readdirSync,statSync} from 'node:fs';

const scenes='public/scenes';
// Quality chosen by eye at 2× zoom against the masters; colour stays full resolution
// so neon edges and lamp light do not bleed.
const AVIF={quality:60,effort:6,chromaSubsampling:'4:4:4'},WEBP={quality:86,effort:6};
// Each place's arrival and evening paintings, in the order a preview card reads them.
const PLACES={'neon-rain':'neon-rain-night','golden-hour':'golden-hour-dusk','last-light-station':'last-light-station-night','the-last-chapter':'the-last-chapter-night'};
const kb=file=>`${Math.round(statSync(file).size/1024)} KB`;

for(const file of readdirSync(scenes).filter(name=>name.endsWith('.png'))) {
  const master=`${scenes}/${file}`,base=master.slice(0,-4);
  await sharp(master).avif(AVIF).toFile(`${base}.avif`);
  await sharp(master).webp(WEBP).toFile(`${base}.webp`);
  console.log(file.padEnd(32),'png',kb(master),'· avif',kb(`${base}.avif`),'· webp',kb(`${base}.webp`));
}

mkdirSync(`${scenes}/thumbs`,{recursive:true});
for(const place of Object.keys(PLACES)) {
  // The place list shows thumbnails at 94×67 CSS pixels; this covers 2× displays.
  await sharp(`${scenes}/${place}.png`).resize(240,170,{fit:'cover'}).webp({quality:80,effort:6}).toFile(`${scenes}/thumbs/${place}.webp`);
}

// Link previews show the hook: the same place, arrival on the left, evening on the right.
mkdirSync(`${scenes}/og`,{recursive:true});
const WIDTH=1200,HEIGHT=630;
const pixels=file=>sharp(file).resize(WIDTH,HEIGHT,{fit:'cover'}).removeAlpha().raw().toBuffer();
const smooth=x=>{const t=Math.max(0,Math.min(1,x));return t*t*(3-2*t);};
const logo=await sharp('public/brand/motes-logo.svg',{density:300}).resize({width:220}).png().toBuffer();
for(const [place,evening] of Object.entries(PLACES)) {
  const day=await pixels(`${scenes}/${place}.png`),night=await pixels(`${scenes}/${evening}.png`),out=Buffer.alloc(day.length);
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
