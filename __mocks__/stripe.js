// __mocks__/stripe.js

const mockSubscriptionsRetrieve = jest.fn();
const mockSubscriptionsUpdate = jest.fn();
const mockSubscriptionsCancel = jest.fn();
const mockSubscriptionsList = jest.fn();

const mockChargesRetrieve = jest.fn();
const mockChargesList = jest.fn();

const mockRefundsCreate = jest.fn();

// This is what `new Stripe(...)` returns in the controller
const Stripe = jest.fn(function StripeMock() {
  return {
    subscriptions: {
      retrieve: mockSubscriptionsRetrieve,
      update: mockSubscriptionsUpdate,
      cancel: mockSubscriptionsCancel,
      list: mockSubscriptionsList,
    },
    charges: {
      retrieve: mockChargesRetrieve,
      list: mockChargesList,
    },
    refunds: {
      create: mockRefundsCreate,
    },
  };
});

// Default export for `require("stripe")`
module.exports = Stripe;

// Named exports so tests can control behavior
module.exports.mockSubscriptionsRetrieve = mockSubscriptionsRetrieve;
module.exports.mockSubscriptionsUpdate = mockSubscriptionsUpdate;
module.exports.mockSubscriptionsCancel = mockSubscriptionsCancel;
module.exports.mockSubscriptionsList = mockSubscriptionsList;

module.exports.mockChargesRetrieve = mockChargesRetrieve;
module.exports.mockChargesList = mockChargesList;

module.exports.mockRefundsCreate = mockRefundsCreate;
