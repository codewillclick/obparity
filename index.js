
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
	
	constructor(url) {
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
	}
	
	// Private methods meant to be run internally.
	
	_constructorUpdate() {
		// Store top-level class names in a table for various computations.
		if (!ParityObject._classNames.has(this.constructor.name)) {
			// Add class name to this table.
			ParityObject._classNames.add(this.constructor.name)
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
			ParityObject._methodTable[this.constructor.name] = this.getClientMethods()
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
		return ['ping','debug']
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
			let source = await fs.p.readFile(
				path.resolve(__dirname,this.clientSourcePath))
			
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
		//return super.getClientMethods().concat(['pong'])
		return ['pong']
	}
	
	async pong(...r) {
		return {
			msg:'class extension success'
		}
	}
}
M.P2 = P2

})(exports)

