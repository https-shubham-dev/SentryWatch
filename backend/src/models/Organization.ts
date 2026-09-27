import { Schema, model, Document, Types } from 'mongoose';

export interface IOrganization extends Document {
  _id: Types.ObjectId;
  name: string;
  createdAt: Date;
}

const OrganizationSchema = new Schema<IOrganization>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
    versionKey: false,
  },
);

export const Organization = model<IOrganization>('Organization', OrganizationSchema);
