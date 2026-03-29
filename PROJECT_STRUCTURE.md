# 📊 项目结构完整视图

## 🎬 完整文件树

```
bzd/
│
├── 📄 .env.example                    # 环境变量模板
├── 📄 .gitignore                      # Git 忽略配置
├── 📄 README.md                       # 项目主文档
├── 📄 SETUP.md                        # 详细设置指南
├── 📄 QUICKSTART.md                   # 快速命令参考
├── 📄 CHECKLIST.md                    # 初始化清单
│
├── 📁 backend/                        # 后端服务 (Express.js)
│   ├── 📄 package.json                # 后端依赖配置
│   ├── 📁 config/                     # 配置文件目录
│   │   └── 📝 service-key.json [待创建] # Google 服务账号密钥
│   ├── 📁 data/                       # 数据库文件目录 [运行时创建]
│   │   └── cinema.db [待创建]         # SQLite 数据库
│   ├── 📁 src/                        # 源代码
│   │   ├── 📄 server.js               # Express 主服务器
│   │   ├── 📁 db/
│   │   │   └── 📄 init.js             # 数据库初始化和工具函数
│   │   ├── 📁 middleware/
│   │   │   └── 📄 auth.js             # 认证中间件（用户代号、Admin key）
│   │   ├── 📁 routes/                 # API 路由
│   │   │   ├── 📄 theaters.js         # 影厅接口
│   │   │   ├── 📄 bookings.js         # 预订接口
│   │   │   └── 📄 admin.js            # 管理员接口
│   │   └── 📁 services/
│   │       └── 📄 sheetsService.js    # Google Sheets API 集成
│   └── 📁 scripts/                    # 辅助脚本
│       ├── 📄 initDb.js               # 数据库初始化脚本
│       └── 📄 seedDemo.js             # 演示数据生成脚本
│
├── 📁 frontend/                       # 前端应用 (Vue 3 + Vite)
│   ├── 📄 package.json                # 前端依赖配置
│   ├── 📄 vite.config.js              # Vite 构建配置
│   ├── 📄 index.html                  # HTML 入口
│   ├── 📁 public/                     # 静态资源目录
│   ├── 📁 src/                        # Vue 源代码
│   │   ├── 📄 main.js                 # Vue 应用入口
│   │   ├── 📄 App.vue                 # 根组件（主应用逻辑）
│   │   ├── 📄 style.css               # 全局样式
│   │   ├── 📁 components/             # Vue 组件
│   │   │   ├── 📄 UserCodeInput.vue   # 用户代号输入表单
│   │   │   ├── 📄 TheaterSelector.vue # 影厅列表和选择
│   │   │   └── 📄 SeatSelection.vue   # 座位网格和选择
│   │   ├── 📁 views/                  # 页面组件 [可扩展]
│   │   └── 📁 services/               # API 调用
│   │       └── 📄 api.js              # Axios API 封装
│   └── 📁 dist/                       # 构建输出目录 [npm run build 生成]
│
└── 📁 node_modules/                   # 依赖包 [npm install 生成]
```

## 🔄 数据流架构

```
用户浏览器
    ↓
Vue 3 前端 (http://localhost:5173)
    ├─ UserCodeInput   → 输入用户代号
    ├─ TheaterSelector → 选择影厅
    └─ SeatSelection   → 选择座位并确认
    ↓
Axios API 请求 (CORS)
    ↓
Express.js 后端 (http://localhost:5000)
    ├─ 中间件：验证用户代号
    ├─ 路由处理：
    │   ├─ GET  /api/theaters          → 获取影厅列表
    │   ├─ GET  /api/theaters/:id/seats → 获取座位状态
    │   ├─ POST /api/bookings          → 创建预订
    │   └─ POST /api/admin/theaters    → 创建影厅（管理员）
    ├─ 业务逻辑：保存到数据库
    └─ 服务：提交到 Google Sheets
    ↓
数据存储
    ├─ SQLite 数据库 (backend/data/cinema.db)
    │   ├─ theaters 表   → 影厅信息
    │   └─ bookings 表   → 预订记录
    └─ Google Sheets    → 预订备份和报告
```

## 📦 依赖清单

### 后端依赖 (backend/package.json)

```json
{
  "dependencies": {
    "express": "^4.18.2",              // Web 框架
    "cors": "^2.8.5",                  // 跨域支持
    "dotenv": "^16.3.1",               // 环境变量
    "sqlite3": "^5.1.6",               // SQLite 数据库
    "uuid": "^9.0.0",                  // UUID 生成
    "google-auth-library": "^9.2.0",   // Google 认证
    "googleapis": "^118.0.0"            // Google APIs
  },
  "devDependencies": {
    "nodemon": "^3.0.2"                // 开发自动重载
  }
}
```

### 前端依赖 (frontend/package.json)

```json
{
  "dependencies": {
    "vue": "^3.3.4",                   // Vue 框架
    "axios": "^1.5.0",                 // HTTP 客户端
    "vue-router": "^4.2.4"             // 路由（可选）
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^4.4.0",    // Vite Vue 插件
    "vite": "^4.5.0"                   // 构建工具
  }
}
```

## 🗄️ 数据库架构

### theaters 表
```sql
CREATE TABLE theaters (
  id TEXT PRIMARY KEY,           -- UUID
  name TEXT NOT NULL,            -- 影厅名称（如"第一影厅"）
  rows INTEGER NOT NULL,         -- 行数（如 8）
  cols INTEGER NOT NULL,         -- 列数（如 10）
  created_at DATETIME            -- 创建时间
);
```

**示例数据**：
| id | name | rows | cols | created_at |
|----|------|------|------|------------|
| uuid-1 | 第一影厅 | 8 | 10 | 2024-01-01 10:00:00 |
| uuid-2 | 第二影厅 | 6 | 8 | 2024-01-01 10:00:00 |
| uuid-3 | 第三影厅 | 10 | 12 | 2024-01-01 10:00:00 |

### bookings 表
```sql
CREATE TABLE bookings (
  id TEXT PRIMARY KEY,           -- 预订 UUID
  theater_id TEXT NOT NULL,      -- 影厅 ID（外键）
  user_code TEXT NOT NULL,       -- 用户代号
  seats TEXT NOT NULL,           -- 座位列表 JSON，如 ["1-5", "1-6"]
  status TEXT DEFAULT 'confirmed', -- 预订状态
  submitted_to_sheets BOOLEAN,   -- 是否已同步到 Google Sheets
  created_at DATETIME            -- 创建时间
);
```

**示例数据**：
| id | theater_id | user_code | seats | status | submitted_to_sheets | created_at |
|----|------------|-----------|-------|--------|---------------------|------------|
| uuid-b1 | uuid-1 | user123 | ["1-5","1-6"] | confirmed | 1 | 2024-01-01 10:30:00 |
| uuid-b2 | uuid-2 | emp001 | ["2-3"] | confirmed | 1 | 2024-01-01 10:35:00 |

## 🔐 API 端点汇总

### 公开接口

| 方法 | 端点 | 功能 | 需要认证 |
|------|------|------|---------|
| GET | `/api/theaters` | 获取所有影厅 | ✗ |
| GET | `/api/theaters/:id` | 获取单个影厅 | ✗ |
| GET | `/api/theaters/:id/seats` | 获取座位状态 | ✗ |
| POST | `/api/bookings` | 创建预订 | ✓ (用户代号) |
| GET | `/api/bookings/user/:user_code` | 用户预订历史 | ✗ |

### 管理员接口

| 方法 | 端点 | 功能 | 认证方式 |
|------|------|------|---------|
| POST | `/api/admin/theaters` | 创建影厅 | X-Admin-Key |
| DELETE | `/api/admin/theaters/:id` | 删除影厅 | X-Admin-Key |

## ⚙️ 配置文件

### .env 文件结构

```env
# 后端服务
NODE_ENV=development
PORT=5000
FRONTEND_URL=http://localhost:5173

# Google Sheets API
GOOGLE_SHEETS_ID=your-sheet-id
GOOGLE_SHEETS_RANGE=Bookings!A:G
GOOGLE_SERVICE_ACCOUNT_EMAIL=service@project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_KEY_PATH=./config/service-key.json

# Admin 认证
ADMIN_SECRET_KEY=my-secret-admin-key-2024

# 数据库
DATABASE_PATH=./data/cinema.db
```

## 🎯 开发工作流

```
1. 启动后端 (npm run dev)
   ↓
2. 启动前端 (npm run dev)
   ↓
3. 访问 http://localhost:5173
   ↓
4. 输入用户代号，开始预订
   ↓
5. 刷新 Google Sheet 查看数据
   ↓
6. 修改代码 → 自动刷新 (Vite + Nodemon)
```

## 📱 响应式断点

前端使用 CSS 媒体查询支持：
- 📱 手机：< 640px
- 📱 平板：640px - 1024px
- 💻 桌面：> 1024px

## 🚀 部署架构

```
生产环境
├─ 前端：Vercel / Netlify
│  ├─ 自动部署 Git 推送
│  └─ CDN 加速
├─ 后端：Railway / Heroku
│  ├─ Docker 容器
│  └─ 自动扩展
└─ 数据库：SQLite (或升级到 PostgreSQL)
   └─ 文件存储或云存储
```

---

**🎉 项目已完全初始化！接下来：**

1. ✏️ 编辑 `.env` 配置文件
2. 🔑 设置 Google Sheets API
3. 📦 运行 `npm install` 安装依赖
4. 🗄️ 运行 `npm run init:db` 初始化数据库
5. 🚀 运行 `npm run dev` 启动开发服务器

详细步骤见 **SETUP.md** 或 **QUICKSTART.md**！
