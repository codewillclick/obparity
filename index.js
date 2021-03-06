
(async (M) => {

let _uid = 1
function uid(pre) {
	pre = pre || ''
	let s = `${pre}${_uid++}_${Math.floor(Math.random() * (1<<30))}`
	//console.log('creating uid',s)
	return s
}

class ParityObject {
	// TODO: Let's consider letting this rely on getClientMethods(), but still
	//   passing a methods array to the client-side class on clientSource().
	static methods = ['pair','ping']
	static sourceClassId = null
	
	constructor(url) {
		// Set a static class id... if needed.
		this._staticSourceIdCheck()
		// Set an instance id.
		let id = uid('pob_')
		// Effectively make these values private.
		Object.defineProperties(this, {
			fetchUrl: { get:() => url },
			parityId: { get:() => id }
		})
	}

	// Internal methods

	_staticSourceIdCheck() {
		// WARNING: The method requiring this is static, and may be called before an
		//   instance of this class is initialized, leaving sourceClassId blank.
		if (!this.constructor.sourceClassId ||
				(this.constructor.sourceClassId ===
					Object.getPrototypeOf(this.constructor).sourceClassId)) {
			// Only write a new class id on new class definition.
			this.constructor.sourceClassId = uid('scid_')
			// Override this method once it calls...  It should add to the topmost
			// prototype, leaving the original alone.
			// TODO: Need a test for this.
			this._staticSourceIdCheck = () => {}
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
	clientMethods(...r) {
		return this.constructor.getClientMethods(...r)
	}
	static getClientMethods() {
		let B,A = this
		let i=0, r = []
		// Collect parent class chain for mapping.
		while (i < 1000 && A && A.name && A.name !== 'Function') {
			r.push(A)
			B = Object.getPrototypeOf(A)
			if (A === B)
				break
			A = B
			i++
		}
		if (i === 1000)
			throw new Error('getClientMethods() reached loop maximum')
		// Take unique values from full class list only, and return them.
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
			// Loop up constructor.methods arrs...
			let hasIt = false, con = this.constructor
			while (con.name !== 'Function' && con.methods) {
				// TODO: Just throw the error if this[ob.method] isn't found, instead
				//   of this messy logic.
				if (con.methods.includes(ob.method)) {
					hasIt = true
					break
				}
				let a = Object.getPrototypeOf(con)
				if (a === con)
					break
				con = a
			}
			if (!hasIt)
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
			// TODO: If overriding handleClientRequest(), it may be useful to return
			//   the initial ob param, rather than throwing an Error, so the
			//   overriding method can just handle things, instead.  Or maybe it can
			//   just use a try/catch block, but... that feels inelegant.
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
			this.pair = async (...auth) => {
				let a = await this.proxy.pair(...auth) // think about auth later?
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
				let x = await fetch(self.fetchUrl,self.modMessage({
					method:'POST',
					headers: { 'content-type':'application/json' },
					body:JSON.stringify({
						type:'call',
						method:prop,
						args:[...arguments],
						id:self.parityId,
						classId:self.constructor.sourceClassId || null
					})
				}) )
				return x.json()
			}

			// Two of these, where 'proxy' ignores getOwnProperties()
			this.proxy = new Proxy(this,{
				// Prioritzes server-side object properties.
				get:((target,prop,receiver) => {
					if (this.methods.has(prop))
						return f(prop)
					// UNCERTAIN: I wrote it like this orignally, but wait... what?
					//   Unit test!  When all else fails, write a unit test for it.
					return Reflect.get(this,...arguments)
				}).bind(this)
			})
			
			return px = new Proxy(this,{
				get:((target,prop,receiver) => {
					if (Reflect.has(target,prop))
						return Reflect.get(target,prop)
					return this.methods.has(prop) && f(prop) || undefined
				}).bind(this)
			})
		}
		
		// This should be overridden in cases where unique properties are added to
		// the object being sent server-side via POST request on proxy call.
		modMessage(ob) {
			return ob
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

class Manager {
	constructor(param) {
		this.templates = {}
		this.paired = {}
		this.unpaired = {}
		this.unpairedRefs = {}
		// ^ pobs are to be removed from this on placement in this.paired
		this.addressed = {}
		this.sessions = {}
		this.matchPatterns = this._initPatterns(param && param.patterns || [])
		// Default to NOT true on this one.
		//this.createOnEmpty = param && (param.createOnEmpty ? true : false) || true
		this.createOnEmpty = param && (param.createOnEmpty ? true : false)
		// There should be buckets of unpaired pobs, to be picked from when a new
		// pair() request comes in.
		// 
		// ... But how should they be divided?  I guess... by classId?
		// This presents a problem when the server goes down but the client doesn't.
		// All the old classIds are active client-side but the server says "nope".
		if (this.createOnEmpty)
			throw new Error('.createOnEmpty was decided a flawed precept, ' +
				'so this Error will be thrown until this idea is further explored')
	}
	
	_initPatterns(r) {
		return r.map(s => new RegExp(s))
	}

	_urlPatternMatch(url) {
		for (let x of this.matchPatterns) {
			let m = url.match(x)
			if (m)
				return m.toString()
		}
		return null
	}
	
	// NOTE: Should I not put this somewhere, I dunno... special?
	//   I mean, it's way too short to be its own module...
	express() {
		// ASSUMES: app.post()
		return async (req,res,next) => {
			let a = await this.evaluate(req.url,req.body)
				.catch(e => {
					// TODO: Or should this send that {err:something} object?
					console.log('throw this?',req.url,'\n',e.stack)
					//res.sendStatus(500)
				})
			a && res.send(JSON.stringify(a)) || res.sendStatus(500)
		}
	}
	expressSource(param) {
		// Return source dynamically generated between all class types Manager
		// is currently storing.
		let self = this
		return async (req,res,next) => {
			let s = await self.compileSource(param)
			res.set({ 'content-type':'application/javascript' })
			res.send(s)
		}
	}

	async compileSource(param) {
		let chain = function * (r) { for (let a of r) for (let b of a) yield b }
		let tr = Object.values(this.templates).map(r => r[0])
		let pr = Object.values(this.paired).map(a => a.constructor)
		let ur = Array.from(chain(Object.values(this.unpaired)))
		         .map(a => a.constructor)
		let ar = Array.from(chain(Object.values(this.addressed)))
		         .map(a => a.constructor)
		//console.log('these',{ tr:tr, pr:pr, ur:ur, ar:ar })
		let r = Array.from(new Set(chain([tr,pr,ur,ar])))
		// NOTE: Module reference.
		return M.compileSource(r,param)
	}
	
	accept(pob,sessionKey,sessionId) {
		// In case the pob wasn't created with the Manager, add it in like this.
		let stack = this.unpaired[pob.constructor.sourceClassId]
		if (!stack)
			stack = this.unpaired[pob.constructor.sourceClassId] = []
		// Push it into the appropriate stack and... I guess that's it.
		stack.push(pob)
		// Add in this reference for use by old-session deletion process.
		// NOTE: I need to clean up the logic behind all this, but... later...
		if (sessionKey && sessionId) {
			// NOTE: Honestly, all this work to make a hacky solution feasible.  I'm
			//   seriously gonna put Manager session buckets in as a feature in
			//   v1.2.1.
			this.unpairedRefs[sessionKey] =
				this.unpairedRefs[sessionKey] || {}
			this.unpairedRefs[sessionKey][sessionId] =
				this.unpairedRefs[sessionKey][sessionId] || new Set()
			this.unpairedRefs[sessionKey][sessionId].add(pob.parityId)
		}
		return this
	}
	// TODO: The match param is still iffy.  Does anything even pull from the
	//   this.addressed bucket?  It looks like it only tries if id == null, which
	//   *wouldn't* be true, if pair was called to begin with.  ... Though I guess
	//   for pobs where pair() is *never* called, it'd be fine?
	acceptMatch(pob) {
		// This is for objects intended to be matched with their incoming urls.
		let k = this._urlPatternMatch(pob.fetchUrl)
		if (!k)
			throw new Error(`no patterns match for url (${pob.fetchUrl})`)
		let bucket = this.addressed[k]
		if (!bucket)
			this.addressed[k] = []
		// Just stuff it in this bucket.
		this.addressed[k].push(pob)
		return this
	}

	addTemplate(k,params) {
		// params is a list of arguments.  The first is the class to call 'new' on,
		// whereas the rest are to be passed in as *its* arguments on create().
		this.templates[k] = params
		return this
	}
	addTemplates(ob) {
		for (var k in ob)
			this.addTemplate(k,ob[k])
		return this
	}
	create(k,match,sessionKey,sessionId) {
		// HACK: I don't like including sessionKey and sessionId here
		if (typeof match !== 'boolean') {
			// Shift perceived params over one, assuming false for match.
			sessionId = sessionKey
			sessionKey = match
			match = false
		}
		let p = this.templates[k]
		console.log('creating',p[0],p.slice(1))
		let pob = new p[0](...p.slice(1))
		if (match)
			this.acceptMatch(pob)
		else
			this.accept(pob,sessionKey,sessionId)
		return pob
	}
	
	async evaluate(url,ob) {
		// NOTE: I'm trying to set it up so an object is referenced in only one
		//   location at a time, but if multiple keys need to be able to access the
		//   same object, that's going to be a little difficult.
		console.log('evaluating',url,ob)
		console.log('against', {
			paired:this.paired,
			unpaired:this.unpaired,
			addressed:this.addressed
		})
		// First, check if it's a pair() request.
		if (ob.id === null && ob.method === 'pair') {
			// TODO: Include ability to supply a unique key of one's own, which will
			//   automatically remove any managed objects with that key... somehow
			//   referencing them.  But... where is said key attached?
			//     . Should the Manager attach some new property to all managed
			//       objects, and keep a table on hand that can pick them out of their
			//       respective buckets?
			//
			// issue#13: pair(sessionKey,sessionId)
			//   . this is what we're going with here
			//   . there are two arguments
			//     . a table is accessed for session key/id storage
			//     . this.sessions will work

			// If it doesn't match the sessionKey/Id format, DESTROY IT.
			// So... sessionKey/Id validation.
			let session
			if (ob.args.length !== 2) {
				throw new Error(`invalid exclusive pair attempt (args: ${ob.args})`)
			}
			else {
				let [key,id] = ob.args
				if (!this.sessions[key]) {
					// Session doesn't exist yet, so make it.
					this.sessions[key] = {
						id:id,
						refs: {} // these should point to pobs in this.paired
					}
				}
				session = this.sessions[key]
				if (this.sessions[key].id === id) {
					// If this id for this session already exists, do... nothing?
					// The actual addition to the session's refs table happens only on a
					// successful pairing.

					// NOTE: Ordering it like this means that it's not the first new
					//   *successful* pairing that clears out all the old session's pobs,
					//   but the first *attempt* at pairing with a new session id.
					//   Well... that's okay, I guess.  As long as authorization happens
					//   before this point.
					// 
					// WARNING: But wait... wouldn't authorization happen when calling
					//   handleClientRequest()?  That happens later in this function.
					//   Hmmm... Right now, nothing is assigned til after that's called,
					//   except I guess for adding the new session to sessions.  Maybe
					//   we'll put this logic in after?  That way if the server-side
					//   object's pair() fails, we can just forget any of this happened?
				}
				else {
					// Otherwise, it's time to *clean house*!
					// Gather all parity keys to remove.
					let karr = []
					for (let sid in this.unpairedRefs[key]) {
						// Like the parity keys of non-new-id unpaired objects.
						if (sid === id)
							continue
						for (let parityId of this.unpairedRefs[key][sid])
							karr.push(parityId)
						delete this.unpairedRefs[key][sid] // just delete the whole Set
					}
					for (let k in session.refs) {
						karr.push(k)
					}
					for (let k of new Set(karr)) {
						// Clear out any references paired against the current session.
						// First, let's clear unpaired... which *is* inefficeint like this.
						let r = this.unpaired[ob.classId]
						if (r) {
							for (let i=r.length-1; i >= 0; --i)
								if (r[i].parityId === k)
									r.splice(i,1) // deletes refs one-by-one from stack array
									// ^ though... there *should* only be one match...
									//   will rethink, later; this is provably viable, if gross
						}
						if (this.paired[k])
							delete this.paired[k]
						if (session.refs[k])
							delete session.refs[k]
					}
					// NOTE: But what about this.unpaired?  Wouldn't there be leaks there?
					//   Hmm, proper Manager session buckets would go a long way to deal
					//   with that.  There'd be a variety of paired/unpaired... parings,
					//   and they'd live and die TOGETHER-ER-ER-ERrrrr...
					// Set the session id.
					session.id = id
				}
			}

			let pob
			console.log('new pair!',url,ob)
			// Pull a pob out of the appropriate unpaired bucket.
			let stack = this.unpaired[ob.classId]
			console.log('picking stack',stack)
			if (!stack || !stack.length) {
				/*
				if (this.createOnEmpty && ob.args[0] && ob.args[0].template) {
					pob = this.create(
						ob.args[0].template,
						ob.args[0].match)
					stack = this.unpaired[ob.classId]
					console.log('created a new guy!',pob,pob.fetchUrl,pob.parityId)
				}
				else
				//*/
				throw new Error(`no pobs of class id (${ob.classId}) available`)
			}
			else {
				console.log('stack',stack)
				pob = stack[stack.length-1]
			}
			// Handle the pair() method normally, by passing it along here.
			let a = await pob.handleClientRequest(ob)
			console.log('a',a,'requst result')
			if (!a)
				throw new Error('pairing failed')
			if (this.paired[pob.parityId])
				throw new Error(`duplicate id! (${pob.parityId})`)
			// And put the pob into the paired and session tables!
			this.paired[pob.parityId] = pob
			session.refs[pob.parityId] = pob
			delete this.unpairedRefs[pob.parityId]
			// Then pop that same element out of the stack, so only a single reference
			// exists between this.paired and this.unpaired.
			if (stack && stack.length) {
				let b = stack.pop() // pop here once transaction was a success
				console.log('pop out of stack',b.parityId)
			}
			console.log('this.paired',Object.keys(this.paired),a)
			console.log('now against', {
				paired:this.paired,
				unpaired:this.unpaired,
				addressed:this.addressed
			})
			return a
		}

		// If id's null, but it's *not* a pair request, try to match by url.
		else if (ob.id === null) {
			if (!url)
				throw new Error('no matching mechanism available for Manager!')
			let k = this._urlPatternMatch(url)
			if (!k)
				throw new Error(`no matching pattern for url (${url})`)
			// Can't select a specific one without an id, and given the lack of pair()
			// attempt, we can assume an id isn't being sought.  So let's just grab
			// whatever's on hand.
			let bucket = this.addressed[k]
			if (!bucket || !bucket.length)
				throw new Error(`bucket for pattern (${k}) is empty`)
			// Just use the first one sitting there.
			// NOTE: I'll leave it like this for now in case I choose some further
			//   sorting method for these buckets later.  Otherwise, it doesn't
			//   matter how large this bucket is; it'll only ever return one value.
			//   ... Let's at least make it return the latest thing added.
			let pob = bucket[bucket.length-1]
			return pob.handleClientRequest(pob)
		}

		// Otherwise, just find the matching pob and process normally.
		else {
			let {id,classId,method} = ob
			let pob = this.paired[id]
			if (!pob)
				throw new Error(`id expected but not present (${id})`)
			return pob.handleClientRequest(ob)
		}
	}
}
M.Manager = Manager

})(exports)

