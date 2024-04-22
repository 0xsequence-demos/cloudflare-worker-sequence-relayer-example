Serverless Sequence Minter Transactions API using Cloudflare Workers
===========================================================

This repo contains a sample minter implementation that leverages [Cloudflare Workers](https://developers.cloudflare.com/workers/) to deploy a secure and gasless token minter that can be leveraged for minting in-game items and tokens.

You can read a complete tutorial about how to use it [on Sequence Docs](https://docs.sequence.xyz/guides/mint-collectibles-serverless).

## Usage

1. pnpm install
2. pnpm dev
3. curl http://localhost:8787

## Deploy

To deploy/publish the cloudflare worker, authenticate with wrangler first, then run  `pnpm deploy`.

See https://developers.cloudflare.com/workers/ to learn more.
