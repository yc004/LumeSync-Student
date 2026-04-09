# LumeSync Student

学生端桌面应用，用于连接教师端服务并接收课堂同步状态。

## 功能概览

- 连接教师端本地服务（默认 `http://<teacherIp>:3000`）。
- 课堂进行中支持全屏置顶、窗口保护、托盘常驻。
- 网络不可用时自动切换离线页并后台重试连接。
- 支持管理员设置（教师 IP、端口、开机自启、管理密码校验）。
- 支持远程接收教师端下发的管理员密码哈希。

## 目录结构

```text
electron/          # 学生端主进程与 preload
common/            # 公共配置与日志能力
shared/            # 管理页、离线页、图标等共享资源
public/            # 入口 HTML
```

## 快速开始

```bash
npm install
npm run start
```

启动后会读取本地配置并尝试访问教师端地址：

- 默认 `teacherIp`: `192.168.1.100`
- 默认 `port`: `3000`

## 常用命令

- `npm run start`：启动学生端桌面应用
- `npm run build`：打包安装包（electron-builder）

## 配置持久化

配置与设置文件存放于 Electron `userData` 目录：

- `config.json`：连接参数、管理员密码哈希
- `settings.json`：课堂行为设置（如全屏跟随、告警开关）

关键默认项：

| 项目 | 默认值 | 说明 |
| --- | --- | --- |
| `teacherIp` | `192.168.1.100` | 教师端服务地址 |
| `port` | `3000` | 教师端服务端口 |
| `forceFullscreen` | `true` | 课堂模式是否强制全屏 |

## 运行机制

- 首次连接失败会打开 `shared/offline.html`，并每 5 秒重试。
- 课堂模式下会阻止普通关闭行为，防止学生退出课堂窗口。
- 应用支持托盘菜单、管理员设置窗口与调试工具切换。
- 非打包开发模式下，开机自启相关操作会被跳过（代码中明确禁用）。

## 打包发布

```bash
npm run build
```

- 打包配置：`electron-builder.json`
- 产物目录：`../../dist/student`
- Windows 目标：`nsis`（`x64`）

说明：安装器脚本包含 `shared/build/student-installer.nsh`，并附带 `verify-password.exe`。

## 常见问题

1. 一直显示离线页
优先确认教师端已运行，并检查学生端中的 `teacherIp`/`port` 配置是否正确。

2. 无法退出全屏课堂窗口
这是课堂进行中的保护策略。需由教师端结束课堂，或在管理员流程中执行对应操作。

3. 开机自启设置不生效
请确认当前为打包安装版本；开发模式下自启流程默认不执行。

## 相关文档

- [CONTRIBUTING.md](./CONTRIBUTING.md)
- [SECURITY.md](./SECURITY.md)
- [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)
- [LICENSE](./LICENSE)
