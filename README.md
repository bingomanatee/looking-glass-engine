Store Engines have the following signature:

* **state**: a property of the current store's state. Ideally an object. 
* **actions**: a collection of mutator functions that take in the engine and arguments and return a mutated state.
               Actions can also return a promise, as they are wrapped in a promise structure. 
* **subscribe**: a method to subscribe (RxJS) to the changes of the state data. 

note, effects as an alias to actions are also provided by the StoreEngine for backwards compatibility. 

*Everything else about the store engine is optional.* 

Want to point the store to a Component state? go to town. 
Want to point the store to a REST interface? why not. 
Want to store state in localStorage/sessionStorage? Sounds good. 
Want to use Generators to communicate changes? If you can make it work. 

Stores can be bound in the React Tree and inherit down the DOM, overriding parent styles -- this is the default model of Freactal. However they can also be kept separate from the DOM tree and broadcast across the tree as their states change. 

States can be combined using the StoreReducer class; this is the mechanic that allows context inheritance to work. 
But you can also create discrete stores that manage specific spheres and blend them into a shared state, a la Redux reducers. 

## The StoreEngine class

The StoreEngine class has the following signature: 

````javascript
const engine = new StoreEngine({
    state,       //? {object},
    initializer, // ? {function}
    actions,     // ? {object}
    effects,     // ? {object}
    },
    actions      //?  {Object: hash of functions);
);

````

note there are multiple ways to provide actions.

* as the second argument (easiest)
* as a property ('actions') of the first argument.
* as a property ('effects') of the first argument for backwards compatibility. 

### The Initialization Cycle 

initialization can be accomplished synchronously, asynchronously or *both*. Engines without an initialValue will have a state value of `Symbol(BASE_STATE_UNINITIALIZED_VALUE)` until `store.initialize() {promise}` is called. At that point the engine's status will move from `Symbol(BASE_STATE_STATUS_UNINITIALIZED)` to `Symbol(BASE_STATE_STATUS_INITIALIZED)`. `.initialize()` is called automatically before every action, and is idempotent. 

If a property with NEITHER initialValue or initializer is passed, IT is considered to be the initial value. So by definition either the initialValue or the initializer is present in all scenarios. 

| state | initializer | state after constructor | state after `await initialize()` |
|------|------|-----|-----|
| -- | function | BASE_STATE_UNINITIALIZED_VALUE | result of initializer(engine) |
| value | -- | state | initialValue |
| value | function | state | result of initializer(engine) |

### Actions

Actions are functions that take in the engine and optional arguments and return a new state value,
or a promise that results in a new state value. 
If passed through the update helper they behave like a React `.setState` method, 
updating the properties of the object they return. 

Actions can call other actions from the engine, other promise actions, etc. They can be asynchronous. 

So, all these actions are equivalent:

````javascript

{
  doubleA: ({state}) => {
      return Object.assign({}, state, {a: 2 * state.a});
    },
  doubleAWithUpdate: update(({state}) => ({a: 2 * state.a}),
  doubleAWithPromise: ({state}) => new Promise((resolve) => {
    resolve(Object.assign({}, state, {a: 2 * state.a}))
  });
}

````

