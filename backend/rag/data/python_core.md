# Python 核心面试知识点

## GIL（全局解释器锁）

CPython 的 GIL 使同一时刻只有一个线程执行 Python 字节码。
- 对 CPU 密集型任务：多线程无法利用多核，用 multiprocessing 或 C 扩展
- 对 I/O 密集型任务：线程在等待 I/O 时会释放 GIL，多线程有效

## 装饰器（Decorator）

```python
from functools import wraps

def log_time(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        import time
        start = time.time()
        result = func(*args, **kwargs)
        print(f"{func.__name__} 耗时: {time.time()-start:.3f}s")
        return result
    return wrapper
```

带参数的装饰器需要三层嵌套。

## 生成器（Generator）

使用 `yield` 关键字，惰性求值，节省内存。
`send()` 可以向生成器发送值，`yield from` 用于委托子生成器。

## 内存管理

- 引用计数（主要）+ 标记-清除（处理循环引用）+ 分代回收
- `__del__` 方法在引用计数为 0 时调用
- `sys.getrefcount()` 查看引用计数

## 列表推导式 vs map/filter

```python
# 列表推导式（更 Pythonic）
squares = [x**2 for x in range(10) if x % 2 == 0]

# 生成器表达式（惰性，节省内存）
gen = (x**2 for x in range(10))
```

## 多进程与多线程

- `threading.Thread`：适合 I/O 密集（爬虫、网络请求）
- `multiprocessing.Process`：适合 CPU 密集（计算、图像处理）
- `asyncio`：协程，适合高并发 I/O，单线程

## 常用数据结构复杂度

| 操作 | list | dict | set |
|------|------|------|-----|
| 查找 | O(n) | O(1) | O(1) |
| 插入末尾 | O(1) | O(1) | O(1) |
| 插入头部 | O(n) | - | - |

collections.deque 两端 O(1) 插入删除，适合队列场景。

## 元类（Metaclass）

```python
class Meta(type):
    def __new__(mcs, name, bases, namespace):
        # 在类创建时执行
        return super().__new__(mcs, name, bases, namespace)

class MyClass(metaclass=Meta):
    pass
```

## 上下文管理器

实现 `__enter__` 和 `__exit__` 方法，或使用 `@contextmanager` 装饰器。
常见：文件操作、数据库连接、锁。
