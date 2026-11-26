const {
  sectionDataToPuckProps,
  puckPropsToSectionData,
} = require("../models/featureComponentAdapters");

describe("featureComponentAdapters", () => {
  describe("Gallery (healthcare)", () => {
    const puck = {
      title: "Our space",
      images: [
        { url: "https://cdn.example/a.jpg", caption: "Lobby" },
        { url: "https://cdn.example/b.jpg", caption: "Exam room" },
      ],
    };

    it("round-trips Puck -> legacy -> Puck", () => {
      const legacy = puckPropsToSectionData("Gallery", puck, "healthcare", {});
      expect(legacy).toEqual({
        sectionTitle: "Our space",
        facilityImages: [
          { url: "https://cdn.example/a.jpg", caption: "Lobby" },
          { url: "https://cdn.example/b.jpg", caption: "Exam room" },
        ],
      });
      const back = sectionDataToPuckProps("Gallery", legacy, "healthcare");
      expect(back).toEqual(puck);
    });

    it("reads legacy facilityImages for listing", () => {
      const legacy = {
        sectionTitle: "Stored",
        facilityImages: [{ url: "https://cdn.example/x.jpg", caption: "One" }],
      };
      expect(sectionDataToPuckProps("Gallery", legacy, "healthcare")).toEqual({
        title: "Stored",
        images: [{ url: "https://cdn.example/x.jpg", caption: "One" }],
      });
    });

    it("still lists Puck-shaped sections stored before conversion", () => {
      const puckStored = { title: "Old", images: [{ url: "https://cdn.example/y.jpg", caption: "" }] };
      expect(sectionDataToPuckProps("Gallery", puckStored, "healthcare")).toEqual(puckStored);
    });
  });

  describe("Gallery (handyman)", () => {
    it("maps images to items[].imageUrl", () => {
      const legacy = puckPropsToSectionData(
        "Gallery",
        { title: "Jobs", images: [{ url: "https://cdn.example/job.jpg", caption: "Deck" }] },
        "handyman",
        { beforeAfterCases: [{ id: "keep-me" }] }
      );
      expect(legacy.sectionTitle).toBe("Jobs");
      expect(legacy.items[0]).toMatchObject({
        imageUrl: "https://cdn.example/job.jpg",
        title: "Deck",
      });
      expect(legacy.beforeAfterCases).toEqual([{ id: "keep-me" }]);
    });
  });

  describe("Testimonials", () => {
  const puck = {
    title: "Reviews",
    items: [{ author: "Sam T.", quote: "Great care.", rating: 5 }],
  };

    it("round-trips author/name fields", () => {
      const legacy = puckPropsToSectionData("Testimonials", puck, "healthcare", {});
      expect(legacy).toEqual({
        sectionTitle: "Reviews",
        items: [{ name: "Sam T.", quote: "Great care.", rating: 5 }],
      });
      expect(sectionDataToPuckProps("Testimonials", legacy, "healthcare")).toEqual(puck);
    });
  });

  describe("Services", () => {
    const puck = { title: "Offerings", items: [{ title: "Consult", description: "Initial visit" }] };

    it("round-trips title/sectionTitle", () => {
      const legacy = puckPropsToSectionData("Services", puck, "healthcare", {});
      expect(legacy.sectionTitle).toBe("Offerings");
      expect(legacy.items[0].title).toBe("Consult");
      expect(sectionDataToPuckProps("Services", legacy)).toEqual(puck);
    });
  });

  describe("BusinessHours", () => {
    const puck = {
      title: "Hours",
      timezone: "America/Chicago",
      schedule: [
        { day: "Weekdays", open: "9:00 AM", close: "5:00 PM", closed: false },
        { day: "Saturday", open: "10:00 AM", close: "2:00 PM", closed: false },
        { day: "Sunday", open: "", close: "", closed: true },
      ],
    };

    it("collapses schedule into weekday buckets", () => {
      const legacy = puckPropsToSectionData("BusinessHours", puck, "healthcare", {});
      expect(legacy.weekdays).toBe("9:00 AM – 5:00 PM");
      expect(legacy.saturday).toBe("10:00 AM – 2:00 PM");
      expect(legacy.sunday).toBe("Closed");
      expect(legacy.schedule).toBeUndefined();
      const back = sectionDataToPuckProps("BusinessHours", legacy, "healthcare");
      expect(back.title).toBe("Hours");
      expect(back.timezone).toBe("America/Chicago");
      expect(back.schedule).toHaveLength(3);
    });
  });

  describe("SocialLinks", () => {
    const puck = {
      title: "Follow us",
      platforms: { github: true, twitter: false, linkedin: true, instagram: false, website: true },
    };

    it("round-trips without persisting URLs", () => {
      const legacy = puckPropsToSectionData("SocialLinks", puck, "healthcare", {
        github: "https://github.com/secret",
      });
      expect(legacy.github).toBeUndefined();
      expect(legacy.sectionTitle).toBe("Follow us");
      expect(legacy.platforms.github).toBe(true);
      expect(legacy.linkSource).toBe("socialLinksModule");
      expect(sectionDataToPuckProps("SocialLinks", legacy)).toEqual(puck);
    });
  });

  describe("QrCode", () => {
    const puck = {
      title: "Open menu",
      target: "/menu",
      size: 200,
      caption: "Scan here",
    };

    it("round-trips path targets", () => {
      const legacy = puckPropsToSectionData("QrCode", puck, "healthcare", {});
      expect(legacy).toMatchObject({
        sectionTitle: "Open menu",
        target: "/menu",
        size: 200,
        caption: "Scan here",
      });
      expect(sectionDataToPuckProps("QrCode", legacy)).toEqual(puck);
    });
  });

  describe("VoucherOffer", () => {
    const puck = {
      title: "Save today",
      voucherId: "507f1f77bcf86cd799439099",
      description: "Limited time",
      cta: "Claim",
      ctaUrl: "https://example.test/offer",
    };

    it("stores userVoucherId only", () => {
      const legacy = puckPropsToSectionData("VoucherOffer", puck, "healthcare", {
        code: "SECRET",
        redemptionCount: 9,
      });
      expect(legacy.userVoucherId).toBe(puck.voucherId);
      expect(legacy.voucherId).toBeUndefined();
      expect(legacy.code).toBeUndefined();
      expect(legacy.redemptionCount).toBeUndefined();
      expect(sectionDataToPuckProps("VoucherOffer", legacy)).toEqual(puck);
    });
  });

  describe("ContactLeadForm", () => {
    const puck = {
      headline: "Contact our clinic",
      enableForm: true,
      submitLabel: "Submit",
      formFields: { showName: true, showEmail: true, showMessage: false },
    };

    it("maps headline and submitLabel to legacy fields", () => {
      const legacy = puckPropsToSectionData("ContactLeadForm", puck, "healthcare", {
        email: "clinic@example.test",
        phone: "555-0100",
      });
      expect(legacy.email).toBe("clinic@example.test");
      expect(legacy.phone).toBe("555-0100");
      expect(legacy.headline).toBe("Contact our clinic");
      expect(legacy.title).toBe("Contact our clinic");
      expect(legacy.submitText).toBe("Submit");
      expect(legacy.formFields.showMessage).toBe(false);
      expect(sectionDataToPuckProps("ContactLeadForm", legacy)).toMatchObject({
        headline: "Contact our clinic",
        submitLabel: "Submit",
      });
    });
  });
});