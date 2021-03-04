import lGet from 'lodash/get';
import { ABSENT, e, Å } from './constants';

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

  get params() {
    return this._params || [];
  }

  get notes() {
    if (!this._notes) this._notes = new Map();
    return this._notes;
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

  get isActive() {
    return !this.valueStream.isStopped && !this.valueStream.hasError;
  }

  get isStopped() {
    return lGet(this.valueStream, 'isStopped');
  }

  get thrownError() {
    return lGet(this.valueStream, 'thrownError');
  }

  next(value) {
    if (this.isActive) {
      this.valueStream.next(value);
    } else throw e('attempt to update a stalled stream', this);
  }

  error(error) {
    if (this.isActive) {
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

  toString() {
    const list = ['<<'];
    if (this.action !== Å) list.push('action: ', this.action.toString());
    if (this.stage !== Å) list.push('stage:', this.stage.toString());
    if (this.value !== Å) list.push('value', this.value.toString());
    list.push('>>');
    return list.join(' ');
  }

  get list() {
    return [this.thrownError, this.value];
  }
}

Event.toEvent = (data) => {
  if (!data) return new Event({});
  if (data instanceof Event) return data;
  if (Array.isArray(data)) return new Event(...data);
  return new Event(data);
};

export default Event;
