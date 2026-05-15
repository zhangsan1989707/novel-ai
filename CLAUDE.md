# Novel AI 项目配置

## 项目端口
- 开发服务器端口: **3200**
- 配置位置: `package.json` scripts.dev

## 启动命令
```bash
npm run dev  # 端口 3200
```

## 环境变量
- `DEEPSEEK_API_KEY`: DeepSeek API 密钥
- `DEEPSEEK_MODEL_ID`: 模型 ID（使用 deepseek-chat）
- `NODE_TLS_REJECT_UNAUTHORIZED=0`: 开发环境 SSL 代理（公司网络需要）
