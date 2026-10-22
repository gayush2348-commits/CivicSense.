import Complaint from "../models/Complaint.model.js";
import { uploadImageToCloudinary } from "../service/cloudinary.service.js";
import { analyzeComplaint } from "../service/ml.service.js";
import mongoose from "mongoose";

const CATEGORIES = [
  "Electrical Hazard",
  "Garbage",
  "Road Damage",
  "Water Leakage",
  "Streetlight",
  "Fire Hazard",
  "Other",
];

const STATUSES = [
  "Pending",
  "Under Review",
  "Assigned",
  "In Progress",
  "Resolved",
  "Rejected",
];

const DEPARTMENTS = [
  "Electrical",
  "Sanitation",
  "Roads",
  "Water Supply",
  "Fire and Safety",
  "Public Works",
];

function parseCoordinate(value, name, min, max) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const number = Number(value);

  if (!Number.isFinite(number) || number < min || number > max) {
    const error = new Error(`${name} must be between ${min} and ${max}`);
    error.statusCode = 400;
    throw error;
  }

  return number;
}

function validConfidence(value) {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1
  );
}

function validPriority(value) {
  return Number.isInteger(value) && value >= 0 && value <= 100;
}

function isAdmin(req) {
  return req.user?.role === "admin";
}

function actorName(req) {
  return req.user?.email || String(req.user?._id || "system");
}

// CREATE COMPLAINT — authenticated citizens and admins
export async function createComplaint(req, res, next) {
  let complaint;

  try {
    if (!req.user?._id) {
      return res.status(401).json({
        success: false,
        message: "Please log in to submit a complaint",
      });
    }

    const description =
      typeof req.body.description === "string"
        ? req.body.description.trim()
        : "";

    if (!description) {
      return res.status(400).json({
        success: false,
        message: "Complaint description is required",
      });
    }

    if (description.length > 5000) {
      return res.status(400).json({
        success: false,
        message: "Description cannot exceed 5000 characters",
      });
    }

    const category =
      typeof req.body.category === "string" && req.body.category.trim()
        ? req.body.category.trim()
        : null;

    if (category && !CATEGORIES.includes(category)) {
      return res.status(400).json({
        success: false,
        message: "Invalid complaint category",
        allowedCategories: CATEGORIES,
      });
    }

    const latitude = parseCoordinate(req.body.latitude, "latitude", -90, 90);
    const longitude = parseCoordinate(
      req.body.longitude,
      "longitude",
      -180,
      180,
    );

    const address =
      typeof req.body.address === "string" ? req.body.address.trim() : "";

    let imageUrl = null;

    if (req.file) {
      imageUrl = await uploadImageToCloudinary(req.file);
    }

    // Save the authenticated user's ID as the complaint owner.
    complaint = await Complaint.create({
      user: req.user._id,
      description,
      category: category || "Other",
      imageUrl,
      location: {
        latitude,
        longitude,
        address,
      },
      status: "Pending",
      auditTrail: [
        {
          action: "COMPLAINT_CREATED",
          actor: actorName(req),
          details: "Complaint received and saved",
        },
      ],
    });

    try {
      const analysis = await analyzeComplaint({
        description: complaint.description,
        category,
        latitude: complaint.location.latitude,
        longitude: complaint.location.longitude,
        createdAt: complaint.createdAt.toISOString(),
        relatedReports: [],
      });

      const predictedCategory = CATEGORIES.includes(analysis.predictedCategory)
        ? analysis.predictedCategory
        : null;

      complaint.predictedCategory = predictedCategory;

      if (validConfidence(analysis.confidence)) {
        complaint.confidence = analysis.confidence;
      }

      if (validPriority(analysis.priorityScore)) {
        complaint.priorityScore = analysis.priorityScore;
      }

      if (Array.isArray(analysis.priorityReasons)) {
        complaint.priorityReasons = analysis.priorityReasons.filter(
          (reason) => typeof reason === "string",
        );
      }

      if (DEPARTMENTS.includes(analysis.recommendedDepartment)) {
        complaint.recommendedDepartment = analysis.recommendedDepartment;
      }

      if (!category && predictedCategory) {
        complaint.category = predictedCategory;
      }

      if (Array.isArray(analysis.duplicateCandidates)) {
        complaint.duplicateCandidates = analysis.duplicateCandidates
          .filter(
            (item) =>
              item &&
              typeof item.complaintId === "string" &&
              validConfidence(item.similarity) &&
              (item.distanceMeters === null ||
                (typeof item.distanceMeters === "number" &&
                  Number.isFinite(item.distanceMeters) &&
                  item.distanceMeters >= 0)),
          )
          .map((item) => ({
            complaintId: item.complaintId,
            similarity: item.similarity,
            distanceMeters: item.distanceMeters ?? null,
            reason: typeof item.reason === "string" ? item.reason : "",
          }));
      }

      if (analysis.cluster && typeof analysis.cluster === "object") {
        const clusterId =
          Number.isInteger(analysis.cluster.clusterId) &&
          analysis.cluster.clusterId >= 0
            ? analysis.cluster.clusterId
            : null;

        const clusterSize =
          Number.isInteger(analysis.cluster.clusterSize) &&
          analysis.cluster.clusterSize >= 1
            ? analysis.cluster.clusterSize
            : 1;

        complaint.cluster = {
          clusterId,
          clusterSize,
          isHotspot: analysis.cluster.isHotspot === true,
        };
      }

      complaint.auditTrail.push({
        action: "ML_ANALYSIS_COMPLETED",
        actor: "system",
        details: "ML analysis response processed",
      });

      await complaint.save();
    } catch (mlError) {
      complaint.auditTrail.push({
        action: "ML_ANALYSIS_FALLBACK",
        actor: "system",
        details:
          "ML analysis unavailable; complaint saved without full analysis",
      });

      await complaint.save();

      console.error("ML analysis failed:", mlError.message);
    }

    return res.status(201).json({
      success: true,
      message: "Complaint created successfully",
      complaint,
    });
  } catch (error) {
    return next(error);
  }
}

// LIST COMPLAINTS — citizens see their own; admins see all
export async function getAllComplaints(req, res, next) {
  try {
    if (!req.user?._id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const { category, status, page = "1", limit = "20" } = req.query;

    if (category && !CATEGORIES.includes(category)) {
      return res.status(400).json({
        success: false,
        message: "Invalid complaint category",
        allowedCategories: CATEGORIES,
      });
    }

    if (status && !STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid complaint status",
        allowedStatuses: STATUSES,
      });
    }

    if (!/^[1-9]\d*$/.test(String(page)) || !/^[1-9]\d*$/.test(String(limit))) {
      return res.status(400).json({
        success: false,
        message: "Page and limit must be positive integers",
      });
    }

    const pageNumber = Number(page);
    const pageSize = Number(limit);

    if (
      !Number.isSafeInteger(pageNumber) ||
      !Number.isSafeInteger(pageSize) ||
      pageSize > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Page must be valid and limit cannot exceed 100",
      });
    }

    const filter = {};

    if (category) filter.category = category;
    if (status) filter.status = status;

    // Never trust a user ID supplied through query parameters.
    if (!isAdmin(req)) {
      filter.user = req.user._id;
    }

    const [complaints, total] = await Promise.all([
      Complaint.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((pageNumber - 1) * pageSize)
        .limit(pageSize)
        .lean(),

      Complaint.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      count: complaints.length,
      pagination: {
        page: pageNumber,
        limit: pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
      complaints,
    });
  } catch (error) {
    return next(error);
  }
}

// GET ONE COMPLAINT — owner or admin only
export async function getComplaintById(req, res, next) {
  try {
    const { id } = req.params;

    if (!req.user?._id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid complaint ID",
      });
    }

    const complaint = await Complaint.findById(id).lean();

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: "Complaint not found",
      });
    }

    const isOwner =
      complaint.user && String(complaint.user) === String(req.user._id);

    // Return 404 for another user's complaint to avoid exposing its existence.
    if (!isAdmin(req) && !isOwner) {
      return res.status(404).json({
        success: false,
        message: "Complaint not found",
      });
    }

    return res.status(200).json({
      success: true,
      complaint,
    });
  } catch (error) {
    return next(error);
  }
}

// UPDATE STATUS — admin only
export async function updateComplaintStatus(req, res, next) {
  try {
    if (!req.user?._id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!isAdmin(req)) {
      return res.status(403).json({
        success: false,
        message: "Only admins can update complaint status",
      });
    }

    const { id } = req.params;
    const { status } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid complaint ID",
      });
    }

    if (typeof status !== "string" || !STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid complaint status",
        allowedStatuses: STATUSES,
      });
    }

    const complaint = await Complaint.findById(id);

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: "Complaint not found",
      });
    }

    const previousStatus = complaint.status;
    complaint.status = status;

    complaint.auditTrail.push({
      action: "STATUS_UPDATED",
      actor: actorName(req),
      details: `Status changed from ${previousStatus} to ${status}`,
    });

    await complaint.save();

    return res.status(200).json({
      success: true,
      message: "Complaint status updated successfully",
      complaint,
    });
  } catch (error) {
    return next(error);
  }
}

// ASSIGN DEPARTMENT — admin only
export async function updateComplaintAssignment(req, res, next) {
  try {
    if (!req.user?._id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!isAdmin(req)) {
      return res.status(403).json({
        success: false,
        message: "Only admins can assign departments",
      });
    }

    const { id } = req.params;
    const { assignedDepartment } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid complaint ID",
      });
    }

    if (
      typeof assignedDepartment !== "string" ||
      !DEPARTMENTS.includes(assignedDepartment)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid department",
        allowedDepartments: DEPARTMENTS,
      });
    }

    const complaint = await Complaint.findById(id);

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: "Complaint not found",
      });
    }

    complaint.assignedDepartment = assignedDepartment;

    complaint.auditTrail.push({
      action: "DEPARTMENT_ASSIGNED",
      actor: actorName(req),
      details: `Complaint assigned to ${assignedDepartment}`,
    });

    await complaint.save();

    return res.status(200).json({
      success: true,
      message: "Department assigned successfully",
      complaint,
    });
  } catch (error) {
    return next(error);
  }
}
