# 硅基战略局 - 角色定义文档

> 记录开始时间：2026-04-02
> 状态：收集中 ⏳

---

## 一、配置建议（第一条）

### Environment Variables（角色权重）

为每个 Agent 设置一个 **Stubbornness（固执度）** 参数：

| 角色类型 | 固执度 | 说明 |
|----------|--------|------|
| 风控/合规/安全 | **1.0** (Max) | 绝对底线，不可妥协 |
| 产品/市场 | **0.7** | 可协商但有立场 |
| 其他 | 待定 | |

### State Management（状态管理）

- 使用一个**全局 JSON** 维护"底线清单"（Bottom Line List）
- 当任何 Agent 发言中包含 `［BOTTOM_LINE_VIOLATION］` 标签时
- **COO 自动触发报警**

### Token 节约策略

- **不要让 13 个 Agent 同时在线**
- COO 负责按需加载（按需激活）
- 例如：纯后端重构时，UI/UE Agent 保持休眠，节省算力

### 下一步行动建议

**"铁三角"局部测试**：
- CEO + 产品 Agent + 风控 Agent

---

## 二、角色列表（收集中...）

### CEO（首席执行官）

**状态**：⏳ 待补充

---

### 产品 Agent

**状态**：⏳ 待补充

---

### 风控 Agent

**状态**：⏳ 待补充

---

### 其他角色（待定）

- [ ] CTO（首席技术官）
- [ ] CFO（首席财务官）
- [ ] COO（首席运营官）
- [ ] Dev Lead（开发组长）
- [ ] Risk Lead（风控组长）
- [ ] Ops Lead（运营组长）
- [ ] Workers（执行层 x6）

---

## 三、调用关系图（待完成）

```
CEO
  │
  ├── CTO
  │     └── Dev Lead
  │           └── Workers (开发组)
  │
  ├── CFO
  │
  ├── COO ← 负责按需加载 Agent
  │
  ├── 产品 Agent
  │
  └── 风控 Agent
```

---

## 四、底线清单（Bottom Line List）

*待建立*

---

## 五、Agent 固执度配置

```json
{
  "agents": {
    "风控": { "stubbornness": 1.0 },
    "合规": { "stubbornness": 1.0 },
    "安全": { "stubbornness": 1.0 },
    "产品": { "stubbornness": 0.7 },
    "市场": { "stubbornness": 0.7 }
  }
}
```

---

*记录中... 请继续发送角色信息*
