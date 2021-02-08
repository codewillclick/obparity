
(async (M) => {

let _uid = 1
function uid(pre) {
	pre = pre || ''
	return  `${pre}${_uid++}_${Math.floor(Math.random() * (1<<30))}`
}

class ParityObject {
	static methods = ['pair','ping']
	static sourceClassId = null
	
	constructor(url) {
		// WARNING: The method requiring this is static, and may be called before an
		//   instance of this class is initialized, leaving sourceClassId blank.
		this._staticSourceIdCheck()
		let id = uid()
		Object.defineProperties(this, {
			fetchUrl: { get:() => url },
			parityId: { get:() => id }
		})
	}

	// Internal methods

	_staticSourceIdCheck() {
		if (!this.constructor.sourceClassId ||
				(this.constructor.sourceClassId ===
					Object.getPrototypeOf(this.constructor).sourceClassId)) {
			// Only write a new class id on new class definition.
			this.constructor.sourceClassId = uid('scid_')
		}
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
	async clientSource(param) {
		return this.constructor.getClientSource(param)
	}
	static async getClientSource(param) {
		function addStatic(s,key,val) {
			let ms = `\nstatic ${key} = ${val};`
			return s.replace(/^([^{]+{)/, '$1 '+ms)
		}
		param = Object.assign({ // a few config defaults...
			forceName:true,
			insertMethods:true,
			url:null,
			vars:{}
		},param)
		let cs = this.getClientClass().toString()
		if (param.forceName) {
			// Force name to match server-side class'.
			let s = this.toString().split('{',1)[0]
			cs = cs.replace(/^([^{]+)/,s)
		}
		if (param.insertMethods) {
			// Insert parent static methods object into client-side class.
			cs = addStatic(cs,'methods',JSON.stringify(this.getClientMethods()))
		}
		if (param.url) {
			// Insert default url for class... useful when connecting to a master
			// server object that then pairs client object with a specific server
			// object instance.
			cs = addStatic(cs,'defaultUrl',`"${param.url}"`)
		}
		if (true) {
			// Forcefully set this one, I guess.
			// UNCERTAIN: But what'll happen when an overriding method doesn't include
			//   this variable?  Hmm... we'll have to experiment.
			cs = addStatic(cs,'sourceClassId',`"${this.sourceClassId}"`)
		}
		for (var k in param.vars) {
			// Add in arbitrary static vars for the class.
			cs = addStatic(cs,k,param.vars[k])
		}
		return cs
	}
	
	// Process incoming request object.  Will typically default to a call against
	// one of the server-side client methods.
	async handleClientRequest(ob) {
		if (ob.type === 'call') {
			if (!this.constructor.methods.includes(ob.method))
				throw new Error(
					`(${ob.method}) is not a ${this.constructor.name}.methods value`)
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
	
	async pair(auth) {
		return {url:this.fetchUrl, id:this.parityId}
	}
	
	// Client-side class.
	
	static _ = class ParityObject {
		static _classUidCounter = 1

		constructor(url) {
			// For faster .has() access, make a Set out of this one.
			this.methods = new Set(this.constructor.methods)
			// This id and url are set during pair(), if not through constructor args.
			this.parityId = null
			this.fetchUrl = url || this.constructor.defaultUrl || null
			// And a little helper for sidestepping encapsulation confusion.
			let self = this
			
			let px // for reference to the returned proxy
			let paired = false
			// Meant to synchronize client-side object, though not strictly necessary
			// if the url is provided through the constructor.  *Could* become vitally
			// important once authorization and such is thrown into the mix.
			this.pair = async (auth) => {
				let a = await this.proxy.pair(auth) // I guess... think about auth later?
				if (!a)
					throw new Error('pairing failed completely')
				if (!a.err) { // reserve .err as a property for server's pair()
					this.parityId = a.id
					this.fetchUrl = a.url
					paired = true
				}
				else
					throw new Error(`pairing failed with error (${a.err})`)
				return px // remember to return the *proxy*
			}
			// Read-only paired property.
			Object.defineProperty(this,'paired',{ get:() => paired })
			
			// This will be used multiple times.
			let f = (prop) => async function() {
				let x = await fetch(self.fetchUrl,{
					method:'POST',
					headers: { 'content-type':'application/json' },
					body:JSON.stringify({
						type:'call',
						method:prop,
						args:[...arguments],
						id:self.parityId,
						classId:self.constructor.sourceClassId || null
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
			
			return px = new Proxy(this,{
				get:((target,prop,receiver) => {
					// Prioritizes own set properties.
					let a
					return (a=Reflect.get(target,prop))   ||
						(this.methods.has(prop) && f(prop)) || a
				}).bind(this)
			})
		}
	}
}
M.ParityObject = ParityObject

// This takes a set of provided ParityObject class objects and works out which
// client class sources are needed for the lot of them to work.  Then it orders
// them such that no conflicts arise browser-side.
async function compileSource(r,param) {
	function * chain(c) {
		// Iterate as we climb up the parent class tree... or limb?
		let old=null, a = c
		while (a && a.name && a.name !== 'Function') {
			yield [a,old]
			old = a
			a = Object.getPrototypeOf(a)
		}
	}
	// UNCERTAIN: Can I really just assume an Array?  What if it's an iterable?
	r = Array.isArray(r) ? r : [r]
	let t = {} // keep track of number of references
	let edges = {} // parentage table
	r.map(a => {
		if (!a.getClientSource)
			// Can't provide source, so skip.
			return
		for (let [c,old] of chain(a)) {
			if (c && old) {
				// Add an edge to the parentage table, pointing to the parent.
				if (!edges[old.name])
					edges[old.name] = new Set()
				edges[old.name].add(c.name)
			}
			// Increment the reference count.
			if (!t[c.name])
				t[c.name] = [0,c]
			t[c.name][0] += 1
		}
	})
	// Comparator abides the edges in the parentage table.
	let comp = (a,b) =>
		edges[a] && edges[a].has(b) ?
			-1 :
			edges[b] && edges[b].has(a) ?
				1 : 0
	// This is a function order as far as dependencies go, but it doesn't group
	// related classes together.  ...  Oh well, a problem for a later time.
	let xr = await Promise.all(Object.values(t).sort((a,b) =>
		// sort first by number of times referenced, then by the parentage table
		a[0]-b[0] ? a[0]-b[0] : comp(a.name,b.name))
		// map to the client source...
		.map(r => r[1].getClientSource(param)))
	// Reverse for good measure!
	return xr.reverse().join('\n;\n')
}
M.compileSource = compileSource


})(exports)

