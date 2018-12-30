import bottle from './bottle';


const {
  Store, Engine, EngineMerger, update, mergeIntoState,
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

console.log('Engine:', Engine);
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
  Engine,
  EngineMerger,
  update,
  mergeIntoState,
};
