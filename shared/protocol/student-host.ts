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

export interface ClassStartOptions {
  forceFullscreen?: boolean;
}

export interface StudentHostApi {
  classStarted(options?: ClassStartOptions): void;
  classEnded(): void;
  setFullscreen(enable: boolean): void;
  getConfig(): Promise<StudentConfig>;
  saveConfig(config: Partial<StudentConfig> & { _quit?: boolean }): Promise<boolean>;
  verifyPassword(password: string): Promise<VerifyPasswordResult>;
  getAutostart(): Promise<boolean>;
  setAutostart(enable: boolean): Promise<SaveAutostartResult>;
  manualRetry(): void;
  setAdminPassword(hash: string): void;
  getRole(): Promise<"student">;
  toggleDevTools(): void;
}

export interface ElectronCompatApi extends StudentHostApi {}

declare global {
  interface Window {
    studentHost: StudentHostApi;
    electronAPI?: Partial<ElectronCompatApi>;
  }
}

export {};
