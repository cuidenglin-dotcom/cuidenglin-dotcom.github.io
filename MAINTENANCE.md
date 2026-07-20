# 网站维护索引

## 页面目录约定

每个独立页面使用 `pages/<页面标识>/`，其页面代码、数据和页面专属说明放在同一目录。可复用前端库统一放入 `assets/vendor/`，避免每个页面重复保存依赖。

当前新增页面：

- `pages/national-team-etf-monitor/`：国家队 ETF 份额监控。
- 日常只更新 `pages/national-team-etf-monitor/etf_history.csv`。
- 页面专属说明见 `pages/national-team-etf-monitor/README.md`。
- 公共依赖说明见 `assets/vendor/DEPENDENCIES.md`。

## 发布原则

1. 发布前备份或保留版本历史。
2. 不移动、重命名其他已有页面。
3. 首页只增加明确的页面入口，不复制业务数据。
4. 数据更新后验证主页链接、页面、CSV 和本地依赖均可访问。
5. GitHub 站点通过提交历史回滚；VPS 站点使用部署前备份回滚。

## 安全边界

维护文档不得记录服务器密码、访问令牌或私钥。凭据应通过 SSH 密钥、密码管理器或运行时环境变量提供。

