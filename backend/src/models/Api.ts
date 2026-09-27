import { Schema, model, Document, Types } from 'mongoose';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';
export type ApiStatus = 'ok' | 'warn' | 'critical' | 'unknown';
export type AllowedIntervalSeconds = 60 | 300 | 900;

export interface IApi extends Document {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  name: string;
  method: HttpMethod;
  url: string;
  expectedStatus: number;
  headers?: Record<string, string>;
  checkIntervalSeconds: AllowedIntervalSeconds;
  enabled: boolean;
  currentStatus: ApiStatus;
  createdAt: Date;
  updatedAt: Date;
}

const ApiSchema = new Schema<IApi>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    method: {
      type: String,
      enum: ['GET', 'POST', 'PUT', 'DELETE'],
      required: true,
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
    expectedStatus: {
      type: Number,
      required: true,
      default: 200,
    },
    headers: {
      type: Schema.Types.Mixed,
      default: {},
    },
    checkIntervalSeconds: {
      type: Number,
      enum: [60, 300, 900],
      required: true,
      default: 60,
    },
    enabled: {
      type: Boolean,
      required: true,
      default: true,
    },
    currentStatus: {
      type: String,
      enum: ['ok', 'warn', 'critical', 'unknown'],
      required: true,
      default: 'unknown',
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// Compound index specified in database.md §4
ApiSchema.index({ organizationId: 1, enabled: 1 });

export const Api = model<IApi>('Api', ApiSchema);
