

export default (bottle) => {
  bottle.constant('STORE_STATE_UNSET_VALUE', Symbol('STORE_STATE_UNSET_VALUE'));
  bottle.constant('STORE_STATUS_NEW', Symbol('STORE_STATUS_NEW'));
  bottle.constant('STORE_STATUS_INITIALIZED', Symbol('STORE_STATUS_INITIALIZED'));
  bottle.constant('STORE_STATUS_STOPPED', Symbol('STORE_STATUS_STOPPED'));
  bottle.constant('STORE_STATUS_INITIALIZING', Symbol('STORE_STATUS_INITIALIZING'));
  bottle.constant('STORE_STATUS_INITIALIZATION_ERROR', Symbol('STORE_STATUS_INITIALIZATION_ERROR'));
  bottle.constant('ACTION_ERROR', Symbol('ACTION_ERROR'));
  bottle.constant('ACTION_START', Symbol('ACTION_START'));
  bottle.constant('ACTION_WORKING', Symbol('ACTION_WORKING'));
  bottle.constant('ACTION_NOOP', Symbol('ACTION_NOOP'));
  bottle.constant('ACTION_COMPLETE', Symbol('ACTION_COMPLETE'));
  bottle.constant('NOT_SET', Symbol('NOT_SET'));
};
