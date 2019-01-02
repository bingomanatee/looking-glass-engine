

export default (bottle) => {
  bottle.constant('STORE_STATE_UNSET_VALUE', Symbol('STORE_STATE_UNSET_VALUE'));
  bottle.constant('S_NEW', Symbol('S_NEW'));
  bottle.constant('S_STARTED', Symbol('S_STARTED'));
  bottle.constant('S_STOPPED', Symbol('S_STOPPED'));
  bottle.constant('S_STARTING', Symbol('S_STARTING'));
  bottle.constant('S_ERROR', Symbol('S_ERROR'));
  bottle.constant('ACTION_ERROR', Symbol('ACTION_ERROR'));
  bottle.constant('ACTION_START', Symbol('ACTION_START'));
  bottle.constant('ACTION_WORKING', Symbol('ACTION_WORKING'));
  bottle.constant('ACTION_NOOP', Symbol('ACTION_NOOP'));
  bottle.constant('ACTION_COMPLETE', Symbol('ACTION_COMPLETE'));
  bottle.constant('NOT_SET', Symbol('NOT_SET'));
};
