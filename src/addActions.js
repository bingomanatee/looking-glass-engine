/* eslint-disable no-param-reassign */
import {
  A_ACTION, e, E_COMMIT, E_COMPLETE, toMap, Å,
} from './constants';

const SET_RE = /^set(.+)$/i;

const actionProxy = (stream, asEvent) => new Proxy(stream, {
  get(target, name) {
    if (target._actions.has(name)) {
      if (asEvent && typeof target.send === 'function') {
        return (...args) => {
          return target.send(name, args);
        };
      }
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

    throw e(`no action ${name}`, target);
  },
});

const doObj = (stream) => {
  if (stream._do && ([...Object.keys(stream._do)].length - stream.size) === stream._actions.size) {
    return stream._do;
  }
  stream._do = {};

  stream._actions.keys().forEach((name) => {
    stream._do[name] = (...args) => stream._actions.get(name)(stream, ...args);
  });

  return stream._do;
};

export default (stream, actions) => {
  Object.assign(stream, {
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
      return stream;
    },

    get do() {
      if (typeof Proxy === 'undefined') {
        return doObj(stream);
      }
      if (!stream._doProxy) {
        stream._doProxy = actionProxy(stream);
      }
      return stream._doProxy;
    },

    get try() {
      if (typeof Proxy === 'undefined') {
        return doObj(stream);
      }
      if (!stream._doProxyAct) {
        stream._doProxyAct = actionProxy(stream, true);
      }
      return stream._doProxyAct;
    },
  });

  stream.on((event, target) => {
    if (event.isStopped) return;
    try {
      if (!Array.isArray(event.value)) {
        throw new Error(`action requires array of props: ${event.name}`);
      }
      const fn = target._actions.get(event.action);
      if (typeof fn !== 'function') throw new Error(`cannot find action ${event.action}`);

      const result = fn(target, ...event.value);
      console.log('result of ', event.action, 'is', result);
      event.next(result);
      event.complete();
    } catch (err) {
      console.log('action error', err);
      event.error(err);
    }
  },
  (actionName) => stream._actions.has(actionName), E_COMMIT);

  // this is an "insanity check"; actions should never get to the completee stage,
  // they should be either completed at commit or errored out.

  stream.on((event, target) => {
    if (!event.isStopped) {
      event.error(new Error(`somehow -- action ${event.action} has not executed`));
    }
  }, (actionName) => stream._actions.has(actionName), E_COMPLETE);

  return stream;
};
