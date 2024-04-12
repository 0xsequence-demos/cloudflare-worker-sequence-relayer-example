//
// cloudflare-worker-relayer
//

import { sequence } from '0xsequence'
import { ethers } from 'ethers'
import { Session, SessionSettings } from '@0xsequence/auth'
import { networks, findSupportedNetwork, toChainIdNumber, NetworkConfig } from '@0xsequence/network'

// These env variables should be set under wrangler.toml or via `wrangler secret put` command
// Warning: Always use `wrangler secret put` for PKEY since it's sensitive
export interface Env {
	PKEY: string; // Private key for EOA wallet
	CONTRACT_ADDRESS: string; // Deployed ERC1155 or ERC721 contract address
	PROJECT_ACCESS_KEY: string; // From sequence.build
	CHAIN_HANDLE: string; // Standardized chain name – See https://docs.sequence.xyz/multi-chain-support
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const response = await handleRequest(request, env)

		// Set CORS headers
		response.headers.set("Access-Control-Allow-Origin", "*");
		response.headers.set("Access-Control-Allow-Methods", "GET, POST");
		response.headers.set("Access-Control-Allow-Headers", "Content-Type");

		return response
	}
}

const verifySignature = async (chainId: string, signature: string, message: string, walletAddress: string): Promise<boolean> => {
	const api = new sequence.api.SequenceAPIClient('https://api.sequence.app')
	const { isValid } = await api.isValidMessageSignature({chainId, walletAddress, message, signature})
	return isValid
}

async function handleRequest(request: Request, env: Env): Promise<Response> {
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

	if (request.method === "POST") {
		const payload = await request.json()
		const { proof, signedProof, address }: any = payload
		
		if (await verifySignature(chainConfig.name, signedProof, proof, address) === false) {
			return new Response('Invalid signature', { status: 400 })
		}

		const proofPayload = JSON.parse(proof).payload
		const tokenId = parseInt(proofPayload.tokenId)
		const amount = parseInt(proofPayload.amount)

		const now = new Date().getTime()
		const expiration = parseInt(proof.exp)
		if (expiration < now) {
			return new Response('Proof has expired', { status: 400 })
		}
		const iat = parseInt(proof.iat)
		if (iat > now) {
			return new Response('Proof is not yet valid', { status: 400 })
		}

		try {
			const txn = await callContract(env, chainConfig, address, tokenId, amount)
			return new Response(`${txn.hash}`, { status: 201 })
		} catch(error: any) {
			console.log(error)
			return new Response(JSON.stringify(error), { status: 400 })
		}
	} else {
		const signer = await getSigner(env, chainConfig)
	
		console.log(await signer.getAddress())

		return new Response("Minter ready", { status: 200 })
	}
}

const getSigner = async(env: Env, chainConfig: NetworkConfig): Promise<ethers.Signer> => {
	const provider = new ethers.providers.StaticJsonRpcProvider({
		url: chainConfig.rpcUrl, 
		skipFetchSetup: true // Required for ethers.js Cloudflare Worker support
	})

	const walletEOA = new ethers.Wallet(env.PKEY, provider);
	const relayerUrl = `https://${chainConfig.name}-relayer.sequence.app`

	// Open a Sequence session, this will find or create
	// a Sequence wallet controlled by your server EOA
	const settings: Partial<SessionSettings> = {
		networks: [{
			...networks[chainConfig.chainId],
			rpcUrl: chainConfig.rpcUrl,
			provider: provider, // NOTE: must pass the provider here
			relayer: {
				url: relayerUrl,
				provider: {
					url: chainConfig.rpcUrl
				}
			}
		}],
	}

	// Create a single signer sequence wallet session
	const session = await Session.singleSigner({
		settings: settings,
		signer: walletEOA,
		projectAccessKey: env.PROJECT_ACCESS_KEY
	})

	const signer = session.account.getSigner(chainConfig.chainId)
	return signer;
}

const callContract = async (env: Env, chainConfig: NetworkConfig, address: string, tokenId: number, amount: number): Promise<ethers.providers.TransactionResponse> => {
	const signer = await getSigner(env, chainConfig)
	
	// Standard interface for ERC1155 contract deployed via Sequence Builder
	const collectibleInterface = new ethers.utils.Interface([
		'function mint(address to, uint256 tokenId, uint256 amount, bytes data)'
	])
		
	const data = collectibleInterface.encodeFunctionData(
		'mint', [`${address}`, `${tokenId}`, `${amount}`, "0x00"]
	)

	const txn = {
		to: env.CONTRACT_ADDRESS, 
		data: data
	}

	try {
		return await signer.sendTransaction(txn)
	} catch (err) {
		console.error(`ERROR: ${err}`)
		throw err
	}
}
