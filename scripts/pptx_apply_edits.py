"""Update the ProjectsForge pitch deck so it matches the real, working app.

Edits (in an already-unpacked pptx tree):
  slide7  - profile card text -> real tested profile; "prototype" label ->
            "real screenshot"; label moved below the new picture; screenshot
            of the working Recommendation screen replaces the mock cards.
  slide8  - title -> "Skill-gap analysis — built and working"; full-body
            screenshot of the real Skill Gap screen replaces the mockup.
  slide9  - title -> "Week-by-week roadmap — built and working"; full-body
            screenshot of the real Roadmap screen replaces the mockup.
  slide12 - checkmarks on the three built MVP loops; caption states what is
            built today.
  slide13 - title -> "AI layer — built vs next"; checkmarks on the three
            shipped AI capabilities; caption carries real metrics.

All text replacements are asserted (exact match count) and all edited XML is
re-parsed before the result is re-zipped.
"""
import os
import re
import shutil
import zipfile
import xml.etree.ElementTree as ET

from PIL import Image, ImageOps

ROOT = r"C:\Users\HANMANTH\projectsforge\pitch"
UNPACKED = os.path.join(ROOT, "unpacked")
SHOTS = r"C:\Users\HANMANTH\AppData\Local\Temp\opencode\pitch_shots"
OUT_PPTX = os.path.join(ROOT, "ProjectsForge Startup Pitch (Working MVP).pptx")

SLIDES = os.path.join(UNPACKED, "ppt", "slides")
MEDIA = os.path.join(UNPACKED, "ppt", "media")
EMU = 914400


def emu(inches: float) -> int:
    return round(inches * EMU)


def rep(xml: str, old: str, new: str, expected: int = 1) -> str:
    count = xml.count(old)
    assert count == expected, f"expected {expected}x {old[:60]!r}, found {count}"
    return xml.replace(old, new)


def rep_re(xml: str, pattern: str, new: str, expected: int = 1) -> str:
    found = re.findall(pattern, xml)
    assert len(found) == expected, (
        f"expected {expected}x /{pattern[:60]}/, found {len(found)}"
    )
    return re.sub(pattern, new, xml)


def adjust_box(xml: str, anchor: str, *, x=None, y=None, cx=None, cy=None) -> str:
    """Move/resize the <p:sp> that contains the anchor text."""
    idx = xml.index(anchor)
    start = xml.rfind("<p:sp>", 0, idx)
    end = xml.index("</p:sp>", idx)
    block = xml[start:end]

    if x is not None or y is not None:
        m = re.search(r'<a:off x="(\d+)" y="(\d+)"/>', block)
        assert m, "off not found"
        nx = emu(x) if x is not None else m.group(1)
        ny = emu(y) if y is not None else m.group(2)
        block = block[: m.start()] + f'<a:off x="{nx}" y="{ny}"/>' + block[m.end() :]

    if cx is not None or cy is not None:
        m = re.search(r'<a:ext cx="(\d+)" cy="(\d+)"/>', block)
        assert m, "ext not found"
        ncx = emu(cx) if cx is not None else m.group(1)
        ncy = emu(cy) if cy is not None else m.group(2)
        block = block[: m.start()] + f'<a:ext cx="{ncx}" cy="{ncy}"/>' + block[m.end() :]

    return xml[:start] + block + xml[end:]


def group_span(xml: str, anchor: str) -> tuple[int, int]:
    """Start/end offsets of the <p:grpSp> that contains the anchor text."""
    idx = xml.index(anchor)
    start = xml.rfind("<p:grpSp>", 0, idx)
    end = xml.index("</p:grpSp>", idx) + len("</p:grpSp>")
    assert start != -1 and start < idx < end, f"no grpSp around {anchor!r}"
    return start, end


def delete_group(xml: str, anchor: str) -> str:
    start, end = group_span(xml, anchor)
    return xml[:start] + xml[end:]


def adjust_group(xml: str, anchor: str, *, x=None, y=None,
                 cx=None, cy=None) -> str:
    """Move/resize the <p:grpSp> containing the anchor text.

    Only the group's own off/ext are touched; children scale through
    chOff/chExt, which keeps rect and text box aligned.
    """
    start, end = group_span(xml, anchor)
    block = xml[start:end]

    if x is not None or y is not None:
        m = re.search(r'<a:off x="(\d+)" y="(\d+)"/>', block)
        assert m, "off not found"
        nx = emu(x) if x is not None else m.group(1)
        ny = emu(y) if y is not None else m.group(2)
        block = block[: m.start()] + f'<a:off x="{nx}" y="{ny}"/>' + block[m.end():]

    if cx is not None or cy is not None:
        m = re.search(r'<a:ext cx="(\d+)" cy="(\d+)"/>', block)
        assert m, "ext not found"
        ncx = emu(cx) if cx is not None else m.group(1)
        ncy = emu(cy) if cy is not None else m.group(2)
        block = block[: m.start()] + f'<a:ext cx="{ncx}" cy="{ncy}"/>' + block[m.end():]

    return xml[:start] + block + xml[end:]


def recolor_group(xml: str, anchor: str, old: str, new: str) -> str:
    """Replace a colour inside one group only (fill or text runs)."""
    start, end = group_span(xml, anchor)
    block = xml[start:end]
    assert old in block, f"{old} not in group {anchor!r}"
    return xml[:start] + block.replace(old, new) + xml[end:]


def make_picture(slide_no: int, image_name: str, x: float, y: float,
                 w: float, h: float, rel_id: str) -> str:
    return (
        # xmlns:r declared here: slides may not declare it at the root when
        # nothing else references relationships inline.
        '<p:pic xmlns:r="http://schemas.openxmlformats.org/officeDocument/'
        '2006/relationships">'
        '<p:nvPicPr>'
        f'<p:cNvPr id="9{slide_no}0" name="Real app screenshot {slide_no}"/>'
        '<p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr>'
        "<p:nvPr/>"
        "</p:nvPicPr>"
        '<p:blipFill>'
        f'<a:blip r:embed="{rel_id}"/>'
        "<a:stretch><a:fillRect/></a:stretch>"
        "</p:blipFill>"
        "<p:spPr>"
        "<a:xfrm>"
        f'<a:off x="{emu(x)}" y="{emu(y)}"/>'
        f'<a:ext cx="{emu(w)}" cy="{emu(h)}"/>'
        "</a:xfrm>"
        '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>'
        "</p:spPr>"
        "</p:pic>"
    )


def insert_pic(xml: str, pic_xml: str) -> str:
    assert xml.count("</p:spTree>") == 1
    return xml.replace("</p:spTree>", pic_xml + "</p:spTree>")


def add_rel(slide_no: int, rel_id: str, image_name: str) -> None:
    path = os.path.join(SLIDES, "_rels", f"slide{slide_no}.xml.rels")
    xml = open(path, encoding="utf-8").read()
    assert rel_id not in xml, f"{rel_id} already used in slide{slide_no}"
    rel = (
        f'<Relationship Id="{rel_id}" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/'
        f'relationships/image" Target="../media/{image_name}"/>'
    )
    xml = xml.replace("</Relationships>", rel + "</Relationships>")
    open(path, "w", encoding="utf-8", newline="").write(xml)


def ensure_png_content_type() -> None:
    path = os.path.join(UNPACKED, "[Content_Types].xml")
    xml = open(path, encoding="utf-8").read()
    if 'Extension="png"' not in xml:
        xml = xml.replace(
            "</Types>",
            '<Default Extension="png" ContentType="image/png"/></Types>',
        )
        open(path, "w", encoding="utf-8", newline="").write(xml)


def prepare_media() -> dict[str, tuple[int, int]]:
    """Add a subtle border to each shot and copy it into ppt/media."""
    os.makedirs(MEDIA, exist_ok=True)
    mapping = {
        "s7_recommendation.png": "image101.png",
        "s8_skillgap.png": "image102.png",
        "s9_roadmap.png": "image103.png",
    }
    sizes: dict[str, tuple[int, int]] = {}
    for src, dst in mapping.items():
        im = Image.open(os.path.join(SHOTS, src)).convert("RGB")
        bordered = ImageOps.expand(im, border=4, fill=(221, 225, 232))
        bordered.save(os.path.join(MEDIA, dst))
        sizes[dst] = bordered.size
    return sizes


def edit_slides(sizes: dict[str, tuple[int, int]]) -> None:
    # ---- slide 7 -------------------------------------------------------
    p = os.path.join(SLIDES, "slide7.xml")
    xml = open(p, encoding="utf-8").read()
    xml = rep(xml, "<a:t>2nd year</a:t>", "<a:t>3rd year</a:t>")
    xml = rep(
        xml,
        "<a:t>Beginner Python</a:t>",
        "<a:t>Arduino, C, basic electronics</a:t>",
    )
    xml = rep(
        xml,
        "<a:t>AI + sustainability</a:t>",
        "<a:t>IoT &amp; Embedded</a:t>",
    )
    xml = rep(xml, "<a:t>6 hours / week</a:t>", "<a:t>8 weeks</a:t>")
    xml = rep_re(
        xml,
        r"<a:t>PROTOTYPE INTERFACE[^<]*NOT FINAL PRODUCT</a:t>",
        "<a:t>REAL SCREENSHOT \u2014 WORKING APP, LOCAL LLM</a:t>",
    )

    w7, h7 = sizes["image101.png"]
    aspect7 = w7 / h7
    x7, y7, w_in7 = 6.88, 3.40, 11.77
    h_in7 = w_in7 / aspect7
    label_y = y7 + h_in7 + 0.16
    xml = adjust_box(xml, "REAL SCREENSHOT", y=label_y)
    xml = insert_pic(xml, make_picture(7, "image101.png", x7, y7, w_in7, h_in7,
                                       "rId910"))
    ET.fromstring(xml)
    open(p, "w", encoding="utf-8", newline="").write(xml)
    add_rel(7, "rId910", "image101.png")
    print(f"slide7 pic: x={x7} y={y7} w={w_in7:.2f} h={h_in7:.2f} "
          f"bottom={y7 + h_in7:.2f} label_y={label_y:.2f}")

    # ---- slide 8 -------------------------------------------------------
    p = os.path.join(SLIDES, "slide8.xml")
    xml = open(p, encoding="utf-8").read()
    xml = rep(
        xml,
        "<a:t>Project detail interface</a:t>",
        "<a:t>Skill-gap analysis \u2014 built and working</a:t>",
    )
    w8, h8 = sizes["image102.png"]
    x8, y8, w_in8 = 0.94, 2.45, 17.71
    h_in8 = w_in8 / (w8 / h8)
    xml = insert_pic(xml, make_picture(8, "image102.png", x8, y8, w_in8, h_in8,
                                       "rId910"))
    ET.fromstring(xml)
    open(p, "w", encoding="utf-8", newline="").write(xml)
    add_rel(8, "rId910", "image102.png")
    print(f"slide8 pic: x={x8} y={y8} w={w_in8:.2f} h={h_in8:.2f} "
          f"bottom={y8 + h_in8:.2f}")

    # ---- slide 9 -------------------------------------------------------
    p = os.path.join(SLIDES, "slide9.xml")
    xml = open(p, encoding="utf-8").read()
    xml = rep(
        xml,
        "<a:t>Student progress: AI Waste Classification</a:t>",
        "<a:t>Week-by-week roadmap \u2014 built and working</a:t>",
    )
    xml = insert_pic(xml, make_picture(9, "image103.png", x8, y8, w_in8, h_in8,
                                       "rId910"))
    ET.fromstring(xml)
    open(p, "w", encoding="utf-8", newline="").write(xml)
    add_rel(9, "rId910", "image103.png")
    print(f"slide9 pic: x={x8} y={y8} w={w_in8:.2f} h={h_in8:.2f} "
          f"bottom={y8 + h_in8:.2f}")

    # ---- slide 12 ------------------------------------------------------
    # Only built features stay: drop Search & Filters, Project Detail Page,
    # Milestone Checklist, Save Projects, Feedback as written; re-use six
    # boxes for the loop that actually ships, relaid out as 3 columns x 2.
    p = os.path.join(SLIDES, "slide12.xml")
    xml = open(p, encoding="utf-8").read()
    xml = delete_group(xml, "Personalized Recommendations")  # orig box 04
    xml = delete_group(xml, "Feedback")                      # orig box 08
    col_x = (0.94, 7.01, 13.08)
    grid12 = [
        ("Student Profile", col_x[0], 3.12),
        ("Project Database", col_x[1], 3.12),
        ("Search &amp; Filters", col_x[2], 3.12),
        ("Project Detail Page", col_x[0], 5.52),
        ("Milestone Checklist", col_x[1], 5.52),
        ("Save Projects", col_x[2], 5.52),
    ]
    for anchor, bx, by in grid12:
        xml = adjust_group(xml, anchor, x=bx, y=by, cx=5.57)
    # renumber + rename every box to a feature that is built
    xml = rep(xml, "<a:t>01</a:t>", "<a:t>\u2713 01</a:t>")
    xml = rep(xml, "<a:t>02</a:t>", "<a:t>\u2713 02</a:t>")
    xml = rep(xml, "<a:t>03</a:t>", "<a:t>\u2713 03</a:t>")
    xml = rep(
        xml,
        "<a:t>Search &amp; Filters</a:t>",
        "<a:t>Personalized Recommendations</a:t>",
    )
    xml = rep(xml, "<a:t>05</a:t>", "<a:t>\u2713 04</a:t>")
    xml = rep(
        xml, "<a:t>Project Detail Page</a:t>", "<a:t>Skill-Gap Analysis</a:t>"
    )
    xml = rep(xml, "<a:t>06</a:t>", "<a:t>\u2713 05</a:t>")
    xml = rep(
        xml, "<a:t>Milestone Checklist</a:t>", "<a:t>Week-by-Week Roadmap</a:t>"
    )
    xml = rep(xml, "<a:t>07</a:t>", "<a:t>\u2713 06</a:t>")
    xml = rep(
        xml, "<a:t>Save Projects</a:t>", "<a:t>Save / Export Report</a:t>"
    )
    xml = rep(
        xml,
        "<a:t>Avoid feature bloat at MVP stage.</a:t>",
        "<a:t>All six are built and working today \u2014 profile to export, "
        "end to end.</a:t>",
    )
    xml = adjust_box(xml, "All six are built", x=3.5, cx=13.0)
    ET.fromstring(xml)
    open(p, "w", encoding="utf-8", newline="").write(xml)
    print("slide12: trimmed to 6 built boxes, 3x2 grid, caption")

    # ---- slide 13 ------------------------------------------------------
    # Only the three shipped capabilities remain; the six "next" items are
    # removed, the row is recentered, and the middle box keeps the blue accent.
    p = os.path.join(SLIDES, "slide13.xml")
    xml = open(p, encoding="utf-8").read()
    for anchor in (
        "Context-aware assistant",
        "Debugging guidance",
        "Documentation assistant",
        "Presentation generator",
        "Viva preparation",
        "Interview questions",
    ):
        xml = delete_group(xml, anchor)
    for anchor in (
        "Project recommendation",
        "Skill-gap analysis",
        "Personalized roadmap",
    ):
        xml = adjust_group(xml, anchor, y=4.15, cy=2.35)
    # blue fill on the middle box (text is already white on this dark slide)
    xml = recolor_group(xml, "Skill-gap analysis", 'val="13243A"', 'val="2F7DF6"')
    xml = rep(
        xml,
        "<a:t>Future AI layer</a:t>",
        "<a:t>AI layer \u2014 built today</a:t>",
    )
    xml = rep(
        xml,
        "<a:t>Project recommendation</a:t>",
        "<a:t>\u2713 Project recommendation</a:t>",
    )
    xml = rep(
        xml,
        "<a:t>Skill-gap analysis</a:t>",
        "<a:t>\u2713 Skill-gap analysis</a:t>",
    )
    xml = rep(
        xml,
        "<a:t>Personalized roadmap</a:t>",
        "<a:t>\u2713 Personalized roadmap</a:t>",
    )
    xml = rep_re(
        xml,
        r"<a:t>AI supports learning and ownership[^<]*it should not promote "
        r"copying\.</a:t>",
        "<a:t>Built: recommendation + skill gap + roadmap \u2014 local LLM "
        "(phi4-gpu), 16-project dataset, ~30 s per analysis. AI supports "
        "learning, not copying.</a:t>",
    )
    xml = adjust_box(xml, "Built:", x=2.0, cx=16.0)
    ET.fromstring(xml)
    open(p, "w", encoding="utf-8", newline="").write(xml)
    print("slide13: trimmed to 3 built boxes, centered, accent, caption")


def pack() -> None:
    if os.path.exists(OUT_PPTX):
        os.remove(OUT_PPTX)
    files = []
    for dirpath, _, names in os.walk(UNPACKED):
        for name in names:
            full = os.path.join(dirpath, name)
            rel = os.path.relpath(full, UNPACKED).replace(os.sep, "/")
            files.append((rel, full))
    files.sort(key=lambda pair: (pair[0] != "[Content_Types].xml", pair[0]))
    with zipfile.ZipFile(OUT_PPTX, "w", zipfile.ZIP_DEFLATED) as zf:
        for rel, full in files:
            zf.write(full, rel)
    # sanity: every XML part still parses
    with zipfile.ZipFile(OUT_PPTX) as zf:
        bad = zf.testzip()
        assert bad is None, f"corrupt member {bad}"
        xml_parts = [n for n in zf.namelist() if n.endswith((".xml", ".rels"))]
        for name in xml_parts:
            ET.fromstring(zf.read(name))
    print(f"packed {OUT_PPTX} ({os.path.getsize(OUT_PPTX)} bytes, "
          f"{len(files)} parts, {len(xml_parts)} xml parts parsed)")


def main() -> None:
    sizes = prepare_media()
    for name, (w, h) in sizes.items():
        print(f"media {name}: {w}x{h} (aspect {w / h:.4f})")
    edit_slides(sizes)
    ensure_png_content_type()
    pack()


if __name__ == "__main__":
    main()
