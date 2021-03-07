import {
  BehaviorSubject, from as fromEffect, Subject, from,
} from 'rxjs';
import {
  filter, map, tap, switchMap, catchError,
} from 'rxjs/operators';

import Event, { EventFilter } from './Event';
import {
  E_COMMIT, E_PRECOMMIT, E_FILTER, E_INITIAL, E_VALIDATE, A_NEXT, E_COMPLETE, A_ANY,
  defaultEventTree, eqÅ, Å, e, NOOP,
} from './constants';
import ValueStreamFast from './ValueStreamFast';

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
 * Most of the basic functionality it inherits from ValueStreamFast;
 * the code here adds event-driven update cycles to next.
 */

class ValueStream extends ValueStreamFast {
  /**
   *
   * @param value {any} the observed value of the stream.
   * @param options {Object} config options - mainly relevant in the ValueMapStream subclass
   */
  constructor(value, options = {}) {
    super(value, options);
    this._eventTree = new Map(defaultEventTree);

    // eslint-disable-next-line no-shadow
    const {
      filter: myFilter, finalize,
    } = options;
    if (typeof myFilter === 'function') {
      this.filter(myFilter);
    }

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
      this._$eventSubject.subscribe((evt) => {
        this._lastEvent = evt;
      }, NOOP);
    }
    return this._$eventSubject;
  }

  _watchEvents() {
    this.when(({ valueStream }) => {
      this._updateValue(valueStream.value);
      valueStream.complete();
    }, onNextCommit);
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
        if (this.debugFilter) console.log('error thrown in filter:', error, 'in event', event);
        event.error(error, event);
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

    const observer = this._eventSubject.pipe(
      filter((event) => {
        const out = test.matches(event);
        return out;
      }),
    );

    observer.subscribe((event) => {
      if (this.debug) console.log('doing ', event.toString(), fn.toString());
      fn(event, target);
    }, NOOP);

    return observer;
  }

  /**
   * initiate an event.
   * @param action {string} -- an action code
   * @param value {var}
   * @param stages {stages[]} -- optional array of stages that the event goes through
   */
  send(action, value, stages) {
    const actionStages = stages || this._eventTree.get(action) || this._eventTree.get(A_ANY);
    const onError = this._errorSubject.next.bind(this._errorSubject);
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
        next: (ev) => this._eventSubject.next(ev),
        error: (err) => {
          console.log('error in fromEffect:', err.message);
        },
        complete() {
          if (!event.isStopped) {
            event.complete();
          }
        },
      });
    return event;
  }

  /**
   * initiate a replacement value
   * @param value {any}
   */
  next(value) {
    this.send(A_NEXT, value);
  }
}

export default ValueStream;
