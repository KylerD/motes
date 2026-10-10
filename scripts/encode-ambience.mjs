// Encodes each place's scene sounds from CC0 field recordings: node scripts/encode-ambience.mjs
// Sources download once into .cache/ambience (checked against their SHA-256) and are never served.
// Every recording goes through the same steps: trim, filter, normalise to one shared loudness, fold
// a bed's tail into its head so it loops without a seam, then MP3 (mono for placed sounds, stereo for
// enveloping beds). Provenance for every file is in public/audio/ambience/README.md.
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,statSync,writeFileSync} from 'node:fs';

const cache='.cache/ambience',out='public/audio/ambience',RATE=48000;
// Ambie (jenius-apps/ambie) ships these Freesound CC0 recordings in its repository; pinned to one commit.
const ambie='https://raw.githubusercontent.com/jenius-apps/ambie/eb29bd9946b414f7b7988d43ea5e77c537e9ab7d/src/AmbientSounds.Uwp/Assets/Sounds/';
// The other places' recordings are Freesound's own high-quality previews of CC0 sounds (about 200 kbps Ogg Vorbis).
const freesound=path=>`https://cdn.freesound.org/previews/${path}-hq.ogg`;
const SOURCES={
  rain:{url:ambie+'rain.wav',sha256:'5a68ea94b6e1d83e77db80fbc55d7c2f7abef192879dfb6a9b859c1c3f753fa0'},
  brook:{url:ambie+'creek.wav',sha256:'3926d7cf09975740dc39baec395a4117ea06a8f4a322978a44798b3245863777'},
  city:{url:ambie+'citystreet.wav',sha256:'05346bcef4768a8a5590a2bf64b21301f9832212f19bd351e3c6b805ae23b353'},
  'snowy-afternoon':{url:freesound('719/719852_2250422'),sha256:'798293eb0ff9e9369a511235312322b6c571f322ef2dd7a22c7b3451a82ada64'},
  'propane-lantern':{url:freesound('159/159386_2379373'),sha256:'aa8f8669ee7b3b98feeb9cdb3f3ce749bf6aed8a86c32ecf387a67a0beb7f8f2'},
  'grandfather-clock':{url:freesound('125/125968_981397'),sha256:'1396506d0cdefa53881d48954aeed0b8e57594004f112d65a3fa728197c5a95d'},
  'church-peal':{url:freesound('411/411489_109726'),sha256:'c59460994ac235cf9bf8a902b5fb1103036aaa94d66a83ca23a31908e2432d31'},
  'far-dog':{url:freesound('453/453433_612689'),sha256:'22613d84f2f88b152557930abcb5393010cd7d08862a303cb829dce1384cb4e0'},
  'distant-train':{url:freesound('380/380671_5734792'),sha256:'815d9be638fe35a6182e13e9930df0405e1a8c29f6530360fe036355a3a3e699'},
  'summer-meadow':{url:freesound('409/409143_85211'),sha256:'daeeb9f2c84a860fe840717e5271b54bec022383d42c376ba2d7ac50de6e4d30'},
  'tree-in-wind':{url:freesound('523/523389_2010973'),sha256:'d57fddeea123289a35edb5e98ce6f6e01187f356b8d79627a4b7d4f895040ba8'},
  'lake-waves':{url:freesound('326/326097_1050391'),sha256:'783364edf557331c87c2ba85c361a537da7564e709b6bcd307e95742fa65d0dc'},
  blackbird:{url:freesound('431/431911_1340199'),sha256:'6b66edb5d7bcc8575e0ed18c40ff94b1e86a090e110cbcc55e25b877a9942aea'},
  bumblebees:{url:freesound('152/152789_2479316'),sha256:'60b5b537d7c2fbe94782aead215bf5d619a53839cf20a64d3a3f822a8cac2801'},
  'night-crickets':{url:freesound('175/175020_2979997'),sha256:'c5ce8cc71b693f35d03b71d400c856b487ecd60a4ace4d7bdd2f257567d541f5'},
  'house-martins':{url:freesound('196/196363_2824510'),sha256:'76417b64984c1c7c6b8ffe37e83a74b83f7016d22daf5f81bb05ce2c3f62ebf2'},
  'sardinia-rocks':{url:freesound('188/188509_1558130'),sha256:'7b10b41afc543328634fdd3791d54ff90453d9b5ba3796a46c8d12c871578c35'},
  'trogir-square':{url:freesound('195/195725_623488'),sha256:'93a8acfd99cc9f2f8057ca156b351581fe9a9ac32b91a2ba51c88b555b89421a'},
  fabric:{url:freesound('701/701647_9616576'),sha256:'0e6897dc3cb6afd397f85e089a041ebfd2bf3fd3f649add074c56c5bebf95146'},
  'genova-chains':{url:freesound('55/55034_680310'),sha256:'a09d3e1c8e4bbc6a81222f852310b7b4af0ba7645cc33361f86ea1021b4e96c4'},
  'bell-buoy':{url:freesound('675/675693_2524442'),sha256:'fddb35a9af96c42b515ca70fc3ddc1e20d5c4cc92a60da946a7c30b8ddc4fa47'},
  'gulls-wildtrack':{url:freesound('462/462462_2752236'),sha256:'660c7a8606f69b45230c4e982938046afec22264a58e884583b017df3ebe4e74'},
  'marine-diesel':{url:freesound('264/264864_1934171'),sha256:'13165f1434c00e01014cfed95e4fdbf6019c0531081ff23833e47d4f61ad2072'},
};
/** One shared loudness for beds, and one for the loudest moment of a spot, so per-place trims start equal. */
const BED_RMS=-30,SPOT_PEAK_RMS=-24,FOLD=1.5,BUDGET=1.2e6;

function source(name) {
  const {url,sha256}=SOURCES[name],file=`${cache}/${name}${url.slice(url.lastIndexOf('.'))}`;
  if(!existsSync(file)) {
    mkdirSync(cache,{recursive:true});
    const fetched=spawnSync('curl',['-sSfL','--max-time','120','-o',file,url],{stdio:'inherit'});
    if(fetched.status!==0)throw new Error(`Could not download ${url}`);
  }
  const hash=createHash('sha256').update(readFileSync(file)).digest('hex');
  if(hash!==sha256)throw new Error(`${file} does not match its recorded SHA-256 (${hash}).`);
  return file;
}

/** Decode a stretch of a recording to 48 kHz floats through an FFmpeg filter chain: mono, or [left, right] for
 * stereo. A filter that slows the sound down makes `out` seconds from `seconds` of the recording. */
function decode(name,start,seconds,filters='',channels=1,out=seconds) {
  // Read a little past the stretch: compressed sources can seek a few milliseconds short.
  const args=['-v','error','-ss',String(start),'-t',String(seconds+.05),'-i',source(name),'-ac',String(channels),'-ar',String(RATE)];
  if(filters)args.push('-af',filters);
  const result=spawnSync('ffmpeg',[...args,'-f','f32le','-'],{maxBuffer:1<<30});
  if(result.status!==0)throw new Error(result.stderr.toString());
  const bytes=result.stdout;
  const samples=new Float32Array(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
  const frames=Math.floor(out*RATE);
  if(samples.length<Math.floor((out-.01)*RATE)*channels)throw new Error(`${name} is shorter than ${start+seconds}s`);
  if(channels===1)return samples.subarray(0,frames);
  return Array.from({length:channels},(_,c)=>Float32Array.from({length:frames},(_,i)=>samples[i*channels+c]));
}

const rms=(data,from=0,to=data.length)=>{let sum=0;for(let i=from;i<to;i++)sum+=data[i]*data[i];return Math.sqrt(sum/Math.max(1,to-from));};
const db=value=>20*Math.log10(Math.max(value,1e-12));
const scale=(channels,gain)=>{for(const data of channels)for(let i=0;i<data.length;i++)data[i]*=gain;return channels;};
/** Beds: their average level. */
const normaliseBed=channels=>scale(channels,10**(BED_RMS/20)/Math.sqrt(channels.reduce((sum,data)=>sum+rms(data)**2,0)/channels.length));
/** Spots: each variant's loudest 50 ms, so a drip and a passing car arrive at one level before the mix. */
function normaliseSpot(data) {
  const block=Math.round(RATE*.05);let loudest=0;
  for(let i=0;i+block<=data.length;i+=block/2)loudest=Math.max(loudest,rms(data,i,i+block));
  return scale([data],10**(SPOT_PEAK_RMS/20)/loudest)[0];
}

/** Equal-power fold: the last FOLD seconds blend into the first, and the file ends where its start continues. */
function fold(data) {
  const overlap=Math.round(FOLD*RATE),length=data.length-overlap,looped=data.slice(0,length);
  for(let i=0;i<overlap;i++){const t=i/overlap;looped[i]=data[length+i]*Math.cos(t*Math.PI/2)+data[i]*Math.sin(t*Math.PI/2);}
  return looped;
}

/** Short fades on a spot's cut edges, so a slice never starts or stops with a click. */
function edges(data,fadeIn,fadeOut) {
  const a=Math.round(fadeIn*RATE),b=Math.round(fadeOut*RATE);
  for(let i=0;i<a;i++)data[i]*=Math.sin(i/a*Math.PI/2)**2;
  for(let i=0;i<b;i++)data[data.length-1-i]*=Math.sin(i/b*Math.PI/2)**2;
  return data;
}

/** Spots that share one file sit in equal slots; the sound map plays slot n. */
function slots(variants,seconds) {
  const length=Math.round(seconds*RATE),all=new Float32Array(length*variants.length);
  variants.forEach((data,i)=>all.set(data.subarray(0,length),i*length));
  return all;
}

function mulberry(seed){return()=>{seed|=0;seed=seed+0x6d2b79f5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

/** Eave drips, modelled: no CC0 recording of a single drip could be reached, so each is a water drop's
 * entrained bubble (van den Doel 2005: a rising, quickly damped sine, f0 = 3/r) or a tap on wet stone,
 * with a faint splash and two early reflections from the eave. Deterministic, so the file never drifts. */
function drips(count,seconds) {
  const random=mulberry(0x5eed),length=Math.round(seconds*RATE);
  return Array.from({length:count},(_,variant)=>{
    const data=new Float32Array(length),stone=variant%3===2;
    const noise=()=>random()*2-1;
    // The impact: a few milliseconds of noise, brighter on stone.
    const impact=Math.round(RATE*(stone?.004:.0025));let low=0;
    for(let i=0;i<impact;i++){low=low*.55+noise()*.45;data[i]+=(stone?noise()*.5+low*.5:low)*Math.exp(-i/impact*4)*(stone?.9:.35);}
    // The splash: soft, bright and short.
    for(let i=0;i<RATE*.05;i++)data[i]+=noise()*.06*Math.exp(-i/(RATE*.012));
    // Bubbles: one main drop, sometimes a smaller follower a moment later.
    const bubbles=stone?(random()<.5?1:0):random()<.45?2:1;
    for(let b=0;b<bubbles;b++) {
      const radius=(stone?3.4:1.2+random()*1.8)*1e-3*(b?.7:1),f0=3/radius,decay=.13+.0072*radius**-1.5,rise=(.05+random()*.07)*decay;
      const start=Math.round(RATE*(b?.03+random()*.09:.0015)),amplitude=(stone?.25:.9)*(b?.5:1);
      let phase=0;
      for(let i=start;i<length;i++) {
        const t=(i-start)/RATE,envelope=Math.exp(-decay*t);if(envelope<1e-4)break;
        phase+=2*Math.PI*f0*(1+rise*t)/RATE;data[i]+=amplitude*Math.sin(phase)*envelope*Math.min(1,t*RATE/24);
      }
    }
    // Two early reflections from the eave and steps, softened.
    const dry=data.slice();
    for(const [delay,gain] of [[.011,.22],[.023,.12]]){let soft=0;const d=Math.round(delay*RATE);for(let i=d;i<length;i++){soft=soft*.6+dry[i-d]*.4;data[i]+=soft*gain;}}
    return edges(normaliseSpot(data),0,.02);
  });
}

function encode(file,channels,kbps,rate) {
  const frames=channels[0].length,interleaved=new Float32Array(frames*channels.length);
  for(let i=0;i<frames;i++)for(let c=0;c<channels.length;c++)interleaved[i*channels.length+c]=channels[c][i];
  const peak=interleaved.reduce((max,v)=>Math.max(max,Math.abs(v)),0);
  if(peak>=.98)throw new Error(`${file} would clip (peak ${peak.toFixed(3)})`);
  const result=spawnSync('ffmpeg',['-v','error','-y','-f','f32le','-ar',String(RATE),'-ac',String(channels.length),'-i','-',
    '-ar',String(rate),'-c:a','libmp3lame','-b:a',`${kbps}k`,'-write_xing','1',file],{input:Buffer.from(interleaved.buffer)});
  if(result.status!==0)throw new Error(result.stderr.toString());
  return {file,seconds:+(frames/RATE).toFixed(2),channels:channels.length,bytes:statSync(file).size,levelDb:+db(rms(interleaved)).toFixed(1),peakDb:+db(peak).toFixed(1)};
}

// Neon rain: rain on the garden all round, on the tea-house roof above-left, on the pond ahead;
// drips from the eave, the gutter running over now and then, and the city far off to the right.
const PLACES={
  rain:()=>{
    // The garden: two distant stretches of one recording, one per ear, so the rain surrounds without a centre.
    const garden=[decode('rain',.1,30+FOLD,'highpass=f=150,highpass=f=150,highshelf=f=9000:g=-2'),decode('rain',28.7,30+FOLD,'highpass=f=150,highpass=f=150,highshelf=f=9000:g=-2')];
    // The roof: the same storm overhead, heavier in the body and duller through the tiles.
    const roof=decode('rain',12,26+FOLD,'highpass=f=180,highpass=f=180,equalizer=f=520:t=q:w=0.9:g=5,lowpass=f=6500');
    // The pond: the brook's small water sounds with the rain's fizz on the surface.
    const water=decode('brook',.3,23.2+FOLD,'highpass=f=300,lowpass=f=9000'),fizz=decode('rain',33,23.2+FOLD,'highpass=f=3500');
    const blend=.35*rms(water)/rms(fizz),pond=water.map((v,i)=>v+fizz[i]*blend);
    const gutter=[[2,4],[9,4],[16,4]].map(([start,length])=>edges(normaliseSpot(decode('brook',start,length,'highpass=f=300,lowpass=f=6000')),.4,.6));
    // Traffic from the first seventeen seconds only: voices come in after that.
    const city=[[1,4],[7,4],[13,4]].map(([start,length])=>edges(normaliseSpot(decode('city',start,length,'highpass=f=40,lowpass=f=1000')),.8,.9));
    return {
      garden:[normaliseBed(garden.map(fold)),112,44100],
      roof:[normaliseBed([fold(roof)]),80,32000],
      pond:[normaliseBed([fold(pond)]),80,32000],
      drips:[[slots(drips(8,.6),.6)],64,32000],
      gutter:[[slots(gutter,4)],64,32000],
      city:[[slots(city,4)],64,32000],
    };
  },
  // Last light station: wind in the snowy trees all round, a lantern hissing on its post to the left, the clock
  // ticking high on the left, a peal or a dog carried up from the village now and then, and the evening train.
  snow:()=>{
    // A calm stretch running into a gust, so the bed breathes; the high-pass takes out the wind's buffeting.
    const wind=decode('snowy-afternoon',30,32+FOLD,'highpass=f=70,highpass=f=70',2);
    const lantern=decode('propane-lantern',4,12+FOLD,'highpass=f=200,lowpass=f=7000');
    const clock=[.5,5.2,9.9].map(start=>edges(normaliseSpot(decode('grandfather-clock',start,3,'highpass=f=150,lowpass=f=8000')),.25,.4));
    // Moments of a peal, faded slowly at both ends: the wind carries them up from the valley and away again.
    const peal=[10,40,75].map(start=>edges(normaliseSpot(decode('church-peal',start,6,'highpass=f=250,lowpass=f=3000')),1.5,1.8));
    const dog=[7.3,19.4,63.15,72.95].map(start=>edges(normaliseSpot(decode('far-dog',start,2.5,'highpass=f=200,lowpass=f=2500')),.05,.6));
    // The train rolling past, from the loudest stretch of its pass.
    const train=decode('distant-train',10,12+FOLD,'highpass=f=40,lowpass=f=3000');
    return {
      wind:[normaliseBed(wind.map(fold)),96,44100],
      lantern:[normaliseBed([fold(lantern)]),64,32000],
      clock:[[slots(clock,3)],56,32000],
      peal:[[slots(peal,6)],56,32000],
      dog:[[slots(dog,2.5)],56,32000],
      train:[normaliseBed([fold(train)]),64,32000],
    };
  },
  // Golden hour: grass and the meadow's distant birds all round, the big tree's leaves above to the right, the pond
  // lapping below; a blackbird in the tree, by the arch and down the valley; bees by day and crickets as the light goes.
  meadow:()=>{
    const grass=decode('summer-meadow',60,26+FOLD,'highpass=f=80,highpass=f=80',2);
    // A stretch with one gust swelling through the leaves and dying back.
    const tree=decode('tree-in-wind',26,24+FOLD,'highpass=f=90');
    const pond=decode('lake-waves',14,20+FOLD,'highpass=f=120,lowpass=f=7000');
    const birds=[2.5,10,19.6,28.4,36.5].map(start=>edges(normaliseSpot(decode('blackbird',start,3.5,'highpass=f=600')),.1,.5));
    const bees=[8.5,12.5,24,30].map(start=>edges(normaliseSpot(decode('bumblebees',start,4,'highpass=f=90,lowpass=f=5000')),.6,.8));
    const crickets=[5,15,25,40].map(start=>edges(normaliseSpot(decode('night-crickets',start,3,'highpass=f=1500')),.7,.9));
    // House martins chirping on the wing, for the flock that crosses the sky.
    const martins=[1,4.5,8,12,16,20].map(start=>edges(normaliseSpot(decode('house-martins',start,2,'highpass=f=1500')),.15,.4));
    return {
      grass:[normaliseBed(grass.map(fold)),96,44100],
      tree:[normaliseBed([fold(tree)]),64,32000],
      pond:[normaliseBed([fold(pond)]),64,32000],
      birds:[[slots(birds,3.5)],56,32000],
      bees:[[slots(bees,4)],56,32000],
      crickets:[[slots(crickets,3)],56,32000],
      martins:[[slots(martins,2)],56,32000],
    };
  },
  // The last chapter: the bay washing on the rocks below, the harbour town's evening far off to the right; the
  // curtain stirring close on the left, the moored boat's chains, a bell buoy out on the bay, gulls and the boat's engine.
  coast:()=>{
    // The calmest stretch: elsewhere the waves slap under the rocks 30 dB over the wash, which would come through as pops.
    const sea=decode('sardinia-rocks',262.5,21+FOLD,'highpass=f=60,highpass=f=60',2);
    const town=decode('trogir-square',40,24+FOLD,'highpass=f=120,lowpass=f=3000');
    // Fabric slowed to four fifths, so it is a heavier curtain lifting rather than a flag.
    const curtain=[1.1,3.5,7.5,10.8].map(start=>edges(normaliseSpot(decode('fabric',start,2.4,'highpass=f=150,lowpass=f=5000,aresample=48000,asetrate=38400,aresample=48000',1,3)),.4,.7));
    const chains=[.3,2.9,4.5].map(start=>edges(normaliseSpot(decode('genova-chains',start,2.2,'highpass=f=200')),.1,.5));
    const buoy=[.5,3.9,23.6,54.75].map(start=>edges(normaliseSpot(decode('bell-buoy',start,2.6,'highpass=f=400,highpass=f=400,lowpass=f=6000')),.03,.6));
    const gulls=[2,5.4,7.8,24.5,39.6,51.6].map(start=>edges(normaliseSpot(decode('gulls-wildtrack',start,2.2,'highpass=f=400,highpass=f=400')),.1,.4));
    const engine=decode('marine-diesel',20,10+FOLD,'highpass=f=30,lowpass=f=1500');
    return {
      sea:[normaliseBed(sea.map(fold)),96,44100],
      town:[normaliseBed([fold(town)]),64,32000],
      curtain:[[slots(curtain,3)],56,32000],
      chains:[[slots(chains,2.2)],56,32000],
      buoy:[[slots(buoy,2.6)],56,32000],
      gulls:[[slots(gulls,2.2)],56,32000],
      engine:[normaliseBed([fold(engine)]),64,32000],
    };
  },
};

// `node scripts/encode-ambience.mjs snow coast` rebuilds just those places; encoded.json keeps the others' entries.
const only=process.argv.slice(2),unknown=only.filter(place=>!PLACES[place]);
if(unknown.length)throw new Error(`No sound recipe for ${unknown.join(', ')}.`);
const kept=only.length&&existsSync(`${out}/encoded.json`)?JSON.parse(readFileSync(`${out}/encoded.json`,'utf8')).filter(entry=>!only.includes(entry.place)):[];
const report=[];
for(const [place,make] of Object.entries(PLACES).filter(([place])=>!only.length||only.includes(place))) {
  mkdirSync(`${out}/${place}`,{recursive:true});
  const files=Object.entries(make()).map(([name,[channels,kbps,rate]])=>encode(`${out}/${place}/${name}.mp3`,channels,kbps,rate));
  const total=files.reduce((sum,f)=>sum+f.bytes,0);
  for(const f of files)console.log(f.file.padEnd(40),`${f.channels===2?'stereo':'mono  '} ${String(f.seconds).padStart(5)} s`,`${Math.round(f.bytes/1024)} KB`.padStart(7),`${f.levelDb} dB`,`peak ${f.peakDb} dB`);
  console.log(`${place}: ${(total/1e6).toFixed(2)} MB`);
  if(total>BUDGET)throw new Error(`${place} is ${(total/1e6).toFixed(2)} MB, over its 1.2 MB budget.`);
  report.push({place,total,files});
}
const written=report.map(({place,total,files})=>({place,bytes:total,files:files.map(({file,...rest})=>({file:file.slice(out.length+1),...rest}))}));
const order=Object.keys(PLACES);
writeFileSync(`${out}/encoded.json`,JSON.stringify([...kept,...written].sort((a,b)=>order.indexOf(a.place)-order.indexOf(b.place)),null,2)+'\n');
