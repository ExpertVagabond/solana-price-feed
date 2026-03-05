# solana-price-feed

On-chain price oracle with staleness detection and confidence intervals. Publish and consume price data with freshness guarantees.

![Rust](https://img.shields.io/badge/Rust-000000?logo=rust&logoColor=white)
![Solana](https://img.shields.io/badge/Solana-9945FF?logo=solana&logoColor=white)
![Anchor](https://img.shields.io/badge/Anchor-blue)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

## Features

- Price staleness detection
- Confidence interval tracking
- Multi-asset support
- Authority-controlled updates

## Program Instructions

`initialize` | `update_price` | `get_price`

## Build

```bash
anchor build
```

## Test

```bash
anchor test
```

## Deploy

```bash
# Devnet
anchor deploy --provider.cluster devnet

# Mainnet
anchor deploy --provider.cluster mainnet
```

## Project Structure

```
programs/
  solana-price-feed/
    src/
      lib.rs          # Program entry point and instructions
    Cargo.toml
tests/
  solana-price-feed.ts           # Integration tests
Anchor.toml             # Anchor configuration
```

## License

MIT — see [LICENSE](LICENSE) for details.

## Author

Built by [Purple Squirrel Media](https://purplesquirrelmedia.io)
