import { sequence } from '0xsequence'
import { networks, findSupportedNetwork, toChainIdNumber, NetworkConfig } from '@0xsequence/network'

import { ethers } from 'ethers'
import { Session, SessionSettings } from '@0xsequence/auth'

export interface Env {
	PKEY: string; // Private key for EOA wallet
	CONTRACT_ADDRESS: string; // Deployed ERC1155 or ERC721 contract address
	PROJECT_ACCESS_KEY: string; // From sequence.build
	CHAIN_HANDLE: string; // Standardized chain name – See https://docs.sequence.xyz/multi-chain-support
}

// use the sequence api to verify proof came from a sequence wallet
const verify = async (chainId: string, walletAddress: string, ethAuthProofString: string): Promise<Boolean> => {
	const api = new sequence.api.SequenceAPIClient('https://api.sequence.app')
	const { isValid } = await api.isValidETHAuthProof({
		chainId, walletAddress, ethAuthProofString
	})
	return isValid
}

async function handleRequest(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
	if (env.PKEY === undefined || env.PKEY === '') {
		return new Response('Make sure PKEY is configured in your environment', { status: 400 })
	}

	if (env.CONTRACT_ADDRESS === undefined || env.CONTRACT_ADDRESS === '') {
		return new Response('Make sure CONTRACT_ADDRESS is configured in your environment', { status: 400 })
	}

	if (env.PROJECT_ACCESS_KEY === undefined || env.PROJECT_ACCESS_KEY === '') {
		return new Response('Make sure PROJECT_ACCESS_KEY is configured in your environment', { status: 400 })
	}

	if (env.CHAIN_HANDLE === undefined || env.CHAIN_HANDLE === '') {
		return new Response('Make sure CHAIN_HANDLE is configured in your environment', { status: 400 })
	}

	const chainConfig = findSupportedNetwork(env.CHAIN_HANDLE)

	if (chainConfig === undefined) {
		return new Response('Unsupported network or unknown CHAIN_HANDLE', { status: 400 })
	}

	// POST request
	if (request.method === "POST") {
		// parse the request body as JSON
		const body = await request.json();
		const { proof, address, tokenId }: any = body;
		try {
			// check that the proof is valid
			if(await verify(env.CHAIN_HANDLE, address, proof)){
				try{
					const res = await callContract(request, env, address, tokenId)
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
	} 
	// GET request
	else {
		try {
			const res = await getBlockNumber(env.CHAIN_HANDLE, request)
			return new Response(`Block Number: ${res}`)
		} catch(err: any){
			return new Response(`Something went wrong: ${JSON.stringify(err)}`, { status: 400 })
		}
	}
}

const getBlockNumber = async (chainHandle: string, request: Request): Promise<number> => {
	const nodeUrl = `https://nodes.sequence.app/${chainHandle}`
	const provider = new ethers.providers.JsonRpcProvider({ url: nodeUrl, skipFetchSetup: true })

	return await provider.getBlockNumber()
}

const callContract = async (request: Request, env: Env, address: string, tokenId: number): Promise<ethers.providers.TransactionResponse> => {
	const relayerUrl = `https://${env.CHAIN_HANDLE}-relayer.sequence.app`
	const nodeUrl = `https://nodes.sequence.app/${env.CHAIN_HANDLE}`
	const provider = new ethers.providers.JsonRpcProvider({ url: nodeUrl, skipFetchSetup: true })

		const contractAddress = env.CONTRACT_ADDRESS
	
		// create EOA from private key
		const walletEOA = new ethers.Wallet(env.PKEY, provider);
	
		// instantiate settings
		const settings: Partial<SessionSettings> = {
			networks: [{
				...networks[findSupportedNetwork(env.CHAIN_HANDLE)!.chainId],
				rpcUrl: findSupportedNetwork(env.CHAIN_HANDLE)!.rpcUrl,
				provider: provider,
				relayer: {
					url: relayerUrl,
					provider: {
						url: findSupportedNetwork(env.CHAIN_HANDLE)!.rpcUrl
					}
				}
			}],
		}
	
		// create a single signer sequence wallet session
		const session = await Session.singleSigner({
			settings: settings,
			signer: walletEOA,
			projectAccessKey: env.PROJECT_ACCESS_KEY
		})
	
		const signer = session.account.getSigner(findSupportedNetwork(env.CHAIN_HANDLE)!.chainId)
			
		const collectibleInterface = new ethers.utils.Interface([
			'function mint(address to, uint256 tokenId, uint256 amount, bytes data)'
		])
			
		const data = collectibleInterface.encodeFunctionData(
			'mint', [address, tokenId, 1, "0x00"]
		)
	
		const txn = { to: contractAddress, data }
	
		try {
			return await signer.sendTransaction(txn)
		} catch (err) {
			throw err
		}
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext) {
		// Process the request and create a response
		const response = await handleRequest(request, env, ctx);

		// Set CORS headers
		response.headers.set("Access-Control-Allow-Origin", "*");
		response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
		response.headers.set("Access-Control-Allow-Headers", "Content-Type");

		// return response
		return response;
	}
};