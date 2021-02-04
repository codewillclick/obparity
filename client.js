
var ParityObject = class ParityObject {
	
	constructor(url,methods) {
	
		let baseMethods = $ParityObject_methods$
		methods = methods ?
			baseMethods.concat(methods) :
			baseMethods
		methods = new Set(methods.filter(a=>a))
		
		Object.defineProperties(this,{
			fetchUrl: {
				get:() => url,
				enumerable:false
			},
			methods: {
				get:() => methods,
				enumerable:false,
				configurable:true
			}
		})
		
		return new Proxy(this,{
			// I guess assume all gets are async?
			// I guess that makes sense, since anything here should be communicating
			// with its paired server-side instance.
			get: (function (target,prop,receiver) {
				// Either the methods Set has the prop being asked for, at which point a
				// function is returned which's call will be mirrored on the server, or
				// Reflect.get() proceed's with the property's default behavior.
				if (this.methods.has(prop)) {
					// f here is the function made available to the client by the Proxy.
					// So *its* arguments are what pass into the server's paired object's
					// handleClientRequest() method.
					
					// TODO: Put f somewhere it doesn't have to be re-rendered every time
					// a method property is referenced.
					let f = async function() {
						let x = await fetch(this.fetchUrl,{
							method:'POST',
							headers: {
								'content-type':'application/json'
							},
							body:JSON.stringify({
								type:'call',
								method:prop,
								args:[...arguments]
							})
						})
						// ASSUMES: Return value is json-parsable.
						return x.json()
					}
					return f
				}
				else
					return Reflect.get(...arguments)
			}).bind(this)
		})
	}
}

// TODO: Remove this once extendability is proven.
//function P2(url,methods) {
var P2 = class P2 extends ParityObject {
	constructor(url,methods) {
		// NOTE: No longer *looks* hacky, but the implementation's a little grody.
		return super(url,$P2_methods$.concat(methods))
	}
}

