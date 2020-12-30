This is an attempt next redesign the functionality of Looking Glass Engine 
with a simpler interface for change tracking. Looking Glass 3 has a lot of moving parts
and it is harder than necessary to infer functionality from source.

LGE 3.4 is a complete rebuild and redesign with its own API / interface. 

Here are the primary values of LGE Streams:

* They are **synchronous** - changes input into a stream is immediately reflected in its 
  value property (or ejected out as errors). This means that all the hooks 
  (filter, finalize, etc.) are also synchronous. If you want to do async behavior
  either encase it in an action or perform it outside the valueStream.
* They are **interruptable** - you can write filters or finalize hooks to block bad data
  or create side effects to data being update. 
* They are interoperable with the powerful **[rxjs](https://rxjs.dev/guide/overview)** 
  streaming API to control or augment broadcasting of updates. 
* they can be decorated with actions to provide custom interactions with data
  
# Components

## ValueStream

A ValueStream is a curated observable that translates an update request (from next(value)). 
It is a wrapper for an internal BehaviorSubject, and as such, it has the affordances
of a subject -- subscribe, value/getValue(), pipe, error, and complete. 

ValueStreams have an independent error stream - for the most part, errors that happen
internally or that are thrown by the event system are routed towards that. Unlike most 
subjects, ValueStreams persist even if errors are thrown in their processes, 
as those errors are diverted to a seperate subject. 

## constructor(value, {name, filter, finalize}) 

sets the initial value of the state. The second parameter is optional; it lets you set 
hooks (described below) in the constructor. 
 
The initial value of the stream doesn't pass through the filter or finalize
hooks; to ensure the stream's value passes through these hooks, manually set a value
via stream.next(value). 

## subject interface methods

* `next(value)` - sends a new value to any subscribers
* `subscribe(next, error, done)` or `(subscribe({next, error, done))` -- receives updates from value changes.
* `pipe(...rxjs operators)` - returns a modified subject. note-- the pipe operators
  won't apply to any subscribers to the original stream, only those to the modified subject. 
  It's pipes the internal `valueSubject` property - a BehaviorSubject that stores the ValueStream's value.
* `complete()` -- prevents further change and emission of messages from the stream
*` error(err)` -- will *not* terminate the ValueStream. 

### method: filter(fn) 

filter allows you to write a function to either sanitize or block a next-submitted value.
the output of the function is the next value of the stream. Throwing an error will abort 
the update and retain the current value of the stream. 

its best used to either sanitize updates (trim strings, remove empty values from arrays)
or to prevent bad data from being admitted to the stream's value by throwing errors. 

```javascript

const abs = (n, stream) => {
    if (typeof n !== 'number') throw new Error(`${n} must be a number`);
    return Math.abs(n);
};

const filtered = new ValueStream(3).filter(abs);

```

## finalize((event, stream)) 

finalize takes a function that accepts an Event - a Subject that has a value 
that will be committed; it listens after finalize (and almost all other stages in the 
next sequence). 
unlike filter, the function's output is not meaningful.

 * to change the next value of the stream, send a new value to event.next(). 
 * To abort the update, call event.error(err). 

note - finalize is a good way to make streams immutable; you can use immer to 
wrap the content, or wrap it in an immutable.js Record or List. 

```javascript
import {produce} from 'immer';

 const listStream = new ValueStream(produce([], () => {}), {
        finalize: (event, target) => {
          event.next(produce(target.value, (list) => {
            if (Array.isArray(event.value)) {
              return event.value;
            }
            list.push(event.value);
          }));
        },
      });

```
 
## ValueMapStream

ValueMapStreams are class descendants from ValueStreams. 
They manage an internal javascript Map. It will accept an object value in its 
constructor, but it will translate that object into a Map. 

## method `set(key, value) or set(Map)`

sets a single field, or several fields at once; merges the new values into 
the current ValueMapStream's Map value. 

## method` onField((event<Subject>, stream) => {...}, name) or ((event<subject>, stream) => {...}, [names]))`

onField takes a function that accepts an Event - a Subject that has a value (Map) input into the set method. 
unlike filter, the output is not meaningful.

 * to change the fields, send a new map (or the same map, altered) to event.next(). 
 * To abort the event, call event.error(err). 
 
onField hooks will not respond to valueMapStream.next(map) wholesale updating of the map; 
 if you want to use onField filters, avoid using .next(map). 
 
## property `my`

my is an objectified version of the value; its a proxy to value (where proxies are available)
that allows dot-access to the current maps value; useful for deconstruction or injection to React components. 

# Adding actions to a stream.

passing a ValueStream or ValueMapStream instance through addActions will
add a series of user defined actions to the streams' `do` property. Wrapping a ValueMapStream with 
addActions will also add set hooks to do; for instance if you have a key 'comment' in your stream, 
`myStream.do.setComment(string)` is the equivalent of `myStream.set('comment', string`.

The first argument into the method is always a reference to the stream itself. 

The reason that streams don't come with actions inherent is that streams can be nested,
and its better to add the overhead of actions on a case by case basis.

## addActions(stream, {actions})

Actions is an object with function names as keys and functions as its values.
to update the stream, call methods of that first parameter (next(value), set(key, value), etc).
The actions don't have to return anything OR update the state -- but they can to one or both 
of these things. 

You can write actions that simply reduce or filter the streams' current value; or you can 
update its value with input from other arguments. 

You can call other actions from the first parameter -- via `str.do.otherAction(...)`.

```javascript

const stream = addActions(
    new ValueStream({ x: 0, y: 0 }),
    {
      offset(str, dX, dY) {
        const next = { ...s.value };
        next.x += dX;
        next.y += dY;
        str.next(next);
      },
      magnitude({ value: { x, y } }) {
        return Math.round(Math.sqrt(x ** 2 + y ** 2));
      },
    },
  );

stream.do.offset(2, 5);
test.same(stream.value, { x: 2, y: 5 });
test.same(stream.do.magnitude(), 5);
stream.do.offset(2, 7);
test.same(stream.value, { x: 4, y: 12 });
test.same(stream.do.magnitude(), 13);

```

# Advanced Architecture: stages and events

While you don't have to understand the event structure inside of a ValueStream/ValueMapStream to use streams, 
you might find it helpful if you want to create intercept driven stores a la Saga.

`set` and `next` are both executed in a series of stages. An Event is emitted for each stage,
containing the value (or map in the case of set) in a temporary stream. 

## default stages

Unless modified the following stages happen for each update:

*  `next`: `[E_INITIAL, E_FILTER, E_VALIDATE, E_PRECOMMIT, E_COMMIT, E_COMPLETE]]`
* `set`: `[E_INITIAL, E_RESTRICT, E_FILTER, E_VALIDATE, E_PRECOMMIT, E_COMMIT, E_COMPLETE]`
* (default):  `[E_INITIAL, E_COMMIT, E_COMPLETE]]`

the filter hook acts in the `E_FILTER` stage; finalize occurs in the `E_PRECOMMIT` stage. 
The streams' value is updated in the `E_COMMIT` phase of the next sequence. 

## Events

Events are wrappers for a value, stored in the valueSubject property (a BehaviorSubject)
but exposed through event.value. Events are more or less subjects - they can be 
subscribed to, stopped with an error(err) that will emit through the stream;
and complete() will suspend their operation silently. note - complete() and error()
will prevent subsequent stages - but not subsequent stages for the current hook. 
If you are concerned, check the `event.isStopped` property inside your hooks first. 

## method on(hook, onAction = A_NEXT, onStage = E_FILTER, onValue)

`on(...)` allows you to intercept events for a particular action and/or stage. you can
also pass a function for any of these parameters to return a true/false value when passed
an action, stage or value; only when all functional parameters return true will the hook
be applied. 

## method when(hook, EventFilter) 

You can define which triggers a hook responds to in an EventFilter; check the source
for examples of useful EventFilters. 

## method setStages(action, [...stages])

within a stage hooks execute in order of creation. If you want 
more control over what is executed when, feel free to add extra stages to your stream
to ensure hooks perform in the order you want. 

# Interoperating with React

There's more than one way to do this. The primary concern is is the valueStream/ValueMapStream
bound to a particular component or is it shared amongst multiple components?

## localize to a view

You can create a store and keep it within state hooks:

```javascript

const ViewWithStore = (props) => {

const [store, setStore] = useState(null);
const [value, setValue] = useState(new Map());

useEffect(() ={

const mewStore = new addAction(ValueStore({x: 0, y: 0}),
    {
      offset(str, dX, dY) {
        const next = { ...s.value };
        next.x += dX;
        next.y += dY;
        str.next(next);
      },
      magnitude({ value: { x, y } }) {
        return Math.round(Math.sqrt(x ** 2 + y ** 2));
      },
    });

  const sub = newStore.subscribe(setValue);
  setStore(newStore);

    return () => sub.unsubscribe();
}, []);

if (!store) return '';

  return <PureView  {...value} actions={store.my} />
}
```

Or, in a class-based component, 

```javascript

const MyClass extends Component {

  constructor( props) {
    super(props);
    this._store = new ValueStore({x: 0, y: 0});
   this.state = this._store.value;
}

  componentDidMount() {
    this._sub = this._store.subscribe(this.setState.bind(this));  
}
  componentWillUnmount() {
  if (this._sub) this._sub.unsubscribe();
}
// ....
}

```

Global stores can be provided in context, or simply linked as a module when needed and 
subscribed to as above. 
