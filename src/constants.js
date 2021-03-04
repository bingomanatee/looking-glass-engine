import flattenDeep from 'lodash/flattenDeep';

export const E_INITIAL = 'E_INITIAL';
export const E_FILTER = 'E_FILTER';
export const E_VALIDATE = 'E_VALIDATE';
export const E_PRECOMMIT = 'E_PRECOMMIT';
export const E_PRE_MAP_MERGE = 'E_PRE_MAP_MERGE';
export const E_MAP_MERGE = 'E_MAP_MERGE';
export const E_COMMIT = 'E_COMMIT';
export const E_COMPLETE = 'E_COMPLETE';
export const E_RESTRICT = 'E_RESTRICT';

export const A_NEXT = 'action:next';
export const A_ANY = 'action:any';
export const A_ACTION = 'action:';
export const A_SET = 'action:set';
export const A_DELETE = 'action:delete';

export const setEvents = [E_INITIAL, E_RESTRICT, E_FILTER, E_VALIDATE, E_PRECOMMIT, E_COMMIT, E_COMPLETE];

export const defaultEventTree = new Map([
  [A_NEXT, [E_INITIAL, E_FILTER, E_VALIDATE, E_PRECOMMIT, E_COMMIT, E_COMPLETE]],
  [A_SET, [...setEvents]],
  [A_ANY, [E_INITIAL, E_COMMIT, E_COMPLETE]],
]);

export const mapNextEvents = [E_INITIAL, E_FILTER, E_VALIDATE, E_PRE_MAP_MERGE, E_MAP_MERGE, E_PRECOMMIT, E_COMMIT, E_COMPLETE];

export const ABSENT = ('ABSENT');

export const Å = ABSENT;

// param 2 === absent, undefined or target
export const eqÅ = (target, subject) => (typeof subject === 'undefined') || subject === Å || target === subject;

export const e = (message, meta) => {
  if (typeof message !== 'string') {
    message = '';
  }
  const error = new Error(message);
  try {
    if (meta) error.meta = meta;
  } catch (err) {

  }

  return error;
};

export const toMap = (item) => {
  if (!item) return new Map();
  if (item instanceof Map) return item;
  const out = new Map();
  if (typeof item === 'object') {
    [...Object.keys(item)].forEach((key) => out.set(key, item[key]));
    return out;
  }
  return out;
};

export const mergeMaps = (...args) => flattenDeep(args).reduce((map, other) => {
  if (other instanceof Map) {
    other.forEach((value, key) => {
      map.set(key, value);
    });
  }
  return map;
}, new Map());
