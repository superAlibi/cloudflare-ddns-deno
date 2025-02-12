import { getConfig } from "./config.ts";

const config = getConfig();

async function getZones() {
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

getZones().catch(error => {
  console.error("错误:", error.message);
});
