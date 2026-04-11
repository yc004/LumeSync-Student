# LumeSync Student

同步课堂学生端，面向 Windows 学生机部署。项目保留旧的 Electron 学生端，同时新增 C++ 原生 Windows 学生端：C++ 负责窗口、防护、服务守护、安装器和 Windows 原生 API 调用，课堂页面和本地离线页使用 TypeScript 构建后由 WebView2 渲染。

## 功能概览

- 连接教师端服务，默认地址为 `http://<teacherIp>:3000`。
- 课堂中支持全屏、置顶、焦点恢复、快捷键拦截、隐藏滚动条、禁止页面文字拖拽选中。
- 使用 WebView2 渲染课堂页面，支持摄像头和麦克风调用。
- 使用 C++ 原生管理员界面管理教师端 IP、端口、自启动、守护进程和管理员密码。
- 管理员密码和卸载密码保持同步，卸载前会进行密码校验。
- 支持单实例运行，避免重复打开多个学生端窗口。
- 提供 Windows 服务 `LumeSyncStudentGuard`，用于托管启动和异常恢复。
- 提供 NSIS 安装包，便于在其他学生电脑上一键部署。
- GitHub Actions 在 `push` 后自动构建 Windows 安装包并发布 Release。

## 目录结构

```text
electron/                 旧 Electron 主进程和 preload
common/                   旧 Electron 公共逻辑
native/                   C++ 原生学生端、守护服务和安装器脚本
native/shell/             原生学生端窗口和 WebView2 宿主
native/service/           Windows 守护服务
native/installer/         NSIS 安装器脚本
shared/protocol/          学生端宿主桥接协议类型
ui/student-host/          TypeScript 本地页面，包含离线页和本地宿主页面
docs/                     原生学生端运行、构建和部署文档
public/                   旧 Electron 入口 HTML
```

## 开发运行

旧 Electron 学生端：

```bash
pnpm install
pnpm run start
```

原生学生端需要 Windows、Visual Studio C++ 工具链、CMake、Node.js、NSIS 和 WebView2 Runtime。推荐先安装依赖：

```bash
npm install
```

构建并打包原生运行目录：

```bash
npm run build:student-native
```

运行原生学生端：

```powershell
.\dist\student-native\LumeSyncStudentShell.exe
```

构建完整安装包：

```bash
npm run build:student-native-installer
```

安装包输出位置：

```text
dist/installer/LumeSync Student Native Setup 1.0.0.exe
```

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `pnpm run start` | 启动旧 Electron 学生端 |
| `pnpm run build` | 使用 electron-builder 打包旧 Electron 学生端 |
| `npm run build:host-ui` | 构建 TypeScript 本地宿主页面 |
| `npm run build:native:configure` | 生成 CMake Visual Studio 构建目录 |
| `npm run build:native` | 编译 C++ 原生学生端和守护服务 |
| `npm run package:student-native` | 生成原生学生端运行目录 |
| `npm run build:student-native` | 构建本地页面、C++ 程序并生成运行目录 |
| `npm run package:student-native-installer` | 使用 NSIS 打包安装器 |
| `npm run build:student-native-installer` | 一次性构建原生学生端和安装包 |

## 配置与数据

原生学生端使用全局配置目录：

```text
%ProgramData%\LumeSync Student
```

关键文件：

- `config.json`：教师端 IP、端口、管理员密码哈希、自启动、守护进程等配置。
- `state.json`：运行状态。
- `logs\shell.log`：原生学生端日志。
- `logs\service.log`：守护服务日志。

关键默认项：

| 项目 | 默认值 | 说明 |
| --- | --- | --- |
| `teacherIp` | `192.168.1.100` | 教师端服务地址 |
| `port` | `3000` | 教师端服务端口 |
| `forceFullscreen` | `true` | 课堂中是否强制全屏 |
| `guardEnabled` | `true` | 是否启用守护服务托管 |

## 安装部署

在学生电脑上以管理员身份运行安装包：

```powershell
.\dist\installer\LumeSync Student Native Setup 1.0.0.exe
```

安装器会执行以下操作：

- 安装 `LumeSyncStudentShell.exe`、`LumeSyncStudentGuardSvc.exe`、`WebView2Loader.dll` 和本地 UI 资源。
- 注册并启动 `LumeSyncStudentGuard` Windows 服务。
- 创建开始菜单快捷方式和卸载入口。
- 配置安装目录和 `%ProgramData%\LumeSync Student` 的访问权限。
- 覆盖安装前停止旧服务和旧进程，避免文件占用导致写入失败。
- 卸载时要求输入管理员密码，密码与学生端管理员密码保持同步。

## 自动发布

仓库包含 GitHub Actions workflow：

```text
.github/workflows/release.yml
```

每次 `push` 后会在 `windows-latest` 上执行构建，产出原生安装包，并创建 GitHub Release。Release 标签格式为：

```text
student-native-<branch>-<run_number>
```

## 安全边界

原生学生端通过全屏置顶、焦点恢复、快捷键拦截、单实例、服务守护和安装目录权限控制来提高普通学生账号的逃逸成本。

这不是内核级安全边界，无法阻止本机管理员、Windows 安全桌面、`Ctrl+Alt+Del` 路径或拥有提权能力的用户。学生电脑应配合标准用户账号、组策略、任务管理器限制、Assigned Access 或其他终端管控策略部署。

## 更多文档

- [原生学生端运行文档](./docs/native-student-runtime.md)
- [CONTRIBUTING.md](./CONTRIBUTING.md)
- [SECURITY.md](./SECURITY.md)
- [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)
- [LICENSE](./LICENSE)
