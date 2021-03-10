import { distinctUntilChanged } from 'rxjs/operators';
import { e } from './constants';

function _fieldProxy(target) {
  return new Proxy(target, {
    get(tgt, key) {
      console.log('target: ', tgt, 'target fieldSubjects', tgt.fieldSubjects);
      if (!tgt.fieldSubjects.has(key)) console.log('attempt to get undefined fieldSubject', key);
      return tgt.fieldSubjects.get(key);
    },
  });
}

function addFn(key, stream) {
  if (!this.fieldSubjects.has(key)) {
    this.fieldSubjects.set(key, stream);
    const sub = stream.pipe(distinctUntilChanged())
      .subscribe((value) => this.set(key, value, true));
    this.subscribe({
      complete() {
        sub.unsubscribe();
      },
    });
  } else {
    throw e(`cannot redefine field subject ${key}`, { key, stream, target: this });
  }
}

export default function (classDef) {
  // noinspection ES6ShorthandObjectProperty
  /**
     * adds a stream whose values are transported to a key in the map's value.
     * @param key {string}
     * @param stream {Subject} any RxJS subject or a ValueStream/ValueMapStream
     */
  Object.defineProperty(
    classDef.prototype,
    'addFieldSubject',
    {
      value: addFn,
    },
  );

  /**
     * a proxy to the values in the value map
     * @returns {*}
     */

  function getFn() {
    if (!(typeof Proxy === 'undefined')) {
      if (!this._fields) {
        this._fields = _fieldProxy(this);
      }
      return this._fields;
    }
    return this._fieldObj;
  }
  Object.defineProperty(classDef.prototype,
    'fields',
    {
      get: getFn,
    });

  function subjectFn() {
    if (!this._fieldSubjects) this._fieldSubjects = new Map();
    return this._fieldSubjects;
  }

  Object.defineProperty(
    classDef.prototype,
    'fieldSubjects',
    {
      get: subjectFn,
    },
  );

  function foFn() {
    const out = {};
    this._fieldSubjects.forEach((subject, name) => {
      out[name] = subject;
    });
    return out;
  }

  Object.defineProperty(
    classDef.prototype,
    '_fieldObj',
    {
      get: foFn,
    },
  );
}
