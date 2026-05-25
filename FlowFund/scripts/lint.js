const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const files = ["index.html", "verify.html", "data.js", "app.js", "styles.css", "tests/model.test.js"];
const jsFiles = ["data.js", "app.js", "tests/model.test.js"];
const forbidden = [/TODO/i, /FIXME/i, /lorem/i, /placeholder data/i, /sample data/i, /mock/i];

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

for (const file of files) {
  const content = read(file);

  if (/[^\x00-\x7F]/.test(content)) {
    throw new Error(`${file} contains non-ASCII characters.`);
  }

  for (const pattern of forbidden) {
    if (pattern.test(content)) {
      throw new Error(`${file} contains forbidden placeholder wording: ${pattern}`);
    }
  }
}

for (const file of jsFiles) {
  const content = read(file);
  new Function(content);
}

console.log("FlowFund lint checks passed");
