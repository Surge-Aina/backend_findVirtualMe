const nameService = require("./name.service");

exports.getName = async(req, res) => {
    try {
        const name = await nameService.getName(req.user);
        res.json({ name });
    } catch (err) {
        console.error("Get name error:", err);
        res.status(500).json({ ok: false, error: err.message || "Internal Server Error" });
    }
};

exports.updateName = async(req, res) => {
    try {
        const incomingName = (req.body && req.body.name) || "";
        const name = await nameService.updateName(req.user, incomingName);
        res.json({ name });
    } catch (err) {
        console.error("Update name error:", err);
        if (err.message === "No active project") {
            return res.status(404).json({ ok: false, error: err.message });
        }
        res.status(500).json({ ok: false, error: err.message || "Internal Server Error" });
    }
};