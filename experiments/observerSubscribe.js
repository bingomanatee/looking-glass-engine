const { combineLatest, BehaviorSubject, from } = require('rxjs');


const b = new BehaviorSubject(0);
b.subscribe((value) => { console.log('b value:', value); }, () => {}, () => {
  console.log('stream done');
});

b.subscribe((value) => { console.log('b 2 value: ', value); });

b.next(1);
b.next(2);
b.complete();
