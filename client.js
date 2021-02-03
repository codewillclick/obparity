
function ParityObject(url,methods) {
	
	let baseMethods = [
		'ping'
	]
	methods = methods ?
		new Set(baseMethods.concat(methods)) :
		new Set(baseMethods)
	
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
			if (this.methods.has(prop)) {
				//let funcArgs = Array.from(arguments)
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
					// NOTE: See here?  Assumes a json-parsable return value.
					return x.json()
				}
				return f
			}
			else
				return Reflect.get(...arguments)
		}).bind(this)
	})
}

// TODO: Remove this once extendability is proven.
function P2(url,methods) {
	let px = new ParityObject(url,['pong'])

	return px
}

