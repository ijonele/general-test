# general-test

A helpful AI agent named general-test

## x402 Payments

This agent uses [x402](https://x402.org) to charge per request using USDC.

Payment configuration is read from environment variables at startup:

- `X402_FACILITATOR_URL` — payment facilitator endpoint (shared across all networks)
- `X402_<NETWORK>_PAY_TO` — wallet address to receive payments (set to enable, remove to disable)
- `X402_<NETWORK>_PRICE` — price per request in USDC (default: 0.01)
- `X402_<NETWORK>_NETWORK` — network identifier

Available network prefixes: `X402_BASE_SEPOLIA`, `X402_BASE`, `X402_SOL_DEVNET`, `X402_SOL`.

### Facilitator

Set `X402_FACILITATOR_URL` in `.env` to your facilitator of choice. The [PayAI facilitator](https://facilitator.payai.network) offers 1,000 free settlements per month. For higher volumes, create a merchant account at [merchant.payai.network](https://merchant.payai.network) and set `PAYAI_API_KEY_ID` and `PAYAI_API_KEY_SECRET` in your `.env`. Authentication is handled automatically.

To disable payments entirely, remove all `PAY_TO` values from `.env`.
To add a network, uncomment its section in `.env` and set the pay-to address.

## Setup

Install dependencies:

```bash
npm install
```

Copy the example environment file and configure your API key:

```bash
cp .env.example .env
```

Edit `.env` and set your `OPENAI_API_KEY`.


## Development

Build and run the agent:

```bash
npm run build
npm start
```

The agent will be available at `http://localhost:3000`.

## Docker

Build and run with Docker:

```bash
docker build -t general-test .
docker run -p 3000:3000 -e AGENT_URL=http://your-public-url:3000 general-test
```

Set `AGENT_URL` to the public URL where the agent will be reachable. This is used in the agent card for discovery by other agents and clients.
