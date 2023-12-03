//
// cloudflare-worker-ethers
//

// Specify window on global so we can ensure that `window.fetch` is available
// @ts-ignore
globalThis.window = globalThis

import { ethers } from 'ethers'

export interface Env {
	// Example binding to KV. Learn more at https://developers.cloudflare.com/workers/runtime-apis/kv/
	// MY_KV_NAMESPACE: KVNamespace;
	//
	// Example binding to Durable Object. Learn more at https://developers.cloudflare.com/workers/runtime-apis/durable-objects/
	// MY_DURABLE_OBJECT: DurableObjectNamespace;
	//
	// Example binding to R2. Learn more at https://developers.cloudflare.com/workers/runtime-apis/r2/
	// MY_BUCKET: R2Bucket;
	//
	// Example binding to a Service. Learn more at https://developers.cloudflare.com/workers/runtime-apis/service-bindings/
	// MY_SERVICE: Fetcher;
	//
	// Example binding to a Queue. Learn more at https://developers.cloudflare.com/queues/javascript-apis/
	// MY_QUEUE: Queue;
}

// TODO: update example to include sequence relayer stuff... etc..

// ethers provider -- here its important to use the static jcson rpc provider passing
// the skipFetchSetup and also the chainId
const nodeUrl = 'https://nodes.sequence.app/polygon'
const chainId = 137
const provider = new ethers.providers.StaticJsonRpcProvider({ url: nodeUrl, skipFetchSetup: true }, chainId)

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const blockNumber = await getBlockNumber(request)
		return new Response(`Hello World! ${blockNumber}`)
	}
}

const getBlockNumber = async (request: Request): Promise<number> => {
	const blockNumber = await provider.getBlockNumber()
	console.log(blockNumber)
	return blockNumber
}
