//
// cloudflare-worker-relayer
//

import { ethers } from 'ethers'
import { Session, SessionSettings } from '@0xsequence/auth'
import { networks, ChainId } from '@0xsequence/network'

const contractAddress = '0x4574ca5b8b16d8e36d26c7e3dbeffe81f6f031f7'

export interface Env {
	PKEY: string;
}

// ethers provider -- here its important to use the static jcson rpc provider passing
// the skipFetchSetup and also the chainId
const nodeUrl = 'https://nodes.sequence.app/polygon'
const relayerUrl = 'https://polygon-relayer.sequence.app'
const chainId = 137
const provider = new ethers.providers.StaticJsonRpcProvider({ url: nodeUrl, skipFetchSetup: true }, chainId)

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		if (env.PKEY === undefined || env.PKEY === '') {
			console.log('ooops! check your wranger.toml config to set your PKEY')
		}

		const res = await call(request, env)
		return new Response(`Hello World! ${res}`)
	}
}

const call = async (request: Request, env: Env): Promise<any> => {

	const walletEOA = new ethers.Wallet(env.PKEY, provider);

	// Open a Sequence session, this will find or create
	// a Sequence wallet controlled by your server EOA

	// TODO: this is so ugly, we need to fix this in sequence.js
	const settings: Partial<SessionSettings> = {
		networks: [{
			...networks[ChainId.POLYGON],
			rpcUrl: nodeUrl,
			relayer: {
				url: relayerUrl,
				provider: {
					url: nodeUrl
				}
			}
		}],
	}

	const session = await Session.singleSigner({
		settings: settings,
		signer: walletEOA,
	})
	
	const signer = session.account.getSigner(chainId)
		
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
	} catch (err) {
		return `ERROR: ${err}`
	}
}
