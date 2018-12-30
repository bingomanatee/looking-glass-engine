const {
  Observable,
} = require('rxjs');
const { delay } = require('rxjs/operators');

const obs = Observable.create(async (listener) => {
  listener.next('first message');
 await  new Promise((done) => {
    setTimeout(done, 1000);
  });
  listener.next('second message');
  listener.complete();
})
  .subscribe(m => console.log('message:', m), e => console.log('error: ', e), () => {
    console.log('done');
  });

