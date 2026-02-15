import * as anchor from "@coral-xyz/anchor";
import {
  LiteSVM,
  FailedTransactionMetadata,
  TransactionMetadata,
} from "litesvm";
import {
  PublicKey,
  Keypair,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  Connection,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { AccountLayout, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { expect } from "chai";
import { readFileSync } from "fs";
import path from "path";

const PROGRAM_ID = new PublicKey(
  "6gAb78mSb4GcHutMxcH4TWy6ffQXccKY2cWb9HyR3MPt",
);

describe("quadratic-voting", () => {
  let svm: LiteSVM;
  let program: anchor.Program;
  let admin: Keypair;
  let voter: Keypair;
  let daoPda: PublicKey;
  let proposalPda: PublicKey;
  let mint: Keypair;
  let voterTokenAccount: Keypair;

  before(() => {
    svm = new LiteSVM().withDefaultPrograms();
    svm.addProgramFromFile(
      PROGRAM_ID,
      path.resolve(process.cwd(), "target/deploy/quadratic_voting.so"),
    );

    admin = Keypair.generate();
    voter = Keypair.generate();
    mint = Keypair.generate();
    voterTokenAccount = Keypair.generate();

    svm.airdrop(admin.publicKey, BigInt(10 * LAMPORTS_PER_SOL));
    svm.airdrop(voter.publicKey, BigInt(10 * LAMPORTS_PER_SOL));

    [daoPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("dao"), admin.publicKey.toBuffer()],
      PROGRAM_ID,
    );

    const countBuf = Buffer.alloc(8);
    countBuf.writeBigUInt64LE(0n);
    [proposalPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("proposal"), daoPda.toBuffer(), countBuf],
      PROGRAM_ID,
    );

    const idl = JSON.parse(
      readFileSync(
        path.resolve(process.cwd(), "target/idl/quadratic_voting.json"),
        "utf-8",
      ),
    );
    const connection = new Connection("http://127.0.0.1:8899");
    const provider = new anchor.AnchorProvider(
      connection,
      new anchor.Wallet(admin),
      {},
    );
    program = new anchor.Program(idl, provider);
  });

  function sendTx(
    instructions: TransactionInstruction[],
    signers: Keypair[],
  ): TransactionMetadata {
    const tx = new Transaction();
    tx.recentBlockhash = svm.latestBlockhash();
    tx.feePayer = signers[0].publicKey;
    instructions.forEach((ix) => tx.add(ix));
    tx.sign(...signers);
    const result = svm.sendTransaction(tx);
    if (result instanceof FailedTransactionMetadata) {
      throw new Error(`Transaction failed:\n${result.meta().prettyLogs()}`);
    }
    return result;
  }

  it("initializes a DAO", async () => {
    const ix = await program.methods
      .initDao("Test DAO")
      .accounts({
        admin: admin.publicKey,
        dao: daoPda,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    sendTx([ix], [admin]);

    const raw = svm.getAccount(daoPda);
    const dao = program.coder.accounts.decode("dao", Buffer.from(raw!.data));
    expect(dao.name).to.equal("Test DAO");
    expect(dao.authority.toBase58()).to.equal(admin.publicKey.toBase58());
    expect(dao.proposalCount.toNumber()).to.equal(0);
  });

  it("creates a proposal", async () => {
    const ix = await program.methods
      .initProposal("Should we fund project X?")
      .accounts({
        admin: admin.publicKey,
        dao: daoPda,
        proposal: proposalPda,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    sendTx([ix], [admin]);

    const raw = svm.getAccount(proposalPda);
    const proposal = program.coder.accounts.decode(
      "proposal",
      Buffer.from(raw!.data),
    );
    expect(proposal.metadata).to.equal("Should we fund project X?");
    expect(proposal.yesVoteCount.toNumber()).to.equal(0);
    expect(proposal.noVoteCount.toNumber()).to.equal(0);

    const daoRaw = svm.getAccount(daoPda);
    const dao = program.coder.accounts.decode(
      "dao",
      Buffer.from(daoRaw!.data),
    );
    expect(dao.proposalCount.toNumber()).to.equal(1);
  });

  it("casts a vote with quadratic credits", async () => {
    const tokenData = Buffer.alloc(AccountLayout.span);
    AccountLayout.encode(
      {
        mint: mint.publicKey,
        owner: voter.publicKey,
        amount: 100n,
        delegateOption: 0,
        delegate: PublicKey.default,
        state: 1,
        isNativeOption: 0,
        isNative: 0n,
        delegatedAmount: 0n,
        closeAuthorityOption: 0,
        closeAuthority: PublicKey.default,
      },
      tokenData,
    );
    svm.setAccount(voterTokenAccount.publicKey, {
      lamports: LAMPORTS_PER_SOL,
      data: tokenData,
      owner: TOKEN_PROGRAM_ID,
      executable: false,
    });

    const [votePda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("vote"),
        voter.publicKey.toBuffer(),
        proposalPda.toBuffer(),
      ],
      PROGRAM_ID,
    );

    const ix = await program.methods
      .castVote(1)
      .accounts({
        voter: voter.publicKey,
        dao: daoPda,
        proposal: proposalPda,
        voteAccount: votePda,
        creatorTokenAccount: voterTokenAccount.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    sendTx([ix], [voter]);

    const raw = svm.getAccount(votePda);
    const vote = program.coder.accounts.decode(
      "vote",
      Buffer.from(raw!.data),
    );
    expect(vote.authority.toBase58()).to.equal(voter.publicKey.toBase58());
    expect(vote.voteType).to.equal(1);
    expect(vote.voteCredits.toNumber()).to.equal(10);
  });
});
