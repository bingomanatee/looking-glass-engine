import {
  BehaviorSubject, from as fromEffect, Subject, from,
} from 'rxjs';
import isEqual from 'lodash/isEqual';
import {
  filter, map, tap, switchMap, catchError,
} from 'rxjs/operators';
import lGet from 'lodash/get';
import Event from './Event';
import EventFilter from './EventFilter';

/**
 * A streaming state system. It has the external features of a BehaviorSubject.
 * Unlike ValueStream, ValueStreamBase forgoes events; this means no filtering, finalize,
 * or interrupts to the updating of the Streams.
 *
 * This trades off increased speed and decreased
 * memory usse against a more limited feature set.
 */
class ValueStreamFast {
  /**
   *
   * @param value {any} the observed value of the stream.
   * @param options {Object} config options - mainly relevant in the ValueMapStream subclass
   */
  constructor(value, options = {}) {
    this._valueSubject = new BehaviorSubject(value);
    this._errorStream = new Subject()
      .pipe(
        map((errorDef) => {
          if (errorDef.error && errorDef.error.message && !errorDef.message) {
            return { ...errorDef, message: errorDef.error.message };
          }
          return errorDef;
        }),
      );
    // eslint-disable-next-line no-shadow
    const {
      name, debug = false, finalize,
    } = options;
    this.name = name || (`state_${Math.random()}`);
    this.debug = debug;
  }

  /**
   * emit an error to subscribes.
   * @param error {Error}
   * @param event
   * @returns {ValueStream|*}
   */
  error(error, event) {
    if (lGet(error, 'error')) {
      this._errorStream.next({ ...error, target: this });
    } else {
      this._errorStream.next({
        target: this,
        event,
        error,
      });
    }
    return this;
  }

  _updateValue(value) {
    this._valueSubject.next(value);
  }

  get isStopped() {
    return this._valueSubject.isStopped;
  }

  get closed() {
    return this._valueSubject.closed;
  }

  /**
   * initiate a replacement value
   * @param value {any}
   */
  next(value) {
    this._updateValue(value);
  }

  /**
   * passthrough to the valueStream's value
   * @returns {any}
   */
  get value() {
    return this._valueSubject.value;
  }

  /**
   * imitating BehaviorSubject's API; returns the current value;
   * @returns {*}
   */
  getValue() {
    return this.value;
  }

  /**
   * shuts down the valueStream, freezing its value and preventing updates
   */
  complete() {
    this._valueSubject.complete();
    this._errorStream.complete();
  }

  /**
   * Subscribe to updates.
   * @param onNext {function}
   * @param onError {function}
   * @param onComplete {function}
   * @returns {Subscription}
   */
  subscribe(onNext, onError, onComplete) {
    if (this.isStopped) {
      throw new Error('cannot subscribe to a stopped stream');
    }
    if (typeof onNext === 'object') {
      const { next, error, complete } = onNext;
      return this.subscribe(next, error, complete);
    }

    let failSub;
    if (typeof onError === 'function') {
      failSub = this._errorStream.subscribe(onError);
    }

    const manifest = {
      complete: () => {
        if (failSub) {
          failSub.unsubscribe();
          if (typeof onComplete === 'function') {
            onComplete();
          }
        }
      },
    };
    if (typeof onError === 'function') {
      manifest.error = onError;
    }

    if (typeof onNext === 'function') {
      manifest.next = onNext;
    }

    return this._valueSubject.subscribe(manifest);
  }

  /**
   * allows for post-filtering or augmentation of streaming events
   * @param args
   * @returns {Observable<unknown>}
   */
  pipe(...args) {
    return this._valueSubject.pipe(...args);
  }
}

export default ValueStreamFast;
