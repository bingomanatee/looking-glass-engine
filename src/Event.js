import isEqual from 'lodash/isEqual';
import lGet from 'lodash/get';
import { BehaviorSubject } from 'rxjs';
import { ABSENT, Å, e } from './constants';
import matchEvent from './matchEvent';
/**
 * Event is a subject that is emitted through a staging sequence
 * to effect change on ValueStreams. Its value can be updated on the fly by listeners
 * via next(value), and it can be cancelled in mid-flight through complete(); or error();
 */
class Event {
  /**
   *
   * @param action {any}
   * @param valueStream {any}
   * @param stage {any}
   * @param target {any}
   */
  constructor(action, valueStream, stage, target) {
    if (typeof action === 'object') {
      this._initParams(action);
    } else {
      this._initArgs(action, valueStream, stage, target);
    }
    this.target = target;
  }

  _initParams({
    action = ABSENT,
    valueStream = ABSENT,
    stage = ABSENT,
  }) {
    this._initArgs(action, valueStream, stage);
  }

  _initArgs(action = Å, valueStream = Å, stage = Å, target = Å) {
    this.action = action;
    this.valueStream = valueStream;
    this.stage = stage;
    this.target = target;
    this.completed = [];
  }

  set stage(v) {
    if (this.stage) this.completed.push(this.stage);
    this._stage = v;
  }

  get stage() {
    return this._stage;
  }

  get value() {
    try {
      return this.valueStream.getValue();
    } catch (err) {
      return Å;
    }
  }

  get thrownError() {
    return this.valueStream.thrownError;
  }

  get activeStream() {
    return !this.valueStream.isStopped && !this.valueStream.hasError;
  }

  get isStopped() {
    return this.valueStream.isStopped;
  }

  next(value) {
    if (this.activeStream) {
      this.valueStream.next(value);
    } else throw e('attempt to update a stalled stream', this);
  }

  error(error) {
    if (this.activeStream) {
      if (this.valueStream === ABSENT) {
        console.warn('attempting to throw error on absent stram', error);
        throw error;
      }
      this.valueStream.error(error);
    } else {
      console.error('cannot register an error on suspended stream', error, this);
    }
  }

  complete() {
    if (this.valueStream) this.valueStream.complete();
  }

  subscribe(...args) {
    if (this.valueStream) return this.valueStream.subscribe(...args);
    throw e('attempted to subscribe to a stream-less Event', this);
  }

  valueToString() {
    try {
      if (this.value === null) return 'null';
      if (typeof this.value === 'undefined') {
        return 'undefined';
      }
      if (typeof this.value === 'object') {
        if (this.value instanceof Map) {
          const entries = [...this.value.entries()];
          const props = { ...this.value };
          return JSON.stringify({
            entries, props,
          });
        }
        if (typeof this.value.toString === 'function') return this.value.toString();
      }

      return `${this.value}`;
    } catch (err) {
      console.log('error in valueToString:', err.message);
      return `${this.value}`;
    }
  }

  toString() {
    const list = ['<<'];
    if (this.action !== Å) list.push('action: ', this.action.toString());
    if (this.stage !== Å) list.push('stage:', this.stage.toString());
    if (this.value !== Å) list.push('value', this.valueToString());
    list.push('>>');
    return list.join(' ');
  }
}

Event.toEvent = (data) => {
  if (!data) throw new Error('toEvent requires data');
  if (data instanceof Event) return data;
  if (Array.isArray(data)) return new Event(...data);
  return new Event(data);
};

export default Event;
