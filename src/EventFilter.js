import lGet from 'lodash/get';
import isEqual from 'lodash/isEqual';
import { ABSENT, Å } from './constants';
import Event from './Event';

/**
 * this is a class that determines whether an broadcast matches a pattern.
 */
export default class EventFilter {
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
    valueStream = ABSENT,
    stage = ABSENT,
  }) {
    this._initArgs(action, valueStream, stage);
  }

  _matches(target, key, isRaw) {
    const myValue = lGet(this, key);
    if (myValue === Å) return true;
    if (target instanceof EventFilter) {
      console.error('comparing two EventFilters', this, target);
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
      if (key === 'value') {
        console.log('value comparing ', myValue.toString(), 'against', target);
      }
      return myValue(target, this);
    }

    return target === myValue;
  }

  valueMatches(value, isRaw) {
    return this._matches(value, 'value', isRaw);
  }

  stageMatches(stage, isRaw) {
    return this._matches(stage, 'stage', isRaw);
  }

  nameMatches(action, isRaw) {
    return this._matches(action, 'action', isRaw);
  }

  matches(otherEvent, isRaw) {
    return this.nameMatches(otherEvent, isRaw)
      && this.stageMatches(otherEvent, isRaw)
      && this.valueMatches(otherEvent, isRaw);
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
