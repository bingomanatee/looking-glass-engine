import store from './Store';
import storeEngine from './StoreEngine';
import storeReducer from './StoreEngineReducer';

export default (bottle) => {
  store(bottle);
  storeEngine(bottle);
  storeReducer(bottle);
}
