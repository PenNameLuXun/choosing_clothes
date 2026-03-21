# Choosing Clothes

这是一个面向 Web 的 AI 虚拟试穿项目，目标能力包括：

- 自定义 3D 身材模型
- 上传单张服装图片并完成试穿
- 在浏览器中实时查看试穿结果
- 保存结果并支持后续扩展

当前仓库先以设计文档为主，按阶段推进实现。

## 文档索引

- [原始设计稿](./sheji.md)
- [总体架构设计](./docs/01-architecture.md)
- [MVP 详细设计](./docs/02-mvp-spec.md)
- [分阶段实施计划](./docs/03-roadmap.md)
- [测试策略](./docs/04-testing.md)

## 当前仓库结构

```text
apps/
  web/       Next.js 前端
  api/       FastAPI 业务接口
  worker/    异步任务处理
packages/
  shared-types/
infra/
docs/
```

## 当前推荐路线

第一版不做“单图直接重建高精度 3D 服装”，而采用更稳妥的路线：

1. 参数化 3D 身体模型
2. 单张服装图分割与分类
3. 服装模板匹配
4. 纹理贴图生成
5. 贴合到 3D 身体模型展示

这样能更快做出一个可用、可演示、可继续迭代的 Web MVP。

## 阶段 1 已完成内容

- 初始化 Monorepo 目录结构
- 创建 `apps/web`
- 创建 `apps/api`
- 创建 `apps/worker`
- 创建共享类型包 `packages/shared-types`
- 添加本地开发基础设施 `docker-compose.yml`
- 添加 `.env.example` 和 `.gitignore`

## 下一步

阶段 2 将开始 Avatar 系统：

1. 接入基础 3D 人体模型
2. 完成 Avatar 编辑器页面
3. 让前端参数和模型联动
4. 补齐 Avatar 的 API 和数据表

## 本地开发

### 一键启动前后端

在仓库根目录执行：

```bash
npm run dev
```

这个脚本会自动：

- 初始化 `.env`（如果不存在）
- 启动 `docker compose`
- 启动 FastAPI 后端
- 启动 Next.js 前端

启动后可直接访问：

```text
http://localhost:3000
http://localhost:3000/avatars
http://localhost:3000/avatars/new/edit
http://localhost:8765/health
```

日志会写到：

```text
.dev/logs/api.log
.dev/logs/web.log
```

停止服务：

```bash
npm run dev:stop
```

### 运行阶段 1 测试

```bash
npm run test:stage1
```

### 启动 Web 前端

1. 安装依赖：

```bash
npm install
```

2. 启动前端开发服务器：

```bash
npm run dev:web
```

3. 在浏览器打开：

```text
http://localhost:3000
```

如果后续需要 API 和基础设施，再额外启动：

```bash
cp .env.example .env
docker compose up -d
```
