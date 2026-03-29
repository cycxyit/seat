# 🏢 科室座位预订系统

一个完整的企业级科室座位选择预订系统，集成 Vue 3 (前端)、Express (后端)、SQLite (数据库) 和 Google Sheets (自动数据同步)。支持多科室管理与网格动态编辑，提供直观的办公选座体验。

## ✨ 功能特性

- ✅ **工号认证系统** — 简单的员工工号/代号验证登录
- ✅ **动态多科室管理** — 管理员可随时增减科室，并灵活自定义办公座位行数与列数
- ✅ **可视化网格展示** — 极具商务风的标准化选座界面，贴近真实办公场景
- ✅ **实时座位状态** — 自动处理并展示已占用和可用座位，防止座位冲突
- ✅ **Google Sheets 自动同步** — 预订数据无缝自动同步到企业 Google 表格中
- ✅ **本地数据兜底** — SQLite 将记录留底保存，双重数据保障
- ✅ **现代响应式** — PC、平板与手机端完美适配

## 📂 项目模块结构

```
bzd/
├── backend/                    # Express 后端核心服务
│   ├── src/
│   │   ├── server.js          # API 服务入口
│   │   ├── db/                # 数据库封装与查询 (M)
│   │   ├── routes/            # 路由层 (C) [admin.js, theaters.js..]
│   │   └── services/          # 服务层 (集成 Google Sheets)
│   ├── data/                  # 运行时自动生成的 SQLite 数据库 (cinema.db)
│   ├── config/                # 请将 Google 服务密钥 (JSON) 放在此处
│   └── scripts/               # 快速初始化脚本 (`npm run init:db`)
│
├── frontend/                   # Vue 3 + Vite 前端 SPA
│   ├── src/
│   │   ├── main.js            # Vue 应用入口
│   │   ├── App.vue            # 主题与路由挂载点
│   │   ├── router/            # 前端路由 (管理端/客户端)
│   │   ├── components/        # UI 组件 (例如选座面板、表单)
│   │   └── views/             # 页面视图 (AdminView.vue, HomeView.vue)
│   ├── dist/                  # (执行 build 后生成的用于部署的静态文件)
│   └── vite.config.js
│
└── .env                       # 项目环境变量配置文件 (前后端约定依赖此文件)
```

## 🚀 完整生产环境部署指南

为了实现将此系统上线供所有人员访问，请严格遵循以下部署步骤：

### 阶段 1：全局依赖与环境配置

#### 1.1 安装依赖
确保服务器安装了 Node.js (v16 或以上)。分别在 `backend` 和 `frontend` 单独安装依赖。
```bash
# 后端
cd backend
npm install

# 前端
cd ../frontend
npm install
```

#### 1.2 Google Sheets 申请（可选但推介）
如果你需要座位预订自动飞入云端表格：
1. 访问 [Google Cloud Console](https://console.cloud.google.com/)。
2. 开启 `Google Sheets API` 服务。
3. 创建“服务账号”并生成 `.json` 格式密钥。
4. 将该 JSON 密钥重命名为 `service-key.json`，并放置于项目的 `backend/config/` 目录下。
5. 在你的 Google 云盘中新建一个空表格，点击“分享”，输入你刚刚创建的“服务账号邮箱”，并赋予**编辑权限**。

#### 1.3 核心环境变量 (`.env`)
在项目根目录下，复制示例文档为 `.env`：
```bash
cp .env.example .env
```
随后使用编辑器（例如 Vim 或 Nano）更改内部的参数：
```env
# ====== 管理员验证 =======
# 重要：用于登入前端 /admin 面板的私密密钥，切勿泄露！
ADMIN_SECRET_KEY=wode_chaoji_mima_123

# ====== 前端通信 =======
# 此处填写实际部署时，前端所处的网址头 (用于解决后端 CORS 强跨域)
FRONTEND_URL=http://your-domain.com

# ====== Google 表格对接 =======
# 你的表格 URL 中的长乱码就是 ID
GOOGLE_SHEETS_ID=xxxxxx-填写你自己的长ID-xxxxxxxxx
GOOGLE_SHEETS_RANGE=Bookings!A:G
GOOGLE_SERVICE_ACCOUNT_EMAIL=bot@your-project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_KEY_PATH=./config/service-key.json
```

#### 1.4 初始化后端数据库
你需要运行脚本以生成第一手本地数据结构，否则运行报错：
```bash
cd backend
npm run init:db    # 建立表结构
# npm run seed:demo # (可选) 写入一点假数据做演示测试
```

---

---

### 阶段 2：Vercel 生产环境部署

由于本项目采用了前后端分离架构，且即将部署在 Vercel 上，无需配置 PM2 和 Nginx。请按以下步骤操作：

#### 2.1 准备工作 (配置 `vercel.json`)
为了让 Vercel 同时处理前端静态页面代理与后端 Express 函数转发，请确保根目录存在合规的 `vercel.json` 配置文件。
基础配置示例（引导 `/api` 流量至后端）：
```json
{
  "version": 2,
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/backend/src/server.js" },
    { "source": "/(.*)", "destination": "/frontend/dist/index.html" }
  ]
}
```
> **注意**：Vercel 属于 Serverless 架构，由于其文件系统是短暂存在的，**本地 SQLite 库的数据可能会在服务重启时被重置**。请务必优先依赖 Google Sheets 做到数据的持久化同步，或者根据业务改用远端数据库！

#### 2.2 推送到 GitHub
将本地完成所有配置好的代码推送到你的 GitHub 仓库中。
注意 `.env` 中涉及机密的私钥或凭证请勿由于疏忽推送到公共仓库，可交由 Vercel 环境变量中心接管。

#### 2.3 在 Vercel 控制台执行部署
1. 登录 [Vercel](https://vercel.com/)，点击 **Add New Project**。
2. 授权连接你的 GitHub 账号，选择该代码仓库（Repository）。
3. 在 **Configure Project** （配置项目）选项卡中：
   - **Framework Preset**: 选择 `Vite`
   - **Root Directory**: 根据你的实际架构设置，如若前后端单仓则选 `./frontend`，或者自定义构建命令。
   - **Environment Variables**: 在此面板中将开发期 `.env` 的所有键值对（如 `GOOGLE_SHEETS_ID`, `ADMIN_SECRET_KEY` 等）逐一填入。
4. 点击 **Deploy**，等待构建完成（Vercel 会自动读取 Vue 构建规则），之后你便可以获取到公网可用 URL 进行访问了！

---

## 📝 API 接口文档 (底层概念仍标为 Theater 以防破坏现有协议)

系统底层依然采用了健壮平稳的电影院模型逻辑（所以 API 中使用 Theater 词汇），请勿在无把握情况下修改相关 `theater_id` 等数据库键名。

### 获取所有科室
```
GET /api/theaters
```

### 获取科室座位及占用状态
```
GET /api/theaters/:id/seats
```

### 提交座位预订方案
```
POST /api/bookings
Headers: X-User-Code: your_work_id
Body: {
  "theater_id": "uuid....",
  "seats": ["1-5", "1-6"],
  "user_code": "user123"
}
```

### ✅ 管理员接口
所有管理请求必须携带头部信息：`X-Admin-Key`

**创建:** `POST /api/admin/theaters`
**删除:** `DELETE /api/admin/theaters/:id`

---

## 🐛 常见错误解决指南

1. **前后端接口不同步 (跨域 CORS Error)**
   - 绝大部分原因是您的 `.env` 中 `FRONTEND_URL` 配置的跟员工浏览器上面显示的地址不一致。请检查包含 `http/https` 协议头以及端口号。
   
2. **提交预订页面报错 Google API failed**
   - 本地写入成功，但上传云端报错，说明你的 `service-key.json` 不正确，或者你没有在 Google Sheet 文件右上角点击分享权限给你新建的服务账号邮箱。

3. **首页不断处于 Loading 状态**
   - 前端没有抓到从 `5000` 端口/ `Nginx` 代理转过来的数据，请在浏览器按 `F12` 获取接口具体报错信息。排查 Nginx 配置 `location /api/` 项。
