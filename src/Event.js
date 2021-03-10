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
class Event extends BehaviorSubject {
  /**
   *
   * @param Object {any}
   */
  constructor(params) {
    super(params.value);
    this._initParams(params);
  }

  _initParams({
    action = ABSENT,
    stage = ABSENT,
    target,
  }) {
    this.action = action;
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
      return this.getValue();
    } catch (err) {
      return Å;
    }
  }

  get activeStream() {
    return !this.isStopped && !this.hasError;
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

export default Event;
