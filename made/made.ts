import {refOf,track} from '../src/measure/analytics';

// Readers arriving from a launch post are counted like any other arrival. Nothing is stored.
track('$pageview',{ref:refOf(new URLSearchParams(location.search)),$referrer:document.referrer||undefined,page:'made'});
