import bottle from './bottle';


const {
  Store, StoreMap, update, mergeIntoState,
  STORE_STATE_UNSET_VALUE
  , S_NEW
  , S_STARTED
  , S_STARTING
  , S_ERROR
  , ACTION_ERROR
  , ACTION_START
  , ACTION_NOOP
  , ACTION_COMPLETE
  , NOT_SET,
} = bottle().container;

export {
  STORE_STATE_UNSET_VALUE
  , S_NEW
  , S_STARTED
  , S_STARTING
  , S_ERROR
  , ACTION_ERROR
  , ACTION_START
  , ACTION_NOOP
  , ACTION_COMPLETE
  , NOT_SET,
  Store,
  StoreMap,
  update,
  mergeIntoState,
};
