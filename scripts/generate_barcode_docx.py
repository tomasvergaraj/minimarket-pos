from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import zipfile
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from xml.sax.saxutils import escape

import psycopg
from dotenv import dotenv_values


ROOT = Path(__file__).resolve().parents[1]
ENV_PATH = ROOT / "server-fastapi" / ".env"
BWIP_MODULE_PATH = ROOT / "client-electron-pos" / "node_modules" / "bwip-js"
BARCODE_RENDERER = ROOT / "scripts" / "generate_barcode_pngs.js"
DEFAULT_OUTPUT = ROOT / "artifacts" / "barcodes" / f"codigos-barras-prueba-{datetime.now().strftime('%Y-%m-%d')}.docx"

NS_REL = "http://schemas.openxmlformats.org/package/2006/relationships"
NS_DOC = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
NS_CT = "http://schemas.openxmlformats.org/package/2006/content-types"

PAGE_WIDTH_TWIPS = 11906
PAGE_HEIGHT_TWIPS = 16838
MARGIN_TWIPS = 720
COLUMN_WIDTH_TWIPS = 5200

IMAGE_WIDTH_EMU = 2_650_000
IMAGE_HEIGHT_EMU = 1_100_000


@dataclass
class ProductLabel:
    sku: str
    name: str
    barcode: str
    is_active: bool
    image_name: str
    symbology: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Genera un DOCX con codigos de barra desde la base de datos.")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="Ruta del archivo .docx a generar.")
    parser.add_argument("--limit", type=int, default=None, help="Limita la cantidad de productos incluidos.")
    parser.add_argument("--include-inactive", action="store_true", help="Incluye productos inactivos.")
    return parser.parse_args()


def load_products(include_inactive: bool = False, limit: int | None = None) -> list[ProductLabel]:
    env = dotenv_values(ENV_PATH)
    database_url = env.get("DATABASE_URL")

    if not database_url:
        raise RuntimeError(f"No se encontro DATABASE_URL en {ENV_PATH}")

    filters = [
        "barcode is not null",
        "btrim(barcode) <> ''",
        "char_length(btrim(barcode)) = 13",
        "btrim(barcode) ~ '^[0-9]+$'",
    ]

    if not include_inactive:
        filters.append("is_active = true")

    query = f"""
        select sku, name, btrim(barcode) as barcode, is_active
        from products
        where {' and '.join(filters)}
        order by name asc
    """

    if limit:
        query += " limit %(limit)s"

    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            cur.execute(query, {"limit": limit} if limit else None)
            rows = cur.fetchall()

    return [
        ProductLabel(
            sku=sku,
            name=name,
            barcode=barcode,
            is_active=is_active,
            image_name=f"barcode-{index:03d}.png",
            symbology="ean13" if is_valid_ean13(barcode) else "code128",
        )
        for index, (sku, name, barcode, is_active) in enumerate(rows, start=1)
    ]


def is_valid_ean13(barcode: str) -> bool:
    if len(barcode) != 13 or not barcode.isdigit():
        return False

    digits = [int(char) for char in barcode]
    total = sum(value if index % 2 == 0 else value * 3 for index, value in enumerate(digits[:-1]))
    check_digit = (10 - (total % 10)) % 10
    return check_digit == digits[-1]


def render_barcode_images(products: list[ProductLabel], image_dir: Path) -> None:
    image_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = image_dir / "manifest.json"
    manifest_path.write_text(
        json.dumps(
            [{"barcode": product.barcode, "image_name": product.image_name, "bcid": product.symbology} for product in products],
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    subprocess.run(
        ["node", str(BARCODE_RENDERER), str(BWIP_MODULE_PATH), str(manifest_path), str(image_dir)],
        check=True,
        cwd=ROOT,
    )


def make_paragraph(
    text: str,
    *,
    bold: bool = False,
    size: int = 18,
    align: str = "center",
    spacing_before: int = 0,
    spacing_after: int = 80,
) -> str:
    bold_xml = "<w:b/>" if bold else ""
    return (
        f'<w:p><w:pPr><w:jc w:val="{align}"/><w:spacing w:before="{spacing_before}" '
        f'w:after="{spacing_after}" w:line="240" w:lineRule="auto"/></w:pPr>'
        f'<w:r><w:rPr>{bold_xml}<w:sz w:val="{size}"/><w:szCs w:val="{size}"/></w:rPr>'
        f'<w:t xml:space="preserve">{escape(text)}</w:t></w:r></w:p>'
    )


def make_image_paragraph(rel_id: str, docpr_id: int, product: ProductLabel) -> str:
    image_name = escape(product.image_name)
    return f"""
        <w:p>
          <w:pPr>
            <w:jc w:val="center"/>
            <w:spacing w:before="20" w:after="30"/>
          </w:pPr>
          <w:r>
            <w:drawing>
              <wp:inline distT="0" distB="0" distL="0" distR="0">
                <wp:extent cx="{IMAGE_WIDTH_EMU}" cy="{IMAGE_HEIGHT_EMU}"/>
                <wp:effectExtent l="0" t="0" r="0" b="0"/>
                <wp:docPr id="{docpr_id}" name="{image_name}"/>
                <wp:cNvGraphicFramePr>
                  <a:graphicFrameLocks noChangeAspect="1"/>
                </wp:cNvGraphicFramePr>
                <a:graphic>
                  <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
                    <pic:pic>
                      <pic:nvPicPr>
                        <pic:cNvPr id="{docpr_id}" name="{image_name}"/>
                        <pic:cNvPicPr/>
                      </pic:nvPicPr>
                      <pic:blipFill>
                        <a:blip r:embed="{rel_id}"/>
                        <a:stretch><a:fillRect/></a:stretch>
                      </pic:blipFill>
                      <pic:spPr>
                        <a:xfrm>
                          <a:off x="0" y="0"/>
                          <a:ext cx="{IMAGE_WIDTH_EMU}" cy="{IMAGE_HEIGHT_EMU}"/>
                        </a:xfrm>
                        <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
                      </pic:spPr>
                    </pic:pic>
                  </a:graphicData>
                </a:graphic>
              </wp:inline>
            </w:drawing>
          </w:r>
        </w:p>
    """.strip()


def make_cell_xml(product: ProductLabel | None, rel_id: str | None, docpr_id: int) -> str:
    if product is None or rel_id is None:
        inner = "<w:p/>"
    else:
        inner = "".join(
            [
                make_paragraph(product.name, bold=True, size=18, spacing_after=20),
                make_paragraph(f"SKU: {product.sku}", size=16, spacing_after=10),
                make_paragraph(f"Formato: {'EAN-13' if product.symbology == 'ean13' else 'Code128'}", size=14, spacing_after=10),
                make_image_paragraph(rel_id, docpr_id, product),
                make_paragraph(product.barcode, size=16, spacing_before=0, spacing_after=120),
            ]
        )

    return (
        f'<w:tc><w:tcPr><w:tcW w:w="{COLUMN_WIDTH_TWIPS}" w:type="dxa"/>'
        '<w:vAlign w:val="center"/></w:tcPr>'
        f"{inner}</w:tc>"
    )


def build_document_xml(products: list[ProductLabel]) -> str:
    rows: list[str] = []
    relationships: list[tuple[ProductLabel, str]] = [
        (product, f"rId{index}") for index, product in enumerate(products, start=1)
    ]
    rel_by_barcode = {product.barcode: rel_id for product, rel_id in relationships}

    for row_index in range(0, len(products), 2):
        left = products[row_index]
        right = products[row_index + 1] if row_index + 1 < len(products) else None
        left_rel = rel_by_barcode[left.barcode]
        right_rel = rel_by_barcode[right.barcode] if right else None

        rows.append(
            "<w:tr>"
            f"{make_cell_xml(left, left_rel, row_index + 1)}"
            f"{make_cell_xml(right, right_rel, row_index + 2)}"
            "</w:tr>"
        )

    table_xml = (
        '<w:tbl>'
        '<w:tblPr>'
        '<w:tblW w:w="0" w:type="auto"/>'
        '<w:tblLayout w:type="fixed"/>'
        '<w:tblCellMar>'
        '<w:top w:w="120" w:type="dxa"/>'
        '<w:left w:w="120" w:type="dxa"/>'
        '<w:bottom w:w="120" w:type="dxa"/>'
        '<w:right w:w="120" w:type="dxa"/>'
        '</w:tblCellMar>'
        '</w:tblPr>'
        f'<w:tblGrid><w:gridCol w:w="{COLUMN_WIDTH_TWIPS}"/><w:gridCol w:w="{COLUMN_WIDTH_TWIPS}"/></w:tblGrid>'
        + "".join(rows)
        + '</w:tbl>'
    )

    title = make_paragraph("Codigos de barra para pruebas de lector", bold=True, size=24, spacing_after=80)
    ean_count = sum(1 for product in products if product.symbology == "ean13")
    code128_count = len(products) - ean_count
    subtitle = make_paragraph(
        f"Generado el {datetime.now().strftime('%d-%m-%Y %H:%M')} con {len(products)} productos. EAN-13: {ean_count}. Code128: {code128_count}.",
        size=16,
        spacing_after=220,
    )

    return f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document
  xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
  xmlns:v="urn:schemas-microsoft-com:vml"
  xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing"
  xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
  xmlns:w10="urn:schemas-microsoft-com:office:word"
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"
  xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup"
  xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk"
  xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml"
  xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"
  mc:Ignorable="w14 wp14">
  <w:body>
    {title}
    {subtitle}
    {table_xml}
    <w:sectPr>
      <w:pgSz w:w="{PAGE_WIDTH_TWIPS}" w:h="{PAGE_HEIGHT_TWIPS}"/>
      <w:pgMar w:top="{MARGIN_TWIPS}" w:right="{MARGIN_TWIPS}" w:bottom="{MARGIN_TWIPS}" w:left="{MARGIN_TWIPS}" w:header="708" w:footer="708" w:gutter="0"/>
      <w:cols w:space="708"/>
      <w:docGrid w:linePitch="360"/>
    </w:sectPr>
  </w:body>
</w:document>"""


def build_document_relationships(products: list[ProductLabel]) -> str:
    relationships = [
        (
            f"rId{index}",
            "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image",
            f"media/{product.image_name}",
        )
        for index, product in enumerate(products, start=1)
    ]

    xml_items = "".join(
        f'<Relationship Id="{rel_id}" Type="{rel_type}" Target="{target}"/>'
        for rel_id, rel_type, target in relationships
    )

    return f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="{NS_REL}">{xml_items}</Relationships>"""


def build_root_relationships() -> str:
    return f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="{NS_REL}">
  <Relationship Id="rId1" Type="{NS_DOC}/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="{NS_DOC}/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="{NS_DOC}/extended-properties" Target="docProps/app.xml"/>
</Relationships>"""


def build_content_types() -> str:
    return f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="{NS_CT}">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>"""


def build_core_props() -> str:
    timestamp = datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
    return f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>Codigos de barra para pruebas de lector</dc:title>
  <dc:creator>Codex</dc:creator>
  <cp:lastModifiedBy>Codex</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">{timestamp}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">{timestamp}</dcterms:modified>
</cp:coreProperties>"""


def build_app_props() -> str:
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>MiniMarket POS</Application>
</Properties>"""


def write_docx(products: list[ProductLabel], image_dir: Path, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(output_path, "w", compression=zipfile.ZIP_DEFLATED) as docx:
        docx.writestr("[Content_Types].xml", build_content_types())
        docx.writestr("_rels/.rels", build_root_relationships())
        docx.writestr("docProps/core.xml", build_core_props())
        docx.writestr("docProps/app.xml", build_app_props())
        docx.writestr("word/document.xml", build_document_xml(products))
        docx.writestr("word/_rels/document.xml.rels", build_document_relationships(products))

        for product in products:
            docx.write(image_dir / product.image_name, arcname=f"word/media/{product.image_name}")


def main() -> int:
    args = parse_args()
    products = load_products(include_inactive=args.include_inactive, limit=args.limit)

    if not products:
        raise RuntimeError("No se encontraron productos con codigos de barra imprimibles en la base de datos.")

    work_dir = args.output.parent / ".barcode-docx-build"
    if work_dir.exists():
        shutil.rmtree(work_dir, ignore_errors=True)

    try:
        image_dir = work_dir / "images"
        render_barcode_images(products, image_dir)
        write_docx(products, image_dir, args.output)
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)

    print(f"Archivo generado: {args.output}")
    print(f"Productos incluidos: {len(products)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
