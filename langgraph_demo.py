
from typing import Annotated, TypedDict
from tavily import TavilyClient
from langgraph.graph import StateGraph, END
from langchain_openai import ChatOpenAI
from langchain_core.tools import tool
from langchain_core.messages import HumanMessage, AIMessage
import operator
import os
from datetime import datetime

# 报告保存的根目录（可以根据你的项目改）
REPORTS_DIR = "./reports"

# ========== 1. 定义工具 ==========
@tool
def web_search(query: str, max_results: int = 5) -> str:
    """
    联网搜索获取最新信息。
    当你需要查找实时信息、新闻、最新数据、不确定的事实时使用这个工具。
    
    Args:
        query: 搜索关键词或问题
        max_results: 返回结果数量，默认5条
    """
    # 初始化客户端
    tavily_client = TavilyClient(api_key="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")

    response = tavily_client.search(
        query=query,
        max_results=max_results,
        search_depth="basic",      # "basic" 快便宜，"advanced" 更准但更贵
        include_answer=True,        # 让 Tavily 直接给一个总结答案
        include_raw_content=False,  # 不返回网页原始 HTML，省 token
    )
    
    # 整理成模型好读的格式
    parts = []
    
    # Tavily 自动总结的答案（最有用，直接放前面）
    if response.get("answer"):
        parts.append(f"【搜索总结】{response['answer']}")
    
    # 逐条列出来源
    parts.append("\n【参考来源】")
    for i, result in enumerate(response.get("results", []), 1):
        parts.append(
            f"{i}. {result['title']}\n"
            f"   内容: {result['content'][:300]}...\n"
            f"   链接: {result['url']}"
        )
    
    return "\n".join(parts)

@tool
def write_report(topic: str, content: str) -> str:
    """
    把调研内容整理成 Markdown 报告并保存到本地文件。
    当你完成调研、需要输出最终报告文件时使用这个工具。
    
    Args:
        topic: 报告主题，会作为标题和文件名的一部分
        content: 报告正文内容（Markdown 格式）
    """
    # 确保目录存在
    os.makedirs(REPORTS_DIR, exist_ok=True)
    
    # 生成文件名：主题 + 时间戳，避免重名覆盖
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    # 把主题里的特殊字符替换掉，保证文件名合法
    safe_topic = "".join(c if c.isalnum() or c in "一-龥-" else "_" for c in topic)[:30]
    filename = f"{timestamp}_{safe_topic}.md"
    filepath = os.path.join(REPORTS_DIR, filename)
    
    # 拼接完整的 Markdown 报告
    full_report = f"""# {topic}

> 生成时间：{datetime.now().strftime("%Y-%m-%d %H:%M:%S")}

---

{content}

---

*本报告由 AI Agent 自动生成*
"""
    
    # 写入文件
    try:
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(full_report)
    except Exception as e:
        return f"❌ 报告保存失败：{str(e)}"
    
    # 返回结果告诉模型文件存在哪了
    return f"✅ 报告已保存到本地文件：{filepath}\n文件大小：{os.path.getsize(filepath)} 字节\n共 {len(content)} 字"

# ========== 2. 定义 Agent 状态 ==========
class AgentState(TypedDict):
    messages: Annotated[list, operator.add]  # 对话历史
    research_topic: str                      # 研究主题

tools = [web_search, write_report]
tool_map = {tool.name: tool for tool in tools}

# ========== 3. 定义节点（Agent 执行的步骤） ==========
llm = ChatOpenAI(
    model="qwen3.8-max", 
    api_key=os.getenv("DASHSCOPE_API_KEY"), 
    base_url="https://llm-axtdj52skmowrf1g.cn-beijing.maas.aliyuncs.com/compatible-mode/v1"    
)
llm_with_tools = llm.bind_tools([web_search, write_report])

def agent_node(state: AgentState):
    """LLM 决策节点：决定下一步做什么"""
    print("🤔 模型正在思考...\n")
    response = llm_with_tools.invoke(state["messages"])
    return {"messages": [response]}

def tool_node(state: AgentState):
    """工具节点：调用工具"""
    last_message = state["messages"][-1]
    results = []
    for tool_call in last_message.tool_calls:
        tool_name = tool_call["name"]
        tool_args = tool_call["args"]
        print(f"🔧 调用工具：{tool_name} {tool_args}")
        result = tool_map[tool_name].invoke(tool_args)
        results.append(AIMessage(content=str(result), name=tool_name))
    return {"messages": results}

# ========== 4. 定义路由逻辑 ==========
def should_continue(state: AgentState):
    """
    判断是否继续执行
    """
    last_message = state["messages"][-1]
    if last_message.tool_calls:
        return 'tools'
    return END

# ========== 5. 构建图 ==========
workflow = StateGraph(AgentState)

# 添加节点
workflow.add_node('agent', agent_node)
workflow.add_node('tools', tool_node)

# 设置入口
workflow.set_entry_point('agent')

# 添加边
workflow.add_conditional_edges(
    'agent', 
    should_continue, 
    { "tools": 'tools', END: END }
)

# 工具执行完后，回到 agent 再思考
workflow.add_edge('tools', 'agent')

# 编译成可运行的 App
app = workflow.compile()

# ========== 6. 运行 App ==========
result = app.invoke({
    "messages": [HumanMessage(content="帮我调研一下2026年前端工程师招聘最新趋势，然后写一份简短报告，并保存到本地")],
    "research_topic": "2026 前端工程师招聘趋势"
})

print(result["messages"][-1].content)