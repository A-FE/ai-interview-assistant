# 数据库面试知识点

## 索引原理

InnoDB 使用 B+ 树索引：
- 所有数据存在叶子节点，叶子节点通过链表相连（支持范围查询）
- 非叶子节点只存 key，树高度低，I/O 次数少
- 聚簇索引：叶子节点存整行数据；二级索引叶子节点存主键值（回表查询）

## 索引失效场景

1. 对索引列使用函数：`WHERE YEAR(create_time) = 2024` ❌
2. 隐式类型转换：字段是 varchar，条件传数字 ❌
3. 左侧模糊匹配：`LIKE '%abc'` ❌
4. 联合索引不满足最左前缀原则
5. OR 条件中有未索引列

## 事务 ACID

- **A** 原子性：事务要么全成功要么全回滚（undo log）
- **C** 一致性：事务前后数据满足业务规则
- **I** 隔离性：并发事务互不干扰（MVCC + 锁）
- **D** 持久性：提交后数据永久保存（redo log）

## 事务隔离级别

| 隔离级别 | 脏读 | 不可重复读 | 幻读 |
|---------|------|-----------|------|
| 读未提交 | ✅ | ✅ | ✅ |
| 读已提交 | ❌ | ✅ | ✅ |
| 可重复读（MySQL默认）| ❌ | ❌ | 部分解决 |
| 串行化 | ❌ | ❌ | ❌ |

MySQL InnoDB 在可重复读级别通过 MVCC + Next-Key Lock 解决幻读。

## MVCC（多版本并发控制）

每行数据有隐藏字段：trx_id（事务ID）、roll_pointer（回滚指针）。
Read View：快照读时创建，根据事务 ID 判断可见性。
当前读（SELECT FOR UPDATE、UPDATE）会加锁。

## 慢查询优化步骤

1. `EXPLAIN` 分析执行计划（type 列：ref > range > index > ALL）
2. 查看 key 是否命中索引
3. 检查 Extra 列：Using filesort / Using temporary 需优化
4. 考虑添加联合索引，覆盖索引减少回表

## Redis 常用数据类型

| 类型 | 底层结构 | 典型用途 |
|------|---------|--------|
| String | SDS | 缓存、计数器、分布式锁 |
| Hash | ziplist/hashtable | 用户信息 |
| List | quicklist | 消息队列、最新列表 |
| Set | intset/hashtable | 去重、标签 |
| ZSet | ziplist/skiplist | 排行榜 |

## 分布式锁（Redis）

```
SET lock_key unique_value NX PX 30000
```

问题：主从切换可能导致锁丢失（Redlock 算法解决，需奇数个节点）。
