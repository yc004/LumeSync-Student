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

export interface PowerControlResult {
  success: boolean;
  error?: string;
}

export interface StudentDeviceInfo {
  mac?: string;
  deviceName?: string;
  clientId?: string;
}

export interface ClassStartOptions {
  forceFullscreen?: boolean;
}

export interface StudentSession {
  role: "viewer";
  clientId: string;
  token: string;
  expiresAt?: string;
  serverTime?: string;
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
  powerControl(payload: { action: "shutdown" | "restart" | "force-shutdown" | "force-restart"; requestId?: string }): Promise<PowerControlResult>;
  getDeviceInfo(): Promise<StudentDeviceInfo>;
  getRole(): Promise<"viewer">;
  getSession(): Promise<StudentSession | null>;
  bootstrapSession(): Promise<StudentSession | null>;
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
