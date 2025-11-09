// const User = require("../user/tempUser.model");
const User = require("../../../models/User");
// const USER_KEY = "singleton_user_mvp";

exports.userUtils = {
  // async getOrCreateUser(userId) {
  //   //let user = await User.findOne({ userKey: USER_KEY }).lean();
  //   // if (!user) {
  //   //   user = await User.create({
  //   //     userKey: USER_KEY,
  //   //     email: "om@test.local",
  //   //     displayName: "Om",
  //   //     activeProjectId: "",
  //   //     projects: [],
  //   //   });
  //   // }
  //   let user = await User.findById(userId).lean();
  //   if (!user) {
  //     // Instead of creating, throw an error
  //     const err = new Error("User not found. Please create an account first.");
  //     err.statusCode = 400; // or 401 depending on your flow
  //     throw err;
  //   }
  //   // Return hydrated model next time
  //   // return User.findOne({ userKey: USER_KEY });
  //   return user;
  // },
  async getOrCreateUser(userId) {
    if (!userId) {
      const err = new Error("Authentication required");
      err.statusCode = 401;
      throw err;
    }

    const user = await User.findById(userId).lean();
    if (!user) {
      const err = new Error("User not found. Please create an account first.");
      err.statusCode = 404;
      throw err;
    }

    return user;
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
