const HandymanInquiry = require('../../models/handyMan/handymanInquiryModel');
const HandymanTemplate = require('../../models/handyMan/HandymanTemplate');
const UserModel = require('../../models/userModel');
const nodemailer = require('nodemailer');

function buildTransporter() {
  // Expect these in your .env
  // SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: process.env.SMTP_USER ? {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    } : undefined
  });
}

const createInquiry = async (req, res) => {
  try {
    const { templateId, name, email, phone, message } = req.body;

    // 1) Persist inquiry
    const newInquiry = await HandymanInquiry.create({
      templateId: templateId || undefined,
      name, email, phone, message
    });

    // 2) Resolve owner email (contact.email → owner’s email)
    let ownerEmail = null;
    if (templateId) {
      try {
        const tpl = await HandymanTemplate.findById(templateId).lean();
        ownerEmail = tpl?.contact?.email || null;
        if (!ownerEmail && tpl?.userId) {
          const owner = await UserModel.findById(tpl.userId).lean();
          ownerEmail = owner?.email || null;
        }
      } catch (_) {}
    }

    // If no owner email resolved, we still succeed after saving the inquiry.
    const transporter = buildTransporter();
    const from = process.env.SMTP_FROM || (process.env.SMTP_USER || 'no-reply@example.com');

    // 3a) Auto-reply to visitor
    if (email && transporter) {
      await transporter.sendMail({
        from,
        to: email,
        subject: 'We received your request',
        text:
`Hi ${name || 'there'},

Thanks for contacting us! We’ve received your request and will get back to you shortly.

Summary you sent:
- Name: ${name || '—'}
- Phone: ${phone || '—'}
- Email: ${email}
- Message: ${message || '—'}

Best,
Your Handyman Team`
      });
    }

    // 3b) Notify the owner (if we resolved an address)
    if (ownerEmail && transporter) {
      await transporter.sendMail({
        from,
        to: ownerEmail,
        subject: 'New estimate request from your handyman site',
        text:
`You have a new inquiry.

Name: ${name || '—'}
Phone: ${phone || '—'}
Email: ${email || '—'}
Message:
${message || '—'}

Portfolio ID: ${templateId || '—'}
Time: ${new Date().toISOString()}

— System notification`
      });
    }

    res.status(201).json({ message: 'Inquiry received successfully!' });
  } catch (error) {
    console.error('Inquiry create error:', error);
    res.status(500).json({ message: 'Server error while saving inquiry.' });
  }
};

module.exports = { createInquiry };
