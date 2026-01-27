const nodemailer = require("nodemailer");

// Configure transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

// Delay helper
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Random delay between 2-4 seconds
function randomDelay() {
  return 2000 + Math.random() * 2000;
}

// 1. Send VISITOR email (acknowledgment)
async function sendVisitorEmail(formData, ownerEmail, businessName) {
  const servicesList = formData.services.join(", ");

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #3B82F6; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
        .info-box { background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #3B82F6; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Thank You for Your Request!</h1>
        </div>
        <div class="content">
          <p>Hi <strong>${formData.name}</strong>,</p>
          <p>We received your quote request for <strong>${businessName}</strong> and will get back to you shortly!</p>
          
          <div class="info-box">
            <h3>Your Request Details:</h3>
            <p><strong>Services:</strong> ${servicesList}</p>
            <p><strong>Due Date:</strong> ${new Date(
              formData.dueDate
            ).toLocaleDateString()}</p>
            <p><strong>Email:</strong> ${formData.email}</p>
            <p><strong>Phone:</strong> ${formData.phone}</p>
            ${
              formData.details
                ? `<p><strong>Details:</strong> ${formData.details}</p>`
                : ""
            }
          </div>
          
          <p><strong>Expected Response Time:</strong> 24-48 hours</p>
          <p>If you have any questions, feel free to reach out to us at <a href="mailto:${ownerEmail}">${ownerEmail}</a></p>
          
          <div class="footer">
            <p>Best regards,<br>${businessName}</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  await transporter.sendMail({
    from: `"${businessName}" <${process.env.SMTP_USER}>`,
    to: formData.email,
    subject: `Quote Request Confirmation - ${businessName}`,
    html: htmlContent,
  });
}

// 2. Send OWNER email (new lead notification)
async function sendOwnerEmail(formData, ownerEmail, businessName) {
  const servicesList = formData.services.join(", ");

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #10B981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
        .highlight { background: #FEF3C7; padding: 15px; margin: 15px 0; border-radius: 8px; border-left: 4px solid #F59E0B; }
        .info-box { background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #10B981; }
        .urgent { color: #DC2626; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 New Lead Alert!</h1>
        </div>
        <div class="content">
          <p>You have a new quote request from your portfolio: <strong>${businessName}</strong></p>
          
          <div class="highlight">
            <h3>📞 Contact Details (Action Required)</h3>
            <p><strong>Name:</strong> ${formData.name}</p>
            <p><strong>Email:</strong> <a href="mailto:${formData.email}">${
    formData.email
  }</a></p>
            <p><strong>Phone:</strong> <a href="tel:${formData.phone}">${
    formData.phone
  }</a></p>
          </div>
          
          <div class="info-box">
            <h3>Service Request:</h3>
            <p><strong>Services:</strong> ${servicesList}</p>
            <p><strong>Due Date:</strong> ${new Date(
              formData.dueDate
            ).toLocaleDateString()}</p>
            ${
              formData.details
                ? `<p><strong>Additional Details:</strong><br>${formData.details}</p>`
                : ""
            }
          </div>
          
          <p class="urgent">⏰ Respond within 24 hours for best conversion rates!</p>
          <p><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await transporter.sendMail({
    from: `"Portfolio System" <${process.env.SMTP_USER}>`,
    to: ownerEmail,
    subject: `🔔 New Quote Request - ${businessName}`,
    html: htmlContent,
  });
}

// 3. Send ADMIN email (system notification)
async function sendAdminEmail(formData, ownerEmail, businessName) {
  const servicesList = formData.services.join(", ");

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #6366F1; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
        .info-box { background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #6366F1; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        td { padding: 8px; border-bottom: 1px solid #ddd; }
        td:first-child { font-weight: bold; width: 150px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📊 Admin: New Form Submission</h1>
        </div>
        <div class="content">
          <h3>Portfolio: ${businessName}</h3>
          
          <div class="info-box">
            <h4>Owner Information:</h4>
            <table>
              <tr><td>Owner Email:</td><td><a href="mailto:${ownerEmail}">${ownerEmail}</a></td></tr>
            </table>
          </div>
          
          <div class="info-box">
            <h4>Visitor Information:</h4>
            <table>
              <tr><td>Name:</td><td>${formData.name}</td></tr>
              <tr><td>Email:</td><td><a href="mailto:${formData.email}">${
    formData.email
  }</a></td></tr>
              <tr><td>Phone:</td><td>${formData.phone}</td></tr>
            </table>
          </div>
          
          <div class="info-box">
            <h4>Request Details:</h4>
            <table>
              <tr><td>Services:</td><td>${servicesList}</td></tr>
              <tr><td>Due Date:</td><td>${new Date(
                formData.dueDate
              ).toLocaleDateString()}</td></tr>
              <tr><td>Timestamp:</td><td>${new Date().toLocaleString()}</td></tr>
              ${
                formData.details
                  ? `<tr><td>Details:</td><td>${formData.details}</td></tr>`
                  : ""
              }
            </table>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  await transporter.sendMail({
    from: `"Portfolio System" <${process.env.SMTP_USER}>`,
    to: process.env.ADMIN_EMAIL,
    subject: `[ADMIN] New Lead - ${businessName}`,
    html: htmlContent,
  });
}

// MAIN FUNCTION - Sends all 3 emails with delays
async function sendQuoteEmails(formData, ownerEmail, businessName) {
  try {
    console.log("📧 Starting email sequence...");

    // 1. Send visitor email
    await sendVisitorEmail(formData, ownerEmail, businessName);
    console.log("✅ Visitor email sent");

    // Wait 2-4 seconds
    await delay(randomDelay());

    // 2. Send owner email
    await sendOwnerEmail(formData, ownerEmail, businessName);
    console.log("✅ Owner email sent");

    // Wait 2-4 seconds
    await delay(randomDelay());

    // 3. Send admin email
    await sendAdminEmail(formData, ownerEmail, businessName);
    console.log("✅ Admin email sent");

    console.log("🎉 All emails sent successfully!");
    return { success: true };
  } catch (error) {
    console.error("❌ Email sending failed:", error);
    throw error;
  }
}
// Support Form Emails (User → Admin, with reply capability)
async function sendSupportFormEmails(formData) {
  try {
    console.log("📧 Starting support form email sequence...");

    const userName = formData.name;
    const userEmail = formData.email;
    const requestType = formData.requestType;
    const portfolioId = formData.portfolioId || "Not specified";
    const message = formData.message;
    const submissionDate = new Date().toLocaleString();
    const userStatus = formData.userStatus || "Guest User";

    // 1. Send confirmation email to USER
    const userHtmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #3B82F6; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .info-box { background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #3B82F6; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Support Request Received</h1>
          </div>
          <div class="content">
            <p>Hi <strong>${userName}</strong>,</p>
            <p>Thank you for contacting <strong>Find Virtual Me Support Team</strong>! We have received your support request and will get back to you soon.</p>
            
            <div class="info-box">
              <h3>Your Submission Details:</h3>
               <p><strong>Name:</strong> ${userName}</p>
              <p><strong>Email:</strong> ${userEmail}</p>
              <p><strong>Request Type:</strong> ${requestType}</p>
              <p><strong>Portfolio ID:</strong> ${portfolioId}</p>
              <p><strong>Submitted:</strong> ${submissionDate}</p>
              <p><strong>Your Message:</strong><br>${message}</p>
            </div>
            
            <p><strong>Expected Response Time:</strong> 24-48 hours</p>
            <p>Our team will review your request and respond to this email address: <strong>${userEmail}</strong></p>
            
            <div class="footer">
              <p>Best regards,<br>Find Virtual Me Support Team</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    await transporter.sendMail({
      from: `"Find Virtual Me Support" <${process.env.SMTP_USER}>`,
      to: userEmail,
      subject: "Support Request Received - Find Virtual Me",
      html: userHtmlContent,
    });

    console.log("✅ User confirmation email sent");

    // Wait 2-4 seconds
    await delay(randomDelay());

    // 2. Send notification to ADMIN (with reply-to set to user)
    const adminHtmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #EF4444; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .highlight { background: #FEF3C7; padding: 15px; margin: 15px 0; border-radius: 8px; border-left: 4px solid #F59E0B; }
          .info-box { background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #EF4444; }
          table { width: 100%; border-collapse: collapse; margin: 15px 0; }
          td { padding: 8px; border-bottom: 1px solid #ddd; }
          td:first-child { font-weight: bold; width: 150px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1> New Support Request</h1>
          </div>
          <div class="content">
            <p><strong>A new support request has been submitted.</strong></p>
            
            <div class="highlight">
              <h3>👤 User Information</h3>
              <table>
                <tr><td>Name:</td><td>${userName}</td></tr>
                <tr><td>Email:</td><td><a href="mailto:${userEmail}">${userEmail}</a></td></tr>
                <tr><td>Status:</td><td>${userStatus}</td></tr>
              </table>
            </div>
            
            <div class="info-box">
              <h3>📋 Request Details</h3>
              <table>
                <tr><td>Request Type:</td><td>${requestType}</td></tr>
                <tr><td>Portfolio ID:</td><td>${portfolioId}</td></tr>
                <tr><td>Submitted:</td><td>${submissionDate}</td></tr>
              </table>
              
              <h4 style="margin-top: 15px;">Message:</h4>
              <p style="background: #f9f9f9; padding: 10px; border-radius: 4px;">${message}</p>
            </div>
            
            <div style="background: #DBEAFE; padding: 15px; border-radius: 8px; margin-top: 20px;">
              <p style="margin: 0;"><strong>💡 Quick Action:</strong> Simply hit "Reply" to respond directly to ${userName} at ${userEmail}</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    await transporter.sendMail({
      from: `"Find Virtual Me Support" <${process.env.SMTP_USER}>`,
      replyTo: userEmail,
      to: process.env.ADMIN_EMAIL,
      subject: `[SUPPORT] ${requestType} - ${userName}`,
      html: adminHtmlContent,
    });

    console.log("✅ Admin notification email sent");
    console.log("🎉 Support form emails sent successfully!");

    return { success: true };
  } catch (error) {
    console.error("❌ Support form email failed:", error);
    throw error;
  }
}

async function sendGenericContactEmails(formData, ownerEmail, ownerName) {
  try {
    console.log("📧 Starting generic contact email sequence...");

    const businessName = ownerName || "Business Name";

    // 1. Send confirmation email to VISITOR
    const visitorHtmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #3B82F6; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .info-box { background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #3B82F6; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>💼 Message Received!</h1>
          </div>
          <div class="content">
            <p>Hi <strong>${formData.name}</strong>,</p>
            <p>Thank you for reaching out to <strong>${businessName}</strong>! Your message has been received and will be reviewed shortly.</p>
            
            <div class="info-box">
              <h3>Your Message:</h3>
              <p><strong>Name:</strong> ${formData.name}</p>
              <p><strong>Email:</strong> ${formData.email}</p>
              <p><strong>Message:</strong><br>${formData.message}</p>
            </div>
            
            <p><strong>Expected Response Time:</strong> Within 24-48 hours</p>
            <p>You can reach ${businessName} directly at <a href="mailto:${ownerEmail}">${ownerEmail}</a></p>
            
            <div class="footer">
              <p>Best regards,<br>${businessName}</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    await transporter.sendMail({
      from: `"${businessName}" <${process.env.SMTP_USER}>`,
      to: formData.email,
      subject: `Message Received - ${businessName}`,
      html: visitorHtmlContent,
    });

    console.log("✅ Visitor confirmation email sent");

    // Wait 2-4 seconds
    await delay(randomDelay());

    // 2. Send notification to OWNER
    const ownerHtmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #10B981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .highlight { background: #FEF3C7; padding: 15px; margin: 15px 0; border-radius: 8px; border-left: 4px solid #F59E0B; }
          .info-box { background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #10B981; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 New Contact Message!</h1>
          </div>
          <div class="content">
            <p>You have a new message from your ${businessName} portfolio.</p>
            
            <div class="highlight">
              <h3>📞 Contact Details</h3>
              <p><strong>Name:</strong> ${formData.name}</p>
              <p><strong>Email:</strong> <a href="mailto:${formData.email}">${
      formData.email
    }</a></p>
            </div>
            
            <div class="info-box">
              <h3>💬 Message:</h3>
              <p>${formData.message}</p>
            </div>
            
            <p style="color: #DC2626; font-weight: bold;">⏰ Respond quickly for best results!</p>
            <p><strong>Received:</strong> ${new Date().toLocaleString()}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await transporter.sendMail({
      from: `"Portfolio System" <${process.env.SMTP_USER}>`,
      to: ownerEmail,
      subject: `🔔 New Message from ${formData.name}`,
      html: ownerHtmlContent,
    });

    console.log("✅ Owner notification email sent");

    // Wait 2-4 seconds
    await delay(randomDelay());

    // 3. Send notification to ADMIN
    const adminHtmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #6366F1; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .info-box { background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #6366F1; }
          table { width: 100%; border-collapse: collapse; margin: 15px 0; }
          td { padding: 8px; border-bottom: 1px solid #ddd; }
          td:first-child { font-weight: bold; width: 150px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📊 Admin: New PM Contact</h1>
          </div>
          <div class="content">
            <h3>Portfolio: ${businessName}</h3>
            
            <div class="info-box">
              <h4>Owner Information:</h4>
              <table>
                <tr><td>Owner Name:</td><td>${businessName}</td></tr>
                <tr><td>Owner Email:</td><td><a href="mailto:${ownerEmail}">${ownerEmail}</a></td></tr>
              </table>
            </div>
            
            <div class="info-box">
              <h4>Visitor Information:</h4>
              <table>
                <tr><td>Name:</td><td>${formData.name}</td></tr>
                <tr><td>Email:</td><td><a href="mailto:${formData.email}">${
      formData.email
    }</a></td></tr>
              </table>
            </div>
            
            <div class="info-box">
              <h4>Message Details:</h4>
              <table>
                <tr><td>Timestamp:</td><td>${new Date().toLocaleString()}</td></tr>
                <tr><td>Message:</td><td>${formData.message}</td></tr>
              </table>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    await transporter.sendMail({
      from: `"Portfolio System" <${process.env.SMTP_USER}>`,
      to: process.env.ADMIN_EMAIL,
      subject: `[ADMIN] New Contact - ${businessName}`,
      html: adminHtmlContent,
    });

    console.log("✅ Admin notification email sent");
    console.log("🎉 All generic contact emails sent successfully!");

    return { success: true };
  } catch (error) {
    console.error("❌ Generic contact email failed:", error);
    throw error;
  }
}

// Project Manager Contact Emails (Visitor, Owner, Admin)
async function sendProjectManagerContactEmails(formData, ownerEmail, ownerName) {
  try {
    console.log("📧 Starting project manager contact email sequence...");

    const businessName = ownerName || "Project Manager";

    // 1. Send confirmation email to VISITOR
    const visitorHtmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #3B82F6; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .info-box { background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #3B82F6; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>💼 Message Received!</h1>
          </div>
          <div class="content">
            <p>Hi <strong>${formData.name}</strong>,</p>
            <p>Thank you for reaching out to <strong>${businessName}</strong>! Your message has been received and will be reviewed shortly.</p>
            
            <div class="info-box">
              <h3>Your Message:</h3>
              <p><strong>Name:</strong> ${formData.name}</p>
              <p><strong>Email:</strong> ${formData.email}</p>
              <p><strong>Message:</strong><br>${formData.message}</p>
            </div>
            
            <p><strong>Expected Response Time:</strong> Within 24-48 hours</p>
            <p>You can reach ${businessName} directly at <a href="mailto:${ownerEmail}">${ownerEmail}</a></p>
            
            <div class="footer">
              <p>Best regards,<br>${businessName}</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    await transporter.sendMail({
      from: `"${businessName}" <${process.env.SMTP_USER}>`,
      to: formData.email,
      subject: `Message Received - ${businessName}`,
      html: visitorHtmlContent,
    });

    console.log("✅ Visitor confirmation email sent");

    // Wait 2-4 seconds
    await delay(randomDelay());

    // 2. Send notification to OWNER
    const ownerHtmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #10B981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .highlight { background: #FEF3C7; padding: 15px; margin: 15px 0; border-radius: 8px; border-left: 4px solid #F59E0B; }
          .info-box { background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #10B981; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 New Contact Message!</h1>
          </div>
          <div class="content">
            <p>You have a new message from your Project Manager portfolio.</p>
            
            <div class="highlight">
              <h3>📞 Contact Details</h3>
              <p><strong>Name:</strong> ${formData.name}</p>
              <p><strong>Email:</strong> <a href="mailto:${formData.email}">${
      formData.email
    }</a></p>
            </div>
            
            <div class="info-box">
              <h3>💬 Message:</h3>
              <p>${formData.message}</p>
            </div>
            
            <p style="color: #DC2626; font-weight: bold;">⏰ Respond quickly for best results!</p>
            <p><strong>Received:</strong> ${new Date().toLocaleString()}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await transporter.sendMail({
      from: `"Portfolio System" <${process.env.SMTP_USER}>`,
      to: ownerEmail,
      subject: `🔔 New Message from ${formData.name}`,
      html: ownerHtmlContent,
    });

    console.log("✅ Owner notification email sent");

    // Wait 2-4 seconds
    await delay(randomDelay());

    // 3. Send notification to ADMIN
    const adminHtmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #6366F1; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .info-box { background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #6366F1; }
          table { width: 100%; border-collapse: collapse; margin: 15px 0; }
          td { padding: 8px; border-bottom: 1px solid #ddd; }
          td:first-child { font-weight: bold; width: 150px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📊 Admin: New PM Contact</h1>
          </div>
          <div class="content">
            <h3>Portfolio: ${businessName}</h3>
            
            <div class="info-box">
              <h4>Owner Information:</h4>
              <table>
                <tr><td>Owner Name:</td><td>${businessName}</td></tr>
                <tr><td>Owner Email:</td><td><a href="mailto:${ownerEmail}">${ownerEmail}</a></td></tr>
              </table>
            </div>
            
            <div class="info-box">
              <h4>Visitor Information:</h4>
              <table>
                <tr><td>Name:</td><td>${formData.name}</td></tr>
                <tr><td>Email:</td><td><a href="mailto:${formData.email}">${
      formData.email
    }</a></td></tr>
              </table>
            </div>
            
            <div class="info-box">
              <h4>Message Details:</h4>
              <table>
                <tr><td>Timestamp:</td><td>${new Date().toLocaleString()}</td></tr>
                <tr><td>Message:</td><td>${formData.message}</td></tr>
              </table>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    await transporter.sendMail({
      from: `"PM Portfolio System" <${process.env.SMTP_USER}>`,
      to: process.env.ADMIN_EMAIL,
      subject: `[ADMIN] New PM Contact - ${businessName}`,
      html: adminHtmlContent,
    });

    console.log("✅ Admin notification email sent");
    console.log("🎉 All project manager contact emails sent successfully!");

    return { success: true };
  } catch (error) {
    console.error("❌ Project manager contact email failed:", error);
    throw error;
  }
}

// Data Scientist Contact Emails (Visitor, Owner, Admin)
async function sendDataScientistContactEmails(formData, ownerEmail, ownerName) {
  try {
    console.log("📧 Starting data scientist contact email sequence...");

    const businessName = ownerName || "Data Scientist";

    // 1. Send confirmation email to VISITOR
    const visitorHtmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #8B5CF6; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .info-box { background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #8B5CF6; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📊 Message Received!</h1>
          </div>
          <div class="content">
            <p>Hi <strong>${formData.name}</strong>,</p>
            <p>Thank you for reaching out to <strong>${businessName}</strong>! Your message has been received and will be reviewed shortly.</p>
            
            <div class="info-box">
              <h3>Your Message:</h3>
              <p><strong>Name:</strong> ${formData.name}</p>
              <p><strong>Email:</strong> ${formData.email}</p>
              <p><strong>Message:</strong><br>${formData.message}</p>
            </div>
            
            <p><strong>Expected Response Time:</strong> Within 24-48 hours</p>
            <p>You can reach ${businessName} directly at <a href="mailto:${ownerEmail}">${ownerEmail}</a></p>
            
            <div class="footer">
              <p>Best regards,<br>${businessName}</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    await transporter.sendMail({
      from: `"${businessName}" <${process.env.SMTP_USER}>`,
      to: formData.email,
      subject: `Message Received - ${businessName}`,
      html: visitorHtmlContent,
    });

    console.log("✅ Visitor confirmation email sent");

    // Wait 2-4 seconds
    await delay(randomDelay());

    // 2. Send notification to OWNER
    const ownerHtmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #10B981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .highlight { background: #FEF3C7; padding: 15px; margin: 15px 0; border-radius: 8px; border-left: 4px solid #F59E0B; }
          .info-box { background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #10B981; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 New Contact Message!</h1>
          </div>
          <div class="content">
            <p>You have a new message from your Data Scientist portfolio.</p>
            
            <div class="highlight">
              <h3>📞 Contact Details</h3>
              <p><strong>Name:</strong> ${formData.name}</p>
              <p><strong>Email:</strong> <a href="mailto:${formData.email}">${
      formData.email
    }</a></p>
            </div>
            
            <div class="info-box">
              <h3>💬 Message:</h3>
              <p>${formData.message}</p>
            </div>
            
            <p style="color: #DC2626; font-weight: bold;">⏰ Respond quickly for best results!</p>
            <p><strong>Received:</strong> ${new Date().toLocaleString()}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await transporter.sendMail({
      from: `"Portfolio System" <${process.env.SMTP_USER}>`,
      to: ownerEmail,
      subject: `🔔 New Message from ${formData.name}`,
      html: ownerHtmlContent,
    });

    console.log("✅ Owner notification email sent");

    // Wait 2-4 seconds
    await delay(randomDelay());

    // 3. Send notification to ADMIN
    const adminHtmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #6366F1; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .info-box { background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #6366F1; }
          table { width: 100%; border-collapse: collapse; margin: 15px 0; }
          td { padding: 8px; border-bottom: 1px solid #ddd; }
          td:first-child { font-weight: bold; width: 150px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📊 Admin: New DS Contact</h1>
          </div>
          <div class="content">
            <h3>Portfolio: ${businessName}</h3>
            
            <div class="info-box">
              <h4>Owner Information:</h4>
              <table>
                <tr><td>Owner Name:</td><td>${businessName}</td></tr>
                <tr><td>Owner Email:</td><td><a href="mailto:${ownerEmail}">${ownerEmail}</a></td></tr>
              </table>
            </div>
            
            <div class="info-box">
              <h4>Visitor Information:</h4>
              <table>
                <tr><td>Name:</td><td>${formData.name}</td></tr>
                <tr><td>Email:</td><td><a href="mailto:${formData.email}">${
      formData.email
    }</a></td></tr>
              </table>
            </div>
            
            <div class="info-box">
              <h4>Message Details:</h4>
              <table>
                <tr><td>Timestamp:</td><td>${new Date().toLocaleString()}</td></tr>
                <tr><td>Message:</td><td>${formData.message}</td></tr>
              </table>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    await transporter.sendMail({
      from: `"DS Portfolio System" <${process.env.SMTP_USER}>`,
      to: process.env.ADMIN_EMAIL,
      subject: `[ADMIN] New DS Contact - ${businessName}`,
      html: adminHtmlContent,
    });

    console.log("✅ Admin notification email sent");
    console.log("🎉 All data scientist contact emails sent successfully!");

    return { success: true };
  } catch (error) {
    console.error("❌ Data scientist contact email failed:", error);
    throw error;
  }
}

// Photographer Contact Emails (Visitor, Owner, Admin)
async function sendPhotographerContactEmails(formData, ownerEmail, ownerName) {
  try {
    console.log("📧 Starting photographer contact email sequence...");

    const businessName = ownerName || "Photographer";

    // 1. Send confirmation email to VISITOR
    const visitorHtmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #1F2937; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .info-box { background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #1F2937; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📸 Message Received!</h1>
          </div>
          <div class="content">
            <p>Hi <strong>${formData.name}</strong>,</p>
            <p>Thank you for reaching out to <strong>${businessName}</strong>! Your message has been received and will be reviewed shortly.</p>
            
            <div class="info-box">
              <h3>Your Message:</h3>
              <p><strong>Name:</strong> ${formData.name}</p>
              <p><strong>Email:</strong> ${formData.email}</p>
              <p><strong>Message:</strong><br>${formData.message}</p>
            </div>
            
            <p><strong>Expected Response Time:</strong> Within 24-48 hours</p>
            <p>You can reach ${businessName} directly at <a href="mailto:${ownerEmail}">${ownerEmail}</a></p>
            
            <div class="footer">
              <p>Best regards,<br>${businessName}</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    await transporter.sendMail({
      from: `"${businessName}" <${process.env.SMTP_USER}>`,
      to: formData.email,
      subject: `Message Received - ${businessName}`,
      html: visitorHtmlContent,
    });

    console.log("✅ Visitor confirmation email sent");

    // Wait 2-4 seconds
    await delay(randomDelay());

    // 2. Send notification to OWNER
    const ownerHtmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #10B981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .highlight { background: #FEF3C7; padding: 15px; margin: 15px 0; border-radius: 8px; border-left: 4px solid #F59E0B; }
          .info-box { background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #10B981; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 New Contact Message!</h1>
          </div>
          <div class="content">
            <p>You have a new message from your Photography portfolio.</p>
            
            <div class="highlight">
              <h3>📞 Contact Details</h3>
              <p><strong>Name:</strong> ${formData.name}</p>
              <p><strong>Email:</strong> <a href="mailto:${formData.email}">${
      formData.email
    }</a></p>
            </div>
            
            <div class="info-box">
              <h3>💬 Message:</h3>
              <p>${formData.message}</p>
            </div>
            
            <p style="color: #DC2626; font-weight: bold;">⏰ Respond quickly for best results!</p>
            <p><strong>Received:</strong> ${new Date().toLocaleString()}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await transporter.sendMail({
      from: `"Portfolio System" <${process.env.SMTP_USER}>`,
      to: ownerEmail,
      subject: `🔔 New Message from ${formData.name}`,
      html: ownerHtmlContent,
    });

    console.log("✅ Owner notification email sent");

    // Wait 2-4 seconds
    await delay(randomDelay());

    // 3. Send notification to ADMIN
    const adminHtmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #6366F1; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .info-box { background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #6366F1; }
          table { width: 100%; border-collapse: collapse; margin: 15px 0; }
          td { padding: 8px; border-bottom: 1px solid #ddd; }
          td:first-child { font-weight: bold; width: 150px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📊 Admin: New Photographer Contact</h1>
          </div>
          <div class="content">
            <h3>Portfolio: ${businessName}</h3>
            
            <div class="info-box">
              <h4>Owner Information:</h4>
              <table>
                <tr><td>Owner Name:</td><td>${businessName}</td></tr>
                <tr><td>Owner Email:</td><td><a href="mailto:${ownerEmail}">${ownerEmail}</a></td></tr>
              </table>
            </div>
            
            <div class="info-box">
              <h4>Visitor Information:</h4>
              <table>
                <tr><td>Name:</td><td>${formData.name}</td></tr>
                <tr><td>Email:</td><td><a href="mailto:${formData.email}">${
      formData.email
    }</a></td></tr>
              </table>
            </div>
            
            <div class="info-box">
              <h4>Message Details:</h4>
              <table>
                <tr><td>Timestamp:</td><td>${new Date().toLocaleString()}</td></tr>
                <tr><td>Message:</td><td>${formData.message}</td></tr>
              </table>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    await transporter.sendMail({
      from: `"Photographer Portfolio System" <${process.env.SMTP_USER}>`,
      to: process.env.ADMIN_EMAIL,
      subject: `[ADMIN] New Photographer Contact - ${businessName}`,
      html: adminHtmlContent,
    });

    console.log("✅ Admin notification email sent");
    console.log("🎉 All photographer contact emails sent successfully!");

    return { success: true };
  } catch (error) {
    console.error("❌ Photographer contact email failed:", error);
    throw error;
  }
}
module.exports = {
  sendQuoteEmails,
  sendSupportFormEmails,
  sendGenericContactEmails,
  sendProjectManagerContactEmails,
  sendDataScientistContactEmails,
  sendPhotographerContactEmails,
};
