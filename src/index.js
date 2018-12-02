import bottle from './bottle';

const {
  Store, StoreEngine, StoreEngineReducer, update, mergeIntoState,
} = bottle().container;
export {
  Store,
  StoreEngine,
  StoreEngineReducer,
  update,
  mergeIntoState,
};
