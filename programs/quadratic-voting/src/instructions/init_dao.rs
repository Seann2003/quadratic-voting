use anchor_lang::prelude::*;

use crate::Dao;

#[derive(Accounts)]
pub struct InitDao<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        init,
        payer = admin,
        space = Dao::DISCRIMINATOR.len() + Dao::INIT_SPACE,
        seeds = [b"dao", admin.key().as_ref()],
        bump
    )]
    pub dao: Account<'info, Dao>,
    pub system_program: Program<'info, System>,
}

impl<'info> InitDao<'info> {
    pub fn handler(&mut self, name: String, bumps: &InitDaoBumps) -> Result<()> {
        self.dao.set_inner(
            Dao {
                name,
                authority: self.admin.key(),
                proposal_count: 0,
                bump: bumps.dao,
            }
        );
        Ok(())
    }
}