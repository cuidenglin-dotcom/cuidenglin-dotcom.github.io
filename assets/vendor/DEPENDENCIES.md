# 前端依赖清单

依赖统一放在站点级 `assets/vendor/`，供后续页面复用。生产页面不依赖第三方 CDN。

| 组件 | 版本 | 本地入口 | 许可证 | SHA-256 |
|---|---:|---|---|---|
| Tailwind CSS Browser | 4.3.3 | `tailwindcss/4.3.3/browser.js` | MIT | `A60C785630A06196808CBE79E6F7BDB4ABCC8F4421A47B56F29338FC84805E3B` |
| Chart.js | 4.4.7 | `chartjs/4.4.7/chart.umd.min.js` | MIT | `206B6E8BB00FC7BBA2C7EE80CA41DB3E9E05BA7BE0AA35ABEBA9CFD5357F5D0E` |
| Font Awesome Free CSS | 6.5.2 | `fontawesome/6.5.2/css/all.min.css` | Font Awesome Free License | `5CEAABA22D75B58E04150311F596306562A3E595E27ED4B1DFA451B82DDA9E50` |

Font Awesome 字体文件 SHA-256：

- `fa-solid-900.woff2`: `AE17C16AFBEA216707B2203EA1CF9BDB45B9BFE47D0F4AE3258DDBC6294DD02F`
- `fa-regular-400.woff2`: `C27DA6F833431DA5AA295C44540BFAC0FD8270BA6A3C4346427006D8A7B34B76`
- `fa-brands-400.woff2`: `232C6F6A7678304F9EFAA26F30B1610DEBC2BA9F4CD636B5E6751C8D73761B92`

上游来源：

- Tailwind CSS Browser: `https://www.npmjs.com/package/@tailwindcss/browser`
- Chart.js: `https://www.jsdelivr.com/package/npm/chart.js`
- Font Awesome Free: `https://cdnjs.com/libraries/font-awesome`

升级依赖时应新建版本目录，不覆盖旧版本；修改页面引用后完成桌面、iPad 和手机回归测试，再删除没有任何页面引用的旧版本。下载文件后应重新记录 SHA-256。

