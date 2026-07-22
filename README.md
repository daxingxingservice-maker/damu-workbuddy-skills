# 达目社 WorkBuddy Skill

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

本市场当前提供 `damu-moments`：根据持续同步的达目社知识库、每日话题和用户本地发布历史，生成真实、合规、去重的朋友圈日更。

## 本地验收

WorkBuddy 的“上传技能”要求 ZIP 根目录直接包含 `SKILL.md`。将 `plugins/damu-moments/skills/damu-moments-daily` 目录内容压缩为 `damu-moments-skill-<版本>.zip` 后上传；不要直接上传插件目录 ZIP。

也可以把本仓库配置为第三方市场后安装：

```text
/plugin marketplace add https://github.com/daxingxingservice-maker/damu-workbuddy-skills.git
/plugin install damu-moments@damu-skills
```

图形界面路径：技能/插件市场 → 添加市场 → 填入公开仓库地址 → 搜索“达目社朋友圈日更” → 安装。

被 SkillHub 收录后，用户只需对 WorkBuddy 说：

```text
安装达目社SKILL
```

WorkBuddy 会查找并要求用户确认安装；安全机制不允许无提示静默安装。

## 隐私与数据

- Skill 不包含飞书密钥，也不会直接访问飞书；达目后台每小时同步并生成公开脱敏索引。
- 检索请求只发送关键词；接口不返回飞书链接、邮箱、手机号或标记为内部使用的段落。
- 用户确认发布过的文案仅保存在其电脑的 `~/.damu-moments/`，不会上传到达目后台。
- 公共知识接口：`https://pro137agent.cn/api/workbuddy/knowledge`。

## 发布版本

1. 同步修改 `.codebuddy-plugin/marketplace.json`、插件目录内 `.codebuddy-plugin/plugin.json` 和 `.codex-plugin/plugin.json` 的语义化版本号。
2. 验证 Skill、插件清单、联网检索和本地去重脚本。
3. 推送公开市场仓库并创建版本标签。
4. 先让少量达目社用户从第三方市场安装；验收稳定后再申请收录到 WorkBuddy SkillHub。

飞书知识内容由达目后台动态同步，普通知识更新不需要发布新版 Skill。只有写作规则、脚本或接口合同变化时才升级插件版本。
