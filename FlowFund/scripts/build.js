const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");
const assets = ["index.html", "verify.html", "data.js", "app.js", "styles.css"];

for (const asset of assets) {
  const source = path.join(root, asset);
  if (!fs.existsSync(source)) {
    throw new Error(`Missing build asset: ${asset}`);
  }
}

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

for (const asset of assets) {
  fs.copyFileSync(path.join(root, asset), path.join(dist, asset));
}

console.log("FlowFund build created dist");
