# 🏢 科室座位预订系统 (Seat Booking System)

**部署前端 (Frontend):**
[![Deploy Frontend with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/cycxyit/seat/tree/main/frontend&project-name=seat-booking-frontend&framework=vite)

**部署后端 (Backend):**
[![Deploy Backend with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/cycxyit/seat/tree/main/backend&env=FRONTEND_URL,ADMIN_SECRET_KEY,GOOGLE_SHEETS_ID,GOOGLE_SHEETS_RANGE,GOOGLE_SERVICE_ACCOUNT_EMAIL,GOOGLE_SERVICE_ACCOUNT_KEY_PATH&project-name=seat-booking-backend)

一个企业级、现代化且支持实时响应的科室座位选择预订系统。系统集成了前后端分离架构，支持完整的工号权限校验、多科室自定义网格管理功能，并支持将预订数据无缝自动同步到 **Google Sheets** 中。

---

## ✨ 功能特性 (Features)

- ✅ **工号认证系统** — 轻量化的员工工号/验证码登录拦截，确保系统私密性。
- ✅ **动态多科室管理** — 管理员可随时自由增减科室，并灵活自定义办公座位行数、列数、过道、以及门的位置。
- ✅ **可视化选座网格** — 极具商务风的现代化选座界面，贴近真实办公场景的设计。
- ✅ **实时座位并发控制** — 结合数据库判断与 SSE (Server-Sent Events) 实时推送，防并发超卖，有效防止座位冲突。
- ✅ **Google Sheets 自动同步** — 预订成功的明细第一时间同步到企业的 Google 数据表格。
- ✅ **本地双重数据兜底** — SQLite 本地运行留底保存，即便网络环境不稳也有据可查。
- ✅ **全平台响应式** — PC、平板与手机端完美自适应适配。

## 🛠️ 技术栈 (Tech Stack)

- **前端 (Frontend):** Vue 3, Vite, Axios, Vue Router
- **后端 (Backend):** Node.js, Express, SQLite3 (数据库)
- **第三方集成 (Integrations):** Google Sheets API v4

---

## 🚀 详细本地使用与配置教程 (Local Development)

### 第 1 步: 克隆项目与安装依赖
首先，克隆该项目到本地计算机。您需要安装 Node.js (v16 或以上)。
打开终端分别在根目录进行依赖安装：

```bash
# 全局快速安装 (需在根目录执行)
npm run install:all

# 或者分别进行手动安装：
cd backend && npm install
cd ../frontend && npm install
```

### 第 2 步: 配置环境变量 (.env)
系统运行高度依赖环境变量，在项目根目录（或 `backend` 目录下，取决于你的构架配置），将示例环境变量复制一份并重命名为 `.env`。

```bash
cp .env.example .env
```
随后请按需修改 `.env` 中的核心参数：

```env
# ====== 后端运行配置 ======
NODE_ENV=development
PORT=5000

# ====== 前端跨域通信 =======
# 此处填写实际部署时，前端所处的网址头 (用于解决跨域)
FRONTEND_URL=http://localhost:5173

# ====== 管理员验证 =======
# 重要：用于登入前端 /admin 隐藏面板的私密密钥，切勿泄露！
ADMIN_SECRET_KEY=wode_chaoji_mima_123 # 请修改为你的密码

# ====== Google 表格对接 =======
GOOGLE_SHEETS_ID=xxxxxx-填入你的表格长ID-xxxxxxx
GOOGLE_SHEETS_RANGE=Bookings!A:G
GOOGLE_SERVICE_ACCOUNT_EMAIL=bot@your-project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_KEY_PATH=./config/service-key.json
```

### 第 3 步: 获取 Google Sheets 密钥 (可选)
如果需要启用 Google 表格同步：
1. 前往 [Google Cloud Console](https://console.cloud.google.com/) 创建项目。
2. 搜索并开启 **Google Sheets API**。
3. 创建“服务账号”并为其生成 JSON 格式密钥。
4. 将该 JSON 文件重命名为 `service-key.json`，放入 `backend/config/` 目录下。
5. 在你的 Google 云盘中新建一个空表格，点击“分享”，输入刚才的“服务账号邮箱”，赋予 **编辑权限**。

### 第 4 步: 初始化数据库
必须要先初始化本地的 SQLite 数据库文件结构才可以运行项目：
```bash
cd backend
npm run init:db    # 建立表结构
# npm run seed:demo # (可选) 写入一些模拟预订假数据用于测试
```

### 第 5 步: 启动服务
你可以使用根目录的脚本一键启动前端和后端：
```bash
# 回到项目根目录执行
npm run dev
```
或分别启动：
- 后端: `cd backend && npm run dev`
- 前端: `cd frontend && npm run dev`

前端默认地址：`http://localhost:5173`
后台管理访问：`http://localhost:5173/admin` 

---

## ☁️ Vercel 生产部署教程 (Deployment)

你可以通过提供的一键部署按钮或手动配置到 Vercel：

### 方法一：一键通过 Vercel 按钮部署（最快）
确保您已把代码推送到个人的 GitHub 仓库，并在上方点击 `Deploy with Vercel` 按钮。
在跳转页面直接输入所需的 Environment Variables 即可。

### 方法二：手动在 Vercel 中部署
1. 登录 [Vercel](https://vercel.com/) 并点击 **Add New Project**。
2. 授权您的 GitHub，选择本项目所在仓库。
3. 在 **Configure Project** 选项卡中，配置以下选项：
   - **Framework Preset**: 选择 `Vite`。
   - **Root Directory**: (此项如需要分别部署可点选 `frontend`)，若采用根目录复合代理（配合 `vercel.json`），请将 Build Command 填写为对应的前端构建即可（由于 Vercel Serverless 特性，不推荐前后一并强行跑在一台机）。
   - 由于 SQLite 在 Vercel 的 Serverless（无服务器）环境中是**易失的**（即：每当 Vercel 冷启动或重新部署，所有落入本地 SQLite `.db` 文件的数据将被清空重置）。
4. **Environment Variables**:
   将您本地 `.env` 中的变量逐一复制进去（比如 `ADMIN_SECRET_KEY`, `GOOGLE_SHEETS_ID` 等）。Google 密钥建议直接转换成 Base64 塞进环境变量避免提交流程问题。
5. 点击 **Deploy**，等待构建完成出网。

> ⚠️ **关于 Vercel 上运行 SQLite 的强烈警告**：
> Vercel 是无状态的 Serverless 云平台，不支持持久化写入本机文件系统。
> **如果坚持在 Vercel 生产环境上运行该项目，必须做到以下之一**：
> 1. 完全依赖 Google Sheets 数据源作为真理数据库，失去本地容灾留底功能。
> 2. *(推荐)* 修改 `backend/src/db/init.js` 的引用连接，改用例如 `Turso` 或 `Vercel Postgres` 等远程 SQL 数据库引擎以长期留存订单记录。

---

## 🐛 常见问题排查 (Troubleshooting)

1. **接口请求出现跨域错误 (CORS Error)**
   - 检查根目录下的 `.env`（Vercel 上则是 Vercel Dashboard -> Environment Variables）内 `FRONTEND_URL` 是否正确配置为前端的公网或测试网址，且不要带尾部斜杠 `/`。

2. **提交座位报错 "Google Sheet 写入失败"**
   - 您的 `service-key.json` 不存在或者读取路径有误。
   - Vercel 环境下读取本地 `json` 文件可能找不到，建议将 `service-key.json` 内容直接赋值到环境变量，并在代码里将其 `JSON.parse`。
   - 请检查是否遗忘了在 Google 表格面板的“分享”按钮上，将机器人的邮箱地址加入。

3. **进入 /admin 页面要求输入密码**
   - 密码由后端环境变量 `ADMIN_SECRET_KEY` 控制，初次安装可能默认是 `wode_chaoji_mima_123`，请尽快替换成复杂字符串。

---
*Created and maintained with ❤️ for optimized business workflows.*
