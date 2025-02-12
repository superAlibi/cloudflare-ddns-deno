import { assertEquals } from "@std/assert";
import { CloudflareDDNS } from "./main.ts";

Deno.test(async function updateTest() {
  const cfddns = new CloudflareDDNS();
  assertEquals(await cfddns.update(), void 0);
});

