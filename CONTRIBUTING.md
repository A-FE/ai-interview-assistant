# Contributing to AI Interview Assistant

感谢你对本项目的关注！我们欢迎任何形式的贡献。

## 如何贡献

### 报告 Bug

如果你发现了 bug，请[创建 Issue](https://github.com/A-FE/ai-interview-assistant/issues/new) 并包含：

- 🐛 清晰的问题描述
- 📝 复现步骤
- 💻 你的环境信息（OS、Python 版本、Node 版本）
- 📸 截图（如果适用）

### 提出新功能

我们欢迎新想法！请先[创建 Issue](https://github.com/A-FE/ai-interview-assistant/issues/new) 讨论：

- 💡 功能描述和使用场景
- 🎯 预期效果
- 🤔 可能的实现方式

### 提交代码

1. **Fork 本仓库**

2. **创建特性分支**
   ```bash
   git checkout -b feature/your-feature-name
   # 或
   git checkout -b fix/your-bug-fix
   ```

3. **编写代码**
   - 遵循现有代码风格
   - 添加必要的注释
   - 确保代码可以通过 lint 检查

4. **测试你的更改**
   ```bash
   # 后端测试
   cd backend && python -m pytest
   
   # 前端 lint
   cd frontend && npm run lint
   ```

5. **提交更改**
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   # 或
   git commit -m "fix: fix your bug description"
   ```
   
   Commit message 格式：
   - `feat:` 新功能
   - `fix:` Bug 修复
   - `docs:` 文档更新
   - `style:` 代码格式调整
   - `refactor:` 代码重构
   - `test:` 测试相关
   - `chore:` 构建/工具链相关

6. **推送到你的 Fork**
   ```bash
   git push origin feature/your-feature-name
   ```

7. **创建 Pull Request**
   - 在 GitHub 上创建 PR
   - 清晰描述你的更改
   - 关联相关 Issue（如 `Closes #123`）

## 开发环境设置

### 后端

```bash
# 创建虚拟环境
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt

# 配置环境变量
cp .env.example .env
# 编辑 .env，填入 DASHSCOPE_API_KEY

# 启动开发服务器
uvicorn backend.main:app --reload
```

### 前端

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

## 代码规范

### Python（后端）

- 遵循 PEP 8 规范
- 使用类型提示（Type Hints）
- 函数和类添加 Docstring
- 示例：
  ```python
  async def get_user(user_id: int) -> User | None:
      """
      根据 ID 获取用户信息
      
      Args:
          user_id: 用户 ID
          
      Returns:
          User 对象，不存在时返回 None
      """
      pass
  ```

### TypeScript（前端）

- 使用 TypeScript 严格模式
- 组件使用函数式写法
- Props 定义清晰的类型
- 示例：
  ```typescript
  interface ChatWindowProps {
    messages: Message[]
    onSend: (text: string) => void
  }
  
  export function ChatWindow({ messages, onSend }: ChatWindowProps) {
    // ...
  }
  ```

## 项目结构

```
backend/
├── agents/          # LangGraph Agents
├── models/          # SQLAlchemy ORM 模型
├── routers/         # FastAPI 路由
├── tools/           # Agent 工具（RAG、沙箱等）
└── rag/             # 知识库相关

frontend/
├── src/
│   ├── pages/       # 页面组件
│   ├── components/  # 可复用组件
│   ├── api/         # API 封装
│   ├── hooks/       # 自定义 Hooks
│   └── types/       # TypeScript 类型定义
```

## 测试

### 后端测试（TODO）

```bash
pytest tests/
```

### 前端测试（TODO）

```bash
npm test
```

## 文档

- 更新相关文档（README.md、API 文档等）
- 为新功能添加使用示例
- 更新 CHANGELOG.md（如果有）

## 行为准则

- 尊重所有贡献者
- 提供建设性反馈
- 专注于技术讨论
- 包容不同的观点和经验水平

## 问题和支持

- 📮 提交 Issue：[GitHub Issues](https://github.com/A-FE/ai-interview-assistant/issues)
- 💬 讨论：[GitHub Discussions](https://github.com/A-FE/ai-interview-assistant/discussions)

## 感谢

感谢所有为本项目做出贡献的开发者！🙏

---

再次感谢你的贡献！❤️
