# RAG 知识库部署问题解决方案

## 问题根源

1. **向量数据库被 .gitignore 排除**：`chroma_db/` 在 `.gitignore` 中，不会提交到 Git
2. **知识文档在仓库中**：`backend/rag/data/*.md` 共 7 个文件（约 500 行内容）已提交
3. **初始化依赖 API key**：`init_kb.py` 需要 `DASHSCOPE_API_KEY` 才能生成 embeddings
4. **部署时机问题**：
   - 在 Build Command 中运行 `python -m backend.rag.init_kb`
   - Render 等平台的 Build 阶段可能没有环境变量
   - 即使有，Build 生成的文件可能不会持久化到运行时容器

## 解决方案对比

### 方案 A：启动时自动初始化（推荐）✅

**优点**：
- 零手动操作，用户无感知
- 适用于所有云平台
- 自动检测是否已初始化，避免重复工作
- 知识文档更新后重新部署即可生效

**缺点**：
- 首次启动慢 30-60 秒（仅首次）
- 需要在运行时生成向量数据

**实施步骤**：
1. 在 `backend/main.py` 的 `lifespan` 中添加知识库初始化逻辑
2. 检测 `chroma_db/` 是否存在且有数据
3. 如果不存在或为空，自动运行 `init_knowledge_base()`
4. 添加日志记录，方便排查问题

### 方案 B：将向量数据库提交到 Git

**优点**：
- 部署后立即可用
- 无需运行时初始化

**缺点**：
- 向量数据是二进制文件，不适合版本控制（1.2MB 且会随文档更新）
- 每次知识文档更新需要重新生成并提交向量数据
- Git 仓库体积增大
- 不同 embedding 模型生成的向量不兼容

### 方案 C：提供管理接口手动初始化

**优点**：
- 可控性强
- 可以随时重新初始化

**缺点**：
- 需要额外开发管理界面
- 用户需要手动操作
- 不符合 "零配置部署" 的目标

## 推荐方案：方案 A（启动时自动初始化）

### 实施细节

#### 1. 修改 `backend/main.py`

在 `lifespan` 函数中添加：

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    
    # 自动初始化 RAG 知识库
    from backend.rag.init_kb import init_knowledge_base, check_kb_exists
    try:
        if not check_kb_exists():
            logger.info("检测到知识库未初始化，开始初始化...")
            init_knowledge_base()
            logger.info("✅ 知识库初始化完成")
        else:
            logger.info("知识库已存在，跳过初始化")
    except Exception as e:
        logger.error(f"知识库初始化失败: {e}")
        logger.warning("应用将继续启动，但 RAG 功能可能不可用")
    
    yield
```

#### 2. 修改 `backend/rag/init_kb.py`

添加检测函数：

```python
def check_kb_exists() -> bool:
    """检查知识库是否已初始化且有数据"""
    from pathlib import Path
    persist_dir = Path(settings.chroma_persist_dir)
    
    if not persist_dir.exists():
        return False
    
    # 检查是否有 chroma.sqlite3 文件且大小 > 0
    db_file = persist_dir / "chroma.sqlite3"
    if not db_file.exists() or db_file.stat().st_size < 1024:
        return False
    
    # 可选：连接并检查集合是否有文档
    try:
        from langchain_chroma import Chroma
        from langchain_openai import OpenAIEmbeddings
        
        embeddings = OpenAIEmbeddings(
            model="text-embedding-v3",
            api_key=settings.dashscope_api_key,
            base_url=settings.llm_base_url,
        )
        vectorstore = Chroma(
            collection_name=settings.chroma_collection,
            persist_directory=str(persist_dir),
            embedding_function=embeddings,
        )
        count = vectorstore._collection.count()
        return count > 0
    except:
        return False
```

优化 `init_knowledge_base()`：

```python
def init_knowledge_base():
    """初始化或重新初始化知识库"""
    print("🔄 初始化面试知识库...")
    
    # 确保持久化目录存在
    persist_dir = Path(settings.chroma_persist_dir)
    persist_dir.mkdir(parents=True, exist_ok=True)
    
    # ... 现有的初始化逻辑 ...
```

#### 3. 更新 `DEPLOYMENT.md`

移除 Build Command 中的 `&& python -m backend.rag.init_kb`，改为：

```markdown
**后端服务（Render.com）**：
- Build Command: `pip install -r requirements.txt`
- Start Command: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`
- 在 Environment 页面添加环境变量

**注意**：知识库会在首次启动时自动初始化（约需 30-60 秒），后续启动无需重新初始化。
```

#### 4. 优化：添加健康检查端点

在 `backend/main.py` 中添加：

```python
@app.get("/health")
async def health():
    from pathlib import Path
    kb_status = "ok" if Path(settings.chroma_persist_dir).exists() else "initializing"
    return {
        "status": "ok",
        "service": "JobPrep Agent",
        "knowledge_base": kb_status
    }
```

## 测试计划

### 本地测试

1. 删除 `chroma_db/` 目录
2. 重启后端服务
3. 检查日志：应该看到 "检测到知识库未初始化，开始初始化..."
4. 等待初始化完成
5. 测试 RAG 接口：`GET /api/rag/docs`

### 模拟部署环境测试

1. 在干净的环境中 clone 仓库
2. 设置环境变量
3. 启动服务
4. 验证知识库自动初始化

## 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 初始化失败（API key 无效） | RAG 功能不可用 | 捕获异常，记录日志，应用继续启动 |
| 初始化超时（云平台健康检查失败） | 部署失败 | 设置合理的健康检查延迟（60-90 秒） |
| 并发启动（多实例同时初始化） | 资源浪费 | 使用文件锁或检查机制 |
| 向量数据损坏 | RAG 返回错误结果 | 提供手动重新初始化接口 |

## 额外改进（可选）

### 1. 添加管理接口（用于手动重新初始化）

```python
@router.post("/api/admin/reinit-kb")
async def reinit_knowledge_base(current_user: User = Depends(get_current_user)):
    """重新初始化知识库（管理员功能）"""
    if current_user.is_guest:
        raise HTTPException(403, detail="游客无此权限")
    
    try:
        import shutil
        from pathlib import Path
        # 删除旧数据
        kb_dir = Path(settings.chroma_persist_dir)
        if kb_dir.exists():
            shutil.rmtree(kb_dir)
        # 重新初始化
        from backend.rag.init_kb import init_knowledge_base
        init_knowledge_base()
        return {"status": "ok", "message": "知识库已重新初始化"}
    except Exception as e:
        raise HTTPException(500, detail=f"初始化失败: {str(e)}")
```

### 2. 添加知识库状态查询接口

```python
@router.get("/api/rag/status")
async def get_kb_status():
    """查询知识库状态"""
    from backend.rag.init_kb import check_kb_exists
    exists = check_kb_exists()
    
    if exists:
        # 统计文档数量
        vectorstore = _get_vectorstore()
        count = vectorstore._collection.count()
        return {
            "status": "ready",
            "document_count": count,
            "collection": settings.chroma_collection
        }
    else:
        return {
            "status": "not_initialized",
            "message": "知识库未初始化或为空"
        }
```

## 总结

推荐采用 **方案 A：启动时自动初始化**，这是最适合云原生部署的方案。修改点：

1. `backend/main.py` — 添加自动初始化逻辑
2. `backend/rag/init_kb.py` — 添加 `check_kb_exists()` 函数
3. `DEPLOYMENT.md` — 更新部署说明
4. 可选：添加健康检查和管理接口

首次启动会慢一些，但后续启动正常，且用户无需任何手动操作。
