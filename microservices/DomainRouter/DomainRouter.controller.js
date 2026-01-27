const DomainRoute = require("./DomainRouter.model");
const axios = require("axios");

// ----------------- Helpers -----------------

function normalizeDomain(domain) {
  return domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}

function getPortfolioMeta(user, portfolioId) {
  return user.portfolios.find(p =>
    p.portfolioId.equals(portfolioId)
  );
}

// ----------------- CREATE -----------------

// POST /api/domains
exports.createDomainRoute = async (req, res) => {
  try {
    const { domain, portfolioId, notes } = req.body;
    const user = req.user;
    const userId = user._id;

    if (!domain || !portfolioId) {
      return res.status(400).json({
        message: "Domain and portfolioId are required"
      });
    }

    const normalizedDomain = normalizeDomain(domain);

    // Verify portfolio ownership and extract routing fields
    const portfolio = getPortfolioMeta(user, portfolioId);

    if (!portfolio) {
      return res.status(403).json({
        message: "You do not own this portfolio"
      });
    }

    // Prevent duplicate domain
    const existing = await DomainRoute.findOne({
      domain: normalizedDomain
    });

    if (existing) {
      return res.status(409).json({
        message: "Domain already mapped"
      });
    }

    const mapping = await DomainRoute.create({
      domain: normalizedDomain,
      userId,
      portfolioId,
      portfolioType: portfolio.portfolioType,
      notes: notes || null,
      createdBy: userId,
      updatedBy: userId
    });

    res.status(201).json(mapping);
  } catch (err) {
    console.error("Create domain route error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ----------------- READ -----------------

// GET /api/domains
exports.getMyDomainRoutes = async (req, res) => {
  try {
    const userId = req.user._id;

    const routes = await DomainRoute.find({ userId })
      .sort({ createdAt: -1 })
      .lean();

    res.json(routes);
  } catch (err) {
    console.error("Get domain routes error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ----------------- UPDATE -----------------

// PATCH /api/domains/:id
exports.updateDomainRoute = async (req, res) => {
  try {
    const user = req.user;
    const userId = user._id;
    const { id } = req.params;
    const { domain, portfolioId, isActive, notes } = req.body;

    const route = await DomainRoute.findById(id);
    if (!route) {
      return res.status(404).json({
        message: "Mapping not found"
      });
    }

    // Ownership check
    if (!route.userId.equals(userId)) {
      return res.status(403).json({
        message: "Access denied"
      });
    }

    // Domain update with collision check
    if (domain) {
      const normalized = normalizeDomain(domain);

      const existing = await DomainRoute.findOne({
        domain: normalized,
        _id: { $ne: route._id }
      });

      if (existing) {
        return res.status(409).json({
          message: "Domain already mapped"
        });
      }

      route.domain = normalized;
    }

    // Portfolio update — verify ownership and refresh routing fields
    if (portfolioId) {
      const portfolio = getPortfolioMeta(user, portfolioId);

      if (!portfolio) {
        return res.status(403).json({
          message: "You do not own this portfolio"
        });
      }

      route.portfolioId = portfolioId;
      route.portfolioType = portfolio.portfolioType;
    }

    if (typeof isActive === "boolean") {
      route.isActive = isActive;
    }

    if (notes !== undefined) {
      route.notes = notes;
    }

    route.updatedBy = userId;
    await route.save();

    res.json(route);
  } catch (err) {
    console.error("Update domain route error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ----------------- DELETE -----------------

// DELETE /api/domains/:id
exports.deleteDomainRoute = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const route = await DomainRoute.findById(id);
    if (!route) {
      return res.status(404).json({
        message: "Mapping not found"
      });
    }

    // Ownership check
    if (!route.userId.equals(userId)) {
      return res.status(403).json({
        message: "Access denied"
      });
    }

    await route.deleteOne();
    res.json({
      message: "Mapping deleted"
    });
  } catch (err) {
    console.error("Delete domain route error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

const BYPASS_PREFIXES = [
  "/@",
  "/vite",
  "/src",
  "/assets",
  "/favicon",
  "/node_modules",
  "/__inspect",
  "/manifest.json"
];

function shouldBypass(path) {
  // Catch the prefixes
  const isPrefix = BYPASS_PREFIXES.some(prefix => path.startsWith(prefix));
  // Catch common file extensions just in case
  const isFile = /\.(js|css|png|jpg|jpeg|svg|gif|ico|woff|woff2)$/i.test(path);
  
  return isPrefix || isFile;
}

exports.routingProxy = async (req, res) => {
  try {
    // ----------------- PATH -----------------
    let rawPath = req.query.path || "";
    if (!rawPath.startsWith("/")) rawPath = "/" + rawPath;

    // ----------------- BYPASS DEV FILES -----------------
    if (shouldBypass(rawPath)) {
      const frontend = process.env.FRONTEND_ORIGIN;
      const targetUrl = `${frontend}${rawPath}`;
      
      // Use the same proxy logic here as you do for the portfolio
      const response = await axios.get(targetUrl, {
        responseType: "stream",
      });

      res.set("Content-Type", response.headers["content-type"]); // Crucial for JS files!
      return response.data.pipe(res);
    }

    // ----------------- DETERMINE HOST -----------------
    const host =
      req.query.host?.toLowerCase() ||
      req.headers.host?.split(":")[0]?.toLowerCase();

    if (!host) {
      return res.status(400).send("Missing host");
    }

    const domain = host.replace(/^www\./, "");

    // ----------------- FIND DOMAIN ROUTE -----------------
    const route = await DomainRoute.findOne({
      domain,
      isActive: true
    }).lean();

    // ----------------- BUILD TARGET PATH -----------------
    let targetPath;

    if (route) {
      targetPath = `/portfolios/${route.portfolioType}/something/${route.portfolioId}${rawPath !== "/" ? rawPath : ""}`;
    } else {
      // fallback to normal path
      targetPath = rawPath;
    }

    // ----------------- FRONTEND URL -----------------
    const frontend = process.env.FRONTEND_ORIGIN || "http://localhost:5173";
    const targetUrl = `${frontend}${targetPath}`;

    // ----------------- PROXY REQUEST -----------------
    const response = await axios.get(targetUrl, {
      responseType: "stream",
      headers: {
        "user-agent": req.headers["user-agent"],
        // Optional: forward cookies if needed
        cookie: req.headers.cookie || "",
      },
    });

    // ----------------- STREAM RESPONSE -----------------
    res.set(response.headers);
    response.data.pipe(res);

  } catch (err) {
    console.error("Routing proxy error:", err.message);
    res.status(500).send("Routing error");
  }
};

