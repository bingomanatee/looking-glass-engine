import { distinctUntilChanged, map } from 'rxjs/operators';
import lGet from 'lodash/get';
import isEqual from 'lodash/isEqual';
import flattenDeep from 'lodash/flattenDeep';
import { BehaviorSubject } from 'rxjs';
import ValueStreamFast from './ValueStreamFast';
import { e, toMap } from './constants';

const kas = (aMap) => {
  try {
    return Array.from(aMap.keys()).sort().join(',');
  } catch {
    return null;
  }
};

const compareMaps = (map1, map2) => {
  if (!((map1 instanceof Map) && (map2 instanceof Map))) {
    return false;
  }
  if (map1.size !== map2.size) return false;
  if (!map1.size) return true;
  const key1 = kas(map1);
  const key2 = kas(map2);
  if (!((key1 && key2) && (key1 === key2))) return false;

  let same = true;
  map1.forEach((value, field) => {
    if (!same) return;
    same = isEqual(value, map2.get(field));
  });
  return same;
};

function onlyMap(e) {
  if (!(e.value instanceof Map)) {
    e.error('only accepts map values');
  }
}

function onlyOldKeys(event, target) {
  const oldKeys = [...target.value.keys()];
  event.value.forEach((value, key) => {
    if (!oldKeys.includes(key)) {
      throw e(`key ${key} must be present in ${oldKeys.join(', ')}`, target);
    }
  });
}

/**
 *
 */
class ValueMapStreamFast extends ValueStreamFast {
  /**
   *
   * @param value {Map | Object} -- objects are coerced into Maps
   * @param options {Object}
   */
  constructor(value, options) {
    super(toMap(value), options);
    this.fieldSubjects = new Map();
  }

  /**
   * set a specific key or set of keys
   * @param key {string | Map} if the key is a map then set performs exactly like next.
   * @param value {any}
   * @param fromSubject {boolean} indicates a fieldSubject
   * @returns {ValueMapStream|void}
   */
  set(key, value, fromSubject) {
    if (key instanceof Map) {
      this.next(key);
    } else if (!fromSubject && this.fieldSubjects.has(key)) {
      this.fieldSubjects.get(key).next(value);
    } else {
      this.next(new Map([[key, value]]));
    }
    return this;
  }

  /**
   * adds a stream whose values are transported to a key in the map's value.
   * @param key {string}
   * @param stream {Subject} any RxJS subject or a ValueStream/ValueMapStream
   */
  addFieldSubject(key, stream) {
    if (!this.fieldSubjects.has(key)) {
      this.fieldSubjects.set(key, stream);
      const sub = stream.subscribe((value) => this.set(key, value, true));
      this.subscribe({
        complete() {
          sub.unsubscribe();
        },
      });
    } else {
      throw e(`cannot redefine field subject ${key}`, { key, stream, target: this });
    }
  }

  /**
   * retrieve a single key
   * @param key {string}
   * @returns {*}
   */
  get(key) {
    return this.value.get(key);
  }

  /**
   * returns the value transformed into an Object;
   * @returns {Object}
   */
  get object() {
    return [...this.value.keys()].reduce((out, key) => {
      try {
        // eslint-disable-next-line no-param-reassign
        out[key] = this.get(key);
      } catch (err) {

      }
      return out;
    }, {});
  }

  _valueProxy() {
    return new Proxy(this, {
      get(vms, key) {
        return vms.get(key);
      },
      set(vms, key, value) {
        return vms.set(key, value);
      },
    });
  }

  /**
   * a proxy to the values in the value map
   * @returns {*}
   */
  get my() {
    if (!(typeof Proxy === 'undefined')) {
      if (!this._myProxy) {
        this._myProxy = this._valueProxy();
      }
      return this._myProxy;
    }
    return this.object;
  }

  _fieldProxy() {
    return new Proxy(this.fieldSubjects, {
      get(vms, key) {
        return vms.get(key);
      },
    });
  }

  /**
   * a proxy to the values in the value map
   * @returns {*}
   */
  get fields() {
    if (!(typeof Proxy === 'undefined')) {
      if (!this._fields) {
        this._fields = this._fieldProxy();
      }
      return this._fields;
    }
    return this._fieldObj;
  }

  /**
   * an object with all the subfields. note -- the object has STREAMS for each key,
   * not their values. Used as a failover in scenarios where Proxies are not usable.
   * @returns {{}}
   * @private
   */
  get _fieldObj() {
    const obj = {};
    this.fieldSubjects.forEach((value, key) => obj[key] = value);
    return obj;
  }

  delete(key) {
    const current = this.value;
    const next = new Map(current);
    next.delete(key);
    console.log('deleted: ', key, 'from', current, 'made', next);
    this._updateValue(next);
    console.log('--- after delete value is ', this.value);
  }

  next(nextMap) {
    if (!(nextMap instanceof Map)) {
      throw new Error('ValueMapStreamFast.next() requires a Map input');
    }
    const current = this.value;
    const next = new Map(current);
    nextMap.forEach((value, key) => {
      next.set(key, value);
    });
    this._updateValue(next);
  }
}

export default ValueMapStreamFast;
