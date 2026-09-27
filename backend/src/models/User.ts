import { Schema, model, Document, Types } from 'mongoose';

export type UserRole = 'admin' | 'member';

export interface IUser extends Document {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  email: string;
  passwordHash: string;
  role: UserRole;
  createdAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ['admin', 'member'],
      required: true,
      default: 'member',
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

export const User = model<IUser>('User', UserSchema);
