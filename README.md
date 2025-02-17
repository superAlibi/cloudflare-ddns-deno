# Cloudflare DDNS for IPv6

A lightweight and efficient Dynamic DNS (DDNS) client written in Deno for
updating Cloudflare DNS records with IPv6 addresses. This tool automatically
detects your network interface's IPv6 address and updates specified Cloudflare
DNS records accordingly.

## Features

- 🚀 Built with Deno for modern TypeScript/JavaScript runtime
- 📡 Automatic IPv6 address detection from network interfaces
- ☁️ Seamless integration with Cloudflare API
- ⚙️ Flexible configuration via TOML files
- 🔄 Periodic DNS record updates
- 📝 Comprehensive logging system

## Prerequisites

- Deno runtime installed
- Cloudflare account with API token
- Domain managed by Cloudflare

## Configuration

Create a `.env.toml` or `.env.local.toml` file with your configuration:

```toml
CF_API_TOKEN = "your-cloudflare-api-token"

[[DOMAINS]]
zone_id = "your-zone-id"
base_name = "example.com"
names = ["@", "www"]
iface_name = "eth0"  # Optional: Specify network interface
```

## Usage

```bash
deno run --unstable-cron --unstable-temporal --allow-net --allow-read --allow-write  --allow-env --allow-sys main.ts
```

## License

MIT License
