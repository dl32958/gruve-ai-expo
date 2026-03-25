from __future__ import annotations

import colorsys
import os
import re
from typing import Optional

import pandas as pd
from PIL import Image, ImageDraw, ImageFont


STATE_BORDER = {
    "pass": (34, 197, 94),
    "review_needed": (251, 146, 60),
    "fail": (239, 68, 68),
}

STATE_ICON = {
    "pass": "✓",
    "review_needed": "⚠",
    "fail": "✗",
}


def generate_field_colors(n: int):
    colors = []
    for i in range(n):
        hue = (i / n + 0.55) % 1.0
        r, g, b = colorsys.hsv_to_rgb(hue, 0.65, 0.90)
        colors.append((int(r * 255), int(g * 255), int(b * 255)))
    return colors


def match_evidence_to_bboxes(evidence_text: str, word_df: pd.DataFrame) -> Optional[tuple[int, int, int, int]]:
    if not evidence_text or not evidence_text.strip():
        return None

    def clean(value: str):
        return re.sub(r"[^\w\s]", "", value.lower()).split()

    ev_words = clean(evidence_text)
    ocr_words = [clean(str(w)) for w in word_df["text"].tolist()]
    ocr_words_flat = [
        (w[0] if w else str(word_df["text"].iloc[i]).lower())
        for i, w in enumerate(ocr_words)
    ]

    if not ev_words:
        return None

    best_score = 0
    best_span = None
    n = len(ocr_words_flat)
    m = len(ev_words)

    for i in range(n - m + 1):
        window = ocr_words_flat[i : i + m]
        score = sum(1 for a, b in zip(ev_words, window) if a == b)
        if score > best_score:
            best_score = score
            best_span = (i, i + m - 1)

    if best_span is None or best_score < max(1, len(ev_words) * 0.4):
        return None

    rows = word_df.iloc[best_span[0] : best_span[1] + 1]
    left = int(rows["left"].min())
    top = int(rows["top"].min())
    right = int((rows["left"] + rows["width"]).max())
    bottom = int((rows["top"] + rows["height"]).max())
    return (left, top, right, bottom)


def phase_visualize(
    cross_result: dict,
    fields: list[str],
    output_dir: str,
    base_name: str,
    word_df,
    image,
    padding: int = 6,
):
    os.makedirs(output_dir, exist_ok=True)

    vis = image.convert("RGBA")
    overlay = Image.new("RGBA", vis.size, (255, 255, 255, 0))
    draw_overlay = ImageDraw.Draw(overlay)
    draw_main = ImageDraw.Draw(vis)

    font = ImageFont.load_default()
    font_small = ImageFont.load_default()

    field_colors = generate_field_colors(len(fields))
    field_results = cross_result.get("field_results", {})
    legend_items = []

    for idx, field in enumerate(fields):
        result = field_results.get(field, {})
        recommended_value = result.get("recommended_value", "")
        field_state = result.get("field_state", "fail")
        field_confidence = result.get("field_confidence", "low")

        evidence_text = ""
        for eng_key in ["engineA_evidence", "engineB_evidence"]:
            ev = result.get(eng_key, "")
            if ev:
                evidence_text = ev
                break
        if not evidence_text:
            evidence_text = recommended_value

        bbox = match_evidence_to_bboxes(evidence_text, word_df)
        color_rgb = field_colors[idx]
        border_rgb = STATE_BORDER.get(field_state, (128, 128, 128))
        icon = STATE_ICON.get(field_state, "?")

        if bbox:
            l, t, r, b = bbox
            l, t, r, b = l - padding, t - padding, r + padding, b + padding

            draw_overlay.rectangle([l, t, r, b], fill=(*color_rgb, 50))
            for offset in range(3):
                draw_main.rectangle(
                    [l - offset, t - offset, r + offset, b + offset],
                    outline=(*border_rgb, 220),
                )

            label = f"{field}: {recommended_value}  {icon}"
            bbox_text = draw_main.textbbox((0, 0), label, font=font)
            tw = bbox_text[2] - bbox_text[0]
            th = bbox_text[3] - bbox_text[1]

            tag_x = l
            tag_y = max(0, t - th - 8)

            draw_main.rectangle(
                [tag_x, tag_y, tag_x + tw + 10, tag_y + th + 6],
                fill=(*border_rgb, 230),
            )
            draw_main.text(
                (tag_x + 5, tag_y + 3),
                label,
                font=font,
                fill=(255, 255, 255, 255),
            )

        legend_items.append(
            (field, recommended_value, field_state, field_confidence, color_rgb, border_rgb, icon)
        )

    vis = Image.alpha_composite(vis, overlay)
    vis = vis.convert("RGB")

    legend_width = 320
    legend_img = Image.new("RGB", (legend_width, vis.height), (245, 245, 245))
    ld = ImageDraw.Draw(legend_img)

    ld.text((12, 12), "Extraction Summary", font=font, fill=(30, 30, 30))
    ld.line([(8, 38), (legend_width - 8, 38)], fill=(180, 180, 180), width=1)

    y_cursor = 50
    for field, value, state, confidence, color_rgb, border_rgb, icon in legend_items:
        ld.rectangle([10, y_cursor, 26, y_cursor + 16], fill=color_rgb)
        ld.text((34, y_cursor), field, font=font, fill=(30, 30, 30))
        y_cursor += 22
        display_val = value if value else "(not found)"
        ld.text((34, y_cursor), display_val, font=font_small, fill=(60, 60, 60))
        y_cursor += 20
        state_label = f"{icon} {state}  |  conf: {confidence}"
        ld.text((34, y_cursor), state_label, font=font_small, fill=border_rgb)
        y_cursor += 28
        ld.line([(10, y_cursor), (legend_width - 10, y_cursor)], fill=(210, 210, 210), width=1)
        y_cursor += 10

    combined = Image.new("RGB", (vis.width + legend_width, vis.height), (255, 255, 255))
    combined.paste(vis, (0, 0))
    combined.paste(legend_img, (vis.width, 0))

    out_path = os.path.join(output_dir, f"{base_name}_annotated.jpg")
    combined.save(out_path, quality=95)
    return out_path
