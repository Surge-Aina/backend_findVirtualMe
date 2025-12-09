// findUserPortfolios.routes.js
import express from "express";
import { getFindUserPortfolios } from "./findUserPortfolios.controller.js";

const router = express.Router();

router.get("/", getFindUserPortfolios);

export default router;
