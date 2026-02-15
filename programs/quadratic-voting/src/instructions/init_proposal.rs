use anchor_lang::prelude::*;

use crate::{Dao, Proposal};

#[derive(Accounts)]
pub struct InitProposal<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(mut)]
    pub dao: Account<'info, Dao>,
    #[account(
        init,
        payer = admin,
        space = Proposal::DISCRIMINATOR.len() + Proposal::INIT_SPACE,
        seeds = [b"proposal", dao.key().as_ref(), dao.proposal_count.to_le_bytes().as_ref()],
        bump
    )]
    pub proposal: Account<'info, Proposal>,
    pub system_program: Program<'info, System>,
}

impl<'info> InitProposal<'info> {
    pub fn handler(&mut self, metadata: String, bumps: &InitProposalBumps) -> Result<()> {
        self.proposal.set_inner(
            Proposal {
                authority: self.admin.key(),
                metadata: metadata,
                yes_vote_count: 0,
                no_vote_count: 0,
                bump: bumps.proposal,
            }
        );

        self.dao.proposal_count += 1;
        Ok(())
    }
}