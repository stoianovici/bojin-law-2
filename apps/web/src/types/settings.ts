// Theme preference
export type Theme = 'dark' | 'light';

// Document open method preference
export type DocumentOpenMethod = 'desktop' | 'online';

// User preferences
export interface UserPreferences {
  theme: Theme;
  emailSignature?: string;
  documentOpenMethod?: DocumentOpenMethod;
}

// Court entity
export interface Court {
  id: string;
  name: string;
  fullAddress: string;
  emailDomains: string[];
}

// Firm billing settings
export interface FirmSettings {
  partnerRate: number;
  associateRate: number;
  paralegalRate: number;
}

// Personal email address entry
export interface PersonalEmailAddress {
  id: string;
  emailAddress: string;
  addedBy: {
    id: string;
    firstName: string;
    lastName: string;
  };
  createdAt: string;
}

// Team member
export interface TeamMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}
