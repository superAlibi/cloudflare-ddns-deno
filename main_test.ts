
Deno.test(function getIpv6() {
  const ifaces = Deno.networkInterfaces()
  console.table(ifaces)
  ifaces.filter(iface => iface.family === 'IPv6').forEach(iface => {
    console.log(iface);
  })
});

