import { Schema, model, Document, Types } from 'mongoose';

export type CheckErrorType = 'network' | 'timeout' | null;

export interface ICheck extends Document {
  _id: Types.ObjectId;
  apiId: Types.ObjectId;
  organizationId: Types.ObjectId;
  scheduledTime: Date;
  executedAt: Date;
  statusCode: number | null;
  passed: boolean;
  latencyMs: number | null;
  errorType: CheckErrorType;
  contractViolation: boolean;
}

const CheckSchema = new Schema<ICheck>(
  {
    apiId: {
      type: Schema.Types.ObjectId,
      ref: 'Api',
      required: true,
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
    },
    scheduledTime: {
      type: Date,
      required: true,
    },
    executedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    statusCode: {
      type: Number,
      default: null,
    },
    passed: {
      type: Boolean,
      required: true,
    },
    latencyMs: {
      type: Number,
      default: null,
    },
    errorType: {
      type: String,
      enum: ['network', 'timeout', null],
      default: null,
    },
    contractViolation: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: false,
    versionKey: false,
  },
);

// Indexes specified in database.md §5
CheckSchema.index({ apiId: 1, executedAt: -1 });
// Compound UNIQUE index for idempotency enforcement (apiId + scheduledTime)
CheckSchema.index({ apiId: 1, scheduledTime: 1 }, { unique: true });

export const Check = model<ICheck>('Check', CheckSchema);
