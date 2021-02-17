import { BehaviorSubject, from, Subject } from 'rxjs';
import {
  combineLatest, distinctUntilChanged, filter, map,
} from 'rxjs/operators';
import Event, { EventFilter } from './Event';
import {
  E_COMMIT, E_FILTER, E_INITIAL, E_VALIDATE, A_NEXT, E_COMPLETE, A_ANY,
  defaultEventTree, eqÅ, Å, e,
} from './constants';

import setProxy, { SET_AFTER, SET_BEFORE } from './setProxy';

export default (stream) => Object.assign(stream, {
  transStream: new BehaviorSubject(new Set()),
  addTrans(subject) {
    const setWithSubject = new Set(stream.transStream.value);
    setWithSubject.add(subject);
    stream.transStream.next(setWithSubject);
    const unTrans = () => {
      stream.finishTrans(subject);
    };
    subject.subscribe({
      complete: unTrans,
      error: unTrans,
    });
  },

  subscribe(...args) {
    return combineLatest(stream._valueSubject, stream.transStream)
      .pipe(
        map(([value, tSet]) => [value, tSet.size]),
        filter(([value, count]) => count < 1),
        map(([value]) => value),
      ).subscribe(...args);
  },

  finishTrans(subject) {
    const setWithoutSubject = new Set(stream.transStream.value);
    setWithoutSubject.remove(subject);
    stream.transStream.next(setWithoutSubject);
  },
});
