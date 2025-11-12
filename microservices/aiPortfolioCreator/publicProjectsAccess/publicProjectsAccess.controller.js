const pubProjServ = require("./publicProjectsAccess.service");

exports.getPublicProjects = async (req, res) => {
  try {
    const projects = await pubProjServ.getPublicProjects();
    res.json({ ok: true, projects });
  } catch (error) {
    console.error("Error in getPublicProjects:", error);
    res.status(500).json({ ok: false, error: error.message });
  }
};

exports.getPublicProjectsFromUser = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ ok: false, error: "Missing userId parameter" });
    }

    const projects = await pubProjServ.getPublicProjectsFromUser(userId);
    res.json({ ok: true, projects });
  } catch (error) {
    console.error(
      `Error in getPublicProjectsFromUser for user ${req.params.userId}:`,
      error
    );
    res.status(500).json({ ok: false, error: error.message });
  }
};

exports.togglePublicStatus = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { projectId } = req.params; // or req.body depending on your route

    if (!userId || !projectId) {
      return res.status(400).json({ ok: false, error: "Missing userId or projectId" });
    }

    const updatedProject = await pubProjServ.togglePublicProjectStatus(userId, projectId);
    res.json({ ok: true, project: updatedProject });
  } catch (error) {
    console.error(
      `Error in togglePublicStatus for user ${req.user?._id} and project ${req.params.projectId}:`,
      error
    );
    res.status(500).json({ ok: false, error: error.message });
  }
};
