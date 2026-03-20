# 测试策略

## 1. 当前阶段目标

阶段 1 的测试重点不是业务正确性，而是建立“工程骨架不会退化”的基线。

这类测试主要覆盖：

- 目录结构是否齐全
- Web、API、Worker 入口是否存在
- 根工作区配置是否正确
- 本地基础设施配置是否存在

## 2. 当前已添加的基线测试

测试文件：

- `tests/test_stage1_scaffold.py`

覆盖内容：

- 根目录关键结构校验
- `package.json` 的 workspace 和脚本校验
- Web 前端包配置校验
- 首页骨架内容校验
- API 健康检查和 meta 路由校验
- Worker 启动入口校验
- `docker-compose.yml` 服务声明校验

## 3. 如何运行阶段 1 测试

在仓库根目录执行：

```bash
npm run test:stage1
```

或者直接执行：

```bash
python3 -m unittest discover -s tests -p 'test_*.py'
```

## 4. 后续阶段如何继续用测试驱动开发

### 阶段 2：Avatar 系统

优先补这些测试：

- Avatar 参数 schema 校验测试
- Avatar API 创建、更新、查询测试
- Avatar 编辑器表单测试
- 3D Viewer 基础渲染 smoke test

### 阶段 3：Garment 系统

优先补这些测试：

- Garment 上传 API 测试
- Garment 分类状态流转测试
- Garment 解析任务输入输出测试

### 阶段 4：Try-on MVP

优先补这些测试：

- Try-on Job 创建测试
- Job 状态推进测试
- Result 查询测试
- 前端任务轮询和结果页测试

## 5. 推荐测试分层

建议后续保持下面这套结构：

- `tests/unit`
  - 纯函数、schema、参数映射
- `tests/integration`
  - API、数据库、队列联动
- `tests/e2e`
  - 上传到查看结果的完整链路

## 6. 当前限制

当前仓库还没有安装 Node 和 Python 依赖，所以现阶段测试以“无依赖基线校验”为主。

等阶段 2 开始后，建议补充：

- 前端：`Vitest` + `Testing Library`
- API：`pytest` + `httpx`
- E2E：`Playwright`
