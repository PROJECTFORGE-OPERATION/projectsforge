"""Print a layout map of shapes on selected slides of an unpacked pptx.

Usage: python pptx_shape_map.py <unpacked-dir> [slide numbers...]
Prints: slide, shape id, name, position/size in inches, text preview.
"""
import sys
import xml.etree.ElementTree as ET

NS = {
    "p": "http://schemas.openxmlformats.org/presentationml/2006/main",
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
}
EMU = 914400.0


def shape_text(shape) -> str:
    texts = [t.text or "" for t in shape.iter(f"{{{NS['a']}}}t")]
    return " | ".join(x for x in texts if x.strip())[:90]


def main() -> None:
    root_dir = sys.argv[1]
    slides = [int(n) for n in sys.argv[2:]] or list(range(1, 21))

    for num in slides:
        path = f"{root_dir}/ppt/slides/slide{num}.xml"
        tree = ET.parse(path)
        print(f"\n===== slide{num}.xml =====")
        sp_tree = tree.getroot().find("p:cSld/p:spTree", NS)
        for shape in sp_tree:
            tag = shape.tag.split("}")[1]
            if tag not in ("sp", "pic", "grpSp", "graphicFrame"):
                continue
            nv = shape.find(".//p:cNvPr", NS)
            name = nv.get("name", "?") if nv is not None else "?"
            sid = nv.get("id", "?") if nv is not None else "?"
            xfrm = shape.find("./p:spPr/a:xfrm", NS)
            if xfrm is None:
                xfrm = shape.find("./p:grpSpPr/a:xfrm", NS)
            if xfrm is None:
                xfrm = shape.find("./p:xfrm", NS)
            pos = ""
            if xfrm is not None:
                off = xfrm.find("a:off", NS)
                ext = xfrm.find("a:ext", NS)
                if off is not None and ext is not None:
                    x = int(off.get("x")) / EMU
                    y = int(off.get("y")) / EMU
                    w = int(ext.get("cx")) / EMU
                    h = int(ext.get("cy")) / EMU
                    pos = f"x={x:5.2f} y={y:5.2f} w={w:5.2f} h={h:5.2f}"
            text = shape_text(shape)
            line = f"  [{sid:>3}] {tag:<10} {name[:34]:<34} {pos}"
            if text:
                line += f"  :: {text}"
            print(line)


if __name__ == "__main__":
    main()
