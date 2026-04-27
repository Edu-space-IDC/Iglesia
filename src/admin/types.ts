export interface AdminProfile {
  username: string;
  displayName: string;
  email: string;
  updatedAt: string;
}

export interface StatusOption {
  key: string;
  label: string;
  color: string;
  order: number;
  active?: boolean;
}

export interface SurveyRecord {
  sheetRow: number;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  prayerRequest: string;
  source: string;
  submittedAt: string;
  status: string;
}

export interface PublicConfig {
  ready: boolean;
  missing: string[];
  spreadsheetId: string;
  responsesSheetName: string;
  serviceAccountFile: string;
  defaultCredentials: {
    username: string;
    alias: string;
    password: string;
  };
}

export interface BootstrapPayload {
  profile: AdminProfile;
  statuses: StatusOption[];
  records: SurveyRecord[];
}

export interface AccountUpdateInput {
  username: string;
  displayName: string;
  email: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}
