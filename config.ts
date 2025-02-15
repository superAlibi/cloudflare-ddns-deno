import { parse } from "@std/toml";
import { parseArgs } from "@std/cli/parse-args";
import { deepMerge } from '@cross/deepmerge'

export interface DomainInfo {
  zone_id: string;
  names: string[];
  base_name: string;
  iface_name?: string;
}

export interface Config {
  CF_API_TOKEN: string;
  logs_dir: string;
  DOMAINS: DomainInfo[];
}



// 尝试读取配置文件
function tryReadConfig(filename: string): Partial<Config> {
  try {
    const content = Deno.readTextFileSync(filename);
    return parse(content) as Partial<Config>;
  } catch {
    // 如果文件不存在或读取失败，返回空对象
    return {};
  }
}


// 从环境变量获取配置
export function getConfig(): Config {
  // 解析命令行参数
  const flags = parseArgs(Deno.args, {
    string: ['env'],
    default: { env: '' },
  });

  // 按优先级从低到高加载配置文件
  const configs = [
    tryReadConfig('.env.toml'),                // 基础配置，优先级最低
    tryReadConfig(`.env.${flags.env}.toml`),   // 环境特定配置
    tryReadConfig('.env.local.toml'),         // 本地配置，优先级最高
  ];

  console.log(`正在加载环境配置...`);

  const result = deepMerge(...configs) as Config;
  return result;
}
