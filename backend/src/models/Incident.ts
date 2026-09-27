import { Schema, model, Document, Types } from 'mongoose';

export type IncidentStatus = 'detected' | 'investigating' | 'mitigated' | 'resolved';
export type IncidentSeverity = 'medium' | 'high';

export interface IIncidentEvent {
  status: IncidentStatus;
  timestamp: Date;
  triggeredBy: 'system' | Types.ObjectId;
}

export interface IIncident extends Document {
  _id: Types.ObjectId;
  apiId: Types.ObjectId;
  organizationId: Types.ObjectId;
  status: IncidentStatus;
  severity: IncidentSeverity;
  reason: string;
  detectedAt: Date;
  resolvedAt: Date | null;
  relatedIncidentIds: Types.ObjectId[];
  events: IIncidentEvent[];
}

const IncidentEventSchema = new Schema<IIncidentEvent>(
  {
    status: {
      type: String,
      enum: ['detected', 'investigating', 'mitigated', 'resolved'],
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    triggeredBy: {
      type: Schema.Types.Mixed,
      required: true,
      default: 'system',
    },
  },
  { _id: false },
);

const IncidentSchema = new Schema<IIncident>(
  {
    apiId: {
      type: Schema.Types.ObjectId,
      ref: 'Api',
      required: true,
      index: true,
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['detected', 'investigating', 'mitigated', 'resolved'],
      required: true,
      default: 'detected',
    },
    severity: {
      type: String,
      enum: ['medium', 'high'],
      required: true,
      default: 'medium',
    },
    reason: {
      type: String,
      required: true,
    },
    detectedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    relatedIncidentIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Incident',
      },
    ],
    events: [IncidentEventSchema],
  },
  {
    timestamps: false,
    versionKey: false,
  },
);

// Indexes specified in database.md §6
IncidentSchema.index({ organizationId: 1, status: 1 });
IncidentSchema.index({ apiId: 1, status: 1 });

export const Incident = model<IIncident>('Incident', IncidentSchema);
