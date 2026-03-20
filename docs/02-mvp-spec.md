# MVP 详细设计

## 1. MVP 目标

MVP 要证明三件事：

1. 用户可以在 Web 上创建一个可调 3D 身材
2. 用户可以上传单张衣服图片
3. 系统可以生成一个可在 3D 模型上查看的试穿结果

## 2. MVP 功能范围

包含：

- 邮箱或手机号登录
- Avatar 创建与编辑
- 上传单张服装图片
- 支持基础服装分类
- 创建试穿任务
- 展示任务进度
- 3D 查看试穿结果
- 保存历史记录

暂不包含：

- 多件叠穿
- 高质量布料物理模拟
- 视频试穿
- AI 自动生成真人面部
- 商业化支付系统

## 3. 用户流程

### 流程 A：创建 Avatar

1. 用户进入身材编辑器
2. 调整基础体型参数
3. 前端实时更新 3D 模型
4. 点击保存
5. 后端持久化 Avatar 配置

### 流程 B：上传衣服并试穿

1. 用户上传衣服图片
2. 后端保存原图并创建 garment 记录
3. 系统异步解析服装类别和轮廓
4. 用户选择一个 Avatar
5. 创建 try-on job
6. Worker 生成试穿结果
7. 前端轮询任务直到完成
8. 用户在 3D Viewer 中查看结果

## 4. 页面设计

### `/`

- 产品介绍
- 登录入口
- 最近案例展示

### `/avatars`

- Avatar 列表
- 新建 Avatar

### `/avatars/:id/edit`

- 身高、肩宽、胸围、腰围、臀围、腿长调整
- 3D 模型实时预览

### `/garments`

- 服装列表
- 上传入口

### `/try-on/new`

- 选择 Avatar
- 选择 Garment
- 创建试穿任务

### `/try-on/:jobId`

- 任务状态
- 预览图
- 3D 结果查看

## 5. 数据模型

### `users`

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | 主键 |
| email | varchar | 邮箱 |
| password_hash | varchar | 密码哈希 |
| created_at | timestamptz | 创建时间 |

### `avatars`

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | 主键 |
| user_id | uuid | 所属用户 |
| name | varchar | Avatar 名称 |
| base_gender | varchar | 基础体型分类 |
| height_cm | integer | 身高 |
| weight_kg | numeric | 体重 |
| shoulder_cm | numeric | 肩宽 |
| chest_cm | numeric | 胸围 |
| waist_cm | numeric | 腰围 |
| hip_cm | numeric | 臀围 |
| leg_length_cm | numeric | 腿长 |
| arm_length_cm | numeric | 臂长 |
| morph_params | jsonb | 模型参数 |
| preview_image_url | varchar | 预览图 |
| model_url | varchar | 生成的 body glb |
| created_at | timestamptz | 创建时间 |
| updated_at | timestamptz | 更新时间 |

### `garments`

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | 主键 |
| user_id | uuid | 所属用户 |
| name | varchar | 名称 |
| category | varchar | 分类 |
| image_url | varchar | 原图 |
| no_bg_url | varchar | 去背景图 |
| mask_url | varchar | mask |
| texture_url | varchar | 贴图 |
| parsed_meta | jsonb | 识别结果 |
| status | varchar | `uploaded/parsing/ready/failed` |
| created_at | timestamptz | 创建时间 |

### `tryon_jobs`

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | 主键 |
| user_id | uuid | 所属用户 |
| avatar_id | uuid | 关联 Avatar |
| garment_id | uuid | 关联 Garment |
| mode | varchar | `fast` |
| status | varchar | `queued/running/succeeded/failed` |
| progress | integer | 进度百分比 |
| current_stage | varchar | 当前阶段 |
| error_message | text | 错误信息 |
| result_id | uuid | 关联结果 |
| created_at | timestamptz | 创建时间 |
| updated_at | timestamptz | 更新时间 |

### `tryon_results`

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | 主键 |
| job_id | uuid | 关联任务 |
| preview_image_url | varchar | 渲染预览图 |
| fitted_model_url | varchar | 输出 glb |
| render_meta | jsonb | 渲染参数 |
| created_at | timestamptz | 创建时间 |

## 6. API 设计

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### Avatars

- `GET /api/avatars`
- `POST /api/avatars`
- `GET /api/avatars/:id`
- `PUT /api/avatars/:id`
- `DELETE /api/avatars/:id`

`POST /api/avatars` 请求体示例：

```json
{
  "name": "Daily Body",
  "baseGender": "female",
  "heightCm": 168,
  "weightKg": 54,
  "shoulderCm": 39,
  "chestCm": 84,
  "waistCm": 66,
  "hipCm": 90,
  "legLengthCm": 98,
  "armLengthCm": 56,
  "morphParams": {
    "bodyFat": 0.32,
    "muscle": 0.18,
    "torsoScale": 1.03
  }
}
```

### Garments

- `POST /api/uploads/sign`
- `GET /api/garments`
- `POST /api/garments`
- `GET /api/garments/:id`
- `POST /api/garments/:id/parse`

`POST /api/garments` 请求体示例：

```json
{
  "name": "White T-Shirt",
  "imageUrl": "https://cdn.example.com/raw/garment-001.png"
}
```

### Try-on Jobs

- `POST /api/try-on/jobs`
- `GET /api/try-on/jobs`
- `GET /api/try-on/jobs/:id`
- `GET /api/try-on/jobs/:id/result`

`POST /api/try-on/jobs` 请求体示例：

```json
{
  "avatarId": "a7f8a2c1-8e85-4f2f-b5ff-d2a6cb248111",
  "garmentId": "1d7cf924-6cc4-4a0a-9b91-b0b812801111",
  "mode": "fast"
}
```

## 7. 任务阶段设计

任务阶段建议统一：

1. `queued`
2. `precheck`
3. `garment_parsing`
4. `template_matching`
5. `texture_generation`
6. `body_fitting`
7. `preview_rendering`
8. `completed`

每个阶段都要回写：

- `status`
- `progress`
- `current_stage`
- `error_message`

## 8. Worker 处理流程

```text
create try-on job
  -> load avatar params
  -> load garment assets
  -> parse garment if needed
  -> choose garment template
  -> generate texture material
  -> fit template to avatar body
  -> export glb
  -> render preview image
  -> save result
  -> update job status
```

## 9. 前端状态设计

建议前端拆两类状态：

### 本地 UI 状态

- 当前选中的 Avatar
- 当前选中的 Garment
- Viewer 相机位置
- 滑杆值和临时编辑值

### 服务端状态

- Avatar 列表
- Garment 列表
- Try-on Job 详情
- Try-on Result

## 10. MVP 成功标准

MVP 完成时，应满足：

- 3 分钟内完成一次从上传到结果查看的流程
- 支持至少 3 类服装：`T-shirt`、`shirt`、`dress`
- Avatar 参数调整后，试穿结果能看出明显差异
- 结果可在浏览器稳定加载和旋转
- 失败任务可以正确提示用户
