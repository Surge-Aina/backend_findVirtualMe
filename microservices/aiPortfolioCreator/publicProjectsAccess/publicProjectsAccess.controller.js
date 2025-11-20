const pubProjServ = require("./publicProjectsAccess.service");

exports.getPublicProjects = async (req, res) => {
  try {
    const projects = await pubProjServ.getPublicProjects();
    res.json({ success: true, projects });
  } catch (error) {
    console.error("Error in getPublicProjects:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getPublicProjectsFromUser = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ success: false, error: "Missing userId parameter" });
    }

    const projects = await pubProjServ.getPublicProjectsFromUser(userId);
    res.json({ success: true, projects });
  } catch (error) {
    console.error(
      `Error in getPublicProjectsFromUser for user ${req.params.userId}:`,
      error
    );
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.togglePublicStatus = async (req, res) => {
  try {
    const { projectId } = req.params;

    if (!req.user || !projectId) {
      return res.status(400).json({ success: false, error: "Missing user or projectId" });
    }

    const updatedProject = await pubProjServ.togglePublicProjectStatus(
      req.user,
      projectId
    );
    res.json({ success: true, project: updatedProject });
  } catch (error) {
    console.error(
      `Error in togglePublicStatus for user ${req.user?._id} and project ${req.params.projectId}:`,
      error
    );
    res.status(500).json({ success: false, error: error.message });
  }
};
