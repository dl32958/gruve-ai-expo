from __future__ import annotations

from PIL import Image
import pandas as pd
import pytesseract

from app.config import TESSERACT_CMD


pytesseract.pytesseract.tesseract_cmd = TESSERACT_CMD


def phase_ocr_with_bbox(image_path: str):
    image = Image.open(image_path)
    raw_text = pytesseract.image_to_string(image)
    df = pytesseract.image_to_data(
        image,
        output_type=pytesseract.Output.DATAFRAME,
    )
    df = df[(df["text"].notna()) & (df["text"].str.strip() != "")]
    df = df[df["conf"] > 0].reset_index(drop=True)
    return raw_text, df, image
