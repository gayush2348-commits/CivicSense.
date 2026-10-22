import Complaint from "../models/Complaint.model.js";

export async function getComplaintAnalytics(req, res, next) {
  try {
    const [
      totalComplaints,
      statusStats,
      categoryStats,
      departmentStats,
      priorityStats,
    ] = await Promise.all([
      Complaint.countDocuments(),

      Complaint.aggregate([
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      Complaint.aggregate([
        {
          $group: {
            _id: "$category",
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ]),

      Complaint.aggregate([
        {
          $group: {
            _id: {
              $ifNull: ["$assignedDepartment", "Unassigned"],
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ]),

      Complaint.aggregate([
        {
          $group: {
            _id: {
              $switch: {
                branches: [
                  {
                    case: { $gte: ["$priorityScore", 70] },
                    then: "High",
                  },
                  {
                    case: { $gte: ["$priorityScore", 40] },
                    then: "Medium",
                  },
                ],
                default: "Low",
              },
            },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    return res.status(200).json({
      success: true,
      analytics: {
        totalComplaints,
        statusStats,
        categoryStats,
        departmentStats,
        priorityStats,
      },
    });
  } catch (error) {
    return next(error);
  }
}
