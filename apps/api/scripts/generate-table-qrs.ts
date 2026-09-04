import { createHmac } from "node:crypto";

function signQrId(qrId: string, secret: string): string {
  return createHmac("sha256", secret).update(`qr:${qrId}`).digest("hex");
}

const frontendBaseUrl =
  process.env.FRONTEND_URL ?? "https://d3-restaurant.pages.dev";
const qrSecret =
  process.env.QR_SECRET ?? "d3-production-qr-secret-replace-with-yours";
const tableCount = Number(process.env.TABLE_COUNT ?? "10");

console.log("\n=======================================================");
console.log("   D3 RESTAURANT - PRODUCTION TABLE QR CODES GENERATOR   ");
console.log("=======================================================\n");
console.log(`Frontend URL : ${frontendBaseUrl}`);
console.log(`QR Secret    : ${qrSecret.slice(0, 4)}*** (length: ${qrSecret.length})`);
console.log(`Total Tables : ${tableCount}\n`);

const results: Array<{
  table: number;
  qrId: string;
  signature: string;
  url: string;
}> = [];

for (let i = 1; i <= tableCount; i++) {
  const qrId = `qr-table-${i}`;
  const signature = signQrId(qrId, qrSecret);
  const url = `${frontendBaseUrl}/?table=${i}&qr=${qrId}&sig=${signature}`;

  results.push({ table: i, qrId, signature, url });

  console.log(`[TABLE ${i}]`);
  console.log(`  QR Identifier : ${qrId}`);
  console.log(`  Signature     : ${signature}`);
  console.log(`  Diner Link    : ${url}\n`);
}

console.log("=======================================================");
console.log("Print these links or convert them to QR codes using");
console.log("any free QR tool (e.g. Canva, qr-code-generator.com)");
console.log("and affix them to your restaurant dining tables.");
console.log("=======================================================\n");
