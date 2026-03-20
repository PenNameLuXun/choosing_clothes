# 总体架构设计

## 1. 产品目标

项目目标是构建一个 Web 虚拟试穿应用，支持：

- 用户自定义 3D 身材模型
- 用户上传单张服装图片
- 系统自动识别服装类别并生成试穿效果
- 浏览器内实时查看、旋转和保存试穿结果

## 2. 设计原则

- 第一版优先可落地，而不是追求研究级真实感
- 实时交互和重计算任务分离
- 前端聚焦交互和展示，重处理放到后端异步任务
- 模块化单体优先，避免过早微服务化
- 数据结构、资源格式和任务流预留升级空间

## 3. 总体分层

```text
[Web App]
- Next.js
- React Three Fiber
- Avatar Editor
- Try-on Workspace

        |
        v

[BFF / App API]
- 鉴权
- Avatar 管理
- 服装资源管理
- 试穿任务管理
- 上传签名与历史记录

        |
        +---------------------------+
        |                           |
        v                           v

[Async Job Queue]             [Core Database]
- try-on job                  - PostgreSQL
- garment parsing             - Redis
- preview rendering

        |
        v

[AI / 3D Processing Service]
- garment segmentation
- garment classification
- keypoint extraction
- template matching
- texture generation
- body fitting
- render export

        |
        v

[Object Storage / CDN]
- garment images
- masks
- textures
- glb files
- previews
```

## 4. 前端架构

推荐技术：

- `Next.js`：页面、路由、BFF、后台管理
- `TypeScript`：统一类型定义
- `React Three Fiber`：3D 视图层
- `Three.js`：底层渲染
- `Zustand`：Avatar 和试穿状态管理
- `TanStack Query`：异步请求和任务轮询

前端模块划分：

- `landing`
  - 项目介绍和入口
- `auth`
  - 登录、注册、权限控制
- `avatar-editor`
  - 身高、围度、体型参数编辑
- `garment-upload`
  - 上传服装图、裁切、预检
- `tryon-workspace`
  - 创建试穿任务、查看进度、切换结果
- `viewer-3d`
  - 3D 人体、服装和相机交互
- `history`
  - 历史任务与结果查看

## 5. 后端架构

推荐组合：

- `FastAPI`
- `PostgreSQL`
- `Redis`
- `Celery`

职责划分：

### App API

- 用户与会话管理
- Avatar CRUD
- Garment CRUD
- Try-on Job CRUD
- 任务状态回写
- 结果查询与分享

### AI / 3D Service

- 服装图背景去除
- 服装类别识别
- 轮廓和关键点提取
- 模板服装匹配
- 纹理贴图生成
- 与人体模板拟合
- 结果模型和预览图导出

## 6. 核心技术路线

### 6.1 身体模型

第一版采用参数化人体模型：

- 基础人体网格
- 一组可控的 morph targets
- 前端根据参数实时更新模型外观

输入参数建议包括：

- 性别或基础体型
- 身高
- 体重区间
- 肩宽
- 胸围
- 腰围
- 臀围
- 腿长
- 手臂长度

### 6.2 服装试穿

第一版采用“模板化 3D 服装 + 单图贴图映射”路线：

1. 用户上传服装图
2. 系统做背景去除和服装分类
3. 根据类别选择标准服装模板
4. 从图片提取纹理和局部轮廓
5. 将纹理应用到服装模板
6. 根据 Avatar 参数对模板做形变适配
7. 输出预览图和可在前端展示的 `glb`

这是第一版最稳妥的实现路径。

## 7. 异步任务流

```text
用户上传服装图
  -> App API 创建 garment 记录
  -> App API 创建 try-on job
  -> Celery 投递任务
  -> AI Service 拉取资源并处理
  -> 生成 mask / meta / texture / fitted model
  -> 回写 try-on result
  -> 前端轮询任务状态并展示结果
```

## 8. 存储设计

### PostgreSQL

存储结构化数据：

- 用户
- Avatar 参数
- Garment 元数据
- Try-on job 状态
- Try-on result 元数据

### Redis

用于：

- 任务队列
- 热点缓存
- 任务状态暂存

### 对象存储

用于：

- 原始服装图
- 去背景图
- mask
- 贴图
- 预览图
- `glb` 模型

## 9. 第一版非目标

以下能力不建议在 MVP 阶段承诺：

- 高精度单图重建真实 3D 服装
- 多层服装叠穿
- 高质量布料物理模拟
- 动作动画下的自然褶皱
- 完整真人级体型扫描

## 10. 推荐仓库结构

```text
/
  docs/
  apps/
    web/
    api/
    worker/
  packages/
    shared-types/
    avatar-engine/
    viewer-components/
  assets/
    base-body-models/
    garment-templates/
```
