---
name: commit-code
description: "提交代码时使用。当用户说"提交代码"、"commit"、"推送"或类似表述时触发。自动生成简短修改摘要（以'修改内容：'开头），然后执行 git pull --rebase、git add、git commit、git push 同步远程仓库。"
---

# Commit Code

## When to Use
用户说"提交代码"、"commit"、"push"或任何提交/推送相关的短语时使用此 skill。

## Workflow

1. **生成修改摘要**
   - 先 `git diff --stat` 查看改动的文件列表
   - 用"修改内容："开头，简短概括修改点，一行以内
   - 示例：`修改内容：修复逐笔成交缓存TTL，添加分时图兜底恢复`

2. **同步远程**
   - `git pull --rebase`

3. **提交推送**
   - `git add -A`
   - 用上面的摘要作为 commit message 执行 `git commit -m "xxx"`
   - `git push`

如果 merge 冲突，提示用户手动解决。
