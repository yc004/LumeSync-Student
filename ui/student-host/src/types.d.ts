export interface StudentConfig {
  teacherIp: string;
  port: number;
  adminPasswordHash?: string;
  forceFullscreen: boolean;
  autoStart: boolean;
  guardEnabled: boolean;
  clientId?: string;
  sessionToken?: string;
  sessionExpiresAt?: string;
  sessionServerTime?: string;
}

export interface VerifyPasswordResult {
  ok: boolean;
}

export interface SaveAutostartResult {
  success: boolean;
  error?: string;
}

export interface StudentSession {
  role: "viewer";
  clientId: string;
  token: string;
  expiresAt?: string;
  serverTime?: string;
}

export interface StudentHostApi {
  getConfig(): Promise<StudentConfig>;
  saveConfig(config: Partial<StudentConfig> & { _quit?: boolean }): Promise<boolean>;
  verifyPassword(password: string): Promise<VerifyPasswordResult>;
  getAutostart(): Promise<boolean>;
  setAutostart(enable: boolean): Promise<SaveAutostartResult>;
  manualRetry(): void;
  getSession(): Promise<StudentSession | null>;
  bootstrapSession(): Promise<StudentSession | null>;
  toggleDevTools(): void;
}
