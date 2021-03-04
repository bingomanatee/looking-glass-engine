import { distinctUntilChanged, map } from 'rxjs/operators';
import lGet from 'lodash/get';
import isEqual from 'lodash/isEqual';
import flattenDeep from 'lodash/flattenDeep';
import { BehaviorSubject } from 'rxjs';
import ValueStream from './ValueStream';
import fieldProxy from './fieldProxy';
import Event from './Event';
import {
  A_DELETE,
  A_NEXT,
  A_SET,
  e,
  E_COMMIT,
  E_PRE_MAP_MERGE,
  E_PRECOMMIT,
  mapNextEvents,
  mergeMaps,
  setEvents,
  toMap, Å,
} from './constants';
import {
  onCommitSet,
  onDeleteCommit,
  onInitialNext,
  onMergeNext,
  onPrecommitSet,
  onRestrictKeyForSet,
} from './triggers';
import EventFilter from './EventFilter';
import mapToObject from './mapToObject';

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

const SR_FROM_SET = Symbol('action:set');

function onlyMap(evt) {
  if (!(evt.value instanceof Map)) {
    evt.error('only accepts map values');
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
  const nextValue = mergeMaps(target.value, event.value);
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
      target._valueSubject.next(targetValue);
    },
  });
};

const mergeNext = (event, target) => {
  event.next(mergeMaps(target.value, event.value));
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
      console.log('--- ifInterSetcs looking for ', names, 'in ', value)
      if (!(value instanceof Map)) {
        return false;
      }
      return names.reduce((has, n) => {
        return has || value.has(n);
      }, false);
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

    const observer = this.when((...args) => {
      if (args[0].value.get('y') === 3) console.log('---- on straight next:', args);
      fn(...args);
    }, onStraightNext);

    observer.subscribe({
      complete: () => observer2.complete(),
      error: (err) => observer2.error(err),
    });

    return observer;
  }

  has(key) {
    return this.value.has(key);
  }

  /**
   * set a specific key or set of keys
   * @param key {string | map}
   * @param value {any}
   * @param fromSubject {boolean} indicates a fieldSubject
   * @returns {Event}
   */
  set(key, value, fromSubject) {
    if (key instanceof Map) {
      return this.send(A_SET, key);
    } if (!fromSubject && this.fieldSubjects.has(key)) {
      const subject = this.fieldSubjects.get(key);
      const event = new Event(A_SET, new BehaviorSubject(this.get(key)));
      let err = Å;
      let newValue = Å;

      const sub = subject.subscribe((v) => newValue = v, (er) => err = er);
      subject.next(value);
      if ((newValue !== Å) && !event.isStopped) event.next(newValue);
      sub.unsubscribe();

      return event;
    }
    return this.send(A_SET, new Map([[key, value]]));
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
    return mapToObject(this.value);
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

  get size() {
    return this.value.size;
  }

  delete(key) {
    this.send(A_DELETE, key);
  }

  watch(...args) {
    const fields = flattenDeep(args);
    const filter = typeof fields[fields.length - 1] === 'function' ? fields.pop() : null;
    const initial = new Map();
    fields.forEach((field) => {
      if (this.has(field)) initial.set(field, this.get(field));
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

fieldProxy(ValueMapStream);

export default ValueMapStream;
