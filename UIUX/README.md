# AI JUDGEMENT
This UI is the front-end for our document analysis demo. It provides a clean, audit-friendly way to upload a document, configure fields, run an analysis, and review field-level results with clear status and confidence signals.

---

## Key Screens

### 1 Empty State
Shows the starting view and prompts the user to upload a document.

### 2 Input Panel (Upload & Configure)
- **Upload Document**: drag-and-drop or browse (JPG/PNG)
- **Document Type**: select the document category (e.g., invoice/receipt)
- **Fields to Extract**: choose required fields and add optional fields
- **Debug Mode**: optional toggle for detailed outputs and downloads
- **Run Analysis**: starts the analysis for the uploaded document

### 3 Results View (Field-Level Summary)
After running analysis, the main panel displays:
- **Results summary cards**: counts of **Passed / Review / Failed**
- **Export JSON**: downloads the final analysis output
- **New Analysis**: reset to start a new run

Each field is shown as a **result card** with:
- **Field name + status** (Pass / Review Needed / Failed)
- **Recommended value** (with copy action)
- **Confidence level**
- **Selected engine** (when applicable)
- **Short reason** when the field needs review or failed

### 4 Technical Details & Debug Info (Collapsible)
A dedicated expandable section for deeper inspection, including:
- **OCR Text** (searchable)
- **Engine Extraction**
- **Final Judgment**
- **Download buttons** (when Debug Mode is enabled)
  