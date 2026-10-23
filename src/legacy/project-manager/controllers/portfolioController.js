const req = require("express/lib/request");
const Portfolio = require("../models/portfolioModel");
const pdfParse = require("pdf-parse");
const { generatePortfolioJSON, generateMatchSummary } = require("../../../shared/services/openAiService");
const { uploadToS3, deleteFromS3 } = require("../../../shared/services/s3Service");

function publicPortfolio(doc) {
  const plain = typeof doc.toObject === "function" ? doc.toObject() : { ...doc };
  delete plain.sessionId;
  delete plain.resumeKey;
  delete plain.profileImageKey;
  return plain;
}

function callerCanEditPortfolio(portfolio, user) {
  if (!user) return false;
  if (user.role === "admin") return true;
  const actorEmail = String(user.email || "").trim().toLowerCase();
  const ownerEmail = String(portfolio.email || "").trim().toLowerCase();
  if (actorEmail && actorEmail === ownerEmail) return true;
  if (portfolio.userId && (user._id || user.id) && String(portfolio.userId) === String(user._id || user.id)) {
    return true;
  }
  return false;
}

function plainPortfolioUpdate(portfolio, { admin }) {
  const source = portfolio && typeof portfolio === "object" ? portfolio : {};
  const updates = {};
  for (const [key, value] of Object.entries(source)) {
    if (key.startsWith("$") || key === "_id" || key === "id") continue;
    updates[key] = value;
  }
  delete updates.sessionId;
  delete updates.resumeKey;
  delete updates.profileImageKey;
  if (!admin) {
    delete updates.email;
    delete updates.userId;
  }
  return updates;
}

exports.getPortfolioByEmail = async(req, res) => {
    const email = req.params.email;
    try {
        const portfolio = await Portfolio.findOne({ email });
        if (!portfolio) {
            res.status(404).json({ message: "portfolio not found" });
            return;
        }
        res.status(200).json(portfolio);
    } catch (error) {
        console.log("error getting portfolio: ", error);
        res.status(500).json({ message: "error getting portfolio" });
    }
};
exports.getAllPortfoliosByEmail = async(req, res) => {
    const email = req.params.email;
    try {
        const portfolios = await Portfolio.find({ email });
        if (portfolios.length === 0) {
            res.status(404).json({ message: "portfolios not found" });
            return;
        }
        res.status(200).json(portfolios);
    } catch (error) {
        console.log("error getting portfolio: ", error);
        res.status(500).json({ message: "error getting portfolio" });
    }
};

exports.getAllPortfolios = async(req, res) => {
    try {
        const portfolios = await Portfolio.find({});
        if (portfolios.length === 0) {
            return res.status(404).json({ message: "No portfolios found" });
        }
        res.status(200).json(portfolios);
    } catch (error) {
        console.error("Error getting portfolios:", error);
        res.status(500).json({ message: "Error getting portfolios" });
    }
};

exports.getPortfolioById = async(req, res) => {
    const id = req.params.id;
    console.log("id", id, typeof id);
    try {
        const portfolio = await Portfolio.findById(id);
        if (!portfolio) {
            res.status(404).json({ message: "portfolio not found" });
            return;
        }
        res.status(200).json(publicPortfolio(portfolio));
    } catch (error) {
        console.log("error getting portfolio: ", error);
        res.status(500).json({ message: "error getting portfolio" });
    }
};

exports.addPortfolio = async(req, res) => {
    const { portfolio } = req.body; //User object will be sent from the front end

    try {
        if (!portfolio) {
            return res.status(400).json({ message: "portfolio needed" });
        }

        const actorEmail = req.user?.email;
        const formattedPortfolio = {
            name: `${portfolio.firstName} ${portfolio.lastName}`,
            title: portfolio.industry,
            email: actorEmail || portfolio.email,
            phone: portfolio.phone,
            location: portfolio.location,
            summary: `Goal: ${portfolio.goal}\n
                      Skills: 
                      ${portfolio.skills.join("\n")}`,
        };
        if (req.user?._id) formattedPortfolio.userId = req.user._id;

        const newPortfolio = new Portfolio(formattedPortfolio);
        await newPortfolio.save();
        res.status(201).json(newPortfolio);
    } catch (error) {
        console.error("error adding portfolio", error);
        res.status(500).json({ message: "error adding portfolio" });
    }
};

exports.addPDF = async(req, res) => {
    const email = req.user?.email || req.body.email;
    const sessionId = req.body.sessionId; // get sessionId
    if (!req.file) {
        return res.status(400).json({ error: "No PDF file uploaded" });
    }

    try {
        // req.file.buffer contains the PDF file in memory
        const data = await pdfParse(req.file.buffer);

        // Example: Simple JSON response with extracted text and number of pages
        const jsonResponse = {
            numPages: data.numpages,
            numRenderedPages: data.numrender,
            info: data.info,
            metadata: data.metadata,
            text: data.text,
        };

        //call openAI API
        const jsonPortfolio = await generatePortfolioJSON(jsonResponse.text, email);
        console.log(jsonPortfolio);

        const portfolioObj = typeof jsonPortfolio === "string" ? JSON.parse(jsonPortfolio) : jsonPortfolio;

        //save portfolio
        // add sessionId to portfolio object
        if (sessionId && !req.user?.email) {
            portfolioObj.sessionId = sessionId;
        }
        if (req.user?.email) {
            portfolioObj.email = req.user.email;
            if (req.user._id) portfolioObj.userId = req.user._id;
            delete portfolioObj.sessionId;
        }
        console.log("Session ID:", sessionId);
        const newPortfolio = new Portfolio(portfolioObj);
        await newPortfolio.save();
        res.status(201).json(newPortfolio);
    } catch (err) {
        console.error("Error parsing PDF:", err);
        res.status(500).json({ error: "Failed to parse PDF" });
    }
};

    exports.editPortfolioByEmail = async (req, res) => {
    const actor = req.user || {};
    const actorEmail = String(actor.email || "").trim();
    const admin = actor.role === "admin";
    const incoming = req.body.portfolio && typeof req.body.portfolio === "object"
      ? req.body.portfolio
      : {};
    const id = incoming._id || incoming.id;
    const updates = plainPortfolioUpdate(incoming, { admin });

    try {
        let filter;
        if (id) {
            const existing = await Portfolio.findById(id);
            if (!existing) {
                return res.status(404).json({ message: "item not found" });
            }
            if (!callerCanEditPortfolio(existing, actor)) {
                return res.status(403).json({ message: "Forbidden" });
            }
            filter = { _id: existing._id };
        } else {
            if (!actorEmail) {
                return res.status(401).json({ message: "Unauthorized" });
            }
            filter = { email: actorEmail };
        }

        const updatedPortfolio = await Portfolio.findOneAndUpdate(
        filter,
        { $set: updates },
        { new: true } // return updated document
        );

        if (!updatedPortfolio) {
        return res.status(404).json({ message: "item not found" });
        }

        res.json(updatedPortfolio);
    } catch (error) {
        console.log("could not edit item", error);
        res.status(500).json({ message: "could not edit item" });
    }
    };


exports.deletePortfolioByEmail = async(req, res) => {
    const email = (req.query.email || "").toString().trim();
    const actor = req.user || {};
    const actorEmail = (actor.email || "").toString().trim();
    const isAdmin = actor.role === "admin";
    if (!actorEmail && !isAdmin) {
        return res.status(401).json({ message: "Unauthorized" });
    }
    if (!isAdmin && email.toLowerCase() !== actorEmail.toLowerCase()) {
        return res.status(403).json({ message: "Forbidden" });
    }
    try {
        const deletedItem = await Portfolio.findOneAndDelete({ email });
        if (!deletedItem) {
            res.status(404).json({ message: "item not found" });
            return;
        }
        res.status(200).json({ message: "item deleted successfully!" });
    } catch (error) {
        console.log("error deleting portfolio: ", error);
        res.status(500).json({ message: "error deleting portfolio" });
    }
};

exports.aiSummary = async(req, res) => {
    const { resumeJSON, jobText } = req.body;
    if (!resumeJSON || !jobText) return res.status(400).json({ error: "Missing input" });

    try {
        const summary = await generateMatchSummary(resumeJSON, jobText);
        res.json({ summary });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Generation failed" });
    }
};

// Upload / update profile image for a portfolio
exports.uploadProfileImage = async (req, res) => {
    try {
        const { id } = req.params;

        if (!req.file) {
        return res.status(400).json({ message: "No image file uploaded" });
        }

        const portfolio = await Portfolio.findById(id);
        if (!portfolio) {
        return res.status(404).json({ message: "Portfolio not found" });
        }
        if (!callerCanEditPortfolio(portfolio, req.user)) {
        return res.status(403).json({ message: "Forbidden" });
        }

        // If there was a previous image stored, try to delete it from S3
        if (portfolio.profileImageKey) {
        try {
            await deleteFromS3(portfolio.profileImageKey);
        } catch (err) {
            console.error("Error deleting old profile image from S3:", err.message);
            // don't fail the request if delete fails
        }
        }

        // Upload new file to S3
        const { url, key } = await uploadToS3(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        `Ports/ProjectManager/${id}`  // S3 prefix/folder
        );

        // Save S3 info on portfolio
        portfolio.profileImage = url;
        portfolio.profileImageKey = key;
        await portfolio.save();

        return res.status(200).json({
        message: "Profile image uploaded successfully",
        profileImage: url,
        profileImageKey: key,
        portfolio,
        });
    } catch (error) {
        console.error("Error uploading profile image:", error);
        return res.status(500).json({ message: "Error uploading profile image" });
    }
};

// Upload or update resume PDF for a portfolio
exports.uploadResume = async (req, res) => {
    try {
        const { id } = req.params;

        if (!req.file) {
        return res.status(400).json({ message: "No resume file uploaded" });
        }

        const portfolio = await Portfolio.findById(id);
        if (!portfolio) {
        return res.status(404).json({ message: "Portfolio not found" });
        }
        if (!callerCanEditPortfolio(portfolio, req.user)) {
        return res.status(403).json({ message: "Forbidden" });
        }

        // If an old resume exists, try to delete it
        if (portfolio.resumeKey) {
        try {
            await deleteFromS3(portfolio.resumeKey);
        } catch (err) {
            console.error("Error deleting old resume from S3:", err.message);
            // don't fail the whole request if delete fails
        }
        }

        // Upload new resume to S3 (into Ports/... with capital P)
        const { url, key } = await uploadToS3(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        `Ports/ProjectManager/${id}/resumes`
        );

        portfolio.resumeUrl = url;
        portfolio.resumeKey = key;
        await portfolio.save();

        return res.status(200).json({
        message: "Resume uploaded successfully",
        resumeUrl: url,
        resumeKey: key,
        portfolio,
        });
    } catch (error) {
        console.error("Error uploading resume:", error);
        return res.status(500).json({ message: "Error uploading resume" });
    }
};

