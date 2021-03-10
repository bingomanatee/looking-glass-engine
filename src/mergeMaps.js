const flattenDeep = require('lodash/flattenDeep');

const mergeMaps = (...args) => flattenDeep(args).reduce((map, other) => {
  if (other instanceof Map) {
    other.forEach((value, key) => {
      map.set(key, value);
    });
  }
  return map;
}, new Map());

module.exports = mergeMaps;
