# Cloudflare ipv6 DDNS 定时更新程序

这是一个使用 Deno 和 TypeScript 编写的 Cloudflare DDNS 定时更新程序。

## 功能

- 自动获取本机公网 IP
- 使用 Cloudflare API 更新 DNS 记录
- 支持 IPv4 和 IPv6

## 使用方法

1. 首先确保安装了 Deno

2. 配置环境变量或创建 `.env.toml` 文件:

```
CF_API_TOKEN = "你的Cloudflare_API_Token"

[[DOMAINS]]
zone_id = "你的域名Zone_ID"
base_name = "example.com"
names = ["@", "www"]
iface_name = "eth0"  # 可选: 指定网络接口
```

3. 运行程序:

```bash
deno run --unstable-cron --unstable-temporal --allow-net --allow-read --allow-write  --allow-env --allow-sys main.ts
```

## 配置说明

在运行程序前,你需要:

1. 登录 Cloudflare 控制台
2. 创建 API Token (需要有 DNS 编辑权限)
3. 获取你的 Zone ID
4. 配置要更新的域名
