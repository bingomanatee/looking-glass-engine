/* eslint-disable no-unreachable */
import { BehaviorSubject } from 'rxjs';

export default (bottle) => {
  bottle.factory('Store', ({
    STORE_STATE_UNSET_VALUE,
    STORE_STATUS_NEW,
    STORE_STATUS_INITIALIZING,
    STORE_STATUS_INITIALIZATION_ERROR,
    STORE_STATUS_STOPPED,
    STORE_STATUS_INITIALIZED,
    NOT_SET,
    ChangePromise,
  }) => {
    class Store {
      constructor({ initialValue = STORE_STATE_UNSET_VALUE, initializer = NOT_SET }) {
        this.errorStream = new BehaviorSubject(false);
        this.stream = new BehaviorSubject(initialValue);
        try {
          this._state = initialValue;
          this._initializer = initializer;
          this._status = initializer !== NOT_SET ? STORE_STATUS_NEW : STORE_STATUS_INITIALIZED;
        } catch (err) {
          this.onError(err);
        }
      }

      /* ----------------- PROPERTIES --------------------- */

      get status() { return this._status; }

      get state() { return this._state; }

      /* ----------------- METHODS ------------------------ */

      update(change, info = NOT_SET) {
        if (!(change instanceof ChangePromise)) {
          change = new ChangePromise(change, info);
        }
      }

      afterStart(info) {
        return this.after('Start', info);
      }

      afterStop(info) {
        return this.after('Stop', info);
      }

      afterInitError(info) {
        return this.after('InitError', info);
      }

      after(what, info = 'tried to change') {
        if (typeof info === 'string') {
          return this.after(what, new Error(info));
        }
        if (!what) what = this._status.toString();
        this.errorStream.next({ source: `after${what}`, error: info });
        return info;
      }

      start() {
        if (!this._startPromise) {
          switch (this.status) {
            case STORE_STATUS_NEW:
              if (typeof this._initializer !== 'function') {
                console.log('bad initializer', this._initializer, this);
                this.onError('bad initializer');
              }
              this._startPromise = this.update(this._initializer, { status: STORE_STATUS_INITIALIZING })
                .then(this.update(NOT_SET, { status: STORE_STATUS_INITIALIZED }));
              break;

            case STORE_STATUS_INITIALIZING:
              return Promise.reject(this.afterStart('tried to initialize after starting'));
              break;

            case STORE_STATUS_INITIALIZED:
              return Promise.resolve(this.state);
              break;

            case STORE_STATUS_INITIALIZATION_ERROR:
              return Promise.reject(this.afterInitError('tried to initialize after error'));
              break;

            case STORE_STATUS_STOPPED:
              return Promise.reject(this.afterStop('tried to initialize after stopped'));
              break;

            default:
              console.log('strange status: ', this.status);
              return Promise.reject(new Error(`strange status: ${this.status.toString()}`));
          }
        }

        return this._startPromise;
      }

      stop() {
        this._status = STORE_STATUS_STOPPED;
      }

      onError() {
        this._status = STORE_STATUS_INITIALIZATION_ERROR;
        this.errorStream.next(new Error('bad initializer'));
      }
    }

    return Store;
  });
};
