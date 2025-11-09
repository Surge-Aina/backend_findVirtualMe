//const { userUtils } = require("../utils/aiPortfolioCreator.utils");

exports.getName = async (user) => {
  // const user = await userUtils.getOrCreateUser(userId);
  const proj = user.projects.find(
    (p) => p.projectId === user.activeProjectId && p.status !== "deleted"
  );
  return proj?.dataJson?.name || "";
};

exports.updateName = async (user, incomingName) => {
  // const user = await userUtils.getOrCreateUser(userId);
  const proj = user.projects.find(
    (p) => p.projectId === user.activeProjectId && p.status !== "deleted"
  );

  if (!proj) throw new Error("No active project");

  proj.dataJson.name = incomingName;
  proj.updatedAt = new Date();
  user.updatedAt = new Date();
  await user.save();

  return incomingName;
};
