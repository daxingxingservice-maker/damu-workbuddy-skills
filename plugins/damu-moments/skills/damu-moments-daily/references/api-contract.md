# 达目社知识接口

## 默认地址

`https://pro137agent.cn/api/workbuddy/knowledge`

可用环境变量覆盖：

- `DAMU_MOMENTS_API_URL`：知识接口根地址。
- `DAMU_MOMENTS_API_TOKEN`：启用会员访问令牌时使用；不得写入 Skill 文件或公开输出。
- `DAMU_MOMENTS_DATA_DIR`：本地历史与短期缓存目录；默认 `~/.damu-moments`。

## 接口

### 状态

`GET /status`

关注字段：`ready`、`revision`、`lastSyncedAt`、`documentCount`、`failedDocuments`。

### 检索

`GET /search?q=<关键词>&limit=8&source=all`

`source` 可选 `all`、`wiki`、`daily-topic`。响应来源字段：

- `id`：稳定来源标识，用于去重记录。
- `kind`：`wiki` 或 `daily-topic`。
- `title`：来源标题。
- `excerpt`：允许用于写作的内容摘录。
- `updatedAt`：来源更新时间。
- `sourceRef`：内部追溯标识，不作为公开链接。

## 缓存与失败

- 检索成功后脚本按查询保存短期缓存。
- 网络失败时只允许回退到 24 小时内同查询缓存，并在结果中标记 `cache=fallback`。
- 没有新鲜缓存时停止写作，不以模型记忆冒充达目社知识来源。
- `revision` 变化表示飞书知识索引已更新；无需重新安装 Skill。
