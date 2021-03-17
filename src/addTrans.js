import { BehaviorSubject, from, Subject } from 'rxjs';
import {
  combineLatest, distinctUntilChanged, filter, map,
} from 'rxjs/operators';

export default (stream) => Object.assign(stream, {
  _transStream: new BehaviorSubject(new Set()),
  addTrans(subject) {
    if (!subject) subject = new Subject();
    const setWithSubject = stream._transStream.value;
    setWithSubject.add(subject);
    stream._transStream.next(setWithSubject); // it continually emits the same set, with different members
    const unTrans = () => {
      stream.finishTrans(subject);
    };
    subject.subscribe({
      complete: unTrans,
      error: unTrans,
    });
    return subject;
  },

  subscribe(...args) {
    return combineLatest([stream._valueSubject, stream._transStream])
      .pipe(
        map(([value, tSet]) => [value, tSet.size]),
        filter(([value, size]) => size < 1),
        map(([value]) => value),
        distinctUntilChanged(),
      ).subscribe(...args);
  },

  doTrans(fn, ...args) {
    if (!(typeof fn === 'function')) {
      throw e('doTrans requires a function', this);
    }

    const subject = this.addTrans();

    let result = null;
    try {
      result = fn(subject, ...args);
    } catch (err) {
      if (!subject.isStopped) {
        subject.error(err);
      } // also completes transaction
      throw err;
    }
    if (!subject.isStopped) {
      subject.complete();
    }
    return result;
  },

  finishTrans(subject) {
    const setWithoutSubject = new Set(stream._transStream.value);
    if (!setWithoutSubject.has(subject)) return;
    setWithoutSubject.remove(subject);
    stream._transStream.next(setWithoutSubject);
  },
});
