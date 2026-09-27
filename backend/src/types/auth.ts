import { UserRole } from '../models/User.js';

export interface JwtPayload {
  userId: string;
  organizationId: string;
  role: UserRole;
}

export interface RefreshTokenPayload {
  userId: string;
  type: 'refresh';
}

export interface AuthUserResponse {
  id: string;
  email: string;
  role: UserRole;
  organizationId: string;
  createdAt: string;
}

export interface OrganizationResponse {
  id: string;
  name: string;
  createdAt: string;
}

export interface SignupDto {
  email: string;
  password: string;
  orgName: string;
}

export interface LoginDto {
  email: string;
  password: string;
}
