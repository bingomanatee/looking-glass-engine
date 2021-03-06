import isEqual from 'lodash/isEqual';
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
  constructor(action, valueStream, stage, target, source) {
    if (typeof action === 'object') {
      this._initParams(action);
    } else {
      this._initArgs(action, valueStream, stage, target, source);
    }
    this.target = target;
    if (this.valueStream) {
      this.valueStream.subscribe({
        error: (er) => console.warn('error in event stream:', er.message),
      });
    }
  }

  _initParams({
    action = ABSENT,
    valueStream = ABSENT,
    stage = ABSENT,
    target = Å,
    source = Å,
  }) {
    this._initArgs(action, valueStream, stage, target, source);
  }

  _initArgs(action = Å, valueStream = Å, stage = Å, target = Å, source = Å) {
    this.action = action;
    this.valueStream = valueStream;
    this.stage = stage;
    this.target = target;
    this.source = source;
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
    return this.valueStream.getValue();
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
      try {
        this.valueStream.error(error);
      } catch (err) {
        console.log('bad error?', error);
      }
    } else {
      console.warn('cannot register an error on suspended stream', error, this);
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
    if (this.value === Å) return ('/absent/');
    if (typeof this.value === 'symbol') return `($${this.value.toString()}$)`;

    if (this.value instanceof Map) {
      return JSON.stringify(Array.from(this.value.entries()));
    }
    if (Array.isArray(this.value)) return `[${this.value.join(', ')}]`;

    return this.value.toString();
  }

  toString() {
    const list = ['<<'];
    if (this.action !== Å) list.push('action: ', this.action.toString());
    if (this.stage !== Å) list.push('stage:', this.stage.toString());
    list.push('value', this.valueToString());
    if (this.source !== Å) list.push('source', this.source.toString());
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
  constructor(action, value, stage, target, source) {
    if (typeof action === 'object') {
      this._initParams(action);
    } else {
      this._initArgs(action, value, stage, target, source);
    }
  }

  _initArgs(action = Å, value = Å, stage = Å, target = Å, source = Å) {
    this.action = action;
    this.value = value;
    this.stage = stage;
    this.target = target;
    this.source = source;
  }

  _initParams({
    action = ABSENT,
    valueStream = ABSENT,
    stage = ABSENT,
    source = ABSENT,
    target = ABSENT,
  }) {
    this._initArgs(action, valueStream, stage, target, source);
  }

  _matches(target, key, isRaw) {
    const myValue = lGet(this, key);
    if (myValue === Å) return true;
    if (target instanceof EventFilter) {
      console.warn('comparing two EventFilters', this, target);
      return false;
    }
    if (target instanceof Event) {
      return this._matches(lGet(target, key), key);
    }
    if (isRaw) {
      const subProp = lGet(target, key, Å);
      if (subProp !== Å) {
        return this._matches(subProp, key);
      }
    }
    if (typeof myValue === 'function') {
      try {
        return myValue(target, this);
      } catch (err) {
        console.log('error trying ', myValue.toString(), 'on', target);
        return false;
      }
    }

    return target === myValue;
  }

  valueMatches(value, isRaw) {
    return this._matches(value, 'value', isRaw);
  }

  stageMatches(stage, isRaw) {
    return this._matches(stage, 'stage', isRaw);
  }

  sourceMatches(source, isRaw) {
    return this._matches(source, 'source', isRaw);
  }

  nameMatches(action, isRaw) {
    return this._matches(action, 'action', isRaw);
  }

  matches(otherEvent, isRaw) {
    return this.nameMatches(otherEvent, isRaw)
      && this.stageMatches(otherEvent, isRaw)
      && this.sourceMatches(otherEvent, isRaw)
      && this.valueMatches(otherEvent, isRaw);
  }

  // equals

  _equals(target, key, isRaw) {
    if (target instanceof EventFilter) {
      console.warn('comparing two EventFilters', this, target);
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

  sourceEquals(stage, isRaw) {
    return this._equals(stage, 'source', isRaw);
  }

  nameEquals(action, isRaw) {
    return this._equals(action, 'action', isRaw);
  }

  equals(otherEvent, isRaw) {
    return this.nameEquals(otherEvent, isRaw)
      && this.stageEquals(otherEvent, isRaw)
      && this.sourceEquals(otherEvent, isRaw)
      && this.valueEquals(otherEvent, isRaw);
  }
}

Event.EventFilter = EventFilter;

export default Event;
