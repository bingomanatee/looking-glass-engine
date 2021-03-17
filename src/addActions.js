import {
  A_ACTION, e, toMap,
} from './constants';

const SET_RE = /^set(.+)$/i;

const actionProxy = (stream) => new Proxy(stream, {
  get(target, name) {
    if (name === 'constructor') {
      if (stream.debug) console.warn('--- why do we care about constructor');
      return null;
    }
    if (target._actions.has(name)) {
      return (...args) => target._actions.get(name)(target, ...args);
    }

    if (typeof target.set === 'function') {
      const nameString = `${name}`;
      if (SET_RE.test(nameString)) {
        // eslint-disable-next-line no-unused-vars
        const [setName, restOfName] = SET_RE.exec(nameString);
        const keyLCFirst = restOfName.substr(0, 1).toLowerCase() + restOfName.substr(1);
        if (target.has(keyLCFirst)) return (value) => target.set(keyLCFirst, value);
        if (target.has(restOfName)) return (value) => target.set(restOfName, value);
      }
    }

    console.log('unknown action:', name, 'called on stream.do of ', stream);
    throw e(`no action ${name}`, target);
  },
});

const doObj = (stream) => {
  const out = {};

  stream._actions.forEach((fn, name) => {
    out[name] = (...args) => {
      if (stream.debug) console.warn('using non-proxy action');
      return fn(stream, ...args);
    };
  });

  if (typeof stream.set === 'function') {
    const iter = (stream.value instanceof Map) ? stream.value.keys()
      : Object.keys(stream.value);

    iter.forEach((key) => {
      out[key] = (next) => {
        if (stream.debug) console.warn('using non-proxy set');
        return stream.set(key, next);
      };
    });
  }

  return out;
};

export default (stream, actions) => Object.assign(stream, {
  addActions(objOrMap) {
    toMap(objOrMap).forEach((fn, name) => {
      stream.addAction(name, fn);
    });
    return stream;
  },
  _actions: toMap(actions),
  addAction(name, fn) {
    if (!(typeof fn === 'function')) {
      console.error('cannot add ', name, ' -- not a function', fn);
      return stream;
    }
    if (stream._actions.has(name)) {
      console.warn('redefining action', name);
    }
    stream._actions.set(name, fn);
    delete stream._doProxy;
    return stream;
  },

  get do() {
    if (!stream._doProxy) {
      if (typeof Proxy === 'undefined') {
        stream._doProxy = doObj(stream);
      } else stream._doProxy = actionProxy(stream);
    }
    return stream._doProxy;
  },
});
