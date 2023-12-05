//
// cloudflare-worker-relayer
//

// Specify window on global so we can ensure that `window.fetch` is available
// @ts-ignore
globalThis.window = globalThis

import { ethers } from 'ethers'
import { Session } from '@0xsequence/auth'
const contractAddress = '0x4574ca5b8b16d8e36d26c7e3dbeffe81f6f031f7'

export interface Env {
	PKEY: string;
}

// TODO: update example to include sequence relayer stuff... etc..

// ethers provider -- here its important to use the static jcson rpc provider passing
// the skipFetchSetup and also the chainId
const nodeUrl = 'https://nodes.sequence.app/polygon'
const chainId = 137
const provider = new ethers.providers.StaticJsonRpcProvider({ url: nodeUrl, skipFetchSetup: true }, chainId)

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const res = await call(request, env)
		return new Response(`Hello World! ${res}`)
	}
}

const call = async (request: Request, env: Env): Promise<any> => {

	const walletEOA = new ethers.Wallet(env.PKEY, provider);

	// Open a Sequence session, this will find or create
	// a Sequence wallet controlled by your server EOA
	const session = await Session.singleSigner({
		signer: walletEOA,
	})
	
	const signer = session.account.getSigner(137)
		
	const demoCoinInterface = new ethers.utils.Interface([
		'function mint()'
	])
		
	const data = demoCoinInterface.encodeFunctionData(
		'mint', []
	)

	const txn = {
		to: contractAddress,
		data
	}

    try {
        const res = await signer.sendTransaction(txn)
		return res
	}catch(err){
		return 'ERROR'
	}
}
