import { from, race } from 'rxjs';
import { delay } from 'rxjs/operators';
import nameRegex from './nameRegex';

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

  /**
   * converts a POJO into an official JavaScript map.
   */
  bottle.factory('asMap', () => (item) => {
    if (!item) return new Map();
    if (item instanceof Map) return item;
    if (typeof item === 'object') {
      return Object.keys(item).reduce((map, key) => {
        const value = item[key];
        map.set(key, value);
        return map;
      }, new Map());
    }
    console.log('asMap cannot process ', item);
    return new Map();
  });

  bottle.factory('asValue', ({ NOT_SET }) => (value, defaultValue = null) => {
    if ((!value) || (value === NOT_SET)) return defaultValue;
    return value;
  });

  bottle.constant('NOOP', a => a);

  /**
   * This detects some specific falsines conditions.
   */
  bottle.factory('isSet', ({ NOT_SET }) => (value) => {
    if (value === NOT_SET) return false;
    if (typeof value === 'undefined') return false;
    if (value === null) return false;
    return true;
  });

  bottle.factory('isObject', ({ isSet }) => (value) => {
    if (!isSet(value)) return false;
    return typeof value === 'object';
  });

  bottle.factory('isFnName', () => (str) => {
    if (!str) return false;
    if (!(typeof str === 'string')) return false;
    return nameRegex.test(str);
  });

  bottle.factory('isFunction', () => item => typeof item === 'function');

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
