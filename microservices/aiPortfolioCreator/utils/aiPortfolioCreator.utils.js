const User = require("../tempUser.model");
const USER_KEY = "singleton_user_mvp";

exports.userUtils = {
  async getOrCreateUser() {
    let user = await User.findOne({ userKey: USER_KEY }).lean();
    if (!user) {
      user = await User.create({
        userKey: USER_KEY,
        email: "om@test.local",
        displayName: "Om",
        activeProjectId: "",
        projects: [],
      });
    }
    // Return hydrated model next time
    return User.findOne({ userKey: USER_KEY });
  },
};

exports.helpers = {
  projectToClient(p) {
    return {
      projectId: p.projectId,
      name: p.name,
      status: p.status,
      frontendJson: p.frontendJson,
      backendJson: p.backendJson,
      dataJson: p.dataJson,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  },

  nowIso() {
    return new Date().toISOString();
  },
  newProjectId() {
    return `proj_${Date.now()}`;
  },
  linesToTextFromObj(linesObj = {}) {
    return Object.keys(linesObj)
      .sort((a, b) => Number(a) - Number(b))
      .map((k) => linesObj[k] ?? "")
      .join("\n");
  },
};
