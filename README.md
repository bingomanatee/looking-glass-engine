This is an attempt next redesign the functionality of Looking Glass Engine 
with a simpler interface for change tracking. Looking Glass 3 has a lot of moving parts
and it is harder than necessary to infer functionality from source.

LGE 3.4 is a complete rebuild and redesign with its own API / interface. 

Here are the primary values of LGE Streams:

* They are **synchronous** - changes input into a stream immediately appear in its 
  value property (or ejected out as errors). This means that all the hooks 
  (filter, finalize, etc.) are also synchronous. If you want to do async behavior
  either encase it in an action or perform it outside the valueStream.
* They are **interrupt-able** - you can write filters or finalize hooks to block bad data
  or create side effects to data being update. 
* They are interoperable with the powerful **[rxjs](https://rxjs.dev/guide/overview)** 
  streaming API to control or augment broadcasting of updates. 
* they can be decorated with **actions** to provide custom interactions with data
  
# Components

## ValueStream

A ValueStream is a curated single-value observable that translates an update request (from next(value)). 
It is a wrapper for an internal [BehaviorSubject](https://www.learnrxjs.io/learn-rxjs/subjects/behaviorsubject), 
and as such, it has the affordancesof a subject -- `subscribe`, `value`, `pipe`, `error`, and `complete`. 

ValueStreams have an independent error stream - for the most part, errors that happen
internally or that are thrown by the event system are expressed from that stream. 
Unlike most subjects, ValueStreams persist even if errors occur, 
as those errors route a separate subject. 

### `ValueFastStream`

A "fast" variant of the ValueStream class; its not filterable or interruptable
but it has fewer moving pieces than the ValueStream. In most ways its interface
is identical to ValueStream. The notable methods that Fast streams lack 
are `onField`, `filter` and `finalize`.

### `ValueObjectStream`

ValueObjectStream uses an object instead of a Map as its fundamental unit of storage.
While objects aren't as flexible as Map for key/value storage there are applications
in which a "POJO" is the necessary unit of storage for a particular purpose. 

The API for ValueObjectStream is identical to that of ValueMapStream. 
(the "Fast" version will come in a future upgrade)

## constructor(value, {name, filter, finalize}) 

sets the initial value of the state. The second parameter is optional; it lets you set 
hooks (described below) in the constructor. 
 
The initial value of the stream doesn't pass through the filter or finalize
hooks; to ensure the stream's value passes through these hooks, manually set a value
via stream.next(value). (filter/finalize not available for ValueFastStream)

## subject interface methods

* `next(value)` - sends a new value to any subscribers
* `getValue()` - returns the streams' current value. (=== `mystream.value`)
* `subscribe(next, error, done)` or `(subscribe({next, error, done))` -- receives updates from value changes.
* `pipe(...rxjs operators)` - returns a modified subject. note-- the pipe operators
  won't apply to any subscribers to the original stream, only those to the modified subject. 
  It's pipes the internal `valueSubject` property - a BehaviorSubject that stores the ValueStream's value.
* `complete()` -- prevents further change and emission of messages from the stream
*` error(err)` -- will *not* terminate the ValueStream. 

### method: filter(fn) 

*Not available for ValueFastStream* 

filter allows you to write a function to either sanitize or block a next-submitted value.
the output of the function is the next value of the stream. Throwing an error will abort 
the update and retain the current value of the stream. 

its best used to either sanitize updates (trim strings, remove empty values from arrays)
or to prevent bad data from being admitted to the stream's value by throwing errors. 

If the function doesn't throw it **must return a value** - either the first parameter or a 
sanitized version of it. Failing to do so will set the streams' value to undefined. 

```javascript

const abs = (n, stream) => {
    if (typeof n !== 'number') throw new Error(`${n} must be a number`);
    return Math.abs(n);
};

const filtered = new ValueStream(3).filter(abs);

```

## finalize((event, stream))

*Not available for ValueFastStream*

finalize takes a function that accepts an Event - a Subject with a value 
that will be committed; it listens after finalize 
(and almost all other stages in the next sequence). The second argument is the
ValueStream itself, useful if you want to check the current value of the stream.

Unlike filter, the function's output is not meaningful.

 * to change the next value of the stream, send a new value to event.next(). 
 * To abort the update, call event.error(err). 
 
## ValueMapStream

ValueMapStreams extends ValueStreams, and has the same constructor profile.
They manage an internal javascript Map. A ValueMapStream will accept an object value in its 
constructor, but it will translate that object into a Map.

If you need the map transpiled into an Object, use the `myStream.object` 
property. 

As with ValueStream, there is a `ValueMapStreamFast` class that manages
most of the functionality described below without the event middleware. 

### method `set(key, value) or set(Map)`

sets a single field, or several fields at once; merges the new values into 
the current ValueMapStream's Map value. `myStream.set(map)` is functionally
identical to `myStream.next(map)`

### method` onField((Event, stream) => {...}, name, stage = E_PRECOMMIT)` 

or `((Event, stream) => {...}, [names]), stage = E_PRECOMMIT)`

*Not available for ValueFastMapStream*

onField listens for events in which a field is updated (set). 

onField takes a function that accepts an Event. unlike filter, the output is not meaningful.
See the [Advanced Readme](/ADVANCED_README.md) for details on the Event class.

Note that the event that the hook takes may have field changes to other events.
If you want to "cancel" an update to a specific field, change the transmitted value
by resetting its value for a field to the value currently stored by the store (provided as the second argument)
that are being updated by set

 * to change the fields, send a new map (or the same map, altered) to event.next(newMap). 
 * To abort the event, call event.error(err).
 * To abort the update without emitting errors, call event.complete();
 
onField hooks *will* respond to valueMapStream.next(map) wholesale updating of the map, 
IF the value has changed AND the function has not been triggered in the set phase.
However they will only execute on next OR on individual set - not both. 

### method `watch(field, field..., (isEqual: fn?)) or watch([field1, field2...]): Subject`
 
returns a subject which emits when a particular field or fields change. 
This is useful when you want to only react to a specific range of field updates
and ignore any updates to other field, much like the `effects` hook in React. 

The output of this method is a Subject which can be `subscribe`'d to. 
Its important to understand that watch(fields...) doesn't do anything directly
*until* you subscribe to its output; and like all Subject subscriptions you can cancel
it at any time. 
 
The definition of "Change" is determined by comparing the watched fields;
by default it compares before/after field values via lodash.`isEqual`. 
If you want to use another comparator (as an argument to `rxjs.distinctUntilChanged`)
pass the comparator as the last function. 

### property `my`

my is an objectified version of the value; its a proxy to value (where proxies are available)
that allows dot-access to the current maps value; useful for deconstruction or injection to React components.

The difference between `.my` and `.object` is that in environments where Proxy
is available, it doesn't manufacture an object on each call, but uses a shared proxy. 
Creating a new object instance just to deconstruct it for a single field is wasteful. 

In any event, don't deconstruct or capture `my` as its own thing as in `const asObject = streamInstance.my`;
it can have varying effects from browser to browser. If you want to deconstruct or shapshot an object of values
use `.object` which always produces a new object. 

# Adding actions to a stream.

passing a ValueStream or ValueMapStream instance through addActions will
add a series of user defined actions to the streams' `do` property. Wrapping a ValueMapStream with 
addActions will also add set hooks to do; for instance if you have a key 'comment' in your stream, 
`myStream.do.setComment(string)` is the equivalent of `myStream.set('comment', string`.

The first argument into the method is always a reference to the stream itself. 

The reason that streams don't come with actions inherent is that streams can be nested,
and its better to add the overhead of actions on a case by case basis.

### binding actions

The fact that the context (stream) is passed to every action automatically
obviates the need for "this" to be meaningful. In fact there is no binding
done in the code of addActions to any of the passed-through methods. 

### addActions(stream, {actions})

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

actions can be used to: 

* update several fields with one call
* reduce several fields into a computed value (rounding, summing, etc).
* perform an async action such as pulling data from a network endpoint or saving
  data via REST.
* creating a computed state or stateSummary such as `record.do.isSaveable()` 

### Adding new actions

Although in general post-modifying the actions of a Stream is not a good 
idea, you can do so with `myStream.addAction(name, value)` to any stream
that has been passed through `addActions()`.

# Interoperating with React

There's more than one way to do this. The primary concern is whether
the ValueStream/ValueMapStream is bound to a particular component (Localized)
or shared amongst multiple components. 

## Localize to a view

You can create a store and keep it within state hooks:

```javascript

const ViewWithStore = (props) => {

const [store, setStore] = useState(null);
// note - we subscribe every update of xyStore locally
// to keep react updating with the store; its not directly used.   
const [value, setValue] = useState(new Map());

useEffect(() => {

const xyStore = addActions(new ValueMapStore({x: 0, y: 0}),
    {
      offset(str, dX, dY) {
        const next = new Map(str.value);
        next.set('x', str.my.x + dY)
        next.set('y', str.my.y + dY)
        str.set(next);
      },
      magnitude({ object: { x, y } }) {
        return Math.round(Math.sqrt(x ** 2 + y ** 2));
      },
    });

  const sub = xyStore.subscribe(setValue);
  setStore(xyStore);

    return () => sub.unsubscribe();
}, []);

if (!store) return '';
  return <PureView  {...store.object} actions={store.do} />
}
```

Or, in a class-based component. Note - in this case we echo the store's
state into the class component which is probably redundant - 
acessing state directly off `this._store` is better. 

```javascript

class MyClass extends Component {

  constructor( props) {
    super(props);
    this._store = addActions(new ValueMapStore({x: 0, y: 0}));
   this.state = this._store.value;
}

  componentDidMount() {
    this._sub = this._store.subscribe(() => {
      this.setState(this._store.object)
    });  
  }

  componentWillUnmount() {
    if (this._sub) this._sub.unsubscribe();
  }
// ....
  
  render() {
    return <PureView {...this._store.object} actions={this._store.do} />
  }
}

```

Global stores can be provided in context, or simply linked as a module when needed and 
subscribed to as above. 

## Immutability 

Immutable values can be stored in map keys; however if you want to make the entire
store immutable you should `.pipe()` the store out to a separate Subject that `map()`s
the map into an immutable context. For what its worth, the root value of 
a ValueMapStream/ValueObjectStream is always unique, recreated with every `next(value)`.

## Eventing, field subjects and other advanced features

If you want to get familiar with eventing in LGE, review the [ADVANCED_README](/ADVANCED_README.md).
Eventing is not critical in all use cases; its how `filter(fn)` and `finalize(fn)`
are managed, and its how you can do other mid-change operations to enforce schema.

