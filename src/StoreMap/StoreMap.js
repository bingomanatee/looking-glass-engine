/* eslint-disable no-unreachable */

import clone from 'lodash.clonedeep';

import { BehaviorSubject } from 'rxjs';

export default (bottle) => {
  bottle.factory('defaultStateReducer', ({ NOT_SET }) =>
    /**
     * Returns an object with states sub-indexed by the store name keys in the map.
     * For convenience each store (that can be) is also key-value-dumped into the root
     * but as this has the potential for shadowed values, the name-indexed states are the
     * best source of truth.
     *
     * @param storeMap {Map} a dictionary of string/Store listings
     */
    (storeMap) => {
      const byName = {};
      let out = {};
      Array.from(storeMap.keys()).forEach((storeName) => {
        const state = storeMap.get(storeName).state;
        byName[storeName] = state;

        if (state && typeof state === 'object') {
          out = { ...out, ...state };
        }
      });

      return { ...out, ...byName };
    });


  bottle.factory('defaultActionReducer', () => (storeMap) => {
    let out = {};

    storeMap.keys().forEach((key) => {
      const store = storeMap.get(key);
      out = { ...out, ...store.actions };
    });

    storeMap.keys().forEach((key) => {
      const store = storeMap.get(key);
      out[key] = store.actions;
    });
  });


  /**
   * NOTE - this is a function that RETURNS a function; difficult to read in bottle notation,
   * but the output of defaultStarterFactory's bottle is a function that takes in a storeMap
   * and returns a starter function that calls each storeMap's starters.
   */
  bottle.factory('defaultStarterFactory', () => storeMap => () => {
    storeMap.values().forEach((store) => {
      store.start();
    });
  });

  /**
   * StoreMap is a "MetaStore", like the reduced stores in Redux.
   * It takes in a Map
   */

  bottle.factory('StoreMap', ({
    STORE_STATE_UNSET_VALUE,
    S_NEW,
    S_STARTING,
    S_ERROR,
    S_STOPPED,
    S_STARTED,
    NOT_SET,
    ChangePromise,
    isPromise,
    defaultStateReducer,
    defaultStarterFactory,
    defaultActionReducer,
    Store,
  }) => class StoreMap extends Store {
    constructor(storeMap = new Map(), config = {}) {
      /**
       * if the storeMap is a POJO, convert it to a formal Map object.
       */
      if (!(storeMap instanceof Map) && (typeof storeMap === 'object')) {
        if (Array.isArray(storeMap)) storeMap = new Map(storeMap);
        else {
          const map = new StoreMap();
          Object.keys(storeMap).forEach(name => map.set(name, storeMap[name]));
          storeMap = map;
        }
      }

      const stateReducer = config._stateReducer || defaultStateReducer;
      const actionReducer = config._actionReducer || defaultActionReducer;
      const starterFactory = config.starter || defaultStarterFactory;

      super({ ...config, state: stateReducer(storeMap), starter: starterFactory(storeMap) });

      console.log('StoreMap:', StoreMap);

      this.stores = storeMap;
      this._stateReducer = stateReducer;
      this._actionReducer = actionReducer;

      /**
       * unlike Stores, the StoreMap internally starts itself - and by extension its members.
       */
      this.start();
    }

    get do() {
      return this._actionReducer(this.stores);
    }

    get actions() {
      return this._actionReducer(this.stores);
    }
  });
};
