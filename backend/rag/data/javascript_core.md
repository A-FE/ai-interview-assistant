# JavaScript 核心面试知识点

## 事件循环（Event Loop）

JavaScript 是单线程语言，通过事件循环实现异步。执行顺序：
1. 同步代码（调用栈）
2. 微任务队列（Promise.then、MutationObserver、queueMicrotask）
3. 宏任务队列（setTimeout、setInterval、I/O、MessageChannel）

```js
console.log(1);
setTimeout(() => console.log(2), 0);
Promise.resolve().then(() => console.log(3));
console.log(4);
// 输出：1 4 3 2
```

追问方向：Node.js 事件循环与浏览器的区别（libuv 六个阶段）

## 闭包（Closure）

函数能访问其定义时词法作用域中的变量，即使函数在该作用域外执行。

用途：数据封装、函数工厂、模块化、防抖节流。

常见陷阱：循环中的闭包变量共享问题，用 let 或 IIFE 解决。

## 原型链与继承

每个对象都有 `__proto__` 指向其构造函数的 `prototype`。
查找属性时沿原型链向上查找，直到 `null`。

ES6 class 语法是原型继承的语法糖。

## Promise 与 async/await

Promise 三种状态：pending → fulfilled / rejected，状态不可逆。

```js
async function fetchData() {
  try {
    const res = await fetch('/api/data');
    return await res.json();
  } catch (err) {
    console.error(err);
  }
}
```

手写 Promise.all：所有 promise 都 resolve 才 resolve，任一 reject 即 reject。

## 垃圾回收

V8 使用分代回收：新生代（Scavenge 算法）+ 老生代（Mark-Sweep + Mark-Compact）。
常见内存泄漏：全局变量、未清除的定时器/事件监听、闭包引用大对象。

## var / let / const 区别

| 特性 | var | let | const |
|------|-----|-----|-------|
| 作用域 | 函数/全局 | 块级 | 块级 |
| 变量提升 | ✅ | ❌ (TDZ) | ❌ (TDZ) |
| 重复声明 | ✅ | ❌ | ❌ |
| 重新赋值 | ✅ | ✅ | ❌ |

## 深拷贝 vs 浅拷贝

浅拷贝：Object.assign、扩展运算符，只复制第一层。
深拷贝：JSON.parse(JSON.stringify())（不支持函数/循环引用）、structuredClone()、递归实现。
