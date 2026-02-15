use anchor_lang::prelude::*;
use anchor_spl::token_interface::{TokenAccount, TokenInterface};

use crate::{Dao, Proposal, Vote};

#[derive(Accounts)]
pub struct CastVote<'info> {
    #[account(mut)]
    pub voter: Signer<'info>,

    pub dao: Account<'info, Dao>,

    #[account(mut)]
    pub proposal: Account<'info, Proposal>,

    #[account(
        init,
        payer = voter,
        space = Vote::DISCRIMINATOR.len() + Vote::INIT_SPACE,
        seeds = [b"vote", voter.key().as_ref(), proposal.key().as_ref()],
        bump,
    )]
    pub vote_account: Account<'info, Vote>,

    #[account(
        mut,
        token::authority = voter,
    )]
    pub creator_token_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

impl<'info> CastVote<'info> {
    pub fn cast_vote(&mut self, vote_type: u8, bumps: &CastVoteBumps) -> Result<()> {
        let vote_account = &mut self.vote_account;

        let voting_credits = (self.creator_token_account.amount as f64).sqrt() as u64;

        vote_account.set_inner(Vote {
            authority: self.voter.key(),
            vote_type,
            vote_credits: voting_credits,
            bump: bumps.vote_account,
        });

        Ok(())
    }
}