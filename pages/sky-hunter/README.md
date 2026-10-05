# 天空猎手 · 老鹰抓鸽子

入口 `/pages/sky-hunter/`。每局 60 秒，最后 3 秒各响一声；三只鸽子、8 层难度，火圈每命中一只得 1 分。

开局填写最多 12 字的玩家名字。结束时自动保存到 VPS 数据库，确认保存后显示“已保存到服务器”。保存失败会明确提示，可点击“重试保存”；待提交成绩留在浏览器，恢复联网或重新打开游戏时自动重试。同一局有唯一成绩编号，重复重试只保存一次。

## 排行榜

- VPS 与 GitHub 网站的成绩分别保存，不互通；同一网站不同设备均可读取服务器排行榜。
- 每层显示前 5 名，但所有提交成功的成绩都保存在服务器，未上榜的也不会丢失。
- 姓名、难度、分数和服务器记录时间保存在 SQLite 中；不需要登录。
- 旧版本本机排行榜仍留在原浏览器，不会冒充服务器成绩或自动导入。
- 姓名和分数可被同一网站的其他玩家在排行榜中看到。

## 维护

前端源文件：本机 `C:/codex/eagle-game/`；只发布 index.html、style.css、game.js、README.md。

API：`https://rikkuma.kdns.fr/api/sky-hunter`。
- `GET /leaderboard?site=vps|github&level=1..8`
- `POST /scores`：submission_id、site、name、level、score；成绩编号负责幂等重试。
- `GET /health`：服务健康检查。

服务器程序：`/opt/sky-hunter-api/server.py`；systemd 服务 `sky-hunter-api`；SQLite 数据库 `/var/lib/sky-hunter/scores.sqlite3`。数据库在网站目录以外，服务重启仍保留记录；网站目录不能下载数据库。后台使用独立低权限用户，只监听本机端口 8328，由 Caddy 转发。

后端源与测试位于本机 `C:/codex/eagle-game/server/`。修改前用 SQLite 在线备份功能备份数据库，同时备份 Caddy 配置和前端。不要删除数据库来更新程序。GitHub 前端可用提交历史回滚，VPS 备份在 `/var/backups/sky-hunter-*`。
