export type UserRole = 'admin' | 'member';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  organizationId: string;
  createdAt?: string;
}

export interface Organization {
  id: string;
  name: string;
  createdAt?: string;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
  organization: Organization;
}
