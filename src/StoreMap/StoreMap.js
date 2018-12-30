/* eslint-disable no-unreachable */

import clone from 'lodash.clonedeep';
import lGet from 'lodash.get';

import { BehaviorSubject } from 'rxjs';

export default (bottle) => {
  /**
   * Returns an object with states sub-indexed by the store name keys in the map.
   * For convenience each store (that can be) is also key-value-dumped into the root
   * but as this has the potential for shadowed values, the name-indexed states are the
   * best source of truth.
   *
   * @param storeMap {Map} a dictionary of string/Store listings
   */ bottle.factory('defaultStateReducer', ({ isSet, isObject }) =>
    (storeMapInstance) => {
      const byName = {};
      let out = {};

      Array.from(storeMapInstance.stores.keys()).forEach((storeName) => {
        const state = storeMapInstance.stores.get(storeName).state;
        byName[storeName] = state;

        if (isSet(state && isObject(state))) {
          out = { ...out, ...state };
        }
      });

      return { ...out, ...byName };
    });

  /**
   * blends actions from multiple stores into the storeMap.
   * Note: for convenience, each stores' actions are merged into the root
   * which has significant potential for overlap.
   *
   * To insulate against this, store actions are also presented by name index;
   *
   * i.e., store "alpha" actions are always available in storeMapInstance.actions.alpha.[name].
   *
   */
  bottle.factory('defaultActionReducer', () => (storeMapInstance) => {
    let out = {}; // any

    if (!(storeMapInstance.stores instanceof Map)) {
      console.log('dar: non map passed:', storeMapInstance);
      return {};
    }

    // dump all the actions into the root object.
    // warning: potential for shadowing.
    storeMapInstance.stores.forEach((store) => {
      out = { ...out, ...store.actions };
    });

    const customActions = lGet(storeMapInstance, '_actions', {});
    // overlay any custom actions over the root actions.
    out = { ...out, ...customActions };

    // segregate all the actions into a subset based on name.
    storeMapInstance.stores.forEach((store, key) => {
      out[key] = store.actions;
    });

    return out;
  });


  /**
   * NOTE - this is a function that RETURNS a function; difficult to read in bottle notation,
   * but the output of defaultStarterFactory's bottle is a function that takes in a storeMap
   * and returns a starter function that calls each storeMap's starters.
   */
  bottle.factory('defaultStarter', ({ asMap, S_STARTED }) => (storeMapInstance) => {
    const promises = [];
    Array.from(asMap(storeMapInstance.stores).values()).forEach((store) => {
      const promise = store.start();
      if (store.status !== S_STARTED) {
        promises.push(promise);
      }
    });

    if (!promises.length) {
      return storeMapInstance._stateReducer(storeMapInstance);
    }
    return Promise.all(promises)
      .then(() => storeMapInstance._stateReducer(storeMapInstance));
  });

  /**
   * StoreMap is a "MetaStore", like the reduced stores in Redux.
   * It takes in a Map
   */

  bottle.factory('StoreMap', ({
    S_STOPPED,
    NOT_SET,
    asMap,
    defaultStateReducer,
    defaultStarter,
    defaultActionReducer,
    isFunction,
    Store,
  }) => class StoreMap extends Store {
    constructor(storeMap = new Map(), config = {}) {
      const stateReducer = lGet(config, 'stateReducer', defaultStateReducer);
      const actionReducer = lGet(config, 'actionReducer', defaultActionReducer);
      const starter = lGet(config, 'starter', defaultStarter);

      const trueMapStoreMap = asMap(storeMap);

      const mockMe = { _stateReducer: stateReducer, stores: trueMapStoreMap };
      super({
        ...config,
        state: stateReducer(mockMe),
        starter,
      });
      this.stores = trueMapStoreMap;

      this._stateReducer = stateReducer;
      this._actionReducer = actionReducer;

      this._listenToStores();
    }

    _listenToStores() {
      this._subscribers = [];
      this.stores.forEach((store, key) => {
        const sub = store.stream.subscribe(() => {
          this._updateStoreFromStores();
        }, (error) => {
          this.errorStream.next({
            source: 'mapped store',
            store,
            error,
          });
        });
        this._subscribers.push(sub);
      });
    }

    _updateStoreFromStores() {
      this.update(this._stateReducer);
    }

    stop() {
      this.stores.forEach((store) => { store.complete(); });
      this._subscribers.forEach(sub => sub.unsubscribe);
      return this.update(NOT_SET, { status: S_STOPPED });
    }

    get do() {
      return this.actions;
    }

    get actions() {
      return this._actionReducer(this);
    }

    /**
     * Because all state in a StoreMap is derived, we obviate the possibility
     * of creating an action that directly changes the StoreMap state. I.e.,
     * a StateMap action is ALWAYS a "NOOP" action that calls actions from its
     * component stores but doesn't directly return a value to be injected into State.
     *
     * To accomplish this we suppress the direct response
     * @param name
     * @param mutator {function}
     * @returns {function(...[*]): ChangePromise}
     */
    makeAction(name, mutator) {
      if (!isFunction(mutator)) {
        mutator = () => mutator;
      }
      return (...args) => this.update(
        () => mutator(this, ...args),
        { noop: true, action: name || true },
      );
    }
  });
};
