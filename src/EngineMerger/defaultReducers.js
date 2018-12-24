
export default (bottle) => {
  bottle.factory('defaultActionReducer', () => function (engines) {
    if (Array.isArray(engines)) {
      return engines.reduce((actionsMemo, engine) => {
        // with an array, actions will shadow other actions of the
        // same name preferring right most engines. However all original
        // actions will be available in the baseActions array.
        let baseActions = actionsMemo.baseActions;
        if (baseActions) {
          baseActions = [...baseActions, engine.actions];
        } else {
          baseActions = [engine.actions];
        }
        const actions = { ...actionsMemo, baseActions };
        Object.keys(engine.mutators).forEach((method) => {
          actions[method] = (...params) => engine.perform({
            actions, method, params,
          });
        });
        return actions;
      }, {});
    } else if (typeof engines === 'object') {
      const actions = { baseActions: {} };

      Object.keys(engines).forEach((engineName) => {
        const engine = engines[engineName];
        actions[engineName] = {};
        Object.keys(engine.mutators).forEach((method) => {
          const action = (...params) => engine.perform({
            actions, method, params,
          });
          actions[engineName][method] = action;
          actions[method] = action;
          actions.baseActions[engineName] = engine.actions;
        });
      });
      return actions;
    }
    throw new Error('bad engines for defaultActionReducer');
  });

  bottle.factory('defaultStateReducer', ({
    STORE_STATE_UNSET_VALUE,
  }) => (states) => {
    if (states === STORE_STATE_UNSET_VALUE) return states;
    if (Array.isArray(states)) {
      return states.reduce((newState, state) => ({ ...newState, ...state }), {});
    } else if (typeof states === 'object') {
      const newState = {};
      Object.keys(states).forEach((engineName) => {
        Object.keys(states[engineName]).forEach((fieldName) => {
          newState[fieldName] = states[engineName][fieldName];
        });
        Object.assign(newState, states);
      });
      return newState;
    }
    console.log('bad state:', states);
    throw new Error('bad state passed to defaultStateReducer');
  });
};
