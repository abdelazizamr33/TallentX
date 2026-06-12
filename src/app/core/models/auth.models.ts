export interface RegisterRequest {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phoneNumber: string;
  gender: 'Male' | 'Female' | 'Other';
  dateOfBirth: string;
  userType: 'Candidate' | 'Recruiter';
}

/** POST /api/Auth/register/company — Create a new company + admin recruiter. */
export interface RegisterCompanyRequest {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phoneNumber?: string;
  gender: 'Male' | 'Female' | 'Other';
  dateOfBirth?: string;
  companyName: string;
  taxNumber?: string;
  industry?: string;
  website?: string;
}

/** POST /api/Auth/register/recruiter — Join existing company via invite code. */
export interface RegisterRecruiterRequest {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phoneNumber?: string;
  gender: 'Male' | 'Female' | 'Other';
  dateOfBirth: string;
  inviteCode: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  refreshToken?: string;
  userId: string;
  email: string;
  /** API returns roles as an array, e.g. ["Candidate"] or ["Recruiter","Admin"] */
  roles: string[];
  /** @deprecated kept for backward compat — derived from roles[0] */
  role?: string;
  expiresAt?: string;
  companyId?: number;
  recruiterRole?: 'Admin' | 'Standard';
}
