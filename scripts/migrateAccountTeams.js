#!/usr/bin/env node
/**
 * Idempotent migration: one Account per legacy portfolio owner + account_admin membership,
 * links portfolios.account. Does not run automatically — invoke manually when ready.
 *
 * Usage:
 *   node scripts/migrateAccountTeams.js            # dry-run (default)
 *   node scripts/migrateAccountTeams.js --write    # apply changes
 */
require("dotenv").config();
const mongoose = require("mongoose");
const Portfolio = require("../src/modules/portfolios/models/Portfolio");
const Account = require("../src/modules/account-teams/models/Account");
const AccountMembership = require("../src/modules/account-teams/models/AccountMembership");
const User = require("../src/shared/models/User");

const WRITE = process.argv.includes("--write");

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGODB_URI_TEST;
  if (!uri) {
    console.error("MONGODB_URI required");
    process.exit(1);
  }
  await mongoose.connect(uri);

  const ownerIds = await Portfolio.distinct("owner");
  let accountsCreated = 0;
  let membershipsCreated = 0;
  let portfoliosLinked = 0;

  for (const ownerId of ownerIds) {
    const user = await User.findById(ownerId).select("email").lean();
    if (!user?.email) continue;

    let account = await Account.findOne({ createdFromOwner: ownerId }).lean();
    if (!account) {
      if (WRITE) {
        account = await Account.create({
          name: "Workspace",
          createdFromOwner: ownerId,
          createdBy: ownerId,
        });
      } else {
        account = { _id: `(new for ${ownerId})` };
      }
      accountsCreated += 1;
    }

    const accountId = account._id;
    const existingMembership = await AccountMembership.findOne({
      account: accountId,
      user: ownerId,
    }).lean();
    if (!existingMembership) {
      if (WRITE) {
        await AccountMembership.create({
          account: accountId,
          user: ownerId,
          email: String(user.email).toLowerCase(),
          role: "account_admin",
          status: "active",
        });
      }
      membershipsCreated += 1;
    }

    const unlinked = await Portfolio.countDocuments({ owner: ownerId, account: null });
    if (unlinked > 0) {
      if (WRITE && accountId) {
        const res = await Portfolio.updateMany(
          { owner: ownerId, account: null },
          { $set: { account: accountId } }
        );
        portfoliosLinked += res.modifiedCount;
      } else {
        portfoliosLinked += unlinked;
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        mode: WRITE ? "write" : "dry-run",
        owners: ownerIds.length,
        accountsCreated,
        membershipsCreated,
        portfoliosLinked,
      },
      null,
      2
    )
  );

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});