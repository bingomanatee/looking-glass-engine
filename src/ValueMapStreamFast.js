import ValueStreamFast from './ValueStreamFast';
import { e, mergeMaps, toMap } from './constants';
import fieldProxy from './fieldProxy';

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
  }

  has(key) {
    return this.value.has(key);
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
    this._updateValue(next);
  }

  next(nextMap) {
    if (!(nextMap instanceof Map)) {
      throw new Error('ValueMapStreamFast.next() requires a Map input');
    }
    this._updateValue(mergeMaps(this.value, nextMap));
  }
}

fieldProxy(ValueMapStreamFast);

export default ValueMapStreamFast;
