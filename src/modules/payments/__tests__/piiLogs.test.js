const fs = require("fs");
const path = require("path");

const FILES = [
  "src/modules/payments/subscription-access.service.js",
  "src/modules/users/users.controller.js",
  "src/modules/payments/stripe-webhook.routes.js",
  "src/modules/payments/subscriptions.controller.js",
  "src/modules/payments/checkout.routes.js",
  "src/legacy/data-scientist/controllers/dataScientistContactController.js",
  "src/legacy/project-manager/controllers/projectManagerContactController.js",
  "src/modules/support/support.controller.js",
];

function consoleCalls(source) {
  const calls = [];
  const pattern = /console\.(?:log|info|warn|error)\(/g;
  let match;
  while ((match = pattern.exec(source))) {
    const start = match.index;
    const slice = source.slice(start, start + 500);
    const end = slice.indexOf(");");
    calls.push(end === -1 ? slice : slice.slice(0, end + 2));
  }
  return calls;
}

describe("subscription and contact logs", () => {
  test("do not interpolate emails or Stripe customer ids", () => {
    const forbidden = [
      "user.email",
      "req.user.email",
      "stripeCustomerId",
      "subscription.customer",
      "invoice.customer",
      "paymentIntent.customer",
      "charge.customer",
      "customer.email",
      "req.body",
      "ownerEmail",
    ];

    const leaks = [];
    for (const file of FILES) {
      const source = fs.readFileSync(path.join(process.cwd(), file), "utf8");
      for (const call of consoleCalls(source)) {
        for (const token of forbidden) {
          if (call.includes(token)) leaks.push(`${file} logs ${token}: ${call}`);
        }
      }
    }
    expect(leaks).toEqual([]);
  });
});
