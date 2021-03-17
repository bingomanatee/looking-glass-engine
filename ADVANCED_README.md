# Advanced Architecture

While you **_don't have to understand the event structure_**
inside ValueStream/ValueMapStream to use streams,
you might find it helpful if you want to create intercept driven stores a la Saga.

## A note on "Fast" Streams

The following stage systems do of course have some performance costs. 
Where eventing features are NOT useful in the application, you can use the
`ValueMapStreamFast` and `ValueStreamFast` base classes; these should perform
exactly like their evented counterparts but have fewer moving parts, at the
cost of fewer opportunities to massage the data they manage.

## Stages and events

`set` and `next` updates are both executed in a series of stages. 
An Event is emitted for each stage, containing the value (a map in the case of ValueMapStream). The execution of the desired effect is accomplished with 
The transmission of the event's value to the ValueStream/ValueMapStream 
occurs a hook listener -- generally on the `E_COMMIT` stage - that communicates
the event's value into the Stream. At any point 
prior to that stage the committed value can be updated or filtered, or the 
event can be suspended via `event.complate()` or `event.error()` 
to prevent the effect from occurring. 

You can create your own listeners to react to the event or curate 
which events you want to allow. For instance if you want to ensure that only 
known fields are in a ValueMapStream you can either remove unwanted values 
or reject events that update unwanted values.

## *WARNING*: calling set/next from set/next functions on ValueMapSet

It's generally a bad idea to call methods or update the stream from inside
an event handler in LGE. 

If you try to update a stream as a response to "set" or "next" watchers, you can generate
race conditions. Your "set" will generate a manifest map from the previous edition of the 
ValueMapStream that evaluates after the triggering event. 

To properly set a store in response to data change, wait for the event to complete
before setting additional field values. The best way to do this is to use `.watch(...)`
listeners, which perform in this matter automatically. 

The best solution you can update the value of the event to include desired side effects in a single
manifest, by using `event.next(updatedMap)` to include side-effects in a single transaction;
note, this will side-step event observers. 

## default stages

Unless modified the following stages happen for each update:

*  `next`: `[E_INITIAL, E_FILTER, E_VALIDATE, E_PRECOMMIT, E_COMMIT, E_COMPLETE]]`
* `set`: `[E_INITIAL, E_RESTRICT, E_FILTER, E_VALIDATE, E_PRECOMMIT, E_COMMIT, E_COMPLETE]`
* (default):  `[E_INITIAL, E_COMMIT, E_COMPLETE]]`

the filter hook acts in the `E_FILTER` stage; finalize occurs in the `E_PRECOMMIT` stage. 
The streams' value is updated in the `E_COMMIT` phase of the next sequence. 

### method on(hook, onAction = A_NEXT, onStage = E_FILTER, onValue)

`on(...)` allows you to intercept events for a particular action and/or stage. you can
also pass a function for any of these parameters to return a true/false value when passed
an action, stage or value; only when all functional parameters return true will the hook
be applied. 

### method when(hook, EventFilter) 

You can define which triggers a hook responds to in an EventFilter; check the source
for examples of useful EventFilters. 

### method setStages(action, [...stages])

within a stage hooks execute in order of creation. If you want 
more control over what is executed when, feel free to add extra stages to your stream
to ensure hooks perform in the order you want. 

### isStopped : boolean

indicates whether the event has completed; in which case any next/error calls would
themselves throw errors.


## Events

Events are wrappers for a value, stored in the valueSubject property (a BehaviorSubject)
but exposed through event.value. Events are more or less subjects - they can be 
subscribed to, stopped with an error(err) that will emit through the stream;
and complete() will suspend their operation silently. note - complete() and error()
will prevent subsequent stages - but not subsequent stages for the current hook. 
If you are concerned, check the `event.isStopped` property inside your hooks first. 

### method: `next(value)`

This updates the value that will be transmitted to the stream (and further handlers).
The system does not ordinarily monitor updates to event values, but you can (see subscribe below).

### method: `error (error)`

This will suspend any further listeners and abort the completion of the event. 
The error will be transmitted to error listeners. 

### method `complete()`

This will suspend any further listeners and abort the completion of the event without
emitting any errors. 

### method `subscrbe(oNext, onError, onComplete) or subscribe({next, error, complete})`

This will listen to any updates to the value of the event, as well as completion.
completion occurs when the event is completely resolved --- OR if a hook silently 
terminates the event. 

### completed : array

a list of the previous stages that the event has traversed. The final stage will still
be available (in stage).

### stage: string?

The current stage the event is traversing. **DO NOT** change this field yourself. 

### target

a reference to the stream that received this event

### value

the value that the event is transmitting. Usually either the core value of a ValueStream
or a map that is a subset of the values (or a single name/value pair) in the case 
of a "set" event. 

# Composing Streams with FieldSubjects

Field Subjects are composed subjects that precede the "set" stream.
If you want to take an RXJS stream, or a LGE stream or anything that meets 
the "subscribe" signature, you can shim them in and they will 
submit their next values into a field of ValueMapSubject. 

Any next() events will change the fields' value. Note - streams
that do not emit a value on subscription (non-BehaviorSubject based
streams and non-LGE streams) will only emit on update. 

You cannot replace a set fieldSubject once defined. (easily, anyway; see
`.delete(key)` below. )

If for instance you want to create a reducer pattern with several
ValueStreamMaps coordinating to a central store, you would define
each ValueStreamMap as a fieldSubject for a central store. Or you can
tie a DOM effect emitter into a fields' value.

Values submitted to a fieldSubject will still trip the usual events
when updated in the parent ValueMapStream -- but they wil do so
after the fieldSubject has processed the value. 

If you call a `set[Fieldname]` action it will delegate to the stream,
as will `set(key, value)`. `myValueMapStream.next()` will not. 

the `mystream.fields` property is a proxy to the internal map of field subjets.
i.e., if you add a field subject, `myUserStream.addSubject('name', firstAndLastNameStream)`,
you can access firstAndLastNameStream via `myUserStream.fields.name`.
If you want to access the current *value* of firstAndLastNameStream, 
the easy way to do it is `myUserStream.my.name` which should equal `myUserStream.fields.name.value`.

## addFieldSubject(key, stream)

Registers a stream as a contributor to a single fields' value. `stream`
can be any Value(Map)Stream(Fast) class from LGE, or any RxJS BehaviorSubject. 
If you want to use a non-behavior-subject stream, pipe that streams' value into a 
BehaviorSubject or a ValueStream. 

# Adding new ValueMapStream keys

The initial design of ValueMapStream was intended to work with a fixed set of keys.
(i.e., a predefiend schema.) That being said, you *can* expand its keys past its initial set. 
(there is an option, new ValueMapStream(seedMap, {noNewKeys: true)), that
tries to watchdog the updates to prevent new keys from being added - its 
largely untested and unavalable for ValueFastMapStream instances. 

`set[newField](value)` actions will not *necessarily* be available for fields un-defined
at the streams' creation, but the `myStream.set(newKey, newValue)` will work and
emit events as normal.

In any event there's no harm in initializing any needed fields in the constructor even if
you do so with an undefined value, so that the `set[Field]` actions can be made
available. 

`set` and `next` may expand the field set of a store; 

## deleting keys

The only way to remove a key
is `.delete(key)`. `delete(key)` *also deletes field subjects; so if you really need to 
redefine a fieldSubject on the fly is by deleting the field/key entirely and re-setting 
the fieldSubject with `.addFieldSubject`

## listening to set results *experimental feature*

Setting a value in a ValueMapStream or ValueObjectStream may OR MAY NOT result in that stream 
having that value. Depending on the filters present in the map, or in a fieldSubject,
the value can be changed en route, or rejected. 

How do you know your set was successful and what the current value is? well `set(key, value)`
and by extension, `myStore.do.setX(value)` return the *event* that was used to update the
value. this event has two properties: value and thrownError that can be examined.

* if **thrownError** is _present_, then the value was probably kept to its previous one 
  (and that is not going to be the value of the event's value).
* If **thrownError** is _not present_ the event's value should be the current value of that field;
  it will be contained in a map/object to represent how it was merged into the current value of the map.
  
## observer(on/when) helper methods

These methods utilize on/when to intercept pending set/next actions. 
They exist in ValueMapStreams and ValueObjectStreams.
onFinalize exists on generic ValueMapStreams as well. 

## `onField(fn, name)` method 

Streams that have been wrapped by the `addActions(stream, actions)` method 
get the onField method.

onField takes a function that accepts an Event. unlike filter, the output is not meaningful.

Note that the event that the hook takes may have field changes to other events.
If you want to "cancel" an update to a specific field, change the transmitted value
by resetting its value for a field to the value currently stored by the store (provided as the second argument)
that are being updated by set. 

* to change the fields, send a new map (or the same map, altered) to event.next().
* To abort the event, call event.error(err).
* To abort the update without emitting errors, call event.complete();

onField hooks *will* respond to valueMapStream.next(map) wholesale updating of the map.
That is for each field set, the hook will execute a second time when the entire value
is updated (the 'A_NEXT' action). If this is a problem (or you only want to act on one
or the other circumstance), watct the event's `.action` property. The second update
always occurs in the `E_PRE_MAP_MERGE` phase, before the updated values are merged into
the current value of the stream.

the name field can be a single name (string), an array of strings, or a function that accepts
a single name (string) and the target. 

## method `finalize(function(event, stream))`

*Not available for ValueFastStream*

finalize takes a function that accepts an Event - a Subject with a value
that will be committed; it listens after finalize
(and almost all other stages in the next sequence). The second argument is the
ValueStream itself, useful if you want to check the current value of the stream.

Finalize intercepts `next` updates to the stream just before they are accepted.

Unlike filter, the function's output is not meaningful.

* to change the next value of the stream, send a new value to event.next().
* To abort the update, call event.error(err). 

# Transactional Locking

This experimental feature has been fully integrated into ValueStreams (except for Fast streams). 

calling `const t = myStream.trans()` temporarily suspend emission of value of the stream until the trans is completed.

This will NOT block events from emitting, or actions from completing  --
but it WILL block the value from being changed until the transaction  `complete()`a. 

At a low level, there is a subject that stores all updates (baseSubject) that emits into valueSubject
only in the abcense of any pending transactions.

So, the existence of incomplete transactions suspends the broadcasting of changes to subscribers, but not
the recording of value updates.

You can provide your own subject to addTrans -- or take a generic one which will be created for you.
for instance, if you want to suspend the updating of a stream on mousedowns you can put `let myTrans = stream.trans(-1)`
on a mouseDown handler and put `if (myTrans) myTrans.complete()` on mouseup/mouseleave handlers.

Both the stream and timeout value of `trans(myStream, lifespan)` are optional; 
so all of these calls are valid:

* `myStream.trans()` -- returns a subject that expires in one second
* `myStream.trans(10000)` -- returns a subject that expires in ten seconds
* `myStream.trans(-1)` -- returns a non-expiring transaction subject
* `myStream.trans(mySubject)` -- returns mySubject -- which will be completed in one second
* `myStream.trans(mySubject, -1)` -- returns mySubject which won't be forced to expire ever
* `myStream.trans(mySubject, 10000)` -- returns mySubject, which will be foreced to expire in ten seconds

## lifespan of transactions

Given that transactions suspend functionality of streams they are dangerous. As a built-in safety valve, they
expire in one second by default. The lifespan property 

By default, the transaction will die in one second (as defined by the lifespan parameter).
If you want to keep the transaction alive indefinately, pass -1 to the second parameter.

If the subject expires, it will also un-block the transaction stream.

@param subject
@param lifespan
@returns {Subject<T>}

trans() can be called multiple times; in that scenario the emission will block
until *all* the returned subjects complete/expire.

lifespan is accomplished using the `timeout` operator when possible. 

## Zero-second transactions

If the lifespan is *exactly* zero, LGE will attempt to kill off the transaction 
on the next requestAnimationFrame cycle if possible; otherwise, will use a one-millisecond timeout. 

## Open transactions

Passing -1 (any negative number) will *disable* automatic transactional closing. 
The transaction will only complete when YOU tell it to. 
This puts a big responsibility on you to manage transactions well and is *not* reccomended.

