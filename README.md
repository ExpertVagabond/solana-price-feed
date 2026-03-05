# solana-price-feed

Oracle-style price feed with staleness checks and authority transfer on Solana.

![Rust](https://img.shields.io/badge/Rust-000000?logo=rust) ![Solana](https://img.shields.io/badge/Solana-9945FF?logo=solana&logoColor=white) ![Anchor](https://img.shields.io/badge/Anchor-blue) ![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

## Overview

A Solana Anchor program implementing a price oracle where an authorized publisher pushes price updates on-chain. Each feed stores a signed price, confidence interval, decimal precision, and the last update timestamp. Consumers reading the feed are protected by a 120-second staleness check. Price updates emit a `PriceUpdateEvent` for off-chain indexing. Authority can be transferred to rotate publisher keys.

## Program Instructions

| Instruction | Description | Key Accounts |
|---|---|---|
| `initialize_feed` | Create a new price feed with a name and decimal precision | `authority` (signer), `feed` (PDA) |
| `update_price` | Push a new price and confidence value (authority only) | `authority` (signer), `feed` |
| `read_price` | Read the current price (fails if stale > 120s) | `feed` |
| `transfer_authority` | Transfer feed ownership to a new authority | `authority` (signer), `feed`, `new_authority` |

## Account Structures

### PriceFeed

| Field | Type | Description |
|---|---|---|
| `authority` | `Pubkey` | Authorized price publisher |
| `name` | `String` | Feed name (max 32 chars) |
| `decimals` | `u8` | Price decimal precision |
| `price` | `i64` | Current price (signed, supports negative) |
| `confidence` | `u64` | Confidence interval |
| `last_updated` | `i64` | Unix timestamp of last update |
| `num_updates` | `u64` | Total number of price updates |
| `bump` | `u8` | PDA bump seed |

## Events

### PriceUpdateEvent

| Field | Type | Description |
|---|---|---|
| `feed` | `Pubkey` | Feed account address |
| `price` | `i64` | Updated price |
| `confidence` | `u64` | Confidence interval |
| `timestamp` | `i64` | Update timestamp |

## PDA Seeds

- **Feed:** `["feed", authority]`

## Error Codes

| Error | Description |
|---|---|
| `NameTooLong` | Feed name exceeds 32 characters |
| `StalePrice` | Price data is older than 120 seconds |
| `Overflow` | Arithmetic overflow |

## Build & Test

```bash
anchor build
anchor test
```

## Deploy

```bash
solana config set --url devnet
anchor deploy
```

## License

[MIT](LICENSE)
