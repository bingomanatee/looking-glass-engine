const { combineLatest, BehaviorSubject, from } = require('rxjs');


const b = new BehaviorSubject(0);
b.subscribe((value) => { console.log('b value:', value); }, () => {}, () => {
  console.log('stream done');
});

b.next(1);
b.next(2);
b.next(3);
b.complete();
console.log('--- done');
