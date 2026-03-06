use anchor_lang::prelude::*;

declare_id!("6uafjLqqMeP4DgYqDuVPCL9BVabC7ruQC6SnDdUvXqC5");

#[program]
pub mod solana_price_feed {
    use super::*;

    pub fn initialize_feed(ctx: Context<InitializeFeed>, name: String, decimals: u8) -> Result<()> {
        require!(name.len() <= 32, FeedError::NameTooLong);
        let feed = &mut ctx.accounts.feed;
        feed.authority = ctx.accounts.authority.key();
        feed.name = name;
        feed.decimals = decimals;
        feed.price = 0;
        feed.confidence = 0;
        feed.last_updated = 0;
        feed.num_updates = 0;
        feed.bump = ctx.bumps.feed;

        emit!(FeedInitialized {
            feed: feed.key(),
            authority: feed.authority,
            name: feed.name.clone(),
            decimals,
        });

        Ok(())
    }

    pub fn update_price(ctx: Context<UpdatePrice>, price: i64, confidence: u64) -> Result<()> {
        let feed = &mut ctx.accounts.feed;
        let now = Clock::get()?.unix_timestamp;
        feed.price = price;
        feed.confidence = confidence;
        feed.last_updated = now;
        feed.num_updates = feed.num_updates.checked_add(1).ok_or(FeedError::Overflow)?;

        emit!(PriceUpdateEvent {
            feed: feed.key(),
            price,
            confidence,
            timestamp: now,
        });
        Ok(())
    }

    pub fn read_price(ctx: Context<ReadPrice>) -> Result<()> {
        let feed = &ctx.accounts.feed;
        let staleness = Clock::get()?.unix_timestamp.checked_sub(feed.last_updated).ok_or(FeedError::Overflow)?;
        require!(staleness <= 120, FeedError::StalePrice);
        msg!("Price: {} (confidence: {}, decimals: {})", feed.price, feed.confidence, feed.decimals);
        Ok(())
    }

    pub fn transfer_authority(ctx: Context<TransferAuthority>) -> Result<()> {
        let old_authority = ctx.accounts.feed.authority;
        ctx.accounts.feed.authority = ctx.accounts.new_authority.key();

        emit!(AuthorityTransferred {
            feed: ctx.accounts.feed.key(),
            old_authority,
            new_authority: ctx.accounts.new_authority.key(),
        });

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(name: String)]
pub struct InitializeFeed<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(init, payer = authority, space = 8 + PriceFeed::INIT_SPACE,
        seeds = [b"feed", authority.key().as_ref()], bump)]
    pub feed: Account<'info, PriceFeed>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdatePrice<'info> {
    pub authority: Signer<'info>,
    #[account(mut, seeds = [b"feed", feed.authority.as_ref()], bump = feed.bump, has_one = authority)]
    pub feed: Account<'info, PriceFeed>,
}

#[derive(Accounts)]
pub struct ReadPrice<'info> {
    pub feed: Account<'info, PriceFeed>,
}

#[derive(Accounts)]
pub struct TransferAuthority<'info> {
    pub authority: Signer<'info>,
    #[account(mut, has_one = authority)]
    pub feed: Account<'info, PriceFeed>,
    /// CHECK: new authority
    pub new_authority: AccountInfo<'info>,
}

#[account]
#[derive(InitSpace)]
pub struct PriceFeed {
    pub authority: Pubkey,
    #[max_len(32)]
    pub name: String,
    pub decimals: u8,
    pub price: i64,
    pub confidence: u64,
    pub last_updated: i64,
    pub num_updates: u64,
    pub bump: u8,
}

#[event]
pub struct FeedInitialized {
    pub feed: Pubkey,
    pub authority: Pubkey,
    pub name: String,
    pub decimals: u8,
}

#[event]
pub struct AuthorityTransferred {
    pub feed: Pubkey,
    pub old_authority: Pubkey,
    pub new_authority: Pubkey,
}

#[event]
pub struct PriceUpdateEvent {
    pub feed: Pubkey,
    pub price: i64,
    pub confidence: u64,
    pub timestamp: i64,
}

#[error_code]
pub enum FeedError {
    #[msg("Name too long (max 32)")]
    NameTooLong,
    #[msg("Price is stale (>120s)")]
    StalePrice,
    #[msg("Overflow")]
    Overflow,
}
