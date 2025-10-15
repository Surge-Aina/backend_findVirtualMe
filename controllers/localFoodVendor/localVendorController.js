const LocalVendorPortfolio = require("../../models/localFoodVendor/LocalVendorPortfolio");
const Banner = require("../../models/localFoodVendor/Banner");
const About = require("../../models/localFoodVendor/About");
const GalleryImage = require("../../models/localFoodVendor/GalleryImage");
const MenuItem = require("../../models/localFoodVendor/MenuItems");
const Review = require("../../models/localFoodVendor/Review");
const TaggedImage = require("../../models/localFoodVendor/TaggedImage");
const seedVendor = require("../../models/localFoodVendor/seedVendor");
const {
  generateVendorAboutAndMenuJSON,
} = require("../../services/openAiService");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const { PDFDocument } = require("pdf-lib");
const pdfjsLib = require("pdfjs-dist/legacy/build/pdf.js");

// Create vendor and add the basic info so website doesn't look blank, view seedVendor
exports.createVendor = async (req, res) => {
  try {
    const vendor = new LocalVendorPortfolio(req.body);
    await vendor.save();

    //seeding info
    await seedVendor(vendor._id);

    res.status(201).json(vendor);
  } catch (err) {
    res.status(400).json({ error: "Failed to create vendor" });
  }
};

// Get all vendors
exports.getAllVendors = async (req, res) => {
  try {
    const vendors = await LocalVendorPortfolio.find();
    res.json(vendors);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch vendors" });
  }
};

// Get one vendor
exports.getVendorById = async (req, res) => {
  try {
    const vendor = await LocalVendorPortfolio.findById(req.params.vendorId);
    if (!vendor) return res.status(404).json({ error: "Vendor not found" });
    res.json(vendor);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch vendor" });
  }
};

// Update vendor
exports.updateVendor = async (req, res) => {
  try {
    const updated = await LocalVendorPortfolio.findByIdAndUpdate(
      req.params.vendorId,
      req.body,
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: "Vendor not found" });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to update vendor" });
  }
};

// Delete vendor
exports.deleteVendor = async (req, res) => {
  try {
    const deleted = await LocalVendorPortfolio.findByIdAndDelete(
      req.params.vendorId
    );
    if (!deleted) return res.status(404).json({ error: "Vendor not found" });
    res.json({ message: "Vendor deleted" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete vendor" });
  }
};

// Aggregated portfolio data
exports.getFullPortfolio = async (req, res) => {
  try {
    const vendorId = req.params.vendorId;
    const vendor = await LocalVendorPortfolio.findById(vendorId);
    if (!vendor) return res.status(404).json({ error: "Vendor not found" });

    // fetch all linked data in parallel
    const [banners, about, gallery, menu, reviews, taggedImages] =
      await Promise.all([
        Banner.find({ vendorId }),
        About.findOne({ vendorId }),
        GalleryImage.find({ vendorId }),
        MenuItem.find({ vendorId }),
        Review.find({ vendorId }),
        TaggedImage.find({ vendorId }).populate("tags.menuItem"),
      ]);

    res.json({ vendor, banners, about, gallery, menu, reviews, taggedImages });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch full portfolio" });
  }
};

// async function extractText(fileBuffer, mimeType) {
//   console.log("MimeType:", mimeType);
//   console.log("Buffer type:", Buffer.isBuffer(fileBuffer));
//   console.log("Buffer length:", fileBuffer?.length);

//   if (mimeType === "application/pdf") {
//     try {
//       const data = await pdfParse(fileBuffer);
//       console.log("PDF parse success, length of text:", data.text.length);
//       return data.text;
//     } catch (err) {
//       console.error("PDF parse failed:", err);
//       throw err;
//     }
//   } else {
//     const { value } = await mammoth.extractRawText({ buffer: fileBuffer });
//     return value;
//   }
// }

async function pdfJsExtract(buffer) {
  // v5 automatically detects Node environment
  const loadingTask = pdfjsLib.getDocument({ data: buffer });
  const pdf = await loadingTask.promise;
  let fullText = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    fullText += textContent.items.map((item) => item.str).join(" ") + "\n";
  }

  return fullText.trim();
}

async function extractText(fileBuffer, mimeType) {
  console.log("MimeType:", mimeType);
  console.log("Buffer type:", Buffer.isBuffer(fileBuffer));
  console.log("Buffer length:", fileBuffer?.length);

  const normalizedBuffer = Buffer.isBuffer(fileBuffer)
    ? Buffer.from(fileBuffer)
    : Buffer.from(new Uint8Array(fileBuffer));

  if (mimeType === "application/pdf") {
    try {
      // Primary parse
      const data = await pdfParse(normalizedBuffer);
      if (!data.text || data.text.trim().length < 50) {
        throw new Error(
          "Parsed PDF is too short — likely invalid or image-only."
        );
      }
      console.log("PDF parse success, length of text:", data.text.length);
      return data.text.trim();
    } catch (err) {
      console.warn(" pdf-parse failed:", err.message);

      try {
        //  Secondary fallback: use pdfjs-dist for real text extraction
        console.log("Attempting fallback via pdfjs-dist...");
        const fallbackText = await pdfJsExtract(normalizedBuffer);
        if (fallbackText && fallbackText.trim().length > 20) {
          console.log("Fallback via pdfjs-dist succeeded");
          return fallbackText.trim();
        }
        throw new Error("Fallback text too short");
      } catch (pdfjsErr) {
        console.warn(" pdfjs-dist fallback failed:", pdfjsErr.message);

        try {
          //  Final backup: metadata only
          const pdfDoc = await PDFDocument.load(normalizedBuffer);
          const meta = pdfDoc.getTitle() || pdfDoc.getAuthor() || "Unnamed PDF";
          console.log(" Fallback via pdf-lib metadata");
          return `Extracted metadata: ${meta}`;
        } catch (metaErr) {
          console.error(" All fallbacks failed:", metaErr.message);
          return "";
        }
      }
    }
  } else {
    // DOCX, etc.
    const { value } = await mammoth.extractRawText({
      buffer: normalizedBuffer,
    });
    return value.trim();
  }
}

// NEW: Inject vendor + about + menu
exports.injectVendorPortfolio = async (req, res) => {
  console.log("req.file:", req.file);
  console.log("req.body keys:", Object.keys(req.body));
  try {
    if (!req.file) return res.status(400).json({ error: "File is required" });

    const text = await extractText(req.file.buffer, req.file.mimetype);
    let parsed;
    try {
      parsed = await generateVendorAboutAndMenuJSON(text);
      console.log("===== RAW PARSED JSON FROM OPENAI =====");
      console.dir(parsed, { depth: null });
      parsed.vendor = {
        ...parsed.vendor,
        // fallback to frontend values if missing
        name: parsed.vendor.name || req.body.name,
        email: parsed.vendor.email || req.body.email,
        phone: parsed.vendor.phone || req.body.phone,
        description: parsed.vendor.description || req.body.description,
        ...parsed.vendor,
      };
      console.log("===== FINAL MERGED VENDOR OBJECT =====");
      console.dir(parsed.vendor, { depth: null });
    } catch (err) {
      console.error("OpenAI JSON parse failed:", err.message);
      return res.status(400).json({
        error:
          "Could not convert the document into valid vendor data. Please check formatting.",
      });
    }

    if (
      !parsed.vendor ||
      !parsed.vendor.name ||
      !parsed.vendor.email ||
      !parsed.vendor.phone
    ) {
      return res.status(400).json({
        error:
          "Vendor profile is missing required fields (name, email, phone). Please upload a document with complete vendor details",
      });
    }

    const existing = await LocalVendorPortfolio.findOne({
      email: parsed.vendor.email,
    });
    if (existing) {
      return res.status(400).json({
        error: `Vendor with email ${parsed.vendor.email} already exists.`,
      });
    }

    const vendor = await LocalVendorPortfolio.create(parsed.vendor);

    await About.create({ ...parsed.about, vendorId: vendor._id });

    //  Handle menu items safely
    if (Array.isArray(parsed.menuItems)) {
      const validMenus = parsed.menuItems.filter(
        (m) => m && m.name && m.name.trim() !== ""
      );

      if (validMenus.length > 0) {
        const menuDocs = validMenus.map((m) => ({
          ...m,
          vendorId: vendor._id,
        }));
        await MenuItem.insertMany(menuDocs);
      } else {
        console.log("No valid menu items found — skipping MenuItem creation.");
      }
    }

    await Banner.create({
      vendorId: vendor._id,
      title: "Welcome to " + (vendor.name || "Our Business"),
      description: vendor.description || "Your banner description here.",
      image: "https://placehold.co/1200x400", // placeholder
      shape: "fullscreen",
    });

    res
      .status(201)
      .json({ vendor, about: parsed.about, menuItems: parsed.menuItems });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ error: "Failed to create vendor portfolio from document" });
  }
};
