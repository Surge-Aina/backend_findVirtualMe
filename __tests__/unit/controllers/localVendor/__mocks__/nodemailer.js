const sendMail = jest.fn().mockResolvedValue({ accepted: ['ok@test.com'] });
const createTransport = jest.fn(() => ({ sendMail }));
module.exports = { createTransport, __mocks: { sendMail } };
