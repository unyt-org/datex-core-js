// import {DATEX} from "../datex.ts"

// DATEX.Runtime.init()

console.log("helo")

function datex(val: any, context?:ClassDecoratorContext) {
	console.log(val, context)	
	context?.addInitializer(function(){
		console.log(this)
		// @ts-ignore
		this.lol = 23;
	})
}

@datex class Classy {

	// @datex y = 12

	// @datex method1(){

	// }

}

console.log(Classy);