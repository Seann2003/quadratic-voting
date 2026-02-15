pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("6gAb78mSb4GcHutMxcH4TWy6ffQXccKY2cWb9HyR3MPt");

#[program]
pub mod quadratic_voting {
    use super::*;

    pub fn init_dao(ctx: Context<InitDao>, name: String) -> Result<()> {
        ctx.accounts.handler(name, &ctx.bumps)
    }

    pub fn init_proposal(ctx: Context<InitProposal>, metadata: String) -> Result<()> {
        ctx.accounts.handler(metadata, &ctx.bumps)
    }

    pub fn cast_vote(ctx: Context<CastVote>, vote_type: u8) -> Result<()> {
        ctx.accounts.cast_vote(vote_type, &ctx.bumps)
    }

}
