//
// cloudflare-worker-relayer
//
import { sequence } from '0xsequence'
import { ethers } from 'ethers'
import { Session, SessionSettings } from '@0xsequence/auth'
import { networks, ChainId } from '@0xsequence/network'

const contractAddress = '0x68680bc16af8f0b29471bc3196d7cbb7248810a2'

export interface Env {
	PKEY: string;
}

// the skipFetchSetup and also the chainId
const nodeUrl = 'https://nodes.sequence.app/arbitrum'
const relayerUrl = 'https://arbitrum-relayer.sequence.app'
const chainId = ChainId.ARBITRUM

// ethers provider -- here its important to use the static jcson rpc provider passing
const provider = new ethers.providers.StaticJsonRpcProvider({ url: nodeUrl, skipFetchSetup: true }, chainId)

// use the sequence api to verify proof came from a sequence wallet
const verify = async (chainId: string, walletAddress: string, ethAuthProofString: string): Promise<Boolean> => {
	const api = new sequence.api.SequenceAPIClient('https://api.sequence.app')
	const { isValid } = await api.isValidETHAuthProof({
		chainId, walletAddress, ethAuthProofString
	})
	return isValid
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext) {
		// Process the request and create a response
		const response = await handleRequest(request, env, ctx);

		// Set CORS headers
		response.headers.set("Access-Control-Allow-Origin", "*"); // change as needed
		response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
		response.headers.set("Access-Control-Allow-Headers", "Content-Type");

		// return response
		return response;
	}
};

async function handleRequest(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
	if (env.PKEY === undefined || env.PKEY === '') {
		console.log('ooops! check your wranger.toml config to set your PKEY or set in wrangler env variables.')
	}

	if (request.method === "POST") {
		// parse the request body as JSON
		const body = await request.json();
		const { proof, address }: any = body;
		try {
			if(await verify('arbitrum', address, proof)){
				try{
					const res = await call(request, env, address)
					return new Response(`${res.hash}`, { status: 200 })
				} catch (err: any) {
					console.log(err)
					return new Response(`Something went wrong: ${JSON.stringify(err)}`, { status: 400 })
				}
			} else {
				return new Response(`Unauthorized`, { status: 401 })
			}
		} catch(err: any){
			return new Response(`Unauthorized ${JSON.stringify(err)}`, { status: 401 })
		}
	} else {
		try {
			const res = await getBlockNumber(request)
			return new Response(`Block Number: ${res}`)
		} catch(err: any){
			return new Response(`Something went wrong: ${JSON.stringify(err)}`, { status: 400 })
		}
	}
}

const getBlockNumber = async (request: Request): Promise<number> => {
	return await provider.getBlockNumber()
}

const call = async (request: Request, env: Env, address: string): Promise<ethers.providers.TransactionResponse> => {

	const walletEOA = new ethers.Wallet(env.PKEY, provider);

	// TODO: this is so ugly, we need to fix this in sequence.js
	const settings: Partial<SessionSettings> = {
		networks: [{
			...networks[ChainId.ARBITRUM],
			rpcUrl: nodeUrl,
			provider: provider, // NOTE: must pass the provider here
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
		
	const collectibleInterface = new ethers.utils.Interface([
		'function mint(address collector)'
	])
		
	const data = collectibleInterface.encodeFunctionData(
		'mint', [address]
	)

	const txn = { to: contractAddress, data }

	try {
		return await signer.sendTransaction(txn)
	} catch (err) {
		throw err
	}
}