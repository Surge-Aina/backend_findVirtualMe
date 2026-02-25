const HandymanInquiry = require('../../models/handyMan/handymanInquiryModel');
const HandymanTemplate = require('../../models/handyMan/HandymanTemplate');
const UserModel = require('../../models/userModel');
const nodemailer = require('nodemailer');

function buildTransporter() {
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
    const {
      templateId, name, email, phone, message,
      selectedServiceTitles = []   // ✅ array from form
    } = req.body;

    let ownerEmail = null;
    let selectedPrices = [];
    let total = 0;

    if (templateId) {
      const tpl = await HandymanTemplate.findById(templateId).lean();
      ownerEmail = tpl?.contact?.email || null;
      if (!ownerEmail && tpl?.userId) {
        const owner = await UserModel.findById(tpl.userId).lean();
        ownerEmail = owner?.email || null;
      }

      // ✅ price lookup for each selected title
      if (Array.isArray(selectedServiceTitles) && Array.isArray(tpl?.services)) {
        selectedPrices = selectedServiceTitles.map(title => {
          const match = tpl.services.find(s => (s.title || s.name) === title);
          const p = Number(match?.price || 0);
          total += p;
          return p;
        });
      }
    }

    // Save inquiry with snapshot
    await HandymanInquiry.create({
      templateId: templateId || undefined,
      name, email, phone, message,
      selectedServiceTitles,
      selectedServicePrices: selectedPrices,
      selectedServiceTotal: total
    });

    const transporter = buildTransporter();
    const from = process.env.SMTP_FROM || (process.env.SMTP_USER || 'no-reply@example.com');

    const servicesBlock =
      (selectedServiceTitles.length
        ? selectedServiceTitles
            .map((t, i) => `- ${t}${Number.isFinite(selectedPrices[i]) ? ` — $${selectedPrices[i]}` : ''}`)
            .join('\n')
        : '—');

    // Visitor email (includes prices + total)
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
- Services requested:
${servicesBlock}
- Estimated total (owner-set): ${selectedServiceTitles.length ? `$${total}` : '—'}
- Message: ${message || '—'}

Best,
Your Handyman Team`
      });
    }

    // Owner email (shows chosen services; totals included)
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

Services requested:
${servicesBlock}

Total (sum of your set prices): ${selectedServiceTitles.length ? `$${total}` : '—'}

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
