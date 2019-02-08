import lGet from 'lodash.get';

export default (bottle) => {
  bottle.factory('ChangePromise', ({ isPromise, isSet, NOT_SET }) => {
    /**
     * note a change promise is both a token that gets seeded through the change cycle of stores
     * and a "Promise" -- it has the signature of a promise and behaves like one.
     *
     * When it's been fulfilled, calling _resolve will conclude the ChangePromise instance.
     * On an error, calling reject will abort the ChangePromise instance.
     */

    let nextId = 0;

    class ChangePromise {
      constructor(change = NOT_SET, info = {}) {
        if (typeof change === 'undefined') change = NOT_SET;
        nextId += 1;
        this.id = nextId;
        const executor = (done, fail) => {
          this._done = done;
          this._fail = fail;
        };
        this._resolved = false;

        this.promise = new Promise(executor);
        // note - the ORIGINAL change request (function, promise, etc.) is kept as change.
        // at it is unravelled the current value is kept in value;

        this.change = change;
        this.value = change;

        this.info = info === NOT_SET ? {} : info;
      }

      get resolved() {
        return this._resolved;
      }

      get noop() {
        return lGet(this, 'info.noop', false);
      }

      get status() {
        return lGet(this, 'info.status', NOT_SET);
      }

      /**
       * _resolve (optionally) sets the final value of the change
       * and closes the promise. It can only execute once.
       *
       * If value is (or is set to) a value then the change
       * resolves that value and takes the result as the change's value
       * then returns it.
       *
       * @param value {variant} optional
       * @returns {Promise}
       */
      resolve(value = NOT_SET) {
        if (this.resolved) {
          return this.promise;
        }
        if (value !== NOT_SET) {
          this.value = value;
        }

        if (isPromise(this.value)) {
          return this.value.then(unravelled => this.resolve(unravelled));
        }

        this._resolved = true;
        this._done(this.value);
        return this.promise;
      }

      reject(value = NOT_SET) {
        if (this.resolved) {
          console.log('ChangePromise reject called with ', value, 'after _resolve');
          return this.promise;
        }

        this._resolved = true;
        if (value !== NOT_SET) this.error = value;
        try {
          this._fail(this.error);
        } catch (err) {
          console.log('error:', err);
        }
        return this.promise;
      }

      then(...args) {
        return this.promise.then(...args);
      }

      catch(listener) {
        return this.promise.catch(listener);
      }
    }

    return ChangePromise;
  });

  bottle.factory('change', ({ ChangePromise }) => (newValue, params = {}) => new ChangePromise(newValue, params));
};
