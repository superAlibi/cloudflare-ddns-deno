import { parse } from "@std/toml";
import { parseArgs } from "@std/cli/parse-args";

export interface DomainInfo {
  zone_id: string;
  names: string[];
  base_name: string;
}

export interface Config {
  CF_API_TOKEN: string;
  DOMAINS: DomainInfo[];
}

// 验证配置对象是否符合Config接口
function isConfig(obj: unknown): obj is Config {
  if (typeof obj !== 'object' || obj === null) return false;

  const config = obj as Record<string, unknown>;

  if (typeof config.CF_API_TOKEN !== 'string') return false;
  if (!Array.isArray(config.DOMAINS)) return false;

  for (const domain of config.DOMAINS) {
    if (typeof domain !== 'object' || domain === null) return false;
    if (typeof (domain as DomainInfo).zone_id !== 'string') return false;
    if (typeof (domain as DomainInfo).base_name !== 'string') return false;
    if (!Array.isArray((domain as DomainInfo).names)) return false;
    if (!(domain as DomainInfo).names.every(name => typeof name === 'string')) return false;
  }

  return true;
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

// 合并配置
function mergeConfigs(configs: Partial<Config>[]): Config {
  const merged = configs.reduce((acc, curr) => {
    return {
      CF_API_TOKEN: curr.CF_API_TOKEN || acc.CF_API_TOKEN,
      DOMAINS: curr.DOMAINS || acc.DOMAINS,
    };
  }, { CF_API_TOKEN: '', DOMAINS: [] });

  if (!isConfig(merged)) {
    throw new Error("配置文件格式错误或缺少必要的配置项");
  }

  return merged;
}

// 从环境变量获取配置
export function getConfig(): Config {
  // 解析命令行参数
  const flags = parseArgs(Deno.args, {
    string: ['env'],
    default: { env: 'development' },
  });

  // 按优先级从低到高加载配置文件
  const configs = [
    tryReadConfig('.env.toml'),                // 基础配置，优先级最低
    tryReadConfig(`.env.${flags.env}.toml`),   // 环境特定配置
    tryReadConfig('.env.local.toml'),         // 本地配置，优先级最高
  ];

  console.log(`正在加载 ${flags.env} 环境的配置...`);

  // 合并配置，后面的配置会覆盖前面的
  return mergeConfigs(configs);
}
