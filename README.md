# obparity

Simple node.js library for creating objects that exist in tandem between client (browser) and server.

## philosophy

The idea of having an object that behaves identically between client and server struck me one day and this is the result.

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

Server-side `ValueSayer` object, likely in its own module.
```javascript
class ValueSayer extends ParityObject {
  constructor(value,...r) {
    super(...r)
    super.setClientSourcePath('client.valuesayer.js')
    this.value = value
  }
  getClientMethods() {
    return ['sayit']
  }
  asynch sayit(prefix) {
    return {
      value:`${prefix && prefix+' ' || ''}${this.value}`
    }
  }
}
```
Client-side `ValueSayer` object in `client.valuesayer.js` or somesuch.
```javascript
class ValueSayer extends ParityObject {
  constructor(url,methods) {
    super(url, $ValueSayer_methods$.concat(methods))
  }
}
```
Initializing on the server, it'd look like...
```javascript
let sayer = new ValueSayer('stupendosity!','/sayer/1')
```
Running this from the browser would look something like...
```javascript
let sayer = new ValueSayer('/sayer/1')
let value = await sayer.sayit('I demand')
console.log(value)
// ^ This will output, {value:"I demand stupendosity!"}
```

## addendum

I was originally trying to think of a way the server-side object could render the client-side object from its own source, serializing its methods on the way down and deserializing in the browser, but...

For now, having a separate `client.js` is sufficient.  All the logic to handle when or how `getClientSource()` and `handleClientRequest()` are called is left to the server-side application requiring this module.
