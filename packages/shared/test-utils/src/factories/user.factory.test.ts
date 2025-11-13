/**
 * User Factory Tests
 */

import {
  createUser,
  createPartner,
  createAssociate,
  createParalegal,
  createUsers,
} from './user.factory';

describe('User Factory', () => {
  describe('createUser', () => {
    it('should create a valid User entity', () => {
      const user = createUser();

      expect(user).toMatchObject({
        id: expect.any(String),
        email: expect.any(String),
        firstName: expect.any(String),
        lastName: expect.any(String),
        role: expect.stringMatching(/^(Partner|Associate|Paralegal)$/),
        firmId: expect.any(String),
        azureAdId: expect.any(String),
        preferences: expect.any(Object),
        createdAt: expect.any(Date),
        lastActive: expect.any(Date),
      });
    });

    it('should generate valid email addresses', () => {
      const user = createUser();
      expect(user.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    });

    it('should accept overrides', () => {
      const customEmail = 'custom@example.com';
      const user = createUser({ email: customEmail, role: 'Partner' });

      expect(user.email).toBe(customEmail);
      expect(user.role).toBe('Partner');
    });

    it('should generate Romanian names with diacritics', () => {
      // Run multiple times to increase chance of getting Romanian names
      const users = Array.from({ length: 50 }, () => createUser());
      const hasRomanianChars = users.some(
        (user) =>
          /[ăâîșț]/i.test(user.firstName) || /[ăâîșț]/i.test(user.lastName)
      );

      expect(hasRomanianChars).toBe(true);
    });

    it('should have valid preferences object', () => {
      const user = createUser();

      expect(user.preferences).toHaveProperty('theme');
      expect(user.preferences).toHaveProperty('language');
      expect(user.preferences).toHaveProperty('notifications');
    });
  });

  describe('createPartner', () => {
    it('should create a User with Partner role', () => {
      const partner = createPartner();
      expect(partner.role).toBe('Partner');
    });

    it('should accept overrides while maintaining Partner role', () => {
      const partner = createPartner({ email: 'partner@example.com' });
      expect(partner.role).toBe('Partner');
      expect(partner.email).toBe('partner@example.com');
    });
  });

  describe('createAssociate', () => {
    it('should create a User with Associate role', () => {
      const associate = createAssociate();
      expect(associate.role).toBe('Associate');
    });

    it('should accept overrides while maintaining Associate role', () => {
      const associate = createAssociate({ email: 'associate@example.com' });
      expect(associate.role).toBe('Associate');
      expect(associate.email).toBe('associate@example.com');
    });
  });

  describe('createParalegal', () => {
    it('should create a User with Paralegal role', () => {
      const paralegal = createParalegal();
      expect(paralegal.role).toBe('Paralegal');
    });

    it('should accept overrides while maintaining Paralegal role', () => {
      const paralegal = createParalegal({ email: 'paralegal@example.com' });
      expect(paralegal.role).toBe('Paralegal');
      expect(paralegal.email).toBe('paralegal@example.com');
    });
  });

  describe('createUsers', () => {
    it('should create specified number of users', () => {
      const users = createUsers(5);
      expect(users).toHaveLength(5);
    });

    it('should create users with different IDs', () => {
      const users = createUsers(10);
      const ids = users.map((u) => u.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(10);
    });

    it('should apply overrides to all users', () => {
      const users = createUsers(3, { role: 'Partner' });
      users.forEach((user) => {
        expect(user.role).toBe('Partner');
      });
    });
  });
});
