const req = require("express/lib/request");
const Portfolio = require("../../models/projectManager/portfolioModel");
const pdfParse = require("pdf-parse");
const { generatePortfolioJSON, generateMatchSummary } = require("../../services/openAiService");

exports.getPortfolioByEmail = async (req, res) => {
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
exports.getAllPortfoliosByEmail = async (req, res) => {
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

exports.getAllPortfolios = async (req, res) => {
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

exports.getPortfolioById = async (req, res) => {
  const id = req.params.id;
  console.log("id", id, typeof id);
  try {
    const portfolio = await Portfolio.findById(id);
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

exports.addPortfolio = async (req, res) => {
  const { portfolio } = req.body; //User object will be sent from the front end

  try {
    if (!portfolio) {
      return res.status(400).json({ message: "portfolio needed" });
    }

    const formattedPortfolio = {
      name: `${portfolio.firstName} ${portfolio.lastName}`,
      title: portfolio.industry,
      email: portfolio.email,
      phone: portfolio.phone,
      location: portfolio.location,
      summary: `Goal: ${portfolio.goal}\n
                      Skills: 
                      ${portfolio.skills.join("\n")}`,
    };

    const newPortfolio = new Portfolio(formattedPortfolio);
    await newPortfolio.save();
    res.status(201).json(newPortfolio);
  } catch (error) {
    console.error("error adding portfolio", error);
    res.status(500).json({ message: "error adding portfolio" });
  }
};

exports.addPDF = async (req, res) => {
  const email = req.body.email;
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
    const newPortfolio = new Portfolio(portfolioObj);
    await newPortfolio.save();
    res.status(201).json(newPortfolio);
  } catch (err) {
    console.error("Error parsing PDF:", err);
    res.status(500).json({ error: "Failed to parse PDF" });
  }
};

exports.editPortfolioByEmail = async (req, res) => {
  const email = req.user.email; //obtained from middleware
  const portfolio = req.body.portfolio;
  try {
    const updatedPortfolio = await Portfolio.findOneAndUpdate(
      { email: email },
      { $set: portfolio },
      { new: true } //return updated document
    );

    if (!updatedPortfolio) {
      res.status(404).json({ message: "item not found" });
      return;
    }
    res.json(updatedPortfolio);
  } catch (error) {
    console.log("could not edit item", error);
    res.status(500).json({ message: "could not edit item" });
  }
};

exports.deletePortfolioByEmail = async (req, res) => {
  const email = req.query.email;
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

exports.aiSummary = async (req, res) => {
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
