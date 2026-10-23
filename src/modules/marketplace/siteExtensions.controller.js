const { sendError } = require("../public-api/errors");
const {
  ExtensionsError,
  listCustomFields,
  createCustomField,
  deleteCustomField,
  listWorkflowActions,
  createWorkflowAction,
  executeWorkflowAction,
  listWorkflowTriggers,
  createWorkflowTrigger,
  fireWorkflowTrigger,
} = require("./siteExtensions.service");

function handle(res, err) {
  if (err instanceof ExtensionsError) {
    return sendError(res, err.status, err.code, err.message, err.details);
  }
  console.error("site_extension_error");
  return sendError(res, 500, "internal_error", "Internal server error");
}

exports.listFields = async (req, res) => {
  try {
    const data = await listCustomFields(req, req.params.id);
    return res.json({ data });
  } catch (err) {
    return handle(res, err);
  }
};

exports.createField = async (req, res) => {
  try {
    const data = await createCustomField(req, req.params.id, req.body);
    return res.status(201).json({ data });
  } catch (err) {
    return handle(res, err);
  }
};

exports.deleteField = async (req, res) => {
  try {
    const data = await deleteCustomField(req, req.params.id, req.params.fieldId);
    return res.json({ data });
  } catch (err) {
    return handle(res, err);
  }
};

exports.listActions = async (req, res) => {
  try {
    const data = await listWorkflowActions(req, req.params.id);
    return res.json({ data });
  } catch (err) {
    return handle(res, err);
  }
};

exports.createAction = async (req, res) => {
  try {
    const result = await createWorkflowAction(req, req.params.id, req.body);
    return res.status(201).json({
      data: result.action,
      signingSecret: result.signingSecret,
      note: "Store this signing secret now. It cannot be retrieved again.",
    });
  } catch (err) {
    return handle(res, err);
  }
};

exports.executeAction = async (req, res) => {
  try {
    const data = await executeWorkflowAction(req, req.params.id, req.params.key, req.body);
    return res.json({ data });
  } catch (err) {
    return handle(res, err);
  }
};

exports.listTriggers = async (req, res) => {
  try {
    const data = await listWorkflowTriggers(req, req.params.id);
    return res.json({ data });
  } catch (err) {
    return handle(res, err);
  }
};

exports.createTrigger = async (req, res) => {
  try {
    const data = await createWorkflowTrigger(req, req.params.id, req.body);
    return res.status(201).json({ data });
  } catch (err) {
    return handle(res, err);
  }
};

exports.fireTrigger = async (req, res) => {
  try {
    const data = await fireWorkflowTrigger(req, req.params.id, req.params.key, req.body);
    return res.status(202).json({ data });
  } catch (err) {
    return handle(res, err);
  }
};
