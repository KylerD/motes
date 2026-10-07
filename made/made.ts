import {counting,refOf,setCounting,track} from '../src/measure/analytics';

// Readers arriving from a launch post are counted like any other arrival. Nothing is stored.
track('$pageview',{ref:refOf(new URLSearchParams(location.search)),$referrer:document.referrer||undefined,page:'made'});

// The listener's switch for counting sits beside the words that explain it.
const WORDS={
  on:['Motes counts listening in this browser.','Stop counting my listening'],
  off:['Motes doesn’t count listening in this browser.','Count my listening again'],
  declined:['Your browser asks not to be tracked, so Motes counts nothing here.',''],
} as const;
const panel=document.querySelector<HTMLElement>('#counting')!,status=panel.querySelector('p')!,toggle=panel.querySelector('button')!;
function show() {
  const state=counting(),[text,action]=WORDS[state];
  status.textContent=text;toggle.textContent=action;toggle.hidden=state==='declined';panel.hidden=false;
}
toggle.addEventListener('click',()=>{setCounting(counting()==='off');show();});
show();
