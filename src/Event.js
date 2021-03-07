import isEqual from 'lodash/isEqual';
import lGet from 'lodash/get';
import { ABSENT, Å, e } from './constants';

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
  if (!data) return new Event({});
  if (data instanceof Event) return data;
  if (Array.isArray(data)) return new Event(...data);
  return new Event(data);
};
/**
 * this is a class that determines whether an broadcast matches a pattern.
 */
export class EventFilter {
  constructor(action, value, stage, target) {
    if (typeof action === 'object') {
      this._initParams(action);
    } else {
      this._initArgs(action, value, stage, target);
    }
  }

  _initArgs(action = Å, value = Å, stage = Å, target = Å) {
    this.action = action;
    this.value = value;
    this.stage = stage;
    this.target = target;
  }

  _initParams({
    action = ABSENT,
    value = ABSENT,
    stage = ABSENT,
  }) {
    this._initArgs(action, value, stage);
  }

  _matches(target, key, isRaw) {
    const myValue = lGet(this, key);

    if (target instanceof EventFilter) {
      console.error('comparing two EventFilters', this, target);
      return false;
    }

    if (myValue === Å) {
      return true;
    }
    if (target instanceof Event) target = lGet(target, key);

    if (typeof myValue === 'function') {
      const result = myValue(target, this);
      return result;
    }

    return target === myValue;
  }

  valueMatches(value, isRaw) {
    return this._matches(value, 'value', isRaw);
  }

  stageMatches(stage, isRaw) {
    return this._matches(stage, 'stage', isRaw);
  }

  actionMatches(action, isRaw) {
    return this._matches(action, 'action', isRaw);
  }

  matches(otherEvent, isRaw) {
    try {
      const out = this.actionMatches(otherEvent, isRaw)
        && this.stageMatches(otherEvent, isRaw)
        && this.valueMatches(otherEvent, isRaw);
      return out;
    } catch (err) {
      if (this.debug) console.log('match error: ', err.message);
      return false;
    }
  }
  // equals

  _equals(target, key, isRaw) {
    if (target instanceof EventFilter) {
      console.error('comparing two EventFilters', this, target);
      return false;
    }
    if (target instanceof Event) {
      return this._equals(lGet(target, key, ABSENT), key);
    }
    if (isRaw) {
      const subProp = lGet(target, key, ABSENT);
      if (subProp !== ABSENT) {
        return this._equals(subProp, key);
      }
    }
    if (typeof this[key] === 'function') return this[key](target, this);
    return isEqual(lGet(this, key), target);
  }

  valueEquals(value, isRaw) {
    return this._equals(value, 'value', isRaw);
  }

  stageEquals(stage, isRaw) {
    return this._equals(stage, 'stage', isRaw);
  }

  nameEquals(action, isRaw) {
    return this._equals(action, 'action', isRaw);
  }

  equals(otherEvent, isRaw) {
    return this.nameEquals(otherEvent, isRaw)
      && this.stageEquals(otherEvent, isRaw)
      && this.valueEquals(otherEvent, isRaw);
  }
}

Event.EventFilter = EventFilter;

export default Event;
