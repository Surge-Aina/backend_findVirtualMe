const User = require("../../../models/User");

exports.getPublicProjects = async () => {
  try {
    const projects = await User.aggregate([
      { $unwind: "$projects" },
      { $match: { "projects.isPublic": true } },
      { $project: { project: "$projects", _id: 0 } },
    ]);

    return projects;
  } catch (error) {
    console.error("Error fetching public projects:", error);
    throw new Error("Could not fetch public projects");
  }
};

exports.getPublicProjectsFromUser = async (userId) => {
  try {
    const user = await User.findById(userId).lean();
    if (!user) throw new Error("User not found");

    const publicProjects = (user.projects || []).filter((project) => project.isPublic);

    return publicProjects;
  } catch (error) {
    console.error(`Error fetching projects for user ${userId}:`, error);
    throw new Error("Could not fetch user's public projects");
  }
};

exports.togglePublicProjectStatus = async (user, projectId) => {
  try {
    if (!user) throw new Error("User not found");

    const project = user.projects.find((project) => project.projectId === projectId);
    if (!project) throw new Error("Project not found");
    project.isPublic = !project.isPublic;

    await user.save();

    return project;
  } catch (error) {
    console.error(
      `Error toggling public status on user ${userId} for project ${projectId}:`,
      error
    );
    throw new Error("Could not toggle public status");
  }
};
