import { getConfig } from "./config.ts";

const config = getConfig();

/**
 * 获得cloudlare的zone信息
 */
export async function getZones() {
  const response = await fetch("https://api.cloudflare.com/client/v4/zones", {
    headers: {
      "Authorization": `Bearer ${config.CF_API_TOKEN}`,
      "Content-Type": "application/json",
    },
  });

  const data = await response.json();
  if (!data.success) {
    throw new Error(`获取zones失败: ${JSON.stringify(data.errors)}`);
  }

  console.log("\n可用的域名和Zone IDs：");
  console.log("------------------------");
  for (const zone of data.result) {
    console.log(`域名: ${zone.name}`);
    console.log(`Zone ID: ${zone.id}`);
    console.log("------------------------");
  }
}


/**
 * 通过外部api获得公网ipv6
 * @returns 
 */
export async function getPublicIP(): Promise<string> {

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
