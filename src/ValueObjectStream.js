import { distinctUntilChanged, map } from 'rxjs/operators';
import lGet from 'lodash/get';
import isEqual from 'lodash/isEqual';
import intersection from 'lodash/intersection';
import flattenDeep from 'lodash/flattenDeep';
import { BehaviorSubject } from 'rxjs';
import ValueStream from './ValueStream';
import {
  A_DELETE,
  A_NEXT,
  A_SET,
  e,
  E_COMMIT,
  E_PRE_MAP_MERGE,
  E_PRECOMMIT, eqÅ,
  mapNextEvents,
  setEvents,
} from './constants';
import { EventFilter } from './Event';
import fieldProxy from './fieldProxy';
import {
  onCommitSet,
  onDeleteCommit,
  onInitialNext,
  onMergeNext,
  onPrecommitSet,
  onRestrictKeyForSet,
} from './triggers';

const kas = (aMap) => {
  try {
    return Array.from(aMap.keys()).sort().join(',');
  } catch {
    return null;
  }
};

function intersects(a, b) {
  return Array.isArray(a) && Array.isArray(b) && intersection(a, b).length;
}
function onlyObj(evt) {
  if (!(evt.value && (typeof evt.value === 'object'))) {
    evt.error('only accepts map values');
  }
}

const compareMaps = (map1, map2) => {
  const keys1 = Array.from(Object.keys(map1));
  const keys2 = Array.from(Object.keys(map2));
  if (!isEqual(new Set(keys1), new Set(keys2))) return false;

  return keys1.reduce((same, key) => same && map2[key] === map1[key], true);
};

class ObjectFromSet extends Object {} // class-signature for data from set;

function onlyOldKeys(event, target) {
  const oldKeys = [...target.value.keys()];
  event.value.forEach((value, key) => {
    if (!oldKeys.includes(key)) {
      throw e(`key ${key} must be present in ${oldKeys.join(', ')}`, target);
    }
  });
}

const setToNext = (event, target) => {
  const nextValue = new ObjectFromSet();
  Object.assign(nextValue, target.value);

  if (Array.isArray(event.value)) {
    const list = [...event.value];
    while (list.length) {
      const key = list.shift();
      nextValue[key] = list.shift();
    }
  } else {
    Object.assign(nextValue, event.value);
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
      const targetValue = { ...target.value };
      delete targetValue[key];
      target._valueSubject.next(targetValue);
    },
  });
};

const mergeNext = (event, target) => {
  const next = { ...target.value };
  Object.assign(next, event.value);
  event.next(next);
};

/**
 * ValueObjectStream stores key/values in an object form,
 * much like React/state. ValueMapStream was modelled first,
 * so there is legacy names in this class with "map" in their name.
 */
class ValueObjectStream extends ValueStream {
  /**
   *
   * @param value {Object}
   * @param options {Object}
   */
  constructor(value, options) {
    if (!(typeof value === 'object')) {
      throw new Error('ValueObjectStream requires an object as a starting value');
    }
    super({ ...value }, options);
    this.setStages(A_NEXT, mapNextEvents);
    this.setStages(A_SET, setEvents);

    if (lGet(options, 'noNewKeys')) {
      this.when(onlyOldKeys, onRestrictKeyForSet);
    }
    this._watchSet();
  }

  _watchSet() {
    this.when(onlyObj, onPrecommitSet);
    this.when(mergeNext, onMergeNext);
    this.when(onlyObj, onInitialNext);
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
      if (!(value && (typeof value === 'object'))) {
        return false;
      }
      if (value instanceof ObjectFromSet) {
        return false;
      }
      return !!names.find((aName) => (aName in value));
    };

    // first - if any changes are sent through set() to the fields of interest
    const onTargets = new EventFilter(A_SET, ifIntersects, stage);

    const observer2 = this.when(fn, onTargets);

    const onStraightNext = new EventFilter({
      action: A_NEXT,
      stage: E_PRE_MAP_MERGE,
      value: ifIntersects,
    });

    const observer = this.when(fn, onStraightNext);

    return observer.subscribe({
      complete: () => observer2.complete(),
      error: (err) => observer2.error(err),
    });
  }

  has(key) {
    return key in this.value;
  }

  /**
   * set a specific key or set of keys
   * @param key {string | map}
   * @param value {any}
   * @param fromSubject {boolean} indicates a fieldSubject
   * @returns {ValueMapStream|void}
   */
  set(key, value, fromSubject) {
    if ((typeof key === 'object')) {
      this.send(A_SET, key);
    } else if (!fromSubject && this.fieldSubjects.has(key)) {
      this.fieldSubjects.get(key).next(value);
    } else {
      this.send(A_SET, { [key]: value });
    }
    return this;
  }

  /**
   * retrieve a single key
   * @param key {string}
   * @returns {*}
   */
  get(key) {
    return this.value[key];
  }

  /**
   * returns the value transformed into an Object;
   * @returns {Object}
   */
  get object() {
    return { ...this.value };
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

  delete(key) {
    this.send(A_DELETE, key);
  }

  watch(...args) {
    const fields = flattenDeep(args);
    const filter = typeof fields[fields.length - 1] === 'function' ? fields.pop() : null;
    const initial = new Map();
    fields.forEach((field) => {
      if (field in this.value) initial[field] = this.value[field];
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
        const newMap = {};
        fields.forEach((field) => {
          if (field in next) {
            newMap[field] = next[field];
          }
        });
        return newMap;
      }),
      distinctUntilChanged(filter || compareMaps),
    );
  }
}

fieldProxy(ValueObjectStream);

export default ValueObjectStream;
