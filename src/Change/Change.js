import lGet from 'lodash.get';
import propper from '@wonderlandlabs/propper';

export default (bottle) => {
  bottle.factory('Change', ({
    ACTION_ERROR, ACTION_START, ACTION_NOOP, ACTION_COMPLETE, NOOP, NOT_SET,
    STORE_STATE_UNSET_VALUE,
    STORE_STATUS_NEW,
    STORE_STATUS_INITIALIZING,
    STORE_STATUS_INITIALIZATION_ERROR,
    STORE_STATUS_INITIALIZED,
    isPromise, functionCombine, explodePromise,
  }) => {
    class Change {
      constructor(params = {}) {
        Object.assign(this, params);

        if (!this.id) {
          ++Change.nextID;
          this.id = Change.nextID;
        }
      }

      get type() {
        if (isPromise(this.change)) return 'promise';
        if (typeof this.change === 'function') return 'function';
        return 'value';
      }

      extend(params) {
        const callbacks = {
          done: functionCombine(this.done, lGet(params, 'done')),
          fail: functionCombine(this.fail, lGet(params, 'fail')),
        };

        const combinedParams = Object.assign({}, this.toJSON(), params, callbacks);
        return new Change(combinedParams);
      }

      toJSON() {
        const out = {};

        ('tid,actions,params,method,done,id,fail,change,status,actionStatus'.split(',')).forEach((name) => {
          out[name] = this[name];
          if (name === 'change') return;
          switch (out[name]) {
            case NOOP:
              delete out[name];
              break;

            case NOT_SET:
              delete out[name];
              break;

            case null:
              delete out[name];
              break;

            case undefined:
              delete out[name];
              break;

            default:
              // no change
          }
        });

        return out;
      }

      asPromise(after = null) {
        const [promise, done, fail] = explodePromise(after);

        const change = this.extend({ done, fail });

        const out = [change, promise];
        return Object.assign(out, { change, promise });
      }
    }

    propper(Change)
      .addProp('tid', {
        required: false,
        type: 'integer',
        defaultValue: null,
      })
      .addProp('actions', {
        type: 'object',
        required: false,
        defaultValue: null,
      })
      .addProp('params', {
        type: 'array',
        required: false,
        defaultValue: null,
      })
      .addProp('method', {
        type: 'string',
        required: 'false',
        defaultValue: null,
      })
      .addProp('done', {
        type: 'function',
        required: false,
        defaultValue: () => NOOP,
      })
      .addProp('id', {
        required: true,
        type: 'integer',
      })
      .addProp('fail', {
        type: 'function',
        required: false,
        defaultValue: () => NOOP,
      })
      .addProp('change', {
      })
      .addProp('status', {
        required: false,
        onInvalid: 'throw',
        tests: [[(n) => {
          const isGood = [STORE_STATE_UNSET_VALUE,
            NOT_SET,
            STORE_STATUS_NEW,
            STORE_STATUS_INITIALIZING,
            STORE_STATUS_INITIALIZATION_ERROR,
            STORE_STATUS_INITIALIZED].includes(n);
          return isGood;
        },
        false, () => new Error('status must be an store state')]],
      })
      .addProp('actionStatus', {
        required: false,
        onInvalid: 'throw',
        tests: [[n => [ACTION_ERROR,
          NOT_SET,
          ACTION_START,
          ACTION_NOOP,
          ACTION_COMPLETE].includes(n),
        false, () => new Error('actionStatus must be an action state')]],
      });

    Change.nextID = 0;

    return Change;
  });
};
