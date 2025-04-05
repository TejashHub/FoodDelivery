import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema({
  action: {
    type: String,
    required: true,
    enum: ["USER_CREATED", "USER_UPDATED", "USER_DELETED", "ROLE_CHANGED"],
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  targetUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  previousState: mongoose.Schema.Types.Mixed,
  newState: mongoose.Schema.Types.Mixed,
  timestamp: {
    type: Date,
    default: Date.now,
  },
  ipAddress: String,
  userAgent: String,
});

const AuditLog = mongoose.model("AuditLog", auditLogSchema);

export default AuditLog;
