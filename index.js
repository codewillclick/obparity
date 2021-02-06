
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

/*
class ParityObject {
	
	constructor(url,methods) {
		// Some overhead...
		this._constructorUpdate()
		
		// Client source path is the javascript file containing the matching
		// client-side class.
		this.clientSourcePath = null
		this.setClientSourcePath()
		
		// This property is meant to represent the url being listened for which's
		// GET should return getClientSource(), and which's POST should return
		// handleClientRequest(res.body).
		this.fetchUrl = null
		this.setClientFetchUrl(url)

		this._clientMethods = methods || []
	}
	
	// Private methods meant to be run internally.
	
	_constructorUpdate() {
		// Store top-level class names in a table for various computations.
		const name = this.constructor.name
		if (name &&
				!ParityObject._classNames.has(name)) {
			// Add class name to this table.
			ParityObject._classNames.add(name)
			// Recompute the regex used to check for 
			this._regexReplaceRecompute(
				ParityObject._classRegex,
				ParityObject._regexAppends,
				ParityObject._classNames.values())
			console.log('classNames  ',ParityObject._classNames)
			console.log('classRegex  ',ParityObject._classRegex)
			console.log('regexAppends',ParityObject._regexAppends)
			// Static client methods table... is this a hack?
			// WARNING: What if getClientMethods() is dynamic, though...?
			//   Either way, a static table of something that is returned with a class
			//   method implementation is wholly inelegant.  But for now it works!
			//   I'll leave it for a refactor.
			ParityObject._methodTable[name] = this.getClientMethods()
			console.log('methodTable',ParityObject._methodTable)
		}
	}
	_regexReplaceRecompute(table,keys,vals) {
		// Per regex append string, recompute regex to match against when replacing
		// strings in client source.
		for (let k of keys) {
			table[k] = new RegExp(
				`\\$(${Array.from(vals).join('|')})_(${k})\\$`,
				'g') // matchAll() is being used, so global it is
		}
	}
	
	// Methods getting and setting various object properties.
	
	setClientFetchUrl(url) {
		this.fetchUrl = url
	}
	
	setClientSourcePath(url) {
		// Meant to be overridden by extending classes.
		url = url ? url : 'client.js'
		this.clientSourcePath = url
	}
	
	getClientMethods() {
		let r = this._clientMethods || []
		return ['ping','debug'].concat(r)
	}
	
	// Methods interacting with the client-side object.
	
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
	
	async getClientSource() {
		try {
			// clientSourcePath searches from the location of index.js.
			
			// TODO: Figure out what happens when this is called from a different
			//   directory.  For example, a separate parity object module extending
			//   ParityObject.  Will it reference __dirname from its own location?
			//   Or will it reference obparity's directory?
			let source
			if (path.isAbsolute(this.clientSourcePath)) {
				source = await fs.p.readFile(this.clientSourcePath)
			} else {
				source = await fs.p.readFile(
					path.resolve(__dirname,this.clientSourcePath))
			}
			
			// Determine file prefixes based on presence of certain $variable$ names.
			let r,x = ParityObject._classRegex['methods']
			let prefixes=[], added=new Set()
			for (let m of new String(source).matchAll(x)) {
				if (added.has(m[1]))
					continue
				let s = `\$${m[1]}_methods\$`,
				    v = JSON.stringify(ParityObject._methodTable[m[1]])
				prefixes.push(`var ${s} = ${s} || ${v};`)
				added.add(m[1])
			}
			if (prefixes.length)
				source = prefixes.join('\n') + source
			return source
		} catch(e) {
			if (true) // check against some specific error type
				throw e
		}
	}
	
	// Methods accessible to the client object.
	
	async ping(...r) {
		return {
			msg:'ping successful',
			ts:new Date(),
			args:[...r],
			url:this.fetchUrl,
			srclen:this.renderedSource && this.renderedSource.length
		}
	}
	
	async debug(...r) {
		return {
			ParityObject_global: {
				classNames:Array.from(ParityObject._classNames),
				classRegex:Object.fromEntries(Object.entries(
					ParityObject._classRegex).map(r=>[r[0],''+r[1]])),
				regexAppends:ParityObject._regexAppends,
				methodTable:ParityObject._methodTable
			}
		}
	}
}
M.ParityObject = ParityObject
// NOTE: Consider just leaving these as local variables, if they're meant to be
//   singletons anyway.  Get rid of some of the 'ParityObject'* clutter.
// Set of class names for classes extending ParityObject.
ParityObject._classNames = new Set()
// Regex table storing regexes to check for use of special $vars$ in source.
ParityObject._classRegex = {}
// Suffixes to append to regex checks.
ParityObject._regexAppends = ['methods']
// Static table of methods returned by getClientMethods(), with each new class.
ParityObject._methodTable = {}

// This is more a test of extendability practice than anything.
// TODO: Remove this once extendability is proven.
class P2 extends ParityObject {
	constructor(...r) {
		super(...r)
	}
	
	getClientMethods() {
		return ['pong']
	}
	
	async pong(...r) {
		return {
			msg:'class extension success'
		}
	}
}
M.P2 = P2
//*/


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

