import { AuthService } from '../src/modules/auth/auth.service.js';
import { User } from '../src/models/User.js';
import { Organization } from '../src/models/Organization.js';
import bcrypt from 'bcryptjs';

jest.mock('../src/models/User.js');
jest.mock('../src/models/Organization.js');
jest.mock('bcryptjs');

describe('AuthService Unit Tests', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService();
    jest.clearAllMocks();
  });

  describe('signup', () => {
    it('should throw ValidationError if password is too short', async () => {
      await expect(
        authService.signup({
          email: 'short@acme.com',
          password: '123',
          orgName: 'Acme',
        }),
      ).rejects.toThrow('Password must be at least 6 characters');
    });

    it('should throw ConflictError if user email already exists', async () => {
      (User.findOne as jest.Mock).mockResolvedValue({ id: 'existing-id' });

      await expect(
        authService.signup({
          email: 'existing@acme.com',
          password: 'password123',
          orgName: 'Acme',
        }),
      ).rejects.toThrow('User with this email already exists');
    });
  });

  describe('login', () => {
    it('should throw UnauthorizedError if user is not found', async () => {
      (User.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        authService.login({
          email: 'notfound@acme.com',
          password: 'password123',
        }),
      ).rejects.toThrow('Invalid email or password');
    });

    it('should throw UnauthorizedError if password does not match', async () => {
      (User.findOne as jest.Mock).mockResolvedValue({
        _id: 'user-id',
        email: 'user@acme.com',
        passwordHash: 'hashedpassword',
        organizationId: 'org-id',
        role: 'admin',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        authService.login({
          email: 'user@acme.com',
          password: 'wrongpassword',
        }),
      ).rejects.toThrow('Invalid email or password');
    });

    it('should return user, org, access token and refresh token on valid credentials', async () => {
      const mockUser = {
        _id: { toString: () => 'user-id' },
        email: 'user@acme.com',
        passwordHash: 'hashedpassword',
        organizationId: { toString: () => 'org-id' },
        role: 'admin',
      };
      const mockOrg = {
        _id: { toString: () => 'org-id' },
        name: 'Acme Corp',
      };

      (User.findOne as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (Organization.findById as jest.Mock).mockResolvedValue(mockOrg);

      const result = await authService.login({
        email: 'user@acme.com',
        password: 'password123',
      });

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user).toBe(mockUser);
      expect(result.org).toBe(mockOrg);
    });
  });
});
