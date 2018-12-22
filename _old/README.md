This repository is the repo for the store engine behind freactal. This module does 
NOT include code for binding the stores to React (or anything browser related).
That code is contained in 
[looking-glass-connect](https://github.com/bingomanatee/looking-glass-connect)

## Store Engines

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

Stores can be bound in the React Tree and inherit down the DOM, overriding parent styles 
-- this is the default model of Freactal. However they can also be kept separate from the DOM tree and broadcast 
across the tree as their states change. 

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

Actions are functions that take in the engine's actions and optional arguments 
and return a function that takes in the states value and returns a modified state;
or a promise that results in that function. 

Actions can call other actions from the engine, other promise actions, etc. They can be asynchronous. 

So, all these actions are equivalent:

````javascript

{
  doubleA: () => (state) => {
      return Object.assign({}, state, {a: 2 * state.a});
    },
  doubleAWithPromise: () => new Promise((resolve) => {
    resolve((state) => Object.assign({}, state, {a: 2 * state.a}))
  });
}

````

### A note under the hood

The `StoreEngine` inherits from `Store` class.  The `Store` class manages data storage and change streaming;
the `StoreEngine` adds functionality for Action management. If you want to write your own StoreEngine,
you might find extending Store with your own Action system easier than a wholly unique rebuild. 

## The Inheritance Pattern: Engine Reducer

StateEngines can inherit data and actions from each other through the StoreReducer class. This class
takes an array of two (or more) StoreEngines and behaves like a StoreEngine that is the union of these two
classes. 

*Example:*

```jsx harmony

let engine1 = new StoreEngine({a: 1, b: 2, c: 3}, {
  setA: update((store, a) => ({a})),
  setB: update((store, b) => ({b})),
  addAtoB: (actions) => (state) => Object.assign({}, state, {b: (state.a + state.b)})
})

let engine2 = new StoreEngine({a: 10, c: 30}, {
  setA: update((store, a) => ({a})),
  setC: update((store, c) => ({c})),
  addAtoC: (actions) => (state) => Object.assign({}, state, {c: (state.a + state.c)}),
  doBoth: async (actions) => {
    await actions.addAtoB();
    await actions.addAtoC();
    return (state) => state;
  }
})

let combined = new StoreEngineReducer([engine1, engine2]);

/**
 * combined's actions: {setA, setB, seteC, addAtoB, addAtoC}
 * combined's initial state: {a: 10, b: 2, c: 30}
*/
```

okay but... addAtoB -- which A? and addAtoC: which A, and which C?

When there are key overlaps both in state and actions, the *second* engine 
(or rightmost if there are more than two) takes precedence.
This means that if a rightmost engine's method/state value shadows ones from an engine before it,
the rightmost engine wins out. 

From the point of view The golden rule of LGE is: 

*actions are bound to the state of the engine they are originally defined in.*

this means combined's `addAtoC` will both *get* the values of A and C from engine1 and will *write* to 
the state of engine1. combined's state is always re-computed after each action and re-blended from
all the states of its' source engines. An `StoreEngineReducer` is a 'virtual class' that combines
both the actions and states of its sources but the flow of information is one-way - it 
continually recombines state from its components out to its consumers. 

## Access to other actions

The actions of the rightmost engine has access to the actions to its left. the example here,
`doBoth()`, shows how a combined action can allow one engine to access another engines' actions. 
*however* it doesn't let the rightmost engine to have access to the leftmost actions' *state*. 

This means if you want to pull information from a child engine into a parent engines' computations,
you have to get it from *outside* the action (and pass it in as a parameter). This means for instance,
there is *no way to inject a shadowed state value of a leftmost engine into an action in a parent's
action. 

## Customizing reduction

How to avoid shadow effects when reducing engines? As with Redux, you can write custom reduction
to combine actions and/or states. This is purely optional - if you can work with shadow/inheritance
you don't need this utility. But for those that need it, custom store blending can let you isolate or
select state and properties from each engine and combine them however you want. 

```jsx harmony

engineAlpha = new StoreEngine(
{
  a: 1,
  b: 2,
  c: 3,
},
{
  setA: update((actions, a) => () => ({ a })),
  setB: update((actions, b) => () => ({ b })),
  addAtoB: () => (state) => {
    const { a, b } = state;
    return Object.assign({}, state, { b: a + b });
  },
},
);

engineAlpha.name = 'alpha';

engineBeta = new StoreEngine({
a: 10,
c: 20,
d: 30,
}, {
setA: update((actions, a) => () => ({ a })),
addAllToD: () => ({ a, c, d }) => {
  const sum = a + c + d;
  return Object.assign({}, {
    a,
    c,
    d: sum,
  });
},
});

engineBeta.name = 'beta';

```

Instead of blending the state and actions we want to name-space each one based on the engine name 
(an ad-hoc property we slap on the engine post-construction). 

Because state reduction is done in the context of RxJS it operates on the states themselves, so we use
the index of the current item as a hint:

```jsx harmony`
blend = new StoreEngineReducer([engineAlpha, engineBeta], {
stateReducer: (memo, state, i) => {
  const out = { ...memo };
  const keys = Object.keys(state);
  switch (i) {
    case 0:
      keys.forEach((name) => {
        out[`${name}-alpha`] = state[name];
      });
      break;

    case 1:
      keys.forEach((name) => {
        out[`${name}-beta`] = state[name];
      });
      break;

    default:
  }
  return out;
},
```
...actions are a lot easier as the actionReducer has access to the entire engine. 

```jsx harmony
// ...
actionReducer: ({ engines }) => engines.reduce((actions, engine) => {
  const out = { ...actions };
  const keys = Object.keys(engine.actions);

  keys.forEach((name) => {
    out[`${name}_${engine.name}`] = engine.actions[name];
  });

  return out;
}, {}),
});

```

Now the state is expressed out to namespaced properties. 

```jsx harmony

console.log(blend.state);

/**
* 
{
    'a-alpha': 1,
    'a-beta': 10,
    'b-alpha': 2,
    'c-alpha': 3,
    'c-beta': 20,
    'd-beta': 30,
}
*/

```

as is shown in the tests, this rebranding of state is *not* present in the action code; they are still
attached to the localized values of state. 
