const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const mongoose = require("mongoose");
const User = require("../../src/shared/models/User");

const SCRIPT = path.join(__dirname, "..", "create-comped-customer.js");

function testMongoUri() {
  const client = mongoose.connection.getClient();
  return client?.s?.url;
}

function runScript(env, extraArgs = []) {
  return spawnSync(process.execPath, [SCRIPT, ...extraArgs], {
    env: { ...process.env, ...env, MONGODB_URI: testMongoUri() },
    encoding: "utf8",
  });
}

function parseScriptStdout(stdout) {
  const lines = String(stdout || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return JSON.parse(lines[lines.length - 1]);
}

describe("create-comped-customer.js", () => {
  it("does not print password, email, or name", async () => {
    const stamp = `${Date.now()}_${Math.random()}`;
    const email = `comped_script_${stamp}@example.com`;
    const username = `comped_user_${stamp}`;
    const passwordOut = path.join(os.tmpdir(), `comped-pass-${stamp}.txt`);

    const result = runScript(
      {
        EMAIL: email,
        NAME: "Comped Script User",
        USERNAME: username,
        COMPED_PLAN: "pro",
      },
      ["--password-out", passwordOut]
    );

    const combined = `${result.stdout || ""}${result.stderr || ""}`;
    expect(result.status).toBe(0);
    expect(combined).not.toMatch(/Comped Script User/);
    expect(combined).not.toMatch(new RegExp(email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    if (fs.existsSync(passwordOut)) {
      const password = fs.readFileSync(passwordOut, "utf8").trim();
      expect(password.length).toBeGreaterThan(16);
      expect(combined).not.toContain(password);
      fs.unlinkSync(passwordOut);
    }

    const parsed = parseScriptStdout(result.stdout);
    expect(parsed.userId).toMatch(/^[a-f0-9]{24}$/i);
    expect(combined).not.toMatch(/@/);

    const user = await User.findById(parsed.userId).lean();
    expect(user.comped).toBe(true);
    expect(user.compedPlan).toBe("pro");
    expect(user.isDemo).toBe(false);

    await User.deleteOne({ _id: user._id });
  });

  it("is idempotent by email", async () => {
    const stamp = `${Date.now()}_${Math.random()}`;
    const email = `comped_idempotent_${stamp}@example.com`;
    const username = `comped_idem_${stamp}`;
    const passwordOut = path.join(os.tmpdir(), `comped-pass-idem-${stamp}.txt`);

    const env = {
      EMAIL: email,
      NAME: "Idempotent User",
      USERNAME: username,
      COMPED_PLAN: "basic",
    };

    const first = runScript(env, ["--password-out", passwordOut]);
    expect(first.status).toBe(0);
    const firstId = parseScriptStdout(first.stdout).userId;

    const second = runScript({ ...env, COMPED_PLAN: "pro" }, ["--password-out", passwordOut]);
    expect(second.status).toBe(0);
    const secondId = parseScriptStdout(second.stdout).userId;

    expect(firstId).toBe(secondId);
    const count = await User.countDocuments({ email });
    expect(count).toBe(1);

    const user = await User.findById(firstId).lean();
    expect(user.compedPlan).toBe("pro");
    await User.deleteOne({ _id: user._id });
    if (fs.existsSync(passwordOut)) fs.unlinkSync(passwordOut);
  });
});