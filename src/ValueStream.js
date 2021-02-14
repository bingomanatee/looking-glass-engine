import {
  BehaviorSubject, from as fromEffect, Subject, from,
} from 'rxjs';
import isEqual from 'lodash/isEqual';
import {
  filter, map, tap, switchMap, catchError,
} from 'rxjs/operators';
import lGet from 'lodash/get';
import Event, { EventFilter } from './Event';
import {
  E_COMMIT, E_PRECOMMIT, E_FILTER, E_INITIAL, E_VALIDATE, A_NEXT, E_COMPLETE, A_ANY,
  defaultEventTree, eqÅ, Å, e,
} from './constants';

const onNextCommit = new EventFilter({
  action: A_NEXT,
  stage: E_COMMIT,
});

const onPreCommitNext = new EventFilter({
  action: A_NEXT,
  stage: E_PRECOMMIT,
});

/**
 * A streaming state system. It has the external features of a BehaviorSubject.
 */
class ValueStream {
  /**
   *
   * @param value {any} the observed value of the stream.
   * @param options {Object} config options - mainly relevant in the ValueMapStream subclass
   */
  constructor(value, options = {}) {
    this._valueSubject = new BehaviorSubject(value);
    this._eventTree = new Map(defaultEventTree);

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
      filter: myFilter, name, debug = false, finalize,
    } = options;
    if (typeof myFilter === 'function') {
      this.filter(myFilter);
    }
    this.name = name || (`state_${Math.random()}`);
    this.debug = debug;

    if (typeof finalize === 'function') {
      this.finalize(finalize);
    }
    this._watchEvents();
  }

  /**
   *
   * override the stages that a particular action goes through.
   * WARNING: its inadvisable to do this with built-in actions unless you ADD to
   * the events and leave the base ones intact.
   *
   * @param action
   * @param stages {strings[]} the stages that a particular action passes through.
   */
  setStages(action, stages) {
    if (!Array.isArray(stages) || (!stages.length)) {
      throw new Error('setStages requires a non-empty array');
    }
    this._eventTree.set(action, stages);
  }

  get _eventSubject() {
    if (!this._$eventSubject) {
      this._$eventSubject = new Subject();
    }
    return this._$eventSubject;
  }

  get _eventStream() {
    if (!this._$eventStream) {
      this._$eventStream = new Subject()
        .pipe(
          switchMap((value) => new BehaviorSubject(value)),
          catchError(() => fromEffect([Å])),
          filter((anEvent) => anEvent instanceof Event),
        );
    }

    return this._$eventStream;
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

  _watchEvents() {
    this.when(({ valueStream }) => {
      this._updateValue(valueStream.value);
      valueStream.complete();
    }, onNextCommit);
  }

  _updateValue(value) {
    this._valueSubject.next(value);
  }

  /**
   * update values; unlike when/on observers,
   * this message receives a raw value and returns
   * a new value.
   *
   * @param fn {function}
   * @returns {ValueStream}
   */
  filter(fn) {
    const target = this;
    return this.on(((event) => {
      try {
        const next = fn(event.value, event, this);
        event.next(next);
      } catch (error) {
        event.error(error);
      }
    }), A_NEXT, E_FILTER);
  }

  /**
   * listen for final commission of values.
   *
   * @param finalize {function}
   * @returns {ValueStream}
   */
  finalize(finalize) {
    return this.when(finalize, onPreCommitNext);
  }

  on(fn, onAction = A_NEXT, onStage = E_FILTER, onValue = Å) {
    if (typeof fn !== 'function') {
      throw e('on() requires function', fn);
    }
    if (onAction instanceof EventFilter) {
      return this.when(fn, onAction);
    }
    const test = new EventFilter({
      action: onAction,
      stage: onStage,
      value: onValue,
    });

    return this.when(fn, test);
  }

  /**
   *
   * @param fn {function}
   * @param test {EventFilter}
   * @returns {subscriber}
   */
  when(fn, test) {
    if (!(typeof fn === 'function')) {
      throw e('when() requires function', fn);
    }
    if (!(test instanceof EventFilter)) throw e('cannot call when() without a formal event filter', test);

    const target = this;

    const observer = this._eventStream.pipe(
      filter((event) => {
        const out = test.matches(event);
        if (this.debug && out) {
          console.log('matched', event.toString(), 'to:', fn.toString());
        }
        return out;
      }),
    );

    observer.subscribe((event) => {
      if (this.debug) console.log('doing ', event.toString(), fn.toString());
      fn(event, target);
    });

    return observer;
  }

  get isStopped() {
    return this._valueSubject.isStopped;
  }

  get closed() {
    return this._valueSubject.closed;
  }

  /**
   * initiate an event.
   * @param action {string} -- an action code
   * @param value {var}
   * @param stages {stages[]} -- optional array of stages that the event goes through
   */
  send(action, value, stages) {
    const actionStages = stages || this._eventTree.get(action) || this._eventTree.get(A_ANY);
    const onError = this._errorStream.next.bind(this._errorStream);
    const event = new Event(action, new BehaviorSubject(value), actionStages[0], this);
    event.subscribe({ error: onError });
    fromEffect(actionStages)
      .pipe(
        // eslint-disable-next-line no-unused-vars
        map((stage) => {
          event.stage = stage;
          return event;
        }),
        filter((ev) => !ev.isStopped),
      )
      .subscribe({
        next: (ev) => this._eventStream.next(ev),
        complete() {
          if (!event.isStopped) {
            event.complete();
          }
        },
      });
  }

  /**
   * initiate a replacement value
   * @param value {any}
   */
  next(value) {
    this.send(A_NEXT, value);
  }

  /**
   * passthrough to the valueStream's value
   * @returns {any}
   */
  get value() {
    return this._valueSubject.value;
  }

  /**
   * for legacy code; returns the current value;
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
  }

  /**
   * Subscribe to updates.
   * @param onNext {function}
   * @param onError {function}
   * @param onComplete {function}
   * @returns {Subscription}
   */
  subscribe(onNext, onError, onComplete) {
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

export default ValueStream;
