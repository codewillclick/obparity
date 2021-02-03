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
