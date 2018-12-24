const {
  combineLatest, BehaviorSubject, from, Observable, ErrorObserver, of, race,
} = require('rxjs');
const { delay } = require('rxjs/operators');

const now = Date.now();
const t = from([false, new Error('t1')]).pipe(delay(10000));
const t2 = from(new Promise((y, n) => {
  setTimeout(() => y('done'), 5000);
}));
const s = race(t, t2);

s.subscribe(m => console.log('m:', m, 'delay: ', Date.now() - now), e => console.log('error:', e), () => {
  console.log('done');
});
