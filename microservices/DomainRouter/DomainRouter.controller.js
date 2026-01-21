const DomainRoute = require("./DomainRouter.model");
const axios = require("axios");

// POST /api/domains
exports.createDomainRoute = async (req, res) => {
  try {
    const { domain, portfolioId, notes } = req.body;
    const user = req.user;
    const userId = user._id;

    if (!domain || !portfolioId) {
      return res.status(400).json({ message: "Domain and portfolioId are required" });
    }

    const normalizedDomain = domain.trim().toLowerCase();

    // Verify portfolio ownership
    const portfolio = user.portfolios.find(p =>
      p.portfolioId.equals(portfolioId)
    );

    if (!portfolio) {
      return res.status(403).json({ message: "You do not own this portfolio" });
    }

    // Prevent duplicate domain
    const existing = await DomainRoute.findOne({ domain: normalizedDomain });
    if (existing) {
      return res.status(409).json({ message: "Domain already mapped" });
    }

    const mapping = await DomainRoute.create({
      domain: normalizedDomain,
      userId, // REQUIRED
      portfolioId,
      notes: notes || null,
      createdBy: userId,
      updatedBy: userId,
    });

    res.status(201).json(mapping);
  } catch (err) {
    console.error("Create domain route error:", err);
    res.status(500).json({ message: "Server error" });
  }
};



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



// PATCH /api/domains/:id
exports.updateDomainRoute = async (req, res) => {
  try {
    const user = req.user;
    const userId = user._id;
    const { id } = req.params;
    const { domain, portfolioId, isActive, notes } = req.body;

    const route = await DomainRoute.findById(id);
    if (!route) {
      return res.status(404).json({ message: "Mapping not found" });
    }

    // Ownership check — must own this mapping
    if (!route.userId.equals(userId)) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Domain update with collision check
    if (domain) {
      const normalized = domain.trim().toLowerCase();

      const existing = await DomainRoute.findOne({
        domain: normalized,
        _id: { $ne: route._id }
      });

      if (existing) {
        return res.status(409).json({ message: "Domain already mapped" });
      }

      route.domain = normalized;
    }

    // Portfolio update — verify ownership only if changing
    if (portfolioId) {
      const portfolio = user.portfolios.find(p =>
        p.portfolioId.equals(portfolioId)
      );

      if (!portfolio) {
        return res.status(403).json({ message: "You do not own this portfolio" });
      }

      route.portfolioId = portfolioId;
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



// DELETE /api/domains/:id
exports.deleteDomainRoute = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const route = await DomainRoute.findById(id);
    if (!route) {
      return res.status(404).json({ message: "Mapping not found" });
    }

    // Ownership check
    if (!route.userId.equals(userId)) {
      return res.status(403).json({ message: "Access denied" });
    }

    await route.deleteOne();
    res.json({ message: "Mapping deleted" });
  } catch (err) {
    console.error("Delete domain route error:", err);
    res.status(500).json({ message: "Server error" });
  }
};


exports.routingProxy = async (req, res) => {
  try {
    const host = req.query.host?.toLowerCase();
    const path = req.query.path || "";

    if (!host) {
      return res.status(400).send("Missing host");
    }

    const domain = host.replace(/^www\./, "");

    const route = await DomainRoute.findOne({
      domain,
      isActive: true
    }).lean();

    let targetPath;

    if (route) {
      targetPath = `/portfolios/${route.portfolioType}/${route.portfolioSlug}${path ? "/" + path : ""}`;
    } else {
      // fallback to normal app behavior
      targetPath = `/${path}`;
    }

    const targetUrl = `https://www.findvirtual.me${targetPath}`;

    const response = await axios.get(targetUrl, {
      responseType: "stream",
      headers: {
        "user-agent": req.headers["user-agent"]
      }
    });

    res.set(response.headers);
    response.data.pipe(res);
  } catch (err) {
    console.error("Routing proxy error:", err.message);
    res.status(500).send("Routing error");
  }
};

