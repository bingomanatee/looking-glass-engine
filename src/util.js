import {BehaviorSubject} from 'rxjs';
import {filter, map, pairwise} from 'rxjs/operators';
import Preact from 'preact';

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

  bottle.factory('diffStream', ({}) => {
    return () => {
      let stream = new BehaviorSubject()
        .pipe(
          pairwise(),
          filter(([a, b]) => {
            return a !== b;
          }),
          map(([a, b]) => b)
        );
      stream.next(null);
      return stream;
    };
  });

  bottle.factory('update', () => {
    return function (delta) {
      return (context) => Object.assign({}, context.state, delta(context));
    };
  });
};
