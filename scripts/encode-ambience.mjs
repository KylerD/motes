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
const SOURCES={
  rain:{url:ambie+'rain.wav',sha256:'5a68ea94b6e1d83e77db80fbc55d7c2f7abef192879dfb6a9b859c1c3f753fa0'},
  brook:{url:ambie+'creek.wav',sha256:'3926d7cf09975740dc39baec395a4117ea06a8f4a322978a44798b3245863777'},
  city:{url:ambie+'citystreet.wav',sha256:'05346bcef4768a8a5590a2bf64b21301f9832212f19bd351e3c6b805ae23b353'},
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

/** Decode a stretch of a recording to mono 48 kHz floats through an FFmpeg filter chain. */
function decode(name,start,seconds,filters='') {
  const args=['-v','error','-ss',String(start),'-t',String(seconds),'-i',source(name),'-ac','1','-ar',String(RATE)];
  if(filters)args.push('-af',filters);
  const result=spawnSync('ffmpeg',[...args,'-f','f32le','-'],{maxBuffer:1<<30});
  if(result.status!==0)throw new Error(result.stderr.toString());
  const bytes=result.stdout;
  const samples=new Float32Array(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
  if(samples.length<Math.floor((seconds-.01)*RATE))throw new Error(`${name} is shorter than ${start+seconds}s`);
  return samples.subarray(0,Math.floor(seconds*RATE));
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
};

const report=[];
for(const [place,make] of Object.entries(PLACES)) {
  mkdirSync(`${out}/${place}`,{recursive:true});
  const files=Object.entries(make()).map(([name,[channels,kbps,rate]])=>encode(`${out}/${place}/${name}.mp3`,channels,kbps,rate));
  const total=files.reduce((sum,f)=>sum+f.bytes,0);
  for(const f of files)console.log(f.file.padEnd(40),`${f.channels===2?'stereo':'mono  '} ${String(f.seconds).padStart(5)} s`,`${Math.round(f.bytes/1024)} KB`.padStart(7),`${f.levelDb} dB`,`peak ${f.peakDb} dB`);
  console.log(`${place}: ${(total/1e6).toFixed(2)} MB`);
  if(total>BUDGET)throw new Error(`${place} is ${(total/1e6).toFixed(2)} MB, over its 1.2 MB budget.`);
  report.push({place,total,files});
}
writeFileSync(`${out}/encoded.json`,JSON.stringify(report.map(({place,total,files})=>({place,bytes:total,files:files.map(({file,...rest})=>({file:file.slice(out.length+1),...rest}))})),null,2)+'\n');
