import { Å } from './constants';

const EVENT_FIELDS = 'action,stage,value,target'.split(',');

const argsToProps = (action, stage, value, target) => {
  if (action && typeof action === 'object') {
    return EVENT_FIELDS.map((field) => (field in action ? action[field] : Å));
  }
  return [action, stage, value, target];
};

/**
 * this function returns a function that tests Event instances
 * based on one or more parameters
 * @param args
 * @returns {function(*)}
 */
export default (...args) => {
  // props is an array of values in the same order as the EVENT_FIELDS
  // may contain Å (absent) if a POJO parameter is passed in.
  // eslint-disable-next-line no-shadow
  const props = argsToProps(...args);

  const tests = new Map();

  EVENT_FIELDS.forEach((key, index) => {
    if (props.length <= index) return;
    const prop = props[index];
    if (prop !== Å) {
      if (typeof prop === 'function') {
        tests.set(key, prop);
      } else if (typeof prop !== 'undefined') {
        tests.set(key, (input) => input === prop);
      }
    }
  });

  if (!tests.size) {
    console.warn('eventFilter with no tests has been crated, with args', args);
  }

  return Object.assign((event) => {
    if (typeof tests.get('value') === 'function' && event.target && event.target.debug) {
      console.log('----- matchEvent:', props);
    }

    if ((event.isComplete) || (!tests.size)) {
      if (typeof tests.get('value') === 'function' && event.target && event.target.debug) {
        console.log('----- matchEvent on complete event, returning false');
      }
      return false;
    }

    const good = [...tests.keys()].reduce((isGood, key) => {
      if (!isGood) return isGood;
      const fn = tests.get(key);
      const eventProp = event[key];
      let result = true;
      try {
        result = fn(eventProp);
      } catch (err) {
        console.log('matchEvent error with ', fn.toString(), 'on', eventProp);
        result = false;
      }
      if (true || typeof tests.get('value') === 'function' && event.target && event.target.debug) {
        console.log('test of ', key, 'result ', result, 'for', event.toString());
      }
      return result;
    }, true);

    if (true || typeof tests.get('value') === 'function' && event.target && event.target.debug) {
      console.log('----- matchEvent:     final result:', good, 'for',  event);
    }
    return good;
  }, { tests, props });
};
