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
      fn(args);
    }
  });

  bottle.factory('update', () => function (delta) {
    return (actions, ...args) => (state) => {
      const change = delta(actions, ...args)(state);
      return Object.assign({}, state, change);
    };
  });

  bottle.factory('isPromise', () => (subject) => {
    if (!subject) return false;
    if (subject instanceof Promise) return true;
    return Promise.resolve(subject) === subject;
  });

  bottle.factory('mergeIntoState', () => change => state => Object.assign({}, state, change));
};
