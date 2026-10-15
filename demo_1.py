# 最小的 Agent Loop 示例

import json
import os
from openai import OpenAI
from datetime import datetime

client = OpenAI(api_key=os.getenv("DASHSCOPE_API_KEY"), base_url="https://llm-axtdj52skmowrf1g.cn-beijing.maas.aliyuncs.com/compatible-mode/v1")

# =========== 1. 定义工具 ===========
def calculate(expression: str) -> str:
    """计算表达式"""
    try:
        return str(eval(expression))
    except Exception as e:
        return f"计算错误: {e}"

def get_current_time() -> str:
    """获取当前时间"""
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    

# 工具注册
tools = {
    "calculate": calculate, 
    "get_current_time": get_current_time
}

# 工具的 JSON Schema (告诉模型有哪些工具、怎么调用)
tools_schema = [
    {
        "type": "function",
        "function": {
            "name": "calculate",
            "description": "计算给定的数学表达式",
            "parameters": {
                "type": "object",
                "properties": {
                    "expression": {
                        "type": "string",
                        "description": "要计算的数学表达式"
                    }
                },
                "required": ["expression"]
            }

        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_current_time",
            "description": "获取当前时间",
            "parameters": {}
        }
    }
]

# ================ 2. Agent Loop 核心 ================
def run_agent(user_message: str, max_steps: int = 5):
    messages = [
        {"role": "system", "content": "你是一个专业的助手，能够使用工具来回答用户的问题。"}, 
        {"role": "user", "content": user_message}
    ]

    for step in range(max_steps):
        print(f"\n--- 第 {step+1} 步 ---")

        # 调用模型，传入工具列表
        response = client.chat.completions.create(
            model="qwen3.8-max",
            messages=messages,
            tools=tools_schema,
        )

        msg = response.choices[0].message
        messages.append(msg)

        # 情况1: 模型决定调用工具
        if msg.tool_calls:
            for tool_call in msg.tool_calls:
                tool_name = tool_call.function.name
                tool_args = json.loads(tool_call.function.arguments)

                print(f"🔧 调用工具：{tool_name} {tool_args}")

                # 执行工具
                result = tools[tool_name](**tool_args)
                print(f"📤 工具执行结果：{result}")

                # 把工具结果喂给模型
                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": tool_call.id,
                        "content": result,
                    }
                )
        else:
            print(f"✅ 最终答案：{msg.content}")
            return msg.content
        
    return "达到最大步数限制"

# ================ 3. 运行示例 ================
if __name__ == "__main__":
    user_message = "计算 12345 * 6789 并获取当前时间"
    result = run_agent(user_message)
    print(result)
                
