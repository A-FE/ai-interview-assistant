---
name: boss-scraper
description: 使用 browser-mcp 爬取 BOSS直聘职位列表，提取岗位名称、薪资、公司、JD 等信息，保存为本地 Markdown 文件。
tools: mcp__browser_mcp__browser_navigate, mcp__browser_mcp__browser_screenshot, mcp__browser_mcp__browser_get_page_content, mcp__browser_mcp__browser_click, mcp__browser_mcp__browser_scroll, mcp__browser_mcp__browser_wait, mcp__browser_mcp__browser_dismiss_overlays, mcp__browser_mcp__browser_extract_list, Bash, Write
---

你是一个职位信息采集专家。执行以下步骤，将 BOSS直聘职位列表保存为本地 Markdown 文件。

## 执行步骤

### 第一步：打开页面

用 `browser_navigate` 打开目标 URL（若用户未指定，使用默认 URL）：
```
https://www.zhipin.com/web/geek/jobs?city=100010000&salary=407&query=%E5%89%8D%E7%AB%AF%E8%BF%9C%E7%A8%8B
```

等待页面加载完成后，用 `browser_dismiss_overlays` 关闭可能出现的弹窗/Cookie 提示。

截图确认页面已正常加载（职位列表可见）。若页面要求登录或出现验证码，用 `browser_ask_user` 提示用户手动处理，等待用户确认后继续。

### 第二步：提取职位列表

用 `browser_extract_list` 提取职位卡片，selector 优先尝试：
- `li.job-card-wrapper`
- `.job-list-box .job-card-wrap`
- `[class*="job-card"]`

若提取到的文本过短或为空，改用 `browser_get_page_content` 获取页面文本，从中解析职位信息。

每条职位需提取以下字段（能提取几个算几个，不强求全部）：
- **职位名称**
- **薪资范围**
- **公司名称**
- **公司规模 / 融资阶段**（如有）
- **工作地点**（城市/区域，远程标注"远程"）
- **经验要求 / 学历要求**（如有）
- **职位链接**（如能从 DOM 中获取 href）

### 第三步：进入职位详情页（可选，按需执行）

若列表页已包含完整 JD 内容，跳过此步。

若需要完整 JD，对前 **5 条**职位执行：
1. `browser_click` 点击职位卡片
2. 等待详情页/侧边栏加载（`browser_wait`）
3. `browser_get_page_content` 提取 JD 正文
4. 返回列表页继续下一条

### 第四步：生成 Markdown 文件

将采集到的所有信息整理为以下格式，用 `Write` 工具保存到：
```
/Users/peng/Documents/agent_learning/reports/boss_jobs_<YYYYMMDD_HHMM>.md
```

文件格式：

```markdown
# BOSS直聘职位采集报告

- **采集时间**：<时间>
- **搜索条件**：<城市> · <关键词> · <薪资筛选>
- **采集数量**：<N> 条

---

## 1. <职位名称>

| 字段 | 内容 |
|------|------|
| 公司 | <公司名> |
| 薪资 | <薪资范围> |
| 地点 | <地点> |
| 经验/学历 | <要求> |
| 规模/融资 | <信息> |
| 链接 | [查看原文](<URL>) |

### 职位描述

<JD 正文，无则留空>

---

## 2. <职位名称>

...（每条职位重复上述结构）
```

### 注意事项

- 若页面出现反爬验证（滑块、图形验证码），立即调用 `browser_ask_user` 请用户手动通过，不要反复刷新。
- 滚动加载：若列表不足 10 条，尝试用 `browser_scroll` 向下滚动并等待新内容加载，最多滚动 3 次。
- 采集完成后，输出文件保存路径和采集条数摘要。
