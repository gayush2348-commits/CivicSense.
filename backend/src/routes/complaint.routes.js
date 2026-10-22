import { Router } from "express";
import {
  createComplaint,
  getAllComplaints,
  getComplaintById,
  updateComplaintStatus,
  updateComplaintAssignment,
} from "../controller/complaint.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { uploadComplaintImage } from "../middleware/upload.middleware.js";

const router = Router();

// All complaint endpoints require login.
router.use(protectRoute);

router.post("/", uploadComplaintImage.single("image"), createComplaint);

router.get("/", getAllComplaints);

router.get("/:id", getComplaintById);

// Controller also checks admin role.
router.patch("/:id/status", updateComplaintStatus);

router.patch("/:id/assignment", updateComplaintAssignment);

export default router;
