export type DynamicFormQuestionType = 'text' | 'tel' | 'email' | 'textarea';
export type DynamicFormQuestionLayout = 'half' | 'full';

export interface DynamicFormQuestion {
  key: string;
  label: string;
  type: DynamicFormQuestionType;
  required: boolean;
  placeholder: string;
  helperText: string;
  autoComplete: string;
  layout: DynamicFormQuestionLayout;
  rows: number;
  order: number;
  active?: boolean;
}

export interface DynamicFormSettings {
  eyebrow: string;
  title: string;
  description: string;
  submitButtonLabel: string;
  successMessage: string;
  privacyNote: string;
}

export interface DynamicFormRecord {
  sheetRow: number;
  submittedAt: string;
  values: Record<string, string>;
}

export interface AdminProfile {
  username: string;
  displayName: string;
  email: string;
  updatedAt: string;
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

export interface DynamicFormBootstrapPayload {
  profile: AdminProfile;
  settings: DynamicFormSettings;
  questions: DynamicFormQuestion[];
  records: DynamicFormRecord[];
}

export interface DynamicFormPublicPayload {
  ready: boolean;
  settings: DynamicFormSettings;
  questions: DynamicFormQuestion[];
}

export interface AccountUpdateInput {
  username: string;
  displayName: string;
  email: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}
