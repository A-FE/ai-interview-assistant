# 算法与数据结构面试高频题

## 数组与字符串

### 双指针
适用：有序数组、回文、两数之和等

```python
def two_sum_sorted(nums, target):
    l, r = 0, len(nums) - 1
    while l < r:
        s = nums[l] + nums[r]
        if s == target: return [l, r]
        elif s < target: l += 1
        else: r -= 1
```

### 滑动窗口
适用：子数组/子串最大最小值、无重复字符最长子串

```python
def length_of_longest_substring(s):
    char_set, l, res = set(), 0, 0
    for r, c in enumerate(s):
        while c in char_set:
            char_set.remove(s[l]); l += 1
        char_set.add(c)
        res = max(res, r - l + 1)
    return res
```

## 链表

### 快慢指针
检测环：快指针每次走2步，慢指针走1步，相遇则有环。
找中间节点：快指针到末尾时慢指针在中间。

### 反转链表（迭代）

```python
def reverse_list(head):
    prev, curr = None, head
    while curr:
        nxt = curr.next
        curr.next = prev
        prev, curr = curr, nxt
    return prev
```

## 二叉树

### DFS 三种遍历（递归）
前序：根->左->右 | 中序：左->根->右 | 后序：左->右->根

### BFS 层序遍历

```python
from collections import deque
def level_order(root):
    if not root: return []
    q, res = deque([root]), []
    while q:
        level = []
        for _ in range(len(q)):
            node = q.popleft()
            level.append(node.val)
            if node.left: q.append(node.left)
            if node.right: q.append(node.right)
        res.append(level)
    return res
```

## 动态规划

### 解题框架
1. 定义状态 dp[i] 的含义
2. 找状态转移方程
3. 确定初始值和边界条件
4. 确定遍历顺序

### 经典题型
- 爬楼梯：dp[i] = dp[i-1] + dp[i-2]
- 最长公共子序列：二维dp，O(mn)
- 背包问题：0-1背包逆序遍历，完全背包正序遍历

## 排序算法复杂度

| 算法 | 平均 | 最坏 | 空间 | 稳定 |
|------|------|------|------|------|
| 快排 | O(n log n) | O(n²) | O(log n) | 否 |
| 归并 | O(n log n) | O(n log n) | O(n) | 是 |
| 堆排 | O(n log n) | O(n log n) | O(1) | 否 |
| 冒泡 | O(n²) | O(n²) | O(1) | 是 |

## 哈希表
用空间换时间，查找 O(1)。
常见应用：两数之和、字母异位词分组、LRU缓存。
