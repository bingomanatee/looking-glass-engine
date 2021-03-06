## 3.2.0

Recoded entire code base; 
spread functionality through a layer of classes for "easier" digestion/testing.
major features add include virtuals, expanded watch, and more nuanced methods.

* removed 'is' passthroughs
* watch now takes one or more fields to watch
* added virtuals - lazy computed values that derive from data. 
* expanded use of Proxies. 
* added gitdocs documentation tree
* added more options when creating methods, allowing them to throw and/or be transactional.
* added throwing versions of the set methods. 

## 3.2.1

fixed a quirk in watch where serializer was undefined. 

# 3.2.2

ensured symmetry in property/method definition; addProperty === property, addMethod === method

# 3.2.4

Allowed objects as validators for the purpose of developing formal

# 3.2.5

updated lodash reflecting github security prompt;
reflected 'is' package is no longer a dependency outside the tests

# 3.3.0

A complete rebuild; transporting sometimes use features like filters (now meta) and blocking into utility classes. 

* Eliminated use of lodash for size minimization
* Using @wonderlandlabs/validation for reduction of type validation features
* Redesigned emissions model to allow for submission of invalid values. 
* Errors renamed meta for a host of use cases including errors, annotation. 

# 3.3.6

various economies to reduce bundle size and bookkeeping tasks

* removed unused packages 
* migrated code back to github repo https://github.com/bingomanatee/looking-glass-engine
* updated README to reflect current API

# 3.4

another architecture rethink; cleaner events. 

# 3.4.4

removed default action handling to avoid false positives for non-existant actions

# 3.4.5 

added (back) watch. 

# 3.4.9

echoing isStopped and closed from the valueStream in ValueStream /ValueMapStream;

# 3.4.10

adding delete to map; adding jsDocs. where/on returns observables. 

# 3.4.11

adding "fast" versions of ValueStream/ValueMapStream for scenarios
in which update eventing is not required. 
In ValueMapStreamFast/ValueStreamFast, 
`.next()/.set(...)/.delete(....)`'s directly update
the value stream without using an event pipe without opportunity for 
filter, finalize or on/when interrupts. 

# 3.4.12

Added a ValueObjectStream for when stores' fundamental model must 
be maintained as an object model. (made under the hood changes 
to fieldSubjects)

# 3.4.16

refactored events to be straightforward BehaviorSubject extensions. 
replaced EventFilters with functional approach. 
