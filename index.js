
(async (M) => {

let fs = require('fs')
let path = require('path')
let util = require('util')

function promitate(mod) {
	let a = {}
	for (var k in mod)
		if (typeof mod[k] === 'function')
			a[k] = util.promisify(mod[k])
	return a
}
fs.p = promitate(fs)

class ParityObject {
	static methods = ['ping']
	
	constructor(url) {
		this.fetchUrl = url
	}
	
	// Server-side methods

	clientClass() {
		return this.constructor.getClientClass()
	}
	static getClientClass() {
		// Grabs the last class it finds among this class object's properties.
		// It's just a default; override this when greater assurance is needed.
		let A = this
		return A[Object.getOwnPropertyNames(A)
			.filter(k => A[k] && A[k].name).pop()]
	}
	
	// Get list of methods the client-side object will refer to the server for.
	clientMethods() {
		return this.constructor.getClientMethods()
	}
	static getClientMethods() {
		let B,A = this
		let i=0, r = []
		while (i < 1000 && A && A.name && A.name !== 'Function') {
			r.push(A)
			B = Object.getPrototypeOf(A)
			if (A === B)
				break
			A = B
			i++
		}
		r = r.reduce((a,b) => b.methods.map(c => a.add(c)) && a,new Set())
		return Array.from(r)
	}
	
	// Get the source of the client-side class.
	async clientSource() {
		return this.constructor.getClientSource()
	}
	static async getClientSource() {
		let cs = this.getClientClass().toString()
		let ms = `static methods = ${JSON.stringify(this.getClientMethods())};`
		return cs.replace(/^([^{]+{)/, '$1 '+ms)
	}
	
	// Process incoming request object.  Will typically default to a call against
	// one of the server-side client methods.
	async handleClientRequest(ob) {
		if (ob.type === 'call') {
			let f = this[ob.method]
			let r = ob.args
			if (typeof f !== 'function')
				throw new Error(`f must be function, but instead is (${typeof f})`)
			if (!Array.isArray(r))
				throw new Error(`r must be array, but instead is (${typeof r})`)
			return await f.apply(this,r)
		}
		else {
			throw new Error(`unhandled request ob type (${typeof ob.type})`)
		}
	}
	
	// Client-side methods.
	
	async ping(...r) {
		return {
			msg:'ping successful',
			ts:new Date(),
			args:[...r],
			url:this.fetchUrl
		}
	}
	
	// Client-side class.
	
	static _ = class ParityObject {
		constructor(url) {
			this.methods = new Set(this.constructor.methods)
			this.fetchUrl = url
			let self = this

			// This will be used multiple times.
			let f = (prop) => async function() {
				let x = await fetch(self.fetchUrl,{
					method:'POST',
					headers: { 'content-type':'application/json' },
					body:JSON.stringify({
						type:'call',
						method:prop,
						args:[...arguments]
					})
				})
				return x.json()
			}

			// Two of these, where 'proxy' ignores getOwnProperties()
			this.proxy = new Proxy(this,{
				// Prioritzes server-side object properties.
				get:((target,prop,receiver) => {
					if (this.methods.has(prop))
						return f(prop)
					else
						return Reflect.get(this,...arguments)
				}).bind(this)
			})
			
			return new Proxy(this,{
				get:((target,prop,receiver) => {
					// Prioritizes own set properties.
					let a
					if (a=Reflect.get(target,prop))
						return a
					else if (this.methods.has(prop))
						return f(prop)
					else
						return Reflect.get(this,...arguments)
				}).bind(this)
			})
		}
	}
	
}
M.ParityObject = ParityObject

class P2 extends ParityObject {
	static methods = ['pong']
	constructor(url) {
		super(url)
	}
	async pong() {
		return { msg:'ponged that bad boi' }
	}
	static _ = class P2 extends ParityObject {
		constructor(url) {
			super(url)
		}
	}
}
M.P2 = P2

// This takes a set of provided ParityObject class objects and works out which
// client class sources are needed for the lot of them to work.  Then it orders
// them such that no conflicts arise browser-side.
async function compileSource(...r) {
	function * chain(c) {
		let old=null, a = c
		while (a && a.name && a.name !== 'Function') {
			yield [a,old]
			old = a
			a = Object.getPrototypeOf(a)
		}
	}
	let t = {}
	r.map(a => {
		if (!a.getClientSource)
			return
		for (let [c,old] of chain(a)) {
			if (!t[c.name])
				t[c.name] = [0,c]
			t[c.name][0] += 1
		}
	})
	// This is a function order as far as dependencies go, but it doesn't group
	// related classes together.  ...  Oh well, a problem for a later time.
	let xr = await Promise.all(Object.values(t).sort((a,b) => b[0] - a[0])
		.map(r => r[1].getClientSource()))
	return xr.join('\n;\n')
}
M.compileSource = compileSource


})(exports)

