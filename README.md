The Looking Glass engine is an evolution from Freactal that takes models from Redux (that work) and models from Freactal
and saga (that work) and removes the elements of Freactal that do not (shadowing, no control over store combination)
and the elements of Redux that do not (massive verbosity) and similar problems with Saga.

The fulcrum of Looking Glass is a Store system that takes change in any of many forms - delta functions , promises, 
promises that return delta functions, absolute values -- and boils them down to a value that State needs to be set to. 

This boildown is synchronous _until a promise is encountered_, at which case the change is deferred until it resolves. 

This means you can insert an ajax request, get the data, then return a function to blend that data into the current state.
You can even _not_ do so at the last minute if the current state condition has changed. 

# Stores

A store is a mutable record of data that manages change. It has RxJS streams "Under the hood" so you can `.subscribe()`
to change streams in the same manner as an RxJS stream. **TLDR**: if you pass a `.subscribe(listener)` to a store you get a
message each time the store changes. You also get a subscriber back, so you can stop listening.

```jsx harmony

const teaStore = new Store({teas: [
  {
    id: 11151215,
    name: 'The Whizzer',
    price: 12.34
  },
  {
    id: 2152265,
    name: 'Thunderdome 1000',
    price: 55
  }
]});

let sub = teaStore.subscribe((store) => {
  console.log('you have ', store.teas.length, ' teas for sale: ', ...store.teas.map(t => t.name));
  if (store.teas.length > 3) sub.unsubscribe();
});

teaStore.change((state) => {
  let out = {...state};
  out.teas = [...state.teas, {id: 11525, name: 'Ragin Cajun', price: 15.50}];
  return out;
})

teaStore.change((state) => {
  let out = {...state};
  out.teas = [...state.teas, {id: 11525, name: 'Ragnarok', price: 35.50}];
  return out;
})

teaStore.change((state) => {
  let out = {...state};
  out.teas = [...state.teas, {id: 11525, name: 'Afternoon Terminator', price: 2.25}];
  return out;
})

```

will render:

```jsx harmony

"you have 2 teas for sale, The Whizzer, Thuinderdome 1000" // will trigger on initial value
"you have 2 teas for sale, The Whizzer, Thuinderdome 1000, Ragin Cajun" // on first addition
"you have 2 teas for sale, The Whizzer, Thuinderdome 1000, Ragin Cajun, Ragnarok" // on second addition; then unsub hit
// Afternoon thunder changes, but does not trigger the subscriber.

```

## Initializing a Store

A store can be built up in one of many ways: 

### An initial value

```jsx harmony

const teaStore = new Store({teas: [
  {
    id: 11151215,
    name: 'The Whizzer'
  },
  {
    id: 2152265,
    name: 'Thunderdome 1000'
  }
]});

Store.initialize();

```

### An initializing function

```jsx harmony

const teaStore = new Store(() => axios.get(API_URL + '/teas').then(result => result.data));

```

### Both

```jsx harmony

const teaStore = new Store({
   store: {teas: []}, 
   initializer: () => axios.get(API_URL + '/teas').then(result => result.data)
});
   
```

The catch is, if you do not set the initial value, the first value of the store will be the symbol 
`STORE_STATE_UNSET_VALUE`. 

All change is deferred until the Store is initialized.
Stores also have a `.status` property that reflects whether the store has been initialized; it goes through 
the following phases: 

* STORE_STATUS_NEW,
* STORE_STATUS_INITIALIZING,
* STORE_STATUS_INITIALIZED,

(and hopefully never) 

* STORE_STATUS_INITIALIZATION_ERROR

All change that is requested before the store is initialized is deferred. 

## Changing State

The store's state is updated with a method `.change([variant])`. Change returns a promise that when done,
indicates the change has been resolved. _however_: change will attempt to resolve the change synchronously
if it is possible. 

Even the initial state and the initializer are special case change requests. They pass through because they have a
status field that indicates they are status-changes. 

# Engines

If you want to manage change flow externally a store is fine. If you want to create an API into a Store you want an Engine.
Engines extend Stores. There are two things about them that are different:

1. They will automatically call their initialize() method.
2. They have actions, which are named "change triggerers". 

```jsx harmony

let teaStore = new Engine({state: {
  teas: [],
  receipts: [],
  customerVisits: 0
}}, {
  reset: () => ({teas: [], customerVisits: 0, receipts: []}),
  incCustomerVisits: () => {
    return (state) => {
      let customerVisits = state.customerVisits + 1;
      return {...state, customerVisits}
    }
  },
  sellTea: (actions, type, qty = 1) => (state) => {
    let tea = state.teas.filter(t => t.type === type);
    if (!tea) return state;
    let saleValue = tea.price * qty;
    let receipt = {tea: type, qty, saleValue};
    let receipts = [...state.receipts, receipt];
    return Object.assign({}, state, {receipts});
  },
  addReceipt: (actions, receipt) => {
    return (state) => {
    let receipts = [...state.receipts, receipt];
    return Object.assign({}, state, {receipts});
    }
  },
  postTeaSale: (actions, type, qty = 1) => (state) => {
    return axios.put(API_URL + '/sales', {type, qty})
    .then(r => r.data)
    .then(({receipt}) => {
      return actions.addReceipt(receipt)
    });
  })
});

```

Lets walk down the actions one by one:

* **reset** is a function that returns an absolute object. It doesn't care what the state was, it rams a value
  into state directly. It's synchronous.
* **incCustomerVisits** returns a delta - a function that changes the shop's customer visits count in the state by 
  incrementing it by one. Its synchronous. 
* **sellTea** is a more complex, but still synchronous action, with parameters. It takes those parameters and 
  saves them into receipts, using the state tea list as a basis for cost. 
* **postTeaSale** is a promise based action that returns a promise that when unravelled, calls another action
  -- the synchronous **addReceipt** -- that adds the result of a remote call to the receipts list. 
  note that since actions all return the last state (ultimately), it's legitimate to return an action result
  from an action.
  
So an action is always a function. Its first argument is the actions collection itself; any other parameters follow.

An action can return:

* A value (that replaces state)
* A function (that takes state and returns a new state)
* A function (that calls actions and has no return: a "void action")
* A function that returns a promise whose result is a function (that takes state then returns a new state)
* A function that returns a promise whose result is an object (that replaces state)

... so basically the only criteria are the *beginning of the trip*(a function whose first params is args, and 
that passes along user input) 

...and the end of the trip (a delta function that modifies state) or (a value to replace state).

# EngineMerger

As with Redux you may want to express state into a series of Engines. one for the user, one for ths
shop, one for navigation, etc. You can do so with no interaction, but if you want your engines to use each 
other's actions, you'll have to merge states with EngineMerger. Engine merger takes an object or array
of states and combines them.

```jsx harmony

let userEngine = new Engine({
userID: 0,
loggedIn: false,
loginResult: null,
userName: null,
shoppingCart: []
}, {
  logOut: () => ({
                 userID: 0,
                 loggedIn: false,
                 loginResult: null,
                 loggedInUserName: null,
                 shoppingCart: []
                 }),
  logIn: (actions, userName, password)=> {
      // note: some obfuscation of password better in a real app
      return axios.post('/login', {userName, password})
      .then((data) => data.json())
      .then((user) => {
        return (state) => ({loggedInUserName: user.name, loggedIn: true});
      })
      .catch((err) => (state) => {
        return {...state, loginResult: err, loggedIn: false};
      });
    },
    
    addToCart: (actions, item) => (store) => {
        let shoppingCart = [...store.shoppingCart, item];
        return {...store, shoppingCart};
    }
})

let teaEngine = new Engine({state: {
  teas: [],
  receipts: [],
  customerVisits: 0
}}, {
  reset: () => ({teas: [], customerVisits: 0, receipts: []}),
  incCustomerVisits: () => {
    return (state) => {
      let customerVisits = state.customerVisits + 1;
      return {...state, customerVisits}
    }
  },
  addToCart: (actions, name, qty) => {
    actions.user.addToCart({name, qty});
    // returns nothing.
  },
  sellTea: (actions, type, qty = 1, userName) => (state) => {
    let tea = state.teas.filter(t => t.type === type);
    if (!tea) return state;
    let saleValue = tea.price * qty;
    let receipt = {tea: type, qty, saleValue};
    let receipts = [...state.receipts, receipt];
    return Object.assign({}, state, {receipts});
  },
  addReceipt: (actions, receipt, userName) => {
    return (state) => {
      let newReceipt = {...receipt, userName};
      let receipts = [...state.receipts, newReceipt];
      return Object.assign({}, state, {receipts});
    }
  },
  postTeaSale: (actions, userName, type, qty = 1) => (state) => {
    return axios.put(API_URL + '/sales', {type, qty})
    .then(r => r.data)
    .then(({receipt}) => {
      return actions.addReceipt(receipt, userName)
    });
  });
});

let baseStore = new EngineMergeer({engines: {user: userEngine, teas: teaEngine}});

```

Even though the actions now have acesss to each other (see addToCart) in a named collection based on the hash
you passed into baseStore, they don't have access to each others' state. Every action's delta function takes
in and returns *the state from its original engine* so even the merged actions in baseStore cant directly cross-
contaminate each other. You need to do so through arguments to the action.

***Word of warning***: because actions return the modified state (as a promise), *never return another engine's action
results from one of your own actions*. Best to return a no-op delta (or nothing). 

## Injecting state into React (or anywhere else) 

Although we could write custom HOC to do this (and might), the best way to manage state is to use React's 
native concepts of Context to manage state yourself. 

To do so follow the following pattern: 

1. Create an Engine. (or perhaps many merged engines) This doesn't have to occur inside a React component - you can
   bring it in from outside.
   
2. Assign its' store value to a components' state.

3. Inject that state into a react context in the render cycle. 

4. Subscribe to state change in componentDidMount and send that back to state. 

Here is how you would set up a shared state in root. 

```jsx harmony

// see above for store defs
export const baseStore = new EngineMergeer({engines: {user: userEngine, teas: teaEngine}});

export const StoreContext = React.createContext(baseStore.state);

export default class App extends React.PureComponent {
  static contextType = StoreContext;
  
  constructor(props) {
    super(props);
    // storing both the store and its resulting state in component state
    this.state = {baseState: baseStore.state, baseStore };
  }
  
  componentDidMount() {
    this.baseStore.subscribe(baseState => this.setState({baseState}));
  }
  
  render() {
    return <StoreContext.Provider value={(
      {
      actions: baseStore.actions,
       state: this.state.baseState
      }
    )}>
    {this.props.children}
    </StoreContext.Provider>
  }
}

```

In any child you can then pull state out of Context: 

```jsx harmony

import {StoreContext} from '../App.';

export default class UserDisplay extends React.PureComponent {
  static contextType = StoreContext;
  
  constructor(props) {
      super(props);
      this.state={userName: '', password: ''}
  }
  
  setUserName(userName) {
    this.setState({userName});
  }
  
  setPassword(password) {
    this.setState({password});
  }
  
  render() {
    return <div>
    {this.context.state.user.loggedIn && <span>{this.context.state.user.loggedInUserName}</span>}
    {!this.context.state.user.loggedIn && (
      <div>
      
      <div>
      <label>Username:</label>
      <input type="text" value={this.state.userName} 
      onChange={(event) => this.setUserName(event.target.value)} />
      </div>
      
      <div>
      <label>Password:</label>
      <input type="password" value={this.state.password}
       onChange={(event) => this.setPassword(event.target.value)} />
      </div>
      
      <div>
      <Button onClick={
            this.context.actions.logIn(this.state.userName, this.state.password)
          }}>Log In!</Button>
          </div>
      </div>
    )}
    </div>
  }
}

```

As this shows, you can use local state where practical, and get access both to Engine state and engine actions
through context. 

Note you can also inject a locally existent state to perform localized management:

```jsx harmony

import {StoreContext} from '../App.';

export default class UserDisplay extends React.PureComponent {
  static contextType = StoreContext;
  
  constructor(props) {
      super(props);
      this.store = new Engine({userName: '', password: ''}, {
        setUserName: (actions, userName) => (state) => ({...state, userName}),
        setPassword: (actions, password) => (state) => ({...state, password})
      })
      
      this.state = {...this.store.state}}
  }
  
  componentDidMount() {
    this.store.subscribe((state) => this.setState(state));
  }
  
  componentWillUnmount() {
    this.store.stop();
  }
  
  render() {
    return <div>
    {this.context.state.user.loggedIn && <span>{this.context.state.user.loggedInUserName}</span>}
    {!this.context.state.user.loggedIn && (
      <div>
      
      <div>
      <label>Username:</label>
      <input type="text" value={this.state.userName}
       onChange={(event) => this.store.actions.setUserName(event.target.value)} />
      </div>
      
      <div>
      <label>Password:</label>
      <input type="password" value={this.state.password}
       onChange={(event) => this.store.actions.setPassword(event.target.value)} />
      </div>
      
      <div>
      <Button onClick={this.context.actions.logIn(this.store.state.userName, this.store.state.password)}}>
      Log In!
      </Button>
      </div>
    )}
    </div>
  }
}

```

The local store for userName and password dumps continually to state, due to the componentDidMount binding of 
store to state. 

# Linking without context

If you want to directly inject state without context, you can publish your store object and bring it into 
state wherever you wish to include it. This is especially useful for Angular or Preact (without context partches).

```jsx harmony

import {baseStore} from '../App.';

export default class UserDisplay extends React.PureComponent {
  static contextType = StoreContext;
  
  constructor(props) {
      super(props);
      this.store = new Engine({userName: '', password: ''}, {
        setUserName: (actions, userName) => (state) => ({...state, userName}),
        setPassword: (actions, password) => (state) => ({...state, password})
      })
      
      this.state = {...this.store.state, loggedInUserName: baseStore.state.loggedInUserName, loggedIn: baseStore.state.loggedIn}}
  }
  
  componentDidMount() {
    this.store.subscribe((state) => this.setState(state));
    baseStore.subscribe(({loggedInUserName, loggedIn}) => {this.setState({loggedInUserName, loggedIn});})
  }
  
  componentWillUnmount() {
    this.store.stop();
  }
  
  render() {
    return <div>
    {this.context.state.user.loggedIn && <span>{this.state.loggedInUserName}</span>}
    {!this.context.state.user.loggedIn && (
      <div>
      
      <div>
      <label>Username:</label>
      <input type="text" value={this.state.userName}
       onChange={(event) => this.store.actions.setUserName(event.target.value)} />
      </div>
      
      <div>
      <label>Password:</label>
      <input type="password" value={this.state.password}
       onChange={(event) => this.store.actions.setPassword(event.target.value)} />
      </div>
      
      <div>
      <Button onClick={baseStore.actions.logIn(this.store.state.userName, this.store.state.password)}}>
      Log In!
      </Button>
      </div>
    )}
    </div>
  }
}

```

