import { getConfig } from "./config.ts";
import Cloudflare from "cloudflare";

// 日志记录函数
async function logToFile(message: string) {
  const now = new Date();
  const logMessage = `[${now.toISOString()}] ${message}\n`;
  await Deno.writeTextFile("ddns.log", logMessage, { append: true });
  console.log(logMessage.trim());
}


export class CloudflareDDNS {
  private config = getConfig();
  private client = new Cloudflare({
    apiToken: this.config.CF_API_TOKEN,
  });
  private zoneRecords = new Map<string, Cloudflare.DNS.RecordResponse.AAAARecord[]>();


  private async getPublicIP(): Promise<string> {

    // IPv6服务提供商列表
    const providers = [
      "https://api6.ipify.org?format=json",
      "https://v6.ident.me/.json",
      "https://api64.ipify.org?format=json",
      "https://ipv6.icanhazip.com"
    ];
    try {
      const responses = providers.map(provider =>
        fetch(provider)
          .then(async response => {
            if (!response.ok) throw new Error('请求失败');
            if (provider.includes('icanhazip.com')) {
              return (await response.text()).trim();
            }
            return (await response.json()).ip;
          })
      );

      const ip = await Promise.any(responses);
      return ip;
    } catch (error) {
      if (error instanceof AggregateError) {
        throw new Error('所有 IP 提供商都无法访问');
      }
      throw error;
    }
  }

  private async getDnsRecords(
    zoneId: string,
  ): Promise<Cloudflare.DNS.RecordResponse.AAAARecord[]> {
    if (!this.zoneRecords.has(zoneId)) {
      const records = await this.client.dns.records.list({
        zone_id: zoneId,
        type: 'AAAA',
      });
      const result = records.result as Cloudflare.DNS.RecordResponse.AAAARecord[];
      return result
    }
    return this.zoneRecords.get(zoneId)!;
  }

  private async updateDnsRecord(
    recordId: string,
    ipv6: string,
    zoneId: string,
    domain: string,
  ): Promise<void> {
    await this.client.dns.records.update(recordId, {
      zone_id: zoneId,
      content: ipv6,
      name: domain,
      type: 'AAAA',
      proxied: true,
    })

  }

  private async createDnsRecord(
    domain: string,
    ip: string,
    zoneId: string,
  ): Promise<void> {
    await this.client.dns.records.create({
      zone_id: zoneId,
      content: ip,
      name: domain,
      type: 'AAAA',
      proxied: true,
    }).then(() => {
      logToFile(`域名 ${domain} 的DNS记录创建成功，IP为 ${ip}`);
    }).catch((error) => {
      if (error instanceof Error) {
        throw new Error(`创建DNS记录失败: ${error.message}`);
      }
      throw error;
    })
  }

  public async update(): Promise<void> {
    try {
      await logToFile("开始执行定时DNS更新...");

      const currentIP = await this.getPublicIP();
      await logToFile(`获取到当前IP: ${currentIP}`);


      for (const domain of this.config.DOMAINS) {
        await logToFile(`开始处理域名: ${domain.base_name} `);


        // 处理收集到的唯一域名
        for (const fullDomain of domain.names) {


          await logToFile(`处理域名: ${fullDomain} `);
          const zoneId = domain.zone_id;

          try {
            const records = await this.getDnsRecords(domain.zone_id);

            if (!records.length) {
              await logToFile(`域名 ${fullDomain} 未找到DNS记录，准备创建...`);
              await this.createDnsRecord(fullDomain, currentIP, zoneId);
            } else {
              const record = records.at(0);
              if (record?.id && record?.content !== currentIP) {
                await logToFile(`域名 ${fullDomain} 的IP需要更新: ${record.content} -> ${currentIP} `);
                await this.updateDnsRecord(record.id, currentIP, zoneId, fullDomain);
                await logToFile(`域名 ${fullDomain} 的IP已更新为 ${currentIP} `);
              } else {
                await logToFile(`域名 ${fullDomain} 的IP未变更，保持为 ${currentIP} `);
              }
            }
          } catch (error) {
            // 记录错误但继续处理其他域名
            await logToFile(`处理域名 ${fullDomain} 时出错: ${(error as Error).message} `);
            continue;
          }
        }
      }
    } catch (error) {
      await logToFile(`定时DNS更新失败: ${(error as Error).message} `);
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
      await logToFile(`定时DNS更新失败: ${(error as Error).message} `);
    }
  });


}
