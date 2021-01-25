# Advanced Architecture

# Stages and events

While you **_don't have to understand the event structure_** 
inside ValueStream/ValueMapStream to use streams, 
you might find it helpful if you want to create intercept driven stores a la Saga.

`set` and `next` updates are both executed in a series of stages. 
An Event is emitted for each stage, containing the value (or map in the case of set) 
in a temporary stream. The execution of the desired effect is accomplished with 
a hook listener -- generally on the `E_COMMIT` stage. At any point 
prior to that stage the committed value can be updated or filtered, or the 
event can be suspended via `event.complate()` or `event.error()` 
to prevent the effect from occurring. 

You can create your own listeners to react to the event or curate 
which events you want to allow. For instance if you want to ensure that only 
known fields are in a ValueMapStream you can either remove unwanted values 
or reject events that update unwanted values.

## *WARNING*: calling set/next from set/next watchers on ValueMapSet

If you try to update a stream as a response to "set" or "next" watchers, you can generate
race conditions. Your "set" will generate a manifest map from the previous edition of the 
ValueMapStream that evaluates after the triggering event. 

To properly set a store in response to data change, wait for the event to complete
before setting additional field values. The best way to do this is to use `.watch(...)`
listeners, which perform in this matter automatically. 

Alternately you can update the value of the event to include desired side effects in a single
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

You cannot replace a set fieldSubject once defined. 

If for instance you want to create a reducer pattern with several
ValueStreamMaps coordinating to a central store, you would define
each ValueStreamMap as a fieldSubject for a central store. Or you can
tie a DOM effect emitter into a fields' value.

Values submitted to a fieldSubject will still trip the usual events
when updated in the parent ValueMapStream -- but they wil do so
after the fieldSubject has processed the value. 

If you call a `set[Fieldname]` action it will delegate to the stream,
as will `set(key, value)`. `myValueMapStream.next()` will not. 

## addFieldSubject(key, stream)

Registers a stream as a contributor to a single fields' value. 
