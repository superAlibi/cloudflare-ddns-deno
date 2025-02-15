import { getConfig } from "./config.ts";
import Cloudflare from "cloudflare";

// 日志记录函数
async function logToFile(message: string, baseDir: string = getConfig().logs_dir) {
  const now = new Date();
  const logMessage = `[${now.toISOString()}] ${message}\n`;
  Deno.mkdirSync(baseDir, { recursive: true });
  await Deno.writeTextFile(`${baseDir}/cloudflare-ddns-${now.toISOString().split('T').at(0)}.log`, logMessage, { create: true, append: true });
}


export class CloudflareDDNS {
  private config = getConfig();
  private client = new Cloudflare({
    apiToken: this.config.CF_API_TOKEN,
  });
  private zoneRecords = new Map<string, Cloudflare.DNS.RecordResponse.AAAARecord[]>();
  private ifaceToAddress = new Map<string, string>();
  get ifaceAddress() {
    return this.ifaceToAddress
  }
  constructor() {
    const ifaces = Deno.networkInterfaces()
    const ipv6 = ifaces
      .filter(iface => (iface.family === 'IPv6') && iface.address !== ("::1") && !iface.address.startsWith("fe80"))
      .map<[string, string]>(iface => [iface.name, iface.address])

    this.ifaceToAddress = new Map(ipv6)
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

      for (const domain of this.config.DOMAINS) {

        await logToFile(`开始处理域名: ${domain.base_name} 与接口 ${domain.iface_name} 绑定`);

        const currentIP = domain.iface_name ? this.ifaceToAddress.get(domain.iface_name) : Array.from(this.ifaceToAddress.values())
        if (!currentIP || !currentIP.length) {
          await logToFile(domain.iface_name ? `接口 ${domain.iface_name} 未找到IP，跳过处理` : `未找到IP，跳过处理`);
          continue;
        }
        const records = await this.getDnsRecords(domain.zone_id);
        // 处理收集到的唯一域名
        for (const subDomain of domain.names) {

          const fullDomain = `${subDomain}.${domain.base_name}`;

          await logToFile(`处理域名: ${fullDomain} 与网卡接口 ${domain.iface_name} 绑定`);

          try {
            if (!records.length) {
              await logToFile(`域名 ${fullDomain} 未找到DNS记录，准备创建...`);
              await this.createDnsRecord(subDomain, Array.isArray(currentIP) ? currentIP[0] : currentIP, domain.zone_id);
            } else {
              const record = records.find(i => {
                if (subDomain === '@') {
                  return i.name === domain.base_name
                }
                return i.name === fullDomain
              })
              // 当是数组时,至少有一个ip
              const chooseIP = Array.isArray(currentIP) ? currentIP.at(0)! : currentIP;

              if (!record) {
                await logToFile(`域名 ${fullDomain} 未找到DNS记录，准备创建...`);
                await this.createDnsRecord(subDomain, chooseIP, domain.zone_id);
              } else if (record.content !== currentIP) {
                await logToFile(`域名 ${fullDomain} 的IP需要更新: ${record.content} -> ${currentIP} `);
                await this.updateDnsRecord(record.id, chooseIP, domain.zone_id, subDomain);
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
      every: 1
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