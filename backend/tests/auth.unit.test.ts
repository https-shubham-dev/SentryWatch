import { AuthService } from '../src/modules/auth/auth.service.js';
import { User } from '../src/models/User.js';
import { Organization } from '../src/models/Organization.js';
import bcrypt from 'bcryptjs';
import * as loginLockout from '../src/modules/auth/loginLockout.js';
import { TooManyRequestsError } from '../src/middleware/errorHandler.js';

jest.mock('../src/models/User.js');
jest.mock('../src/models/Organization.js');
jest.mock('bcryptjs');
jest.mock('../src/modules/auth/loginLockout.js');

describe('AuthService Unit Tests', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService();
    jest.clearAllMocks();
    (loginLockout.assertNotLocked as jest.Mock).mockResolvedValue(undefined);
    (loginLockout.recordFailedLogin as jest.Mock).mockResolvedValue(undefined);
    (loginLockout.clearLoginFailures as jest.Mock).mockResolvedValue(undefined);
  });

  describe('signup', () => {
    it('should throw ValidationError if password is too short', async () => {
      await expect(
        authService.signup({
          email: 'short@acme.com',
          password: 'Ab1',
          orgName: 'Acme',
        }),
      ).rejects.toThrow('Password must be at least 8 characters and include a letter and a number');
    });

    it('should throw ValidationError if password has no letter', async () => {
      await expect(
        authService.signup({
          email: 'nums@acme.com',
          password: '12345678',
          orgName: 'Acme',
        }),
      ).rejects.toThrow('Password must be at least 8 characters and include a letter and a number');
    });

    it('should throw ValidationError if password has no number', async () => {
      await expect(
        authService.signup({
          email: 'letters@acme.com',
          password: 'abcdefgh',
          orgName: 'Acme',
        }),
      ).rejects.toThrow('Password must be at least 8 characters and include a letter and a number');
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

      expect(loginLockout.recordFailedLogin).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedError and record failure if password does not match', async () => {
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

      expect(loginLockout.recordFailedLogin).toHaveBeenCalledWith('user@acme.com');
    });

    it('should reject login when account is locked', async () => {
      (loginLockout.assertNotLocked as jest.Mock).mockRejectedValue(
        new TooManyRequestsError(
          'Account temporarily locked due to too many failed login attempts. Try again in 15 minutes.',
        ),
      );

      await expect(
        authService.login({
          email: 'user@acme.com',
          password: 'password123',
        }),
      ).rejects.toThrow('Account temporarily locked');

      expect(User.findOne).not.toHaveBeenCalled();
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
      expect(loginLockout.clearLoginFailures).toHaveBeenCalledWith('user@acme.com');
    });
  });
});
