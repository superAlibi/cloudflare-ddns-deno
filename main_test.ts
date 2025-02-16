import { getConfig } from "./config.ts";
import NodeOS from 'node:os'
Deno.test(function getIpv6() {
  const ifaces = Deno.networkInterfaces()
  const ipv6 = ifaces
    .filter(iface => (iface.family === 'IPv6') && iface.address !== ("::1") && !iface.address.startsWith("fe80"))
    .map<[string, string]>(iface => [iface.name, iface.address])

  console.table(ipv6)
});


Deno.test(function createFile() {
  const config = getConfig()

  Deno.mkdirSync(config.logs_dir, { recursive: true })
  Deno.writeTextFile(`${config.logs_dir}/${new Date().toISOString().split('T').at(0)}test.txt`, "Hello, World!", { createNew: true });
})

Deno.test(function getIpv6FormNodeOS() {
  const infos = NodeOS.networkInterfaces()
  console.log(infos)
})