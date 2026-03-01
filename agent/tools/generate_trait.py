#!/usr/bin/env python3
import json
import sys
from PIL import Image


def generate_trait(spec):
    palette_hex = spec["palette"]
    pixels = spec["pixels"]
    output_path = spec["output"]

    assert len(pixels) == 32, f"Expected 32 rows, got {len(pixels)}"
    for row in pixels:
        assert len(row) == 32, f"Expected 32 cols, got {len(row)}"

    # Build PIL palette (768 bytes: R,G,B for each of 256 colours)
    pil_palette = []
    for hex_colour in palette_hex:
        hex_colour = hex_colour.lstrip("#")
        r, g, b = int(hex_colour[0:2], 16), int(hex_colour[2:4], 16), int(hex_colour[4:6], 16)
        pil_palette.extend([r, g, b])
    # Pad to 256 colours
    pil_palette.extend([0, 0, 0] * (256 - len(palette_hex)))

    img = Image.new("P", (32, 32))
    img.putpalette(pil_palette)

    flat_pixels = []
    for row in pixels:
        for val in row:
            assert 0 <= val < len(palette_hex), f"Pixel value {val} out of range"
            flat_pixels.append(val)

    img.putdata(flat_pixels)

    # Set index 0 as transparent
    img.info["transparency"] = 0

    img.save(output_path)
    print(f"Generated: {output_path}")


if __name__ == "__main__":
    if len(sys.argv) > 1:
        with open(sys.argv[1]) as f:
            spec = json.load(f)
    else:
        spec = json.load(sys.stdin)
    generate_trait(spec)
