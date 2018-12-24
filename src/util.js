import { from, race } from 'rxjs';
import { delay } from 'rxjs/operators';

export default (bottle) => {
  /**
   * decomposes a promise into result and error;
   * returns these in an array which also has properties of result and error,
   * so
   *
   * const [result, error] = p(promiseFn())
   *
   * is valid as is
   *
   * const {result, error} = p(promiseFn());
   *
   * accepts a promise, or a function that is called with the remaining arguments.
   */
  bottle.factory('p', () => async (first, ...args) => {
    let error = null;
    let result;
    try {
      if (typeof first === 'function') {
        result = await first(...args);
      } else {
        result = await (first);
      }
    } catch (err) {
      error = err;
    }
    const out = [result, error];
    out.result = result;
    out.error = error;
    return out;
  });

  bottle.factory('call', () => (fn, ...args) => {
    if (fn && typeof fn === 'function') {
      return fn(args);
    }
    return null;
  });

  bottle.factory('explodePromise', ({ NOT_SET, isPromise }) => (promise) => {
    let done = NOT_SET;
    let fail = NOT_SET;

    if (isPromise(promise)) {
      done = (...args) => [...args];
      fail = (...args) => [...args];
      promise.then(done).catch(fail);
    } else promise = new Promise((d, f) => { done = d; fail = f; });

    return Object.assign([promise, done, fail], { done, fail, promise });
  });

  bottle.factory('update', () => function (delta) {
    return (actions, ...args) => (state) => {
      const change = delta(actions, ...args)(state);
      return Object.assign({}, state, change);
    };
  });

  bottle.factory('obj', () => (key, value) => {
    const out = {};
    out[key] = value;
    return out;
  });

  bottle.constant('NOOP', a => a);

  bottle.factory('isPromise', () => (subject) => {
    if (!subject) return false;
    if (subject instanceof Promise) return true;
    return Promise.resolve(subject) === subject;
  });

  bottle.factory('functionCombine', ({ call }) => (f1, f2) => async (...args) => {
    await call(f1, ...args);
    return call(f2, ...args);
  });

  bottle.factory('mergeIntoState', () => change => state => Object.assign({}, state, change));

  bottle.factory('timeLimitObservable', () => (observable, delayTime = 1000, errorMessage) => {
    const killSwitch = from([false, new Error(errorMessage || `took over ${delayTime / 1000} secs`)])
      .pipe(delay(delayTime));

    return race(observable, killSwitch);
  });
};
