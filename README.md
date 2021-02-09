# obparity

Simple node.js library for creating objects that exist in tandem between client (browser) and server.

## philosophy

The idea of having an object that behaves identically between client and server struck me one day and this is the result.

Where you call a method on the browser-side object, and it proxies to that exact same method on the server-side object.

It's not streamlined, and I'm still working out how class extension will work with it smoothly, but the idea's down.

## intended use cases

Consider a node module that interacts with some other database module,
mapping a few simple method calls off a `ParityObject` to a suite of complex database queries.

This `ParityObject`-extending class would be easy to use, while handling complicated things off in the background.

It would be especially nice if it could be used from the client/browser as easily as from within the server's node logic.

And that exact thing... is what this module exists for.

## a little elaboration

Assume `Looksie` is a class extending `ParityObject`, that interacts with some database.

```
Looksie (client)       Looksie (server)      database(s)
-----------------      ----------------      ----------------
- tieIntoDOM           - listThings          - allThemQueries
                       - saveNewThing
                       - debugDatabase
```

Client-side `Looksie` would have access to...
* `tieIntoDOM()`
* `listThings()`
* `saveNewThing()`

... but not to `debugDatabase()`, since that sounds like something you don't need the client to see.

Server-side `Looksie` would have access to everything _except_ `tieIntoDOM()`, which would only be declared in the client-side source.

Browsers would obviously need the client-side object.  But any node application using `Looksie` would need only the server-side object.

## an actual example

Assuming v1.2.0+ (though v1.1.0 on master already has this particular functionaility).

Server-side `ValueSayer` object, likely in its own module.
```javascript
let {ParityObject} = require('obparity')

class ValueSayer extends ParityObject {
  // Necessary static methods array for methods client-side object will use.
  static methods = ['sayit']
  
  constructor(value,...r) {
    super(...r)
    this.value = value
  }
  
  // This will be called via the client-side object's proxy reference.
  async sayit(prefix) {
    return {
      value:`${prefix && prefix+' ' || ''}${this.value}`
    }
  }
  
  // And here's the client-side class, itself, as a static property.
  static _ = class extends ParityObject {
    constructor(url) {
      // ParityObject() returns a Proxy, so be sure to return super()'s result
      return super(url)
    }
  }
}
```
The server app might contain something like...
```javascript
...
let sayer = new ValueSayer('stupendosity!','/sayer/1')

app.post('/sayer/1', async (req,res) => {
  res.send(JSON.stringify(await sayer.handleClientRequest(req.body)))
})
...
```
Running this from the browser would look something like...
```javascript
let sayer = new ValueSayer('/sayer/1')
let value = await sayer.sayit('I demand')
console.log(value)
// ^ This will output, {value:"I demand stupendosity!"}
```
Note that `await sayer.sayit('I demand')` will return `{value:"I demand stupendosity!"}` on both the client _and_ server.

That behavior for identically called methods in both locations is identical... is a _premise_, and must be maintained for extending classes to uphold the philosphy behind the `obparity` module.

Next is an example using a `Manager` class.


## changelog

Prior
* v1.0.0
  * ParityObject
    * client object source pulls from separate file
  * server-side use
    * ParityObjects are initialized with manual url entry
    * server app routes to specific ParityObjects manually
  * client-side use
    * ParityObjects are initialized with manual url entry
  * module
    * ParityObject

Current
* v1.1.0
  * ParityObject
    * ~~client object source pulls from separate file-~~
    * **NEW: client object source renders from `getClientClass()`**
      * (defaults to last static class property that _is_ a class)
  * server-side use
    * ParityObjects are initialized with manual url entry
    * server app routes to specific ParityObjects manually
  * client-side use
    * ParityObjects are initialized with manual url entry
  * module
    * ParityObject
    * **NEW: `compileSource()`**

Upcoming
* v1.2.0
  * ParityObject
    * client object source renders from `getClientClass()`
    * **NEW: `pair()` method allows for matching against specific server-side objects**
  * **NEW: Manager**
    * generates new ParityObjects based on added templates
    * provides new ways to match client- and server-side objects
    * manages incoming url+post-data, automatically mapping to respective managed server-side objects
    * middleware method: url+post mapping (for express.js)
    * middleware method: client source-getting (for express.js)
  * server-side use
    * server app routes to specific ParityObjects manually
    * **NEW: server app uses Manager to route incoming requests**
  * client-side use
    * ParityObjects are initialized with manual url entry
    * **NEW: ParityObjects have default class-level values for init params**
  * module
    * ParityObject
    * `compileSource()`
    * **NEW: Manager**
