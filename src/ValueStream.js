import {
  BehaviorSubject, from as fromEffect, Subject, combineLatest,
} from 'rxjs';
import { filter, map, timeout } from 'rxjs/operators';

import Event from './Event';
import {
  A_ANY, A_NEXT, defaultEventTree, e, E_FILTER, NOOP, Å,
} from './constants';
import ValueStreamFast from './ValueStreamFast';
import { onNextCommit, onPreCommitNext } from './triggers';
import matchEvent from './matchEvent';

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
    this.debugTrans = !!options.debugTrans;
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

  get _eventTree() {
    if (!this._$eventTree) {
      this._$eventTree = new Map(defaultEventTree);
    }
    return this._$eventTree;
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
    this.when((valueStream) => {
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

  /**
   * Executes a function on an event under specific conditions.
   * @param fn
   * @param onAction
   * @param onStage
   * @param onValue
   * @returns {subscriber}
   *
   * note - you can STOP the observation by calling `.complete()` on the returned observer.
   *
   */
  on(fn, onAction = A_NEXT, onStage = E_FILTER, onValue = Å) {
    if (typeof fn !== 'function') {
      throw e('on() requires function', fn);
    }
    if ((typeof onAction === 'function')) {
      return this.when(fn, onAction);
    }
    const test = matchEvent({
      action: onAction,
      stage: onStage,
      value: onValue,
    });

    return this.when(fn, test);
  }

  /**
   * This is a simpler event filter; it occurs when test(event) is true.
   * tests can be produced through matchEvent(as in "on" above) or can be
   * a custom user test.
   *
   * @param fn {function}
   * @param test {function}
   * @returns {subscriber}
   */
  when(fn, test) {
    if (!(typeof fn === 'function')) {
      throw e('when() requires function', fn);
    }

    const target = this;
    const observer = this._eventSubject.pipe(
      filter((event) => {
        try {
          return test(event);
        } catch (err) {
          console.log('filter error: ', err);
          event.error(err);
          return false;
        }
      }),
    );

    observer.subscribe((event) => {
      try {
        fn(event, target);
        if (this.debug) console.log('when:performed ', event.toString(), fn.toString());
      } catch (err) {
        if (this.debug) {
          console.log('---- when:error performed ', fn.toString(), ': ', err.message);
        }
        event.error(err);
      }
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
    const event = new Event(
      value, {
        action,
        stages: actionStages[0],
        target: this,
      },
    );
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

  get _transSubject() {
    if (!this._$transSubject) {
      this._$transSubject = new BehaviorSubject(new Set());
    }
    return this._$transSubject;
  }

  remTrans(subject) {
    if (!subject) return;
    const transSet = this._transSubject.value;
    transSet.delete(subject);
    this._transSubject.next(transSet);
  }

  /**
   * temporarily suspend emission of value of the stream until the trans is completed.
   *
   * note -- this will NOT block events from occuring  --
   * but it WILL block the value from being changed until the transaction completees.
   * just the broadcasting of changes to subscribers.
   *
   * You can provide your own subject to addTrans -- or take a generic one which will be created for you.
   *
   * so all of these calls are valid:
   *
   * - myStream.trans() -- returns a subject that expires in one second
   * - myStream.trans(10000) -- returns a subject that expires in ten seconds
   * - myStream.trans(-1) -- returns a non-expiring transaction subject
   * - myStream.trans(mySubject) -- returns mySubject -- which will be completed in one second
   * - myStream.trans(mySubject, -1) -- returns mySubject which won't be forced to expire ever
   * - myStream.trans(mySubject, 10000) -- returns mySubject, which will be foreced to expire in ten seconds
   *
   * By default, the transaction will die in one second (as defined by the lifespan parameter).
   * If you want to keep the transaction alive indefinately, pass -1 to the second parameter.
   *
   * If the subject expires, it will also un-block the transaction stream.
   *
   * @param subject
   * @param lifespan
   * @returns {Subject<T>}
   *
   * trans() can be called multiple times; in that scenario the emission will block
   * until *all* the returned subjects complete/expire.
   */
  trans(subject, lifespan = 1000) {
    if (typeof subject === 'number') {
      lifespan = subject;
      subject = null;
    }
    if (!subject) subject = new Subject();
    if (lifespan > 0) {
      subject = subject.pipe(timeout(lifespan));
    }
    // if lifespan is exactly zero, complete current thread then stop the transaction.
    if (lifespan === 0) {
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => {
          if (!subject.isStopped) {
            subject.complete();
          }
        });
      } else {
        subject = subject.pipe(timeout(1));
      }
    }
    const transSet = this._transSubject.value;
    transSet.add(subject);
    this._transSubject.next(transSet);
    const remTrans = this.remTrans.bind(this);

    subject.subscribe({
      error() {
        remTrans(subject);
      },
      complete() {
        remTrans(subject);
      },
    });
    return subject;
  }

  get _baseSubject() {
    if (!this._$baseSubject) {
      this._$baseSubject = new BehaviorSubject(null);
      const valueSubject = this._valueSubject;
      const errorSubject = this._errorSubject;
      const { debugTrans } = this;
      this._$baseSubjectObserver = combineLatest(this._$baseSubject, this._transSubject)
        .pipe(
          filter(([values, trans]) => {
            if (debugTrans) console.log('filtering trans: size = ', trans.size);

            return trans.size < 1;
          }),
          map(([value]) => value),
        ).subscribe({
          next(value) {
            if (debugTrans) console.log('passing on value to valueSubject: ', value);
            valueSubject.next(value);
          },
          error(err) {
            errorSubject.next(err);
          },
          complete() {
            this._valueSubject.complete();
          },
        });
    }
    return this._$baseSubject;
  }

  _updateValue(value) {
    this._baseSubject.next(value);
  }
}

export default ValueStream;
