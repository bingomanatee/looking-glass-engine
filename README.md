This is an attempt next redesign the functionality of Looking Glass Engine 
with a simpler interface for change tracking. Looking Glass 3 has a lot of moving parts
and it is harder than necessary to infer functionality from source.

LGE 3.3 is a complete rebuild and redesign with its own API / interface. 
It is less strict with type validation by default; 
reflecting the nature of forms, the most common use case, 
value change also emits zero or more meta (error) notations 
noting whether a value is within the bounds of desired values 
rather than blocking/throwing on validation errors. 

# Components

## ValueStream

A ValueStream is a curated observable that translates an update request (from next(value))
into a Change object that accomplishes change through execution of a series of messages
(defined as *stages*); only when STAGE_COMPLETE is recieved is the value actually updated.
This allows for monitoring and interruption of changes or modification of the message 
by listeners. 

Unlike the other classes below a ValueStream is responsible for a single value.

Actions, if present, inject the stream itself as the first parameter;
any other parameters passed in follow. the value 'this' is not 
useable in action - the first parameter provides all the context you need. 
Actions are intended to update the value in some fashion; they are synchronous. 

ValueStream is intended to function as a component of more complex stores; 
however it is a perfectly adequate store in scenarios where a single value
needs to be carefully observed and monitored, unlike the other classes that 
are intended to monitor a dictionary of values. 

**What you Need to Know** 

Actions are most useful for the classes that inherit ValueStream. 
mostly a ValueStream behaves like a BehaviorSubject in RXJS: 
you can subscribe to it, set its value with `next(value)`, 
and `.complete()` it when you're done with it. 

The mechanics of change and stages are ignoreable except when they
are actually useful for fine tuning behavior. 

**Constructor**

`new ValueStream(value, config?)`

Value can be anything or nothing. config is passed to `extend(config)`. 

**Methods**

* `action(name, fn, [stage]?)`: curried <br />
   Define an action by name.
* `addActions(object)`: curried <br />
   Define several actions; pass in an object whose values are functions
   and they will be added as actions using the keys as the action name.
* `complete()` <br />
   part of the Observable contract; suspends further activity of the stream
*  `execute(action{scalar}, value, [stage]?)` 
   an internal method for injecting a change request into the stream
*  `extend({actionStages,nextStages,defaultStages,actions)`: curried
   used by the constructor to initialize configuration
*  `next(value)` request an update to the current value of the stream; synchronous
*  `on(condition, listener)` : subscription <br />
   if you want to listen to a particular action and/or stage of the stream,
   use `on(...)`. It subscribes to the stream and returns a subscription
   that can be cancelled if you no longer wish to observe the condition. 
   the `condition` field can be a functioon or an object with parameters to 
   match against the change during change execution. 
* `preprocess(fn)`: curried <br />
   Uses `on()` to subscribe to all `next(..)` changes in the beginning.
   Use preprocess to clean up a value or reject an unacceptable change. 
* `setDefaultStages([stages])`: curried    <br />
   Sets the default stages for all change events. 
*  `setNextStages([stages])`: curried <br />
   Sets the default stages for `next(...)`
*  `setStages(action, [stages])`: curried  <br />
   Sets the stage for a defined action. 
*  `stagesFor(action)` : [stages]  <br />
   returns the stages that a given action will trigger when executed
   

**Properties**

*  `actions {Object}` 
    You call a streams' actions from the actions object. 
*  `do`
    Alias for actions
*  `changeSubject` <br />
    a quieter version of the valueSubject. 
    It only emits a change when all pending changes have completed.
*  `_valueSubject` <br />
   a BehaviorSubject that `next()` subscribes to; it holds the current
   value of the stream. 
   
## ValueStore <= ValueStream (abstract)

ValueStore extends ValuesStream with functioanlity for multiple values, 
stored in a dictionary. The exact type of dictionary is defined by its child classes. 
It has the same constructor as ValueStream -- but its initial value is stored 
in a particular storage type defined by the child class. 

Note - each key/value pair is governed by an individual stream - a BehaviorSubject, 
by default. 

This is an **ABSTRACT CLASS** -- it defines shared behaviors for the classes below.
Use ValueStoreeMap or ValueStoreObject in your code; unless you want to define
your own Store class, in which case, extend this class. 

**Methods**

*  `addStream(name, stream)` : curried <br />
   allows you to replace or define a stream holding a single value in the store
   with a stream that you have curated to perform in a particular way; usually
   used to dynamically define a parameter as a complex stream such as adding
   a ValueStoreMap as a key for an element of a ValueStoreObject (or vice versa).
*  `asObject()`: {Object} <br />
   returns the current value as a POJO. 
*  `createStream(name, value)` : BehaviorSubject <br />
   adds a named property to the value. Used to dynamically extend the vocabulary 
   of a store.
*  `forEach(target, fn)` -- abstract <br />
   use to iterate across the value of the store. 
*  `get(name)`: value -- abstract <br />
   used to retrieve a value of the store by name
*  `set(name, value)` -- abstract <br />
   creates a change reqauest for a property of the stores' value. 
*  `watch(key...key) (or ([key, key])`: Subject
   returns a subscribable subject that only updates when specific sub-fields
   of the store are updated. This is a **very powerful** way to observe 
   a targeted set of changes, like `useEffect` hooks in react. The method takes
   any number of keys as arguments. 

**Properties**

*  `my` : asObject() || proxy
   The values of the store expresses in object notation. If Proxy is available,
   it is a more economical way to retrieve a current property value of a store. 
*  `streams` : Map
   the observables for each identified proerty of the stores' value. 

## ValueStoreMap

This is a ValueStore that keeps its values in a JavaScript Map. 
All the interface for it is defined in the above classes. 

## ValueStoreObject

This is a ValueStore that keeps its values in a classic "POJO" Object. 
This is useful if you want to deconstruct its values into a React component. 
