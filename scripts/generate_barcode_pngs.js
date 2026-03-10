const fs = require("fs");
const path = require("path");

async function main() {
  const [, , bwipModulePath, manifestPath, outputDir] = process.argv;

  if (!bwipModulePath || !manifestPath || !outputDir) {
    throw new Error("Usage: node generate_barcode_pngs.js <bwip-module-path> <manifest-path> <output-dir>");
  }

  const bwipjs = require(bwipModulePath);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

  fs.mkdirSync(outputDir, { recursive: true });

  for (const item of manifest) {
    const png = await bwipjs.toBuffer({
      bcid: item.bcid || "code128",
      text: item.barcode,
      scale: 3,
      height: 18,
      includetext: true,
      textxalign: "center",
      textsize: 10,
      paddingwidth: 0,
      paddingheight: 0,
      backgroundcolor: "FFFFFF",
    });

    fs.writeFileSync(path.join(outputDir, item.image_name), png);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
