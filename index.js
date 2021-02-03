
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
		// I guess... allow this to be overridden if needed?
		this.clientSourcePath = './client.js'
		
		this.fetchUrl = null
		this.setClientFetchUrl(url)
	}
	
	setClientFetchUrl(url) {
		this.fetchUrl = url
	}
	
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
			return await fs.p.readFile(
				path.resolve(__dirname,this.clientSourcePath))
		} catch(e) {
			if (true) // check against some specific error type
				throw e
		}
	}
	
	async ping(...r) {
		return {
			msg:'ping successful',
			ts:new Date(),
			args:[...r],
			url:this.fetchUrl,
			srclen:this.renderedSource && this.renderedSource.length
		}
	}
}
M.ParityObject = ParityObject

// This is more a test of extendability practice than anything.
class P2 extends ParityObject {
	constructor(...r) {
		super(...r)
	}
	
	async pong(...r) {
		return {
			msg:'class extension success'
		}
	}
}
M.P2 = P2

})(exports)

