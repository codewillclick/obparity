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

## here's an example

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

... but not to `debugDatabase()`, since that sounds like something you don't need the client to see.  (This should be configured server-object-side, but right now it's in the client source...  Well, I'll get around to it.)

Server-side `Looksie` would have access to everything _except_ `tieIntoDOM()`, which would only be declared in the client-side source.

Browsers would obviously need the client-side object.  But any node application using `Looksie` would need only the server-side object.

## addendum

I was originally trying to think of a way the server-side object could render the client-side object from its own source, serializing its methods on the way down and deserializing in the browser, but...

For now, having a separate `client.js` is sufficient.  All the logic to handle when or how `getClientSource()` and `handleClientRequest()` are called is left to the server-side application requiring this module.
