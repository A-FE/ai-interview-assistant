# JD 输入优化与默认 JD 重构计划

## 问题分析

### 当前问题
1. **截图粘贴不友好**：用户无法直接粘贴截图到 textarea，必须先保存到本地再上传
2. **无默认 JD**：新用户进入后需要手动添加 JD，缺少快速体验的途径

### 现有实现
- 前端：`JobOpportunities.tsx` 中的 `AddJDModal` 组件
- 后端：`/api/jd/ocr` 接口支持图片 OCR 识别
- 当前流程：用户点击"上传截图"按钮 → 选择本地文件 → OCR 识别 → 填充到 textarea

## 解决方案

### 1. 支持截图粘贴（核心功能）

#### 实现思路
在 `AddJDModal` 的 textarea 上监听 `paste` 事件，检测剪贴板中的图片数据：
- 如果粘贴的是图片（`ClipboardItem` 包含 `image/*`），自动触发 OCR 识别
- 如果粘贴的是文本，保持默认行为
- 增加拖拽上传的视觉反馈（当前已有 `onDrop` 但无视觉提示）

#### 技术细节
```typescript
const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
  const items = e.clipboardData?.items
  if (!items) return
  
  // 查找图片类型的 ClipboardItem
  for (const item of Array.from(items)) {
    if (item.type.startsWith('image/')) {
      e.preventDefault() // 阻止默认粘贴行为
      const file = item.getAsFile()
      if (file) await handleImageUpload(file)
      return
    }
  }
  // 如果是文本，让默认行为继续
}
```

#### UI 改进
- 在 textarea placeholder 中明确提示"可直接粘贴截图"
- 添加拖拽时的视觉高亮边框
- OCR 识别时在 textarea 上叠加半透明遮罩（已有，保持）

### 2. 添加默认 JD（快速体验）

#### 默认 JD 内容
根据提供的截图，默认 JD 为：
```
高级前端开发工程师（远程）
香港 | 5-10年 | 本科 | 40-70K

岗位职责：
1. 主导前端架构设计，制定技术规范，把控代码质量与交付节奏
2. 主导核心模块开发：K 线图、订单簿、实时行情、资产看板
3. 推进 Web3 前端能力建设：钱包连接、链上数据展示（wagmi / ethers.js）
4. 关注并持续优化前端性能（Core Web Vitals）

任职要求：
1. 5 年以上前端经验，精通 React / Next.js、TypeScript 熟练
2. 有 TradingView 图表库和d3.js相关开发经验，具备开发金融图表（K 线图、深度图、交易盘口）或复杂动态交互表的实战案例
3. 熟悉 WebSocket、Socket.io、Server-Sent Events（SSE）等实时通信技术，具备网络异常重连、心跳检测、数据一致性校验等实时通信底层逻辑的开发经验
4. 了解 DeFi 协议机制（AMM、Perps、Lending）
5. 有AI 调用经验，能独立设计 AI 交互流
6. 了解 Web3 前端技术栈
7. 有交易所或金融类产品经验者优先

加分项
1. 良好的英语读写能力
2. 有开源贡献或个人技术影响力
```

#### 实现方式（方案 A：后端种子数据 + 标记 - **推荐**）

**优点**：
- 数据一致性好，所有新用户共享同一默认 JD
- 后端可控，方便后续更换或支持多个模板
- 前端无需硬编码长文本
- 可在管理后台动态更新

**实现步骤**：

1. **数据库迁移**：`JDSession` 表增加 `is_default` 字段（布尔型，默认 false）
   ```python
   # backend/models/jd_session.py
   is_default: Mapped[bool] = mapped_column(default=False, index=True)
   ```

2. **种子脚本**：创建 `backend/scripts/seed_default_jd.py`
   ```python
   async def seed_default_jd():
       """为所有用户创建默认 JD（如果尚未创建）"""
       # 查询所有用户
       # 对每个用户检查是否已有 is_default=True 的 JDSession
       # 如果没有，创建一条 is_default=True 的记录
       # jd_text 为上述内容，调用 extract_jd_summary 填充 summary
   ```

3. **注册时自动创建**：在 `/api/auth/register` 和 `/api/auth/guest` 中，用户创建成功后调用创建默认 JD 的逻辑
   ```python
   # backend/routers/auth.py
   from backend.scripts.seed_default_jd import create_default_jd_for_user
   
   # 在 register() 和 guest() 末尾：
   await create_default_jd_for_user(db, new_user.id)
   ```

4. **前端列表处理**：
   - `/api/jd/sessions` 返回时，默认 JD 始终排在最后（或用特殊标记高亮）
   - 默认 JD 可以删除，删除后不再显示（不自动重建）
   - UI 上用淡色徽章标注"示例 JD"或"模板"

5. **启动脚本更新**：在 `start.sh` 或 `backend/main.py` 启动时检查并补种
   ```python
   # backend/main.py startup event
   @app.on_event("startup")
   async def startup():
       await init_db()
       await ensure_default_jds()  # 为所有缺少默认 JD 的用户补种
   ```

#### 实现方式（方案 B：前端本地模板 - 备选）

**优点**：
- 实现简单，无需数据库迁移
- 用户可以随时"加载模板"

**缺点**：
- 每次加载都是新会话，数据冗余
- 无法统计模板使用情况

**实现**：
```typescript
// frontend/src/constants/default-jd.ts
export const DEFAULT_JD_TEXT = `...`

// JobOpportunities.tsx
<button onClick={() => setJdText(DEFAULT_JD_TEXT)}>
  📋 加载示例 JD
</button>
```

**推荐使用方案 A**，理由：
- 新用户进入即可看到完整的分析流程演示
- 避免空列表的困惑感
- 示例数据与真实数据流程一致，降低学习成本

### 3. UI/UX 优化细节

#### AddJDModal 改进
- 增加明确的视觉提示："支持粘贴截图 (Ctrl+V / ⌘V)"
- 拖拽区域增加虚线边框 + 悬停高亮效果
- OCR 识别时显示进度提示（保持现有实现）

#### JobOpportunities 页面
- 如果列表为空且是新用户，显示引导："👋 已为你准备了一个示例 JD，点击查看"
- 默认 JD 卡片右上角增加"示例"徽章
- 允许用户删除示例 JD（删除后不重建）

## 实施步骤

### Phase 1: 截图粘贴功能（优先级：高）
1. ✅ 修改 `JobOpportunities.tsx` 中的 `AddJDModal`
   - 添加 `handlePaste` 事件处理器
   - 更新 placeholder 文案
   - 增强拖拽视觉反馈
2. ✅ 测试各种场景
   - 粘贴图片
   - 粘贴文本
   - 拖拽图片
   - 混合场景

### Phase 2: 默认 JD（优先级：高）
1. ✅ 数据库迁移：`JDSession` 增加 `is_default` 字段
2. ✅ 创建种子脚本 `backend/scripts/seed_default_jd.py`
3. ✅ 修改认证路由，注册/游客登录时自动创建默认 JD
4. ✅ 前端列表展示优化
   - 默认 JD 排序（置于末尾或顶部）
   - 添加"示例"标记
   - 允许删除
5. ✅ 更新启动脚本，确保现有用户也能获得默认 JD

### Phase 3: 文档与测试
1. ✅ 更新 CLAUDE.md，说明新功能
2. ✅ 补充用户引导文案
3. ✅ 端到端测试

## 潜在问题与应对

### 问题 1：粘贴事件与文本输入冲突
- 解决：只在检测到 `image/*` 类型时才 `preventDefault()`

### 问题 2：默认 JD 数据量过大
- 解决：`is_default=True` 的记录只保留一条，删除后不重建

### 问题 3：OCR 识别失败率
- 当前已有错误提示，保持不变
- 后续可考虑支持多模型切换（qwen-vl / gpt-4-vision）

### 问题 4：默认 JD 内容过时
- 方案 A 支持后端动态更新
- 可在管理后台增加"更新默认模板"功能

## 验收标准

### 截图粘贴功能
- [ ] 用户可在 textarea 中按 Ctrl+V / ⌘V 直接粘贴截图
- [ ] 粘贴后自动触发 OCR 识别
- [ ] 粘贴文本时保持原有行为
- [ ] 拖拽图片时有明确视觉反馈
- [ ] placeholder 明确提示支持粘贴截图

### 默认 JD 功能
- [ ] 新注册用户自动拥有一条默认 JD
- [ ] 游客登录也自动拥有默认 JD
- [ ] 默认 JD 在列表中有"示例"标记
- [ ] 用户可以删除默认 JD
- [ ] 删除后不再自动重建
- [ ] 现有用户启动后也能获得默认 JD（可选）

### 用户体验
- [ ] 新用户进入后立即看到可用的 JD
- [ ] 所有交互有明确反馈（loading / error / success）
- [ ] 响应式设计在移动端也可用

## 工作量评估

- 截图粘贴功能：**2-3 小时**
- 默认 JD 后端实现：**3-4 小时**
- 前端 UI 优化：**2 小时**
- 测试与文档：**1-2 小时**

**总计：8-11 小时**

## 依赖与风险

### 依赖
- 阿里云百炼 Vision API（已有）
- SQLite 数据库迁移工具（SQLAlchemy 自动处理）

### 风险
- **低风险**：纯增量功能，不影响现有流程
- 数据库迁移需要在生产环境执行（`is_default` 字段）
- 现有用户的默认 JD 创建逻辑需要异步处理（避免阻塞启动）

## 后续优化方向

1. **多模板支持**：不限于一个默认 JD，可选择"前端"、"后端"、"算法"等不同模板
2. **JD 收藏夹**：用户可以将常用 JD 标记为收藏
3. **批量导入**：支持从招聘网站批量导入 JD
4. **历史记录同步**：支持跨设备同步 JD 记录
