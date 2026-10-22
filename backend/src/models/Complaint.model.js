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

const COMPLAINT_STATUSES = [
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

const duplicateCandidateSchema = new mongoose.Schema(
  {
    complaintId: {
      type: String,
      required: true,
    },
    similarity: {
      type: Number,
      min: 0,
      max: 1,
      default: 0,
    },
    distanceMeters: {
      type: Number,
      min: 0,
      default: null,
    },
    reason: {
      type: String,
      default: "",
    },
  },
  { _id: false },
);

const clusterSchema = new mongoose.Schema(
  {
    clusterId: {
      type: Number,
      default: null,
    },
    clusterSize: {
      type: Number,
      min: 1,
      default: 1,
    },
    isHotspot: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false },
);

const auditTrailSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
    },
    actor: {
      type: String,
      default: "system",
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    details: {
      type: String,
      default: "",
    },
  },
  { _id: false },
);

const complaintSchema = new mongoose.Schema(
  {
    // User who submitted the complaint.
    // Keep optional temporarily for compatibility with old records.
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    description: {
      type: String,
      required: [true, "Complaint description is required"],
      trim: true,
      maxlength: [5000, "Description cannot exceed 5000 characters"],
    },

    category: {
      type: String,
      enum: CATEGORIES,
      default: "Other",
    },

    imageUrl: {
      type: String,
      default: null,
    },

    location: {
      latitude: {
        type: Number,
        default: null,
        min: -90,
        max: 90,
      },
      longitude: {
        type: Number,
        default: null,
        min: -180,
        max: 180,
      },
      address: {
        type: String,
        trim: true,
        default: "",
      },
    },

    status: {
      type: String,
      enum: COMPLAINT_STATUSES,
      default: "Pending",
    },

    predictedCategory: {
      type: String,
      enum: [...CATEGORIES, null],
      default: null,
    },

    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: null,
    },

    priorityScore: {
      type: Number,
      min: 0,
      max: 100,
      validate: {
        validator: Number.isInteger,
        message: "Priority score must be an integer",
      },
      default: 0,
    },

    priorityReasons: {
      type: [String],
      default: [],
    },

    recommendedDepartment: {
      type: String,
      enum: DEPARTMENTS,
      default: "Public Works",
    },

    assignedDepartment: {
      type: String,
      enum: [...DEPARTMENTS, null],
      default: null,
    },

    duplicateCandidates: {
      type: [duplicateCandidateSchema],
      default: [],
    },

    cluster: {
      type: clusterSchema,
      default: () => ({}),
    },

    auditTrail: {
      type: [auditTrailSchema],
      default: [],
    },
  },
  {
    timestamps: {
      createdAt: true,
      updatedAt: false,
    },
    versionKey: false,
  },
);

const Complaint = mongoose.model("Complaint", complaintSchema);

export default Complaint;
