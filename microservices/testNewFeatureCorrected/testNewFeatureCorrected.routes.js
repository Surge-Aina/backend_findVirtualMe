// testNewFeatureCorrected.routes.js
import express from "express";
import { getTestNewFeatureCorrected } from "./testNewFeatureCorrected.controller.js";

const router = express.Router();

router.get("/", getTestNewFeatureCorrected);

export default router;
