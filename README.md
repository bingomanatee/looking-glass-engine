This is an attempt next redesign the functionality of Looking Glass Engine 
with a simpler interface for change tracking. Looking Glass 3 has a lot of moving parts
and it is harder than necessary to infer functionality from source.

LGE 3.4 is a complete rebuild and redesign with its own API / interface. 

Here are the primary values of LGE Streams:

* They are **synchronous** - changes input into a stream is immediately reflected in its 
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

If the function doesn't throw it must return a value - either the first parameter or a 
sanitized version of it. 

```javascript

const abs = (n, stream) => {
    if (typeof n !== 'number') throw new Error(`${n} must be a number`);
    return Math.abs(n);
};

const filtered = new ValueStream(3).filter(abs);

```

## finalize((event, stream)) 

finalize takes a function that accepts an Event - a Subject with a value 
that will be committed; it listens after finalize 
(and almost all other stages in the next sequence). The second argument is the
ValueStream itself, useful if you want to check the current value of the stream.

Unlike filter, the function's output is not meaningful.

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

ValueMapStreams extends ValueStreams, and has the same constructor profile.
They manage an internal javascript Map. A ValueMapStream will accept an object value in its 
constructor, but it will translate that object into a Map. 

**A note on "Map Integrity"/new keys **

ValueMapStream is designed with the idea of a "fixed map" in which keys are not
created or deleted. That being said, there are also no code guards put in place 
to *prevent* you from adding new keys to the map. 

`set[newField](value)` actions will not *necessarily* be available for fields un-defined
at the streams' creation, but the `myStream.set(newKey, newValue)` will work and 
emit events as normal.

In any event there's no harm in initializing any needed fields in the constructor even if
you do so with an undefined value, so that the setField actions can be made 
available. 

## method `set(key, value) or set(Map)`

sets a single field, or several fields at once; merges the new values into 
the current ValueMapStream's Map value. 

## method` onField((event<Subject>, stream) => {...}, name, stage = E_PRECOMMIT) or ((event<subject>, stream) => {...}, [names]), stage)`

onField listens for events in which a field is updated (set). 

onField takes a function that accepts an Event. unlike filter, the output is not meaningful.
See the [Advanced Readme](/ADVANCED_README.md) for details on the Event class.

 * to change the fields, send a new map (or the same map, altered) to event.next(). 
 * To abort the event, call event.error(err).
 * To abort the update without emitting errors, call event.complete();
 
onField hooks will not respond to valueMapStream.next(map) wholesale updating of the map; 
 if you want to use onField filters, avoid using .next(map). 
 
## method `watch(field, field..., (isEqual: fn?)) or watch([field1, field2...]): Subject`
 
returns a subject which emits when a particular field or fields are updated. 
By default it compares field for field via lodash.`isEqual`. If you want to use another comparator
(as an argument to `rxjs.distinctUntilChanged`) pass the comparator as the last function. 

The output of this method is a subject which can be `subscribe`'d to; 
you can save the output and `.unsubscribe()` if you want to cancel the effects of the subscription. 

### A note on sequencing

Watch observers wait for any "next" events to complete before emitting change. This means
that watch will be notified after any subscriptions to the root object and after any "next"
event observers. 
 
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


# Interoperating with React

There's more than one way to do this. The primary concern is whether
the ValueStream/ValueMapStream is bound to a particular component (Localized)
or shared amongst multiple components. 

## Localize to a view

You can create a store and keep it within state hooks:

```javascript

const ViewWithStore = (props) => {

const [store, setStore] = useState(null);
const [value, setValue] = useState(new Map());

useEffect(() => {

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

class MyClass extends Component {

  constructor( props) {
    super(props);
    this._store = new ValueMapStore({x: 0, y: 0});
   this.state = this._store.value;
}

  componentDidMount() {
    this._sub = this._store.subscribe((map) => {
      this.setState(new Map(map))
    });  
  }

  componentWillUnmount() {
    if (this._sub) this._sub.unsubscribe();
  }
// ....
}

```

Global stores can be provided in context, or simply linked as a module when needed and 
subscribed to as above. 

If you want to get familiar with interrupt and eventing
in LGE, review the [ADVANCED_README](/ADVANCED_README.md)
