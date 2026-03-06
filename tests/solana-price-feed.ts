import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SolanaPriceFeed } from "../target/types/solana_price_feed";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { expect } from "chai";

describe("solana-price-feed", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace
    .solanaPriceFeed as Program<SolanaPriceFeed>;

  const authority = provider.wallet as anchor.Wallet;
  const newAuthority = Keypair.generate();
  const unauthorized = Keypair.generate();

  let feedPda: PublicKey;

  const FEED_NAME = "SOL/USD";
  const DECIMALS = 8;

  before(async () => {
    const conn = provider.connection;

    // Fund extra keypairs
    for (const kp of [newAuthority, unauthorized]) {
      const sig = await conn.requestAirdrop(kp.publicKey, 2 * LAMPORTS_PER_SOL);
      await conn.confirmTransaction(sig);
    }

    // Derive PDA
    [feedPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("feed"), authority.publicKey.toBuffer()],
      program.programId
    );
  });

  it("initialize_feed — creates price feed", async () => {
    await program.methods
      .initializeFeed(FEED_NAME, DECIMALS)
      .accounts({
        authority: authority.publicKey,
        feed: feedPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const feed = await program.account.priceFeed.fetch(feedPda);
    expect(feed.authority.toBase58()).to.equal(authority.publicKey.toBase58());
    expect(feed.name).to.equal(FEED_NAME);
    expect(feed.decimals).to.equal(DECIMALS);
    expect(feed.price.toNumber()).to.equal(0);
    expect(feed.confidence.toNumber()).to.equal(0);
    expect(feed.lastUpdated.toNumber()).to.equal(0);
    expect(feed.numUpdates.toNumber()).to.equal(0);
  });

  it("update_price — updates price", async () => {
    const price = new anchor.BN(15_000_000_000); // $150.00 at 8 decimals
    const confidence = new anchor.BN(50_000_000); // $0.50

    await program.methods
      .updatePrice(price, confidence)
      .accounts({
        authority: authority.publicKey,
        feed: feedPda,
      })
      .rpc();

    const feed = await program.account.priceFeed.fetch(feedPda);
    expect(feed.price.toNumber()).to.equal(price.toNumber());
    expect(feed.confidence.toNumber()).to.equal(confidence.toNumber());
    expect(feed.lastUpdated.toNumber()).to.be.greaterThan(0);
    expect(feed.numUpdates.toNumber()).to.equal(1);
  });

  it("read_price — reads current price (not stale)", async () => {
    // read_price just emits a msg and checks staleness (<= 120s).
    // Since we just updated, it should succeed.
    await program.methods
      .readPrice()
      .accounts({
        feed: feedPda,
      })
      .rpc();

    // If we get here without error, the price was not stale. Confirm data.
    const feed = await program.account.priceFeed.fetch(feedPda);
    expect(feed.price.toNumber()).to.equal(15_000_000_000);
    expect(feed.numUpdates.toNumber()).to.equal(1);
  });

  it("update_price — second update increments num_updates", async () => {
    const price = new anchor.BN(15_500_000_000); // $155.00
    const confidence = new anchor.BN(40_000_000); // $0.40

    await program.methods
      .updatePrice(price, confidence)
      .accounts({
        authority: authority.publicKey,
        feed: feedPda,
      })
      .rpc();

    const feed = await program.account.priceFeed.fetch(feedPda);
    expect(feed.price.toNumber()).to.equal(15_500_000_000);
    expect(feed.confidence.toNumber()).to.equal(40_000_000);
    expect(feed.numUpdates.toNumber()).to.equal(2);
  });

  it("error: unauthorized update — should fail", async () => {
    const price = new anchor.BN(99_999);
    const confidence = new anchor.BN(1);

    try {
      await program.methods
        .updatePrice(price, confidence)
        .accounts({
          authority: unauthorized.publicKey,
          feed: feedPda,
        })
        .signers([unauthorized])
        .rpc();
      expect.fail("Should have thrown an authorization error");
    } catch (err: any) {
      // has_one = authority constraint will reject this with a ConstraintHasOne
      // error or a custom message. Either way the tx should not succeed.
      const msg = err.error?.errorCode?.code || err.message || "";
      expect(msg.length).to.be.greaterThan(0);
      // Confirm the feed was not modified
      const feed = await program.account.priceFeed.fetch(feedPda);
      expect(feed.price.toNumber()).to.equal(15_500_000_000);
      expect(feed.numUpdates.toNumber()).to.equal(2);
    }
  });

  it("transfer_authority — transfers authority to new keypair", async () => {
    await program.methods
      .transferAuthority()
      .accounts({
        authority: authority.publicKey,
        feed: feedPda,
        newAuthority: newAuthority.publicKey,
      })
      .rpc();

    const feed = await program.account.priceFeed.fetch(feedPda);
    expect(feed.authority.toBase58()).to.equal(
      newAuthority.publicKey.toBase58()
    );
  });

  it("error: old authority cannot update after transfer", async () => {
    const price = new anchor.BN(16_000_000_000);
    const confidence = new anchor.BN(30_000_000);

    // After transfer_authority, the PDA seeds use feed.authority (which is now
    // newAuthority). The old authority's key won't match has_one = authority.
    try {
      await program.methods
        .updatePrice(price, confidence)
        .accounts({
          authority: authority.publicKey,
          feed: feedPda,
        })
        .rpc();
      expect.fail("Old authority should not be able to update");
    } catch (err: any) {
      const msg = err.error?.errorCode?.code || err.message || "";
      expect(msg.length).to.be.greaterThan(0);
    }
  });

  it("new authority can update price after transfer", async () => {
    // Note: After transfer, the PDA seed derivation uses feed.authority which
    // changed. But the feed account is passed by address not re-derived from
    // seeds in UpdatePrice (seeds use feed.authority.as_ref()). The new
    // authority should work because has_one checks feed.authority == signer.
    const price = new anchor.BN(16_000_000_000);
    const confidence = new anchor.BN(30_000_000);

    await program.methods
      .updatePrice(price, confidence)
      .accounts({
        authority: newAuthority.publicKey,
        feed: feedPda,
      })
      .signers([newAuthority])
      .rpc();

    const feed = await program.account.priceFeed.fetch(feedPda);
    expect(feed.price.toNumber()).to.equal(16_000_000_000);
    expect(feed.numUpdates.toNumber()).to.equal(3);
  });
});
