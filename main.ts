import { getConfig } from "./config.ts";

// 日志记录函数
async function logToFile(message: string) {
  const now = new Date();
  const logMessage = `[${now.toISOString()}] ${message}\n`;
  await Deno.writeTextFile("ddns.log", logMessage, { append: true });
  console.log(logMessage.trim());
}

interface DnsRecord {
  id: string;
  name: string;
  type: string;
  content: string;
  proxied: boolean;
}

export class CloudflareDDNS {
  private config = getConfig();
  private baseUrl = "https://api.cloudflare.com/client/v4";

  private async getPublicIP(): Promise<string> {
    // IPv6服务提供商列表
    const providers = [
      "https://api6.ipify.org?format=json",
      "https://v6.ident.me/.json",
      "https://api64.ipify.org?format=json",
      "https://ipv6.icanhazip.com"
    ];

    for (const provider of providers) {
      try {
        const response = await fetch(provider);
        if (!response.ok) continue;

        // 处理纯文本响应
        if (provider.includes('icanhazip.com')) {
          const ip = await response.text();
          return ip.trim();
        }

        // 处理JSON响应
        const data = await response.json();
        return data.ip;
      } catch (error) {
        console.log(`使用 ${provider} 获取IP失败: ${(error as Error).message}`);
        continue;
      }
    }

    throw new Error('无法获取IPv6地址');
  }

  private async getDnsRecords(
    domain: string,
    zoneId: string,
  ): Promise<DnsRecord[]> {
    const response = await fetch(
      `${this.baseUrl}/zones/${zoneId}/dns_records?type=AAAA&name=${domain}`,
      {
        headers: {
          "Authorization": `Bearer ${this.config.CF_API_TOKEN}`,
          "Content-Type": "application/json",
        },
      },
    );

    const data = await response.json();
    if (!data.success) {
      throw new Error(`获取DNS记录失败: ${JSON.stringify(data.errors)}`);
    }

    return data.result;
  }

  private async updateDnsRecord(
    recordId: string,
    ip: string,
    zoneId: string,
    domain: string,
  ): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/zones/${zoneId}/dns_records/${recordId}`,
      {
        method: "PATCH",
        headers: {
          "Authorization": `Bearer ${this.config.CF_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: ip,
          name: domain,
          type: "AAAA",
          proxied: true,
        }),
      },
    );

    const data = await response.json();
    if (!data.success) {
      throw new Error(`更新DNS记录失败: ${JSON.stringify(data.errors)}`);
    }
  }

  private async createDnsRecord(
    domain: string,
    ip: string,
    zoneId: string,
  ): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/zones/${zoneId}/dns_records`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.config.CF_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: ip,
          name: domain,
          type: "AAAA",
          proxied: true,
        }),
      },
    );

    const data = await response.json();
    if (!data.success) {
      throw new Error(`创建DNS记录失败: ${JSON.stringify(data.errors)}`);
    }
  }

  public async update(): Promise<void> {
    try {
      console.log("开始更新DDNS...");

      const currentIP = await this.getPublicIP();
      await logToFile(`获取到当前IP: ${currentIP}`);

      for (const domain of this.config.DOMAINS) {
        await logToFile(`开始处理域名: ${domain.base_name}`);
        for (const name of domain.names) {
          // 处理特殊域名
          let fullDomain;
          if (name === '*' || name === '@') {
            // 对于通配符和根域名，直接使用基本域名
            fullDomain = domain.base_name;
          } else {
            // 对于其他子域名，添加前缀
            fullDomain = `${name}.${domain.base_name}`;
          }
          await logToFile(`处理子域名: ${fullDomain}`);
          const zoneId = domain.zone_id;
          const records = await this.getDnsRecords(fullDomain, zoneId);

          try {
            if (records.length === 0) {
              await logToFile(`域名 ${fullDomain} 未找到DNS记录，准备创建新记录...`);
              try {
                await this.createDnsRecord(fullDomain, currentIP, zoneId);
                await logToFile(`域名 ${fullDomain} 的DNS记录创建成功，IP为 ${currentIP}`);
              } catch (error) {
                if ((error as Error).message.includes('identical record already exists')) {
                  await logToFile(`域名 ${fullDomain} 记录已存在，尝试更新...`);
                  // 重新获取记录
                  const newRecords = await this.getDnsRecords(fullDomain, zoneId);
                  if (newRecords.length > 0) {
                    const record = newRecords[0];
                    await this.updateDnsRecord(record.id, currentIP, zoneId, record.name);
                    await logToFile(`域名 ${fullDomain} 的DNS记录更新成功，IP为 ${currentIP}`);
                  }
                } else {
                  throw error;
                }
              }
            } else {
              const record = records[0];
              if (record.content !== currentIP) {
                await logToFile(`域名 ${fullDomain} 的IP需要更新: ${record.content} -> ${currentIP}`);
                await this.updateDnsRecord(
                  record.id,
                  currentIP,
                  zoneId,
                  record.name,
                );
                await logToFile(`域名 ${fullDomain} 的DNS记录更新成功`);
              } else {
                await logToFile(`域名 ${fullDomain} 的IP未变更，保持为 ${currentIP}`);
              }
            }
          } catch (error) {
            console.error(`处理域名 ${fullDomain} 时出错: ${(error as Error).message}`);
            throw error;
          }
        }
      }
    } catch (error) {
      console.error("更新DDNS时发生错误:", (error as Error).message);
      throw error;
    }
  }
}


// 运行程序
if (import.meta.main) {
  const ddns = new CloudflareDDNS();
  // 每5分钟执行一次
  console.log('开始设置定时任务....');
  Deno.cron("ddns-cron-task", {
    minute: {
      every: 5
    },
  }, {
    // 立即执行一次
    backoffSchedule: [0]
  }, async () => {
    await logToFile('开始执行定时DNS更新...');
    try {
      await ddns.update();
      await logToFile('定时DNS更新成功');
    } catch (error) {
      await logToFile(`定时DNS更新失败: ${(error as Error).message}`);
    }
  });


}
