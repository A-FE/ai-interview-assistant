# React 前端面试知识点

## 虚拟 DOM 与 Diff 算法

React 用虚拟 DOM（普通 JS 对象）描述 UI，状态变化时生成新的虚拟 DOM 树，与旧树 Diff 后只更新变化的真实 DOM。

Diff 策略：
1. 同层比较，不跨层级
2. 相同类型节点才 Diff，不同直接替换
3. key 属性帮助识别列表节点（避免用 index 作 key）

## useState 与 useEffect

```tsx
const [count, setCount] = useState(0);

useEffect(() => {
  document.title = `${count} 次点击`;
  return () => { /* 清理副作用 */ };
}, [count]); // 依赖数组为空 = 只执行一次
```

常见陷阱：
- 闭包陷阱：回调中使用旧 state 值，用 `setCount(prev => prev + 1)` 解决
- 依赖数组漏写导致无限循环或不更新

## useMemo / useCallback / React.memo

- `useMemo`：缓存计算结果，依赖不变则不重算
- `useCallback`：缓存函数引用，传给子组件避免不必要重渲染
- `React.memo`：对组件 props 做浅比较，props 不变则跳过渲染

```tsx
const memoValue = useMemo(() => expensiveCalc(data), [data]);
const handleClick = useCallback(() => onChange(id), [id, onChange]);
```

## React 18 新特性

- **并发模式**：可中断渲染，优先处理用户交互
- **自动批处理**：异步函数中多次 setState 自动合并
- **Suspense**：配合 lazy() 做代码分割，配合 use() 做数据获取
- **useTransition**：标记非紧急更新，保持 UI 响应

## 状态管理方案对比

| 方案 | 适合场景 | 特点 |
|------|---------|------|
| Context + useReducer | 中小型项目 | 无额外依赖，避免 prop drilling |
| Zustand | 中型项目 | 轻量，API 简洁 |
| Redux Toolkit | 大型项目 | 标准化，devtools 强 |
| Jotai/Recoil | 原子化状态 | 细粒度订阅 |

## 性能优化

1. 代码分割：React.lazy + Suspense + 路由级拆包
2. 虚拟列表：react-window/react-virtual 渲染可视区域
3. 避免不必要重渲染：memo、useMemo、useCallback
4. 图片懒加载：Intersection Observer
5. Web Workers：CPU 密集计算移出主线程

## Fiber 架构

Fiber 是 React 16 引入的可中断渲染架构。
每个组件对应一个 Fiber 节点（链表结构），可在空闲时间片段执行，保证 16ms 内响应用户交互。
两个阶段：Render（可中断，纯计算）→ Commit（不可中断，操作 DOM）
