import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from '../../models/User.js';
import { Organization } from '../../models/Organization.js';
import { SignupDto, LoginDto } from '../../types/auth.js';
import { ValidationError, ConflictError, UnauthorizedError, NotFoundError } from '../../middleware/errorHandler.js';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from './jwt.utils.js';

export class AuthService {
  /**
   * Signup creates a User (admin) + Organization together atomically.
   */
  async signup(dto: SignupDto) {
    this.validateSignupDto(dto);

    const existingUser = await User.findOne({ email: dto.email.toLowerCase() });
    if (existingUser) {
      throw new ConflictError('User with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const { user, org } = await this.createOrgAndUserTransaction(dto.orgName, dto.email.toLowerCase(), passwordHash);

    const accessToken = generateAccessToken(user._id.toString(), org._id.toString(), user.role);
    const refreshToken = generateRefreshToken(user._id.toString());

    return { user, org, accessToken, refreshToken };
  }

  /**
   * Helper for atomic Org + User creation with Mongoose transaction support.
   */
  private async createOrgAndUserTransaction(orgName: string, email: string, passwordHash: string) {
    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      const org = new Organization({ name: orgName });
      await org.save({ session });

      const user = new User({
        email,
        passwordHash,
        organizationId: org._id,
        role: 'admin',
      });
      await user.save({ session });

      await session.commitTransaction();
      return { user, org };
    } catch (err: unknown) {
      await session.abortTransaction();
      // Fallback for standalone MongoDB environments without replica set enabled
      if (err instanceof Error && err.message.includes('replica set')) {
        return this.createOrgAndUserFallback(orgName, email, passwordHash);
      }
      throw err;
    } finally {
      session.endSession();
    }
  }

  /**
   * Fallback creation for single-node MongoDB without replica set.
   */
  private async createOrgAndUserFallback(orgName: string, email: string, passwordHash: string) {
    const org = await Organization.create({ name: orgName });
    try {
      const user = await User.create({
        email,
        passwordHash,
        organizationId: org._id,
        role: 'admin',
      });
      return { user, org };
    } catch (err) {
      await Organization.findByIdAndDelete(org._id);
      throw err;
    }
  }

  /**
   * Authenticate user credentials and issue tokens.
   */
  async login(dto: LoginDto) {
    this.validateLoginDto(dto);

    const user = await User.findOne({ email: dto.email.toLowerCase() });
    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const org = await Organization.findById(user.organizationId);
    if (!org) {
      throw new NotFoundError('Organization not found');
    }

    const accessToken = generateAccessToken(user._id.toString(), org._id.toString(), user.role);
    const refreshToken = generateRefreshToken(user._id.toString());

    return { user, org, accessToken, refreshToken };
  }

  /**
   * Issue new access token using valid refresh token.
   */
  async refresh(refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedError('Refresh token cookie missing');
    }

    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch (_err) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    const user = await User.findById(payload.userId);
    if (!user) {
      throw new UnauthorizedError('User no longer exists');
    }

    const accessToken = generateAccessToken(user._id.toString(), user.organizationId.toString(), user.role);
    return { accessToken };
  }

  /**
   * Retrieve current user and organization details for session restoration.
   */
  async getMe(userId: string) {
    const user = await User.findById(userId).select('-passwordHash');
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const org = await Organization.findById(user.organizationId);
    if (!org) {
      throw new NotFoundError('Organization not found');
    }

    return {
      user: {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
        organizationId: user.organizationId.toString(),
        createdAt: user.createdAt.toISOString(),
      },
      organization: {
        id: org._id.toString(),
        name: org.name,
        createdAt: org.createdAt.toISOString(),
      },
    };
  }

  private validateSignupDto(dto: SignupDto) {
    if (!dto.email || !dto.password || !dto.orgName) {
      throw new ValidationError('Email, password, and orgName are required');
    }
    if (dto.password.length < 6) {
      throw new ValidationError('Password must be at least 6 characters');
    }
  }

  private validateLoginDto(dto: LoginDto) {
    if (!dto.email || !dto.password) {
      throw new ValidationError('Email and password are required');
    }
  }
}
