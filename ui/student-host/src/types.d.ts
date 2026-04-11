export interface StudentConfig {
  teacherIp: string;
  port: number;
  adminPasswordHash?: string;
  forceFullscreen: boolean;
  autoStart: boolean;
  guardEnabled: boolean;
}

export interface VerifyPasswordResult {
  ok: boolean;
}

export interface SaveAutostartResult {
  success: boolean;
  error?: string;
}

export interface StudentHostApi {
  getConfig(): Promise<StudentConfig>;
  saveConfig(config: Partial<StudentConfig> & { _quit?: boolean }): Promise<boolean>;
  verifyPassword(password: string): Promise<VerifyPasswordResult>;
  getAutostart(): Promise<boolean>;
  setAutostart(enable: boolean): Promise<SaveAutostartResult>;
  manualRetry(): void;
  toggleDevTools(): void;
}
