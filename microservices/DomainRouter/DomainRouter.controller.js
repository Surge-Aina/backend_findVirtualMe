const DomainRoute = require("./DomainRouter.model");
const axios = require("axios");
const { createDomainMapping } = require("./DomainRouter.service");
const { normalizeDomain, getPortfolioMeta } = require("./utils/domainHelpers");
const  {addDomainToUser}  = require("../../services/domainService")
// ----------------- CREATE -----------------

// POST /api/domains
exports.createDomainRoute = async (req, res) => {
  try {
    const mapping = await createDomainMapping({
      domain: req.body.domain,
      portfolioId: req.body.portfolioId,
      notes: req.body.notes,
      user: req.user
    });

    res.status(201).json(mapping);
  } catch (err) {
    console.error("Create domain route error:", err);

    res.status(err.status || 500).json({
      message: err.message || "Server error"
    });
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
      const portfolio = user.portfolios.find((p) => p.portfolioId?.toString() === portfolioId.toString());
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

    // Sync with User.domains
    // Only call if domain exists
    if (route.domain) {
      const options = {
        type: "platform", 
        status: route.isActive ? "active" : "pending",
        dnsConfigured: false,
        registeredAt: route.createdAt,
      };

      await addDomainToUser(userId, route.domain, route.portfolioId, options);
    }

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

// exports.routingProxy = async (req, res) => {
  // try {
  //   const host =
  //     req.query.host?.toLowerCase() ||
  //     req.headers.host?.split(":")[0]?.toLowerCase();

  //   if (!host) {
  //     return res.status(400).send("Missing host");
  //   }

  //   const domain = host.replace(/^www\./, "");
  //   const path = "/" + (req.query.path || "").replace(/^\/+/, "");

  //   // 1. Look up the domain routing rules
  //   const route = await DomainRoute.findOne({
  //     domain,
  //     isActive: true
  //   }).lean();

  //   // 2. Determine the internal target path
  //   let targetPath;
  //   if (route) {
  //     targetPath = `/portfolios/${route.portfolioType}/${route.portfolioId}${path === "/" ? "" : path}`;
  //   } else {
  //     targetPath = path;
  //   }

  //   const frontend = process.env.FRONTEND_ORIGIN; 
    
  //   // If the request is for a page (no file extension), serve index.html
  //   // If it has an extension (.js, .css, .png), fetch the actual file.
  //   const hasExtension = /\.[a-z0-9]+$/i.test(path);
  //   const targetUrl = hasExtension 
  //     ? `${frontend}${targetPath}` 
  //     : `${frontend}/index.html`;

  //   console.log("ROUTING:", { domain, path, targetUrl });

  //   // 4. Proxy the request
  //   const response = await axios.get(targetUrl, {
  //     responseType: "stream",
  //     headers: {
  //       "user-agent": req.headers["user-agent"],
  //       "cookie": req.headers.cookie || "",
  //       // Pass the original host if your frontend logic needs it
  //       "x-forwarded-host": host 
  //     },
  //     // Prevent axios from throwing on 404s so you can pipe the 404 error instead
  //     validateStatus: () => true 
  //   });

  //   // 5. Pipe the response back to the browser
  //   res.status(response.status);
  //   res.set(response.headers);
  //   response.data.pipe(res);
  // } catch (err) {
  //   console.error("Routing proxy error:", err.message);
  //   res.status(500).send("Routing error");
  // }
// };

// ----------------- DOMAIN LOOKUP -----------------

exports.domainLookup = async (req, res) => { 
  try {
    const domain = req.query.domain?.toLowerCase().replace(/^www\./, '');
    
    const route = await DomainRoute.findOne({
      domain,
      isActive: true
    }).lean();

    if (route) {
      res.json({
        portfolioId: route.portfolioId,
        portfolioType: route.portfolioType
      });
    } else {
      res.status(404).json({ error: 'Domain not found' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Lookup failed' });
  }
};