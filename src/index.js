import bottle from './bottle';

const {Store, StoreEngine, StoreEngineReducer, update} = bottle().container;
export {
  Store,
  StoreEngine,
  StoreEngineReducer,
  update
};
