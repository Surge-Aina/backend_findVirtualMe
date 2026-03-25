/**
 * Default section compositions for each portfolio template.
 *
 * When a new portfolio is created with a given template key,
 * these sections are cloned into the document's sections[] array.
 * The data payloads mirror the defaults from the legacy per-type models.
 */

const healthcareDefaults = [
  {
    type: "hero",
    order: 0,
    data: {
      practiceName: "",
      tagline: "",
      description: "",
      logoImage: "",
      icon: "",
      primaryButtonText: "Get Started",
      secondaryButtonText: "Learn More",
      backgroundImage: "",
    },
  },
  {
    type: "stats",
    order: 1,
    data: {
      showStatsSection: true,
      yearsExperience: "0",
      patientsServed: "0",
      successRate: "0",
      doctorsCount: "0",
      visibility: {
        yearsExperience: true,
        patientsServed: true,
        successRate: true,
        doctorsCount: true,
      },
    },
  },
  {
    type: "services",
    order: 2,
    data: {
      items: [],
      viewAllText: "View All Services",
      bookButtonText: "Book Now",
    },
  },
  {
    type: "gallery",
    order: 3,
    data: {
      facilityImages: [],
      beforeAfterCases: [],
    },
  },
  {
    type: "blog",
    order: 4,
    data: {
      posts: [],
      readMoreText: "Read More",
      viewAllText: "View All Posts",
    },
  },
  {
    type: "contact",
    order: 5,
    data: {
      phone: "",
      whatsapp: "",
      email: "",
      address: { street: "", city: "", state: "", zip: "" },
      buttonText: "Contact Us",
      submitText: "Send Message",
    },
  },
  {
    type: "hours",
    order: 6,
    data: {
      weekdays: "Mon-Fri: 9:00 AM - 5:00 PM",
      saturday: "Sat: Closed",
      sunday: "Sun: Closed",
    },
  },
  {
    type: "seo",
    order: 7,
    data: {
      siteTitle: "",
      metaDescription: "",
      keywords: "",
    },
  },
];

const projectManagerDefaults = [
  {
    type: "summary",
    order: 0,
    data: {
      name: "",
      title: "",
      bio: "",
      summary: "",
      email: "",
      phone: "",
      location: "",
      profileImage: "",
      profileImageKey: "",
      resumeUrl: "",
      resumeKey: "",
    },
  },
  {
    type: "skills",
    order: 1,
    data: {
      items: [],
    },
  },
  {
    type: "experience",
    order: 2,
    data: {
      items: [],
    },
  },
  {
    type: "education",
    order: 3,
    data: {
      items: [],
    },
  },
  {
    type: "projects",
    order: 4,
    data: {
      items: [],
    },
  },
  {
    type: "contact",
    order: 5,
    data: {
      email: "",
      phone: "",
      location: "",
    },
  },
];

const dataScientistDefaults = [
  {
    type: "summary",
    order: 0,
    data: {
      name: "",
      title: "",
      bio: "",
      summary: "",
      email: "",
      phone: "",
      location: "",
      profileImage: "",
      profileImageKey: "",
      resumeUrl: "",
      resumeKey: "",
    },
  },
  {
    type: "skills",
    order: 1,
    data: {
      items: [],
    },
  },
  {
    type: "experience",
    order: 2,
    data: {
      items: [],
    },
  },
  {
    type: "education",
    order: 3,
    data: {
      items: [],
    },
  },
  {
    type: "projects",
    order: 4,
    data: {
      items: [
      //   {
      //     name: "Project 1",
      //     about: "Description of Project 1",
      //     time: "2022-2023",
      //     points: ["Point 1", "Point 2", "Point 3"],
      //     technologies: ["Technology 1", "Technology 2", "Technology 3"],
      //     githubUrl: "https://www.github.com/project1",
      //     liveUrl: "https://www.project1.com",
      //   },
      // {
      //   name: "Project 2",
      //   about: "Description of Project 2",
      //   time: "2022-2023",
      //   points: ["Point 1", "Point 2", "Point 3"],
      //   technologies: ["Technology 1", "Technology 2", "Technology 3"],
      //   githubUrl: "https://www.github.com/project2",
      //   liveUrl: "https://www.project2.com",
      // },
      // {
      //   name: "Project 3",
      //   about: "Description of Project 3",
      //   time: "2022-2023",
      //   points: ["Point 1", "Point 2", "Point 3"],
      //   technologies: ["Technology 1", "Technology 2", "Technology 3"],
      //   githubUrl: "https://www.github.com/project3",
      //   liveUrl: "https://www.project3.com",
      // },
      ],
    },
  },
  {
    type: "contact",
    order: 5,
    data: {
      email: "",
      phone: "",
      linkedin: "",
      github: "",
      twitter: "",
      facebook: "",
      instagram: "",
      youtube: "",
      tiktok: "",
      pinterest: "",
      website: "",
    }
  },
  {
    type: "dashboardChart",
    order: 6,
    data: {
      chartTitle: "Sample metrics",
      xAxisLabel: "Month",
      yAxisLabel: "Value",
      data: {
        sales: [120, 190, 300, 500, 200, 300],
        revenue: [15000, 22000, 35000, 48000, 25000, 32000],
        xLabels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
        hiddenPoints: [],
      },
      categories: ["Build", "Analyze", "Report"],
      categoryData: [40, 35, 25],
      isActive: true,
    },
  },
  {
    type: "dashboardTable",
    order: 7,
    data: {
      tableTitle: "Sample table",
      tableData: [
        {
          name: "Python",
          value: 95,
          percentage: 40,
          icon: "🐍",
          link: "",
          buttonText: "",
        },
        {
          name: "SQL",
          value: 88,
          percentage: 35,
          icon: "📊",
          link: "",
          buttonText: "",
        },
        {
          name: "ML / stats",
          value: 82,
          percentage: 25,
          icon: "📈",
          link: "",
          buttonText: "",
        },
      ],
    },
  },
];

const handymanDefaults = [
  {
    type: "hero",
    order: 0,
    data: {
      title: "Trusted Handyman for Home Repairs & Maintenance",
      subtitle: "Licensed, Insured, and Ready to Help. Call us today!",
      phoneNumber: "(123) 456-7890",
      imageUrl: "",
      badge1Text: "Licensed & Insured",
      badge2Text: "5-Star Rated",
      badge3Text: "24/7 Emergency Service",
      ctaText: "Request a Free Estimate",
    },
  },
  {
    type: "services",
    order: 1,
    data: {
      sectionTitle: "A One-Call Solution for Your To-Do List",
      sectionIntro:
        "We handle a wide range of home maintenance and repair solutions so you don't have to juggle multiple contractors.",
      items: [
        {
          icon: "💧",
          title: "Plumbing Repairs",
          description: "Quick and efficient plumbing repairs and installs.",
          bullets: [
            "Faucet repair",
            "Toilet install",
            "Pipe fixes",
            "Heater service",
          ],
        },
        {
          icon: "🔨",
          title: "Electrical Work",
          description:
            "Safe and reliable electrical services for your projects.",
          bullets: [
            "Light installs",
            "Outlet repair",
            "Ceiling fans",
            "Switches",
          ],
        },
      ],
    },
  },
  {
    type: "gallery",
    order: 2,
    data: {
      sectionTitle: "Quality Craftsmanship You Can See",
      sectionSubtitle: "",
      allLabel: "All",
      items: [],
    },
  },
  {
    type: "process",
    order: 3,
    data: {
      sectionTitle: "Our Simple Process",
      steps: [
        {
          number: 1,
          title: "Request a Quote",
          description: "Fill out our form or give us a call.",
        },
        {
          number: 2,
          title: "We Confirm Details",
          description: "We'll contact you to confirm the job scope.",
        },
      ],
    },
  },
  {
    type: "testimonials",
    order: 4,
    data: {
      sectionTitle: "What Our Clients Say",
      items: [
        {
          name: "Jane D.",
          quote: "Incredibly reliable and professional.",
          location: "Downtown",
          service: "General Repairs",
        },
      ],
    },
  },
  {
    type: "contact",
    order: 5,
    data: {
      title: "Get Your Free Estimate",
      subtitle:
        "Ready to get started? Contact us today for a free, no-obligation estimate. We respond to all inquiries within 24 hours.",
      formTitle: "Ready to get started? Send us a message!",
      phone: "(112) 233-4455",
      email: "contact@prohandy.com",
      hours: "Mon–Fri: 7AM–7PM",
      note: "Weekend & emergency calls available",
    },
  },
];

const agentDefaults = [
  {
    type: "summary",
    order: 0,
    data: {
      name: "",
      title: "",
      bio: "",
      summary: "",
      email: "",
      phone: "",
      location: "",
      profileImage: "",
      profileImageKey: "",
      resumeUrl: "",
      resumeKey: "",
    },
  },
  {
    type: "projects",
    order: 1,
    data: {
      items: [],
    },
  },
  {
    type: "contact",
    order: 2,
    data: {
      email: "",
      phone: "",
      location: "",
      website: "",
    },
  },
];

const templateDefaults = {
  healthcare: healthcareDefaults,
  projectManager: projectManagerDefaults,
  handyman: handymanDefaults,
  dataScientist: dataScientistDefaults,
  agent: agentDefaults,
};

function getDefaultSections(template) {
  const defaults = templateDefaults[template];
  if (!defaults) return [];
  return JSON.parse(JSON.stringify(defaults));
}

module.exports = {
  templateDefaults,
  getDefaultSections,
};
