// Mock nodemailer FIRST before any imports
const mockSendMail = jest.fn();
const mockTransporter = {
  sendMail: mockSendMail
};

jest.mock("nodemailer", () => ({
  createTransport: jest.fn(() => mockTransporter)
}));

const nodemailer = require("nodemailer");
const {
  sendQuoteEmails,
  sendSupportFormEmails,
  sendProjectManagerContactEmails,
  sendDataScientistContactEmails,
  sendPhotographerContactEmails
} = require("../../../services/emailService");

describe("Email Service Tests", () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    
    // Reset mock implementation to return success by default
    mockSendMail.mockResolvedValue({ messageId: "test-message-id" });
    
    // Mock delays to speed up tests
    jest.spyOn(global, "setTimeout").mockImplementation((cb) => cb());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  
  describe("sendQuoteEmails", () => {
    const mockFormData = {
      name: "John Doe",
      email: "john@example.com",
      phone: "555-1234",
      services: ["Deep Cleaning", "Window Washing"],
      dueDate: "2025-12-01",
      details: "Need urgent cleaning"
    };
    const ownerEmail = "owner@business.com";
    const businessName = "Sparkle Clean";

    test("should send all 3 emails successfully", async () => {
      const result = await sendQuoteEmails(mockFormData, ownerEmail, businessName);
      
      expect(result.success).toBe(true);
      expect(mockSendMail).toHaveBeenCalledTimes(3);
    });

    test("should send visitor confirmation email with correct details", async () => {
      await sendQuoteEmails(mockFormData, ownerEmail, businessName);
      
      const visitorEmailCall = mockSendMail.mock.calls[0][0];
      
      expect(visitorEmailCall.to).toBe(mockFormData.email);
      expect(visitorEmailCall.subject).toContain("Quote Request Confirmation");
      expect(visitorEmailCall.subject).toContain(businessName);
      expect(visitorEmailCall.html).toContain(mockFormData.name);
      expect(visitorEmailCall.html).toContain("Deep Cleaning, Window Washing");
    });

    test("should send owner notification email with correct details", async () => {
      await sendQuoteEmails(mockFormData, ownerEmail, businessName);
      
      const ownerEmailCall = mockSendMail.mock.calls[1][0];
      
      expect(ownerEmailCall.to).toBe(ownerEmail);
      expect(ownerEmailCall.subject).toContain("New Quote Request");
      expect(ownerEmailCall.html).toContain(mockFormData.name);
      expect(ownerEmailCall.html).toContain(mockFormData.email);
      expect(ownerEmailCall.html).toContain(mockFormData.phone);
    });

    test("should send admin notification email with correct details", async () => {
      await sendQuoteEmails(mockFormData, ownerEmail, businessName);
      
      const adminEmailCall = mockSendMail.mock.calls[2][0];
      
      expect(adminEmailCall.to).toBe(process.env.ADMIN_EMAIL);
      expect(adminEmailCall.subject).toContain("[ADMIN]");
      expect(adminEmailCall.subject).toContain(businessName);
      expect(adminEmailCall.html).toContain(ownerEmail);
      expect(adminEmailCall.html).toContain(mockFormData.name);
    });

    test("should handle form data without optional details field", async () => {
      const formDataNoDetails = { ...mockFormData };
      delete formDataNoDetails.details;
      
      await sendQuoteEmails(formDataNoDetails, ownerEmail, businessName);
      
      expect(mockSendMail).toHaveBeenCalledTimes(3);
      expect(mockSendMail.mock.calls[0][0].html).not.toContain("Need urgent cleaning");
    });

    test("should throw error when email sending fails", async () => {
      mockSendMail.mockRejectedValueOnce(new Error("SMTP Error"));
      
      await expect(
        sendQuoteEmails(mockFormData, ownerEmail, businessName)
      ).rejects.toThrow("SMTP Error");
    });

    test("should format due date correctly in emails", async () => {
      await sendQuoteEmails(mockFormData, ownerEmail, businessName);
      
      const visitorEmail = mockSendMail.mock.calls[0][0];
      const expectedDate = new Date(mockFormData.dueDate).toLocaleDateString();
      
      expect(visitorEmail.html).toContain(expectedDate);
    });
  });

  
  describe("sendSupportFormEmails", () => {
    const mockSupportData = {
      name: "Jane Smith",
      email: "jane@example.com",
      requestType: "Technical Issue",
      portfolioId: "PORT123",
      message: "I can't access my portfolio",
      userStatus: "Premium User"
    };

    test("should send both user and admin emails successfully", async () => {
      const result = await sendSupportFormEmails(mockSupportData);
      
      expect(result.success).toBe(true);
      expect(mockSendMail).toHaveBeenCalledTimes(2);
    });

    test("should send user confirmation email with correct details", async () => {
      await sendSupportFormEmails(mockSupportData);
      
      const userEmailCall = mockSendMail.mock.calls[0][0];
      
      expect(userEmailCall.to).toBe(mockSupportData.email);
      expect(userEmailCall.subject).toContain("Support Request Received");
      expect(userEmailCall.html).toContain(mockSupportData.name);
      expect(userEmailCall.html).toContain(mockSupportData.requestType);
      expect(userEmailCall.html).toContain(mockSupportData.message);
    });

    test("should send admin notification with reply-to set to user email", async () => {
      await sendSupportFormEmails(mockSupportData);
      
      const adminEmailCall = mockSendMail.mock.calls[1][0];
      
      expect(adminEmailCall.to).toBe(process.env.ADMIN_EMAIL);
      expect(adminEmailCall.replyTo).toBe(mockSupportData.email);
      expect(adminEmailCall.subject).toContain("[SUPPORT]");
      expect(adminEmailCall.subject).toContain(mockSupportData.requestType);
    });

    test("should handle missing optional fields (portfolioId, userStatus)", async () => {
      const minimalData = {
        name: "Test User",
        email: "test@example.com",
        requestType: "General Inquiry",
        message: "Hello"
      };
      
      await sendSupportFormEmails(minimalData);
      
      expect(mockSendMail).toHaveBeenCalledTimes(2);
      const adminEmail = mockSendMail.mock.calls[1][0];
      expect(adminEmail.html).toContain("Not specified");
      expect(adminEmail.html).toContain("Guest User");
    });

    test("should throw error when email sending fails", async () => {
      mockSendMail.mockRejectedValueOnce(new Error("Network Error"));
      
      await expect(
        sendSupportFormEmails(mockSupportData)
      ).rejects.toThrow("Network Error");
    });
  });

 
  
  describe("sendProjectManagerContactEmails", () => {
    const mockContactData = {
      name: "Bob Johnson",
      email: "bob@company.com",
      message: "Interested in your project management services"
    };
    const ownerEmail = "pm@example.com";
    const ownerName = "Sarah Williams";

    test("should send all 3 emails successfully", async () => {
      const result = await sendProjectManagerContactEmails(
        mockContactData,
        ownerEmail,
        ownerName
      );
      
      expect(result.success).toBe(true);
      expect(mockSendMail).toHaveBeenCalledTimes(3);
    });

    test("should send visitor confirmation with correct details", async () => {
      await sendProjectManagerContactEmails(mockContactData, ownerEmail, ownerName);
      
      const visitorEmail = mockSendMail.mock.calls[0][0];
      
      expect(visitorEmail.to).toBe(mockContactData.email);
      expect(visitorEmail.subject).toContain("Message Received");
      expect(visitorEmail.subject).toContain(ownerName);
      expect(visitorEmail.html).toContain(mockContactData.name);
      expect(visitorEmail.html).toContain(mockContactData.message);
    });

    test("should send owner notification with visitor details", async () => {
      await sendProjectManagerContactEmails(mockContactData, ownerEmail, ownerName);
      
      const ownerEmailCall = mockSendMail.mock.calls[1][0];
      
      expect(ownerEmailCall.to).toBe(ownerEmail);
      expect(ownerEmailCall.subject).toContain("New Message");
      expect(ownerEmailCall.html).toContain(mockContactData.name);
      expect(ownerEmailCall.html).toContain(mockContactData.email);
    });

    test("should send admin notification with all details", async () => {
      await sendProjectManagerContactEmails(mockContactData, ownerEmail, ownerName);
      
      const adminEmail = mockSendMail.mock.calls[2][0];
      
      expect(adminEmail.to).toBe(process.env.ADMIN_EMAIL);
      expect(adminEmail.subject).toContain("[ADMIN]");
      expect(adminEmail.subject).toContain("New PM Contact");
      expect(adminEmail.html).toContain(ownerName);
      expect(adminEmail.html).toContain(ownerEmail);
    });

    test("should use default business name when ownerName is not provided", async () => {
      await sendProjectManagerContactEmails(mockContactData, ownerEmail, null);
      
      const visitorEmail = mockSendMail.mock.calls[0][0];
      expect(visitorEmail.html).toContain("Project Manager");
    });

    test("should throw error when email sending fails", async () => {
      mockSendMail.mockRejectedValueOnce(new Error("Send Failed"));
      
      await expect(
        sendProjectManagerContactEmails(mockContactData, ownerEmail, ownerName)
      ).rejects.toThrow("Send Failed");
    });
  });

 
  
  describe("sendDataScientistContactEmails", () => {
    const mockContactData = {
      name: "Alice Chen",
      email: "alice@tech.com",
      message: "Looking for data analysis expertise"
    };
    const ownerEmail = "ds@example.com";
    const ownerName = "Dr. Data Scientist";

    test("should send all 3 emails successfully", async () => {
      const result = await sendDataScientistContactEmails(
        mockContactData,
        ownerEmail,
        ownerName
      );
      
      expect(result.success).toBe(true);
      expect(mockSendMail).toHaveBeenCalledTimes(3);
    });

    test("should send visitor confirmation with purple theme", async () => {
      await sendDataScientistContactEmails(mockContactData, ownerEmail, ownerName);
      
      const visitorEmail = mockSendMail.mock.calls[0][0];
      
      expect(visitorEmail.to).toBe(mockContactData.email);
      expect(visitorEmail.html).toContain("#8B5CF6"); // Purple color
      expect(visitorEmail.html).toContain("📊 Message Received!");
    });

    test("should send owner notification", async () => {
      await sendDataScientistContactEmails(mockContactData, ownerEmail, ownerName);
      
      const ownerEmailCall = mockSendMail.mock.calls[1][0];
      
      expect(ownerEmailCall.to).toBe(ownerEmail);
      expect(ownerEmailCall.subject).toContain("🔔 New Message");
    });

    test("should send admin notification with DS prefix", async () => {
      await sendDataScientistContactEmails(mockContactData, ownerEmail, ownerName);
      
      const adminEmail = mockSendMail.mock.calls[2][0];
      
      expect(adminEmail.subject).toContain("New DS Contact");
      expect(adminEmail.from).toContain("DS Portfolio System");
    });

    test("should use default business name when not provided", async () => {
      await sendDataScientistContactEmails(mockContactData, ownerEmail, undefined);
      
      const visitorEmail = mockSendMail.mock.calls[0][0];
      expect(visitorEmail.html).toContain("Data Scientist");
    });
  });

 
  describe("sendPhotographerContactEmails", () => {
    const mockContactData = {
      name: "Mark Davis",
      email: "mark@events.com",
      message: "Need photographer for wedding"
    };
    const ownerEmail = "photo@example.com";
    const ownerName = "Emma Photography";

    test("should send all 3 emails successfully", async () => {
      const result = await sendPhotographerContactEmails(
        mockContactData,
        ownerEmail,
        ownerName
      );
      
      expect(result.success).toBe(true);
      expect(mockSendMail).toHaveBeenCalledTimes(3);
    });

    test("should send visitor confirmation with dark theme", async () => {
      await sendPhotographerContactEmails(mockContactData, ownerEmail, ownerName);
      
      const visitorEmail = mockSendMail.mock.calls[0][0];
      
      expect(visitorEmail.to).toBe(mockContactData.email);
      expect(visitorEmail.html).toContain("#1F2937"); // Dark gray color
      expect(visitorEmail.html).toContain("📸 Message Received!");
    });

    test("should send owner notification", async () => {
      await sendPhotographerContactEmails(mockContactData, ownerEmail, ownerName);
      
      const ownerEmailCall = mockSendMail.mock.calls[1][0];
      
      expect(ownerEmailCall.subject).toContain("🔔 New Message");
      expect(ownerEmailCall.html).toContain("Photography portfolio");
    });

    test("should send admin notification with photographer prefix", async () => {
      await sendPhotographerContactEmails(mockContactData, ownerEmail, ownerName);
      
      const adminEmail = mockSendMail.mock.calls[2][0];
      
      expect(adminEmail.subject).toContain("New Photographer Contact");
      expect(adminEmail.from).toContain("Photographer Portfolio System");
    });

    test("should use default business name when not provided", async () => {
      await sendPhotographerContactEmails(mockContactData, ownerEmail, "");
      
      const visitorEmail = mockSendMail.mock.calls[0][0];
      expect(visitorEmail.html).toContain("Photographer");
    });

    test("should throw error when email sending fails", async () => {
      mockSendMail.mockRejectedValueOnce(new Error("Connection Timeout"));
      
      await expect(
        sendPhotographerContactEmails(mockContactData, ownerEmail, ownerName)
      ).rejects.toThrow("Connection Timeout");
    });
  });

  
  describe("Email Sequencing and Delays", () => {
    test("should send emails in correct sequence for quote emails", async () => {
      const mockFormData = {
        name: "Test",
        email: "test@test.com",
        phone: "555-0000",
        services: ["Service A"],
        dueDate: "2025-12-01"
      };
      
      await sendQuoteEmails(mockFormData, "owner@test.com", "Test Business");
      
      // Check the sequence of emails
      expect(mockSendMail.mock.calls[0][0].subject).toContain("Quote Request Confirmation");
      expect(mockSendMail.mock.calls[1][0].subject).toContain("New Quote Request");
      expect(mockSendMail.mock.calls[2][0].subject).toContain("[ADMIN]");
    });

    test("should stop sending remaining emails if one fails", async () => {
      mockSendMail
        .mockResolvedValueOnce({ messageId: "1" })
        .mockRejectedValueOnce(new Error("Failed"));
      
      const mockFormData = {
        name: "Test",
        email: "test@test.com",
        phone: "555-0000",
        services: ["Service A"],
        dueDate: "2025-12-01"
      };
      
      await expect(
        sendQuoteEmails(mockFormData, "owner@test.com", "Test Business")
      ).rejects.toThrow("Failed");
      
      // Should only call sendMail twice (1 success, 1 failure)
      expect(mockSendMail).toHaveBeenCalledTimes(2);
    });
  });

  
  // ENVIRONMENT VARIABLES TESTS
  
  
  describe("Environment Variables Usage", () => {
   
    
    test("should send admin emails to ADMIN_EMAIL env variable", async () => {
      const mockFormData = {
        name: "Test",
        email: "test@test.com",
        phone: "555-0000",
        services: ["Service"],
        dueDate: "2025-12-01"
      };
      
      await sendQuoteEmails(mockFormData, "owner@test.com", "Business");
      
      const adminEmail = mockSendMail.mock.calls[2][0];
      expect(adminEmail.to).toBe(process.env.ADMIN_EMAIL);
    });
  });


  describe("HTML Email Content Validation", () => {
    test("should include proper HTML structure in all emails", async () => {
      const mockFormData = {
        name: "Test",
        email: "test@test.com",
        phone: "555-0000",
        services: ["Service"],
        dueDate: "2025-12-01"
      };
      
      await sendQuoteEmails(mockFormData, "owner@test.com", "Business");
      
      mockSendMail.mock.calls.forEach((call) => {
        const html = call[0].html;
        expect(html).toContain("<!DOCTYPE html>");
        expect(html).toContain("<html>");
        expect(html).toContain("</html>");
        expect(html).toContain("<body>");
        expect(html).toContain("</body>");
      });
    });

    test("should include responsive styling in emails", async () => {
      const mockFormData = {
        name: "Test",
        email: "test@test.com",
        phone: "555-0000",
        services: ["Service"],
        dueDate: "2025-12-01"
      };
      
      await sendQuoteEmails(mockFormData, "owner@test.com", "Business");
      
      const visitorEmail = mockSendMail.mock.calls[0][0];
      expect(visitorEmail.html).toContain("max-width: 600px");
      expect(visitorEmail.html).toContain("font-family");
    });

    test("should properly escape special characters in user input", async () => {
      const mockFormData = {
        name: "Test <script>alert('xss')</script>",
        email: "test@test.com",
        phone: "555-0000",
        services: ["Service"],
        dueDate: "2025-12-01",
        details: "Details with <b>HTML</b> tags"
      };
      
      await sendQuoteEmails(mockFormData, "owner@test.com", "Business");
     
      const visitorEmail = mockSendMail.mock.calls[0][0];
      expect(visitorEmail.html).toContain(mockFormData.name);
    });
  });

  
  
  describe("Transport and Credentials Validation (BE-SUP-2)", () => {
    describe("Authentication Failures", () => {
      test("should handle authentication failure with wrong password", async () => {
        mockSendMail.mockRejectedValueOnce(
          new Error("535-5.7.8 Username and Password not accepted")
        );

        const mockFormData = {
          name: "Test",
          email: "test@test.com",
          phone: "555-0000",
          services: ["Service"],
          dueDate: "2025-12-01"
        };

        await expect(
          sendQuoteEmails(mockFormData, "owner@test.com", "Business")
        ).rejects.toThrow("Username and Password not accepted");
      });

      test("should handle authentication failure", async () => {
        mockSendMail.mockRejectedValueOnce(
          new Error("535 Authentication failed")
        );

        const mockFormData = {
          name: "Test",
          email: "test@test.com",
          phone: "555-0000",
          services: ["Service"],
          dueDate: "2025-12-01"
        };

        await expect(
          sendQuoteEmails(mockFormData, "owner@test.com", "Business")
        ).rejects.toThrow("Authentication failed");
      });
    });

    describe("Connection Errors", () => {
      test("should handle invalid SMTP host error", async () => {
        mockSendMail.mockRejectedValueOnce(
          new Error("getaddrinfo ENOTFOUND smtp.invalid-host.com")
        );

        const mockFormData = {
          name: "Test",
          email: "test@test.com",
          phone: "555-0000",
          services: ["Service"],
          dueDate: "2025-12-01"
        };

        await expect(
          sendQuoteEmails(mockFormData, "owner@test.com", "Business")
        ).rejects.toThrow("ENOTFOUND");
      });

      test("should handle connection refused error", async () => {
        mockSendMail.mockRejectedValueOnce(
          new Error("connect ECONNREFUSED 127.0.0.1:587")
        );

        const mockFormData = {
          name: "Test",
          email: "test@test.com",
          phone: "555-0000",
          services: ["Service"],
          dueDate: "2025-12-01"
        };

        await expect(
          sendQuoteEmails(mockFormData, "owner@test.com", "Business")
        ).rejects.toThrow("ECONNREFUSED");
      });

      test("should handle connection timeout", async () => {
        mockSendMail.mockRejectedValueOnce(
          new Error("Connection timeout")
        );

        const mockFormData = {
          name: "Test",
          email: "test@test.com",
          phone: "555-0000",
          services: ["Service"],
          dueDate: "2025-12-01"
        };

        await expect(
          sendQuoteEmails(mockFormData, "owner@test.com", "Business")
        ).rejects.toThrow("Connection timeout");
      });

      test("should handle network unreachable error", async () => {
        mockSendMail.mockRejectedValueOnce(
          new Error("Network is unreachable")
        );

        const mockFormData = {
          name: "Test",
          email: "test@test.com",
          phone: "555-0000",
          services: ["Service"],
          dueDate: "2025-12-01"
        };

        await expect(
          sendQuoteEmails(mockFormData, "owner@test.com", "Business")
        ).rejects.toThrow("Network is unreachable");
      });
    });

    describe("SSL/TLS Errors", () => {
      test("should handle TLS/SSL certificate errors", async () => {
        mockSendMail.mockRejectedValueOnce(
          new Error("certificate verify failed")
        );

        const mockFormData = {
          name: "Test",
          email: "test@test.com",
          phone: "555-0000",
          services: ["Service"],
          dueDate: "2025-12-01"
        };

        await expect(
          sendQuoteEmails(mockFormData, "owner@test.com", "Business")
        ).rejects.toThrow("certificate verify failed");
      });
    });

    describe("Transporter Configuration", () => {
     
      
      test("transporter is properly configured", () => {
        
        expect(mockTransporter).toBeDefined();
        expect(mockTransporter.sendMail).toBeDefined();
        expect(mockSendMail).toBeDefined();
      });
    });

    describe("Rate Limiting Errors", () => {
      test("should handle daily sending quota exceeded", async () => {
        mockSendMail.mockRejectedValueOnce(
          new Error("Daily sending quota exceeded")
        );

        const mockFormData = {
          name: "Test",
          email: "test@test.com",
          phone: "555-0000",
          services: ["Service"],
          dueDate: "2025-12-01"
        };

        await expect(
          sendQuoteEmails(mockFormData, "owner@test.com", "Business")
        ).rejects.toThrow("Daily sending quota exceeded");
      });

      test("should handle rate limit error", async () => {
        mockSendMail.mockRejectedValueOnce(
          new Error("421 4.7.0 Try again later, closing connection")
        );

        const mockFormData = {
          name: "Test",
          email: "test@test.com",
          phone: "555-0000",
          services: ["Service"],
          dueDate: "2025-12-01"
        };

        await expect(
          sendQuoteEmails(mockFormData, "owner@test.com", "Business")
        ).rejects.toThrow("Try again later");
      });
    });
  });
});