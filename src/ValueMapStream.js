import { distinctUntilChanged, map } from 'rxjs/operators';
import lGet from 'lodash/get';
import isEqual from 'lodash/isEqual';
import flattenDeep from 'lodash/flattenDeep';
import { BehaviorSubject } from 'rxjs';
import ValueStream from './ValueStream';
import {
  setEvents,
  A_DELETE, A_NEXT, A_SET, E_COMMIT, E_INITIAL, E_PRECOMMIT, E_PRE_MAP_MERGE,
  mapNextEvents, E_MAP_MERGE, toMap, e, Å, E_RESTRICT,
} from './constants';
import { EventFilter } from './Event';

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

const onInitialNext = new EventFilter({
  action: A_NEXT,
  stage: E_INITIAL,
});

const onMergeNext = new EventFilter({
  action: A_NEXT,
  stage: E_MAP_MERGE,
});

const onPrecommitSet = new EventFilter({
  action: A_SET,
  stage: E_PRECOMMIT,
});

const onCommitSet = new EventFilter({
  action: A_SET,
  stage: E_COMMIT,
});

const onRestrictKeyForSet = new EventFilter({
  action: A_SET,
  stage: E_RESTRICT,
});

const onDeleteCommit = new EventFilter({
  action: A_DELETE,
  stage: E_COMMIT,
});

const SR_FROM_SET = Symbol('action:set');

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

const setToNext = (event, target) => {
  const nextValue = new Map(target.value);
  if (event.value instanceof Map) {
    event.value.forEach((value, key) => nextValue.set(key, value));
  }
  event.complete();
  target.send(A_NEXT, nextValue);
};

const deleteKey = (event, target) => {
  const key = event.value;

  event.subscribe({
    complete() {
      if (target.fieldSubjects.has(key)) {
        target.fieldSubjects.get(key).complete();
        target.fieldSubjects.delete(key);
      }
      const targetValue = new Map(target.value);
      targetValue.delete(key);
      target._valueSubject.value.delete(key);
    },
  });
};

const mergeNext = (event, target) => {
  const next = new Map(target.value);
  if (event.value instanceof Map) {
    event.value.forEach((value, key) => next.set(key, value));
  }
  event.next(next);
};

/**
 *
 */
class ValueMapStream extends ValueStream {
  /**
   *
   * @param value {Map | Object} -- objects are coerced into Maps
   * @param options {Object}
   */
  constructor(value, options) {
    super(toMap(value), options);
    this.fieldSubjects = new Map();
    this.setStages(A_NEXT, mapNextEvents);
    this.setStages(A_SET, setEvents);

    if (lGet(options, 'noNewKeys')) {
      this.when(onlyOldKeys, onRestrictKeyForSet);
    }
    this._watchSet();
  }

  _watchSet() {
    this.when(onlyMap, onPrecommitSet);
    this.when(mergeNext, onMergeNext);
    this.when(onlyMap, onInitialNext);
    this.when(setToNext, onCommitSet);
    this.when(deleteKey, onDeleteCommit);
  }

  /**
   * watches for changes to a specific field
   *
   * @param fn {function}
   * @param name {string}
   * @param stage {string} - a phase code (optional)
   * @returns {subscriber}
   */
  onField(fn, name, stage = E_PRECOMMIT) {
    const names = Array.isArray(name) ? [...name] : [name];
    const ifIntersects = (value) => {
      if (!(value instanceof Map)) {
        return false;
      }
      const matches = [...value.keys()].filter((key) => names.includes(key));
      return matches.length;
    };

    // first - if any changes are sent through set() to the fields of interest
    const onTargets = new EventFilter(A_SET, ifIntersects, stage);

    const observer2 = this.when(fn, onTargets);

    const onStraightNext = new EventFilter({
      action: A_NEXT,
      stage: E_PRE_MAP_MERGE,
      value: ifIntersects,
      source: (src) => src !== SR_FROM_SET,
    });

    const observer = this.when(fn, onStraightNext);

    observer.subscribe({
      complete: () => observer2.complete(),
      error: (err) => observer2.error(err),
    });

    return observer;
  }

  /**
   * set a specific key or set of keys
   * @param key {string | map}
   * @param value {any}
   * @param fromSubject {boolean} indicates a fieldSubject
   * @returns {ValueMapStream|void}
   */
  set(key, value, fromSubject) {
    if (key instanceof Map) {
      this.send(A_SET, key);
    } else if (!fromSubject && this.fieldSubjects.has(key)) {
      this.fieldSubjects.get(key).next(value);
    } else {
      this.send(A_SET, new Map([[key, value]]));
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

  get _fieldObj() {
    const obj = {};
    this.fieldSubjects.forEach((value, key) => obj[key] = value);
    return obj;
  }

  delete(key) {
    this.send(A_DELETE, key);
  }

  watch(...args) {
    const fields = flattenDeep(args);
    const filter = typeof fields[fields.length - 1] === 'function' ? fields.pop() : null;
    const initial = new Map();
    fields.forEach((field) => {
      if (this.value.has(field)) initial.set(field, this.value.get(field));
    });
    const receiver = new BehaviorSubject(initial);
    this.on((event) => {
      event.subscribe({
        complete: () => {
          receiver.next(event.target.value);
        },
      });
    }, A_NEXT, E_COMMIT);
    return receiver.pipe(
      map((next) => {
        const newMap = new Map();
        fields.forEach((field) => {
          if (next.has(field)) {
            newMap.set(field, next.get(field));
          }
        });
        return newMap;
      }),
      distinctUntilChanged(filter || compareMaps),
    );
  }
}

export default ValueMapStream;
