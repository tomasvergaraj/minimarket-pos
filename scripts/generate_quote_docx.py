from __future__ import annotations

import argparse
import zipfile
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from xml.sax.saxutils import escape


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "artifacts" / "quotes" / "cotizacion-nexo-base-plantilla.docx"

NS_REL = "http://schemas.openxmlformats.org/package/2006/relationships"
NS_DOC = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
NS_CT = "http://schemas.openxmlformats.org/package/2006/content-types"

PAGE_WIDTH_TWIPS = 11906
PAGE_HEIGHT_TWIPS = 16838
MARGIN_TWIPS = 720


@dataclass(frozen=True)
class Run:
    text: str
    bold: bool = False
    size: int = 22


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Genera una cotizacion DOCX reutilizable para Nexo Base.")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="Ruta del archivo .docx a generar.")
    parser.add_argument("--customer-name", default="[Nombre del cliente]", help="Nombre del cliente.")
    parser.add_argument("--quote-date", default=datetime.now().strftime("%d/%m/%Y"), help="Fecha de la cotizacion.")
    parser.add_argument("--valid-days", type=int, default=7, help="Dias corridos de validez de la oferta.")
    parser.add_argument("--seller-name", default="[Tu nombre]", help="Nombre del vendedor.")
    parser.add_argument("--seller-phone", default="[Tu telefono]", help="Telefono de contacto.")
    parser.add_argument("--seller-email", default="[Tu correo]", help="Correo de contacto.")
    return parser.parse_args()


def make_run_xml(run: Run) -> str:
    bold_xml = "<w:b/>" if run.bold else ""
    return (
        "<w:r>"
        f"<w:rPr>{bold_xml}<w:sz w:val=\"{run.size}\"/><w:szCs w:val=\"{run.size}\"/></w:rPr>"
        f"<w:t xml:space=\"preserve\">{escape(run.text)}</w:t>"
        "</w:r>"
    )


def make_paragraph(
    runs: list[Run],
    *,
    align: str = "left",
    spacing_before: int = 0,
    spacing_after: int = 100,
) -> str:
    return (
        f"<w:p><w:pPr><w:jc w:val=\"{align}\"/><w:spacing w:before=\"{spacing_before}\" "
        f"w:after=\"{spacing_after}\" w:line=\"240\" w:lineRule=\"auto\"/></w:pPr>"
        + "".join(make_run_xml(run) for run in runs)
        + "</w:p>"
    )


def make_empty_paragraph() -> str:
    return "<w:p/>"


def make_cell(content_xml: str, width_twips: int, *, shading_fill: str | None = None) -> str:
    shading_xml = f"<w:shd w:val=\"clear\" w:color=\"auto\" w:fill=\"{shading_fill}\"/>" if shading_fill else ""
    return (
        "<w:tc>"
        f"<w:tcPr><w:tcW w:w=\"{width_twips}\" w:type=\"dxa\"/>{shading_xml}</w:tcPr>"
        f"{content_xml}"
        "</w:tc>"
    )


def make_table(rows: list[list[str]], widths: list[int]) -> str:
    grid = "".join(f"<w:gridCol w:w=\"{width}\"/>" for width in widths)
    rows_xml = []
    for row in rows:
        cells_xml = "".join(make_cell(content, widths[index]) for index, content in enumerate(row))
        rows_xml.append(f"<w:tr>{cells_xml}</w:tr>")

    return (
        "<w:tbl>"
        "<w:tblPr>"
        "<w:tblW w:w=\"0\" w:type=\"auto\"/>"
        "<w:tblLayout w:type=\"fixed\"/>"
        "<w:tblBorders>"
        "<w:top w:val=\"single\" w:sz=\"8\" w:space=\"0\" w:color=\"auto\"/>"
        "<w:left w:val=\"single\" w:sz=\"8\" w:space=\"0\" w:color=\"auto\"/>"
        "<w:bottom w:val=\"single\" w:sz=\"8\" w:space=\"0\" w:color=\"auto\"/>"
        "<w:right w:val=\"single\" w:sz=\"8\" w:space=\"0\" w:color=\"auto\"/>"
        "<w:insideH w:val=\"single\" w:sz=\"8\" w:space=\"0\" w:color=\"auto\"/>"
        "<w:insideV w:val=\"single\" w:sz=\"8\" w:space=\"0\" w:color=\"auto\"/>"
        "</w:tblBorders>"
        "<w:tblCellMar>"
        "<w:top w:w=\"90\" w:type=\"dxa\"/>"
        "<w:left w:w=\"110\" w:type=\"dxa\"/>"
        "<w:bottom w:w=\"90\" w:type=\"dxa\"/>"
        "<w:right w:w=\"110\" w:type=\"dxa\"/>"
        "</w:tblCellMar>"
        "</w:tblPr>"
        f"<w:tblGrid>{grid}</w:tblGrid>"
        + "".join(rows_xml)
        + "</w:tbl>"
    )


def paragraph_text(text: str, *, bold: bool = False, size: int = 22, align: str = "left", spacing_after: int = 90) -> str:
    return make_paragraph([Run(text, bold=bold, size=size)], align=align, spacing_after=spacing_after)


def bullet_text(text: str) -> str:
    return make_paragraph([Run(f"- {text}", size=20)], spacing_after=60)


def build_document_xml(args: argparse.Namespace) -> str:
    title = make_paragraph([Run("COTIZACION", bold=True, size=28)], align="center", spacing_after=60)
    subtitle = make_paragraph(
        [Run("Sistema Nexo Base para Minimarket", bold=True, size=24)],
        align="center",
        spacing_after=180,
    )

    info_rows = [
        [
            paragraph_text("Fecha", bold=True, size=20, spacing_after=0),
            paragraph_text(args.quote_date, size=20, spacing_after=0),
        ],
        [
            paragraph_text("Cliente", bold=True, size=20, spacing_after=0),
            paragraph_text(args.customer_name, size=20, spacing_after=0),
        ],
        [
            paragraph_text("Validez de la oferta", bold=True, size=20, spacing_after=0),
            paragraph_text(f"{args.valid_days} dias corridos", size=20, spacing_after=0),
        ],
    ]
    info_table = make_table(info_rows, [2600, 7400])

    plans_rows = [
        [
            paragraph_text("Plan", bold=True, size=20, align="center", spacing_after=0),
            paragraph_text("Incluye", bold=True, size=20, align="center", spacing_after=0),
            paragraph_text("Precio sugerido", bold=True, size=20, align="center", spacing_after=0),
        ],
        [
            paragraph_text("Base 1 Caja", bold=True, size=20),
            paragraph_text("Licencia local, instalacion y configuracion inicial", size=20),
            paragraph_text("$249.000 + IVA", bold=True, size=20, align="center"),
        ],
        [
            paragraph_text("Base Implementado", bold=True, size=20),
            paragraph_text("Licencia local, instalacion, capacitacion y puesta en marcha", size=20),
            paragraph_text("$349.000 + IVA", bold=True, size=20, align="center"),
        ],
        [
            paragraph_text("Base 2-3 Cajas", bold=True, size=20),
            paragraph_text("Multi-caja en red local, instalacion y capacitacion", size=20),
            paragraph_text("$529.000 + IVA", bold=True, size=20, align="center"),
        ],
    ]
    plans_table = make_table(plans_rows, [2200, 6200, 2000])

    optional_rows = [
        [
            paragraph_text("Item", bold=True, size=20, align="center", spacing_after=0),
            paragraph_text("Precio sugerido", bold=True, size=20, align="center", spacing_after=0),
        ],
        [
            paragraph_text("Lector de codigo de barras 2D", size=20),
            paragraph_text("$59.000 + IVA", bold=True, size=20, align="center"),
        ],
        [
            paragraph_text("Impresora termica 80 mm", size=20),
            paragraph_text("$79.000 + IVA", bold=True, size=20, align="center"),
        ],
        [
            paragraph_text("Gaveta de dinero", size=20),
            paragraph_text("$69.000 + IVA", bold=True, size=20, align="center"),
        ],
        [
            paragraph_text("Soporte mensual", size=20),
            paragraph_text("$24.900 + IVA / mes", bold=True, size=20, align="center"),
        ],
    ]
    optional_table = make_table(optional_rows, [7600, 2800])

    body_parts = [
        title,
        subtitle,
        info_table,
        make_empty_paragraph(),
        paragraph_text("Planes disponibles", bold=True, size=24, spacing_after=120),
        plans_table,
        make_empty_paragraph(),
        paragraph_text("Propuesta recomendada para este cliente", bold=True, size=24, spacing_after=90),
        paragraph_text("Plan seleccionado: [Completar]", size=22),
        paragraph_text("Valor final propuesto: [Completar] + IVA", size=22),
        paragraph_text(
            "Importante: esta propuesta corresponde a la version base local y no incluye sync worker / sincronizacion cloud.",
            size=20,
            spacing_after=150,
        ),
        paragraph_text("Opcionales", bold=True, size=24, spacing_after=120),
        optional_table,
        make_empty_paragraph(),
        paragraph_text("Condiciones comerciales sugeridas", bold=True, size=24, spacing_after=90),
        bullet_text("50% al aprobar"),
        bullet_text("50% contra entrega e instalacion"),
        bullet_text("Tiempo estimado de implementacion: 1 a 3 dias habiles"),
        bullet_text("Soporte posterior opcional mensual"),
        make_empty_paragraph(),
        paragraph_text("No incluye", bold=True, size=24, spacing_after=90),
        bullet_text("Sync worker / nube"),
        bullet_text("Computador servidor o cajas"),
        bullet_text("Red interna o cableado"),
        bullet_text("Insumos de impresion"),
        bullet_text("Configuraciones especiales fuera de la instalacion base"),
        make_empty_paragraph(),
        paragraph_text("Atentamente,", size=22, spacing_after=120),
        paragraph_text(args.seller_name, bold=True, size=22, spacing_after=40),
        paragraph_text(args.seller_phone, size=20, spacing_after=40),
        paragraph_text(args.seller_email, size=20, spacing_after=40),
        paragraph_text("Nexo", bold=True, size=20, spacing_after=60),
    ]

    return f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    {''.join(body_parts)}
    <w:sectPr>
      <w:pgSz w:w="{PAGE_WIDTH_TWIPS}" w:h="{PAGE_HEIGHT_TWIPS}"/>
      <w:pgMar w:top="{MARGIN_TWIPS}" w:right="{MARGIN_TWIPS}" w:bottom="{MARGIN_TWIPS}" w:left="{MARGIN_TWIPS}" w:header="708" w:footer="708" w:gutter="0"/>
      <w:cols w:space="708"/>
      <w:docGrid w:linePitch="360"/>
    </w:sectPr>
  </w:body>
</w:document>"""


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
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>"""


def build_core_props(title: str) -> str:
    timestamp = datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
    return f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>{escape(title)}</dc:title>
  <dc:creator>Codex</dc:creator>
  <cp:lastModifiedBy>Codex</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">{timestamp}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">{timestamp}</dcterms:modified>
</cp:coreProperties>"""


def build_app_props() -> str:
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Nexo</Application>
</Properties>"""


def write_docx(args: argparse.Namespace) -> None:
    args.output.parent.mkdir(parents=True, exist_ok=True)
    title = "Cotizacion Nexo Base - Plantilla"

    with zipfile.ZipFile(args.output, "w", compression=zipfile.ZIP_DEFLATED) as docx:
        docx.writestr("[Content_Types].xml", build_content_types())
        docx.writestr("_rels/.rels", build_root_relationships())
        docx.writestr("docProps/core.xml", build_core_props(title))
        docx.writestr("docProps/app.xml", build_app_props())
        docx.writestr("word/document.xml", build_document_xml(args))


def main() -> int:
    args = parse_args()
    write_docx(args)
    print(f"Cotizacion DOCX generada en: {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
