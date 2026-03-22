import type { RunResult } from './types';

export const mockRunResult: RunResult = {
  status: 'partial',
  metadata: {
    timestamp: '00:50:52',
    elapsed_seconds: 185.6,
    doc_category: 'receipt',
    fields: ['company', 'date', 'address', 'total', 'phone_number'],
    debug: true,
  },
  stage1_ocr_text: `RECEIPT
Target Store #1234
123 Main Street
Anytown, ST 12345

Date: 03/15/2026
Time: 14:32

ITEMS:
Milk - Organic         $4.99
Bread - Whole Wheat    $3.49
Eggs - Free Range      $5.99
Apples - Honeycrisp    $6.99

SUBTOTAL              $21.46
TAX (8.5%)            $1.82
TOTAL                 $23.28

VISA ****1234
Auth: 123456

Thank you for shopping!
Customer Service: (555) 123-4567`,
  
  stage3_consolidated_rules: {
    rules: [
      'Total amount must match subtotal + tax',
      'Date format should be MM/DD/YYYY',
      'Vendor name appears at top of receipt',
      'Tax percentage should be validated against jurisdiction',
    ],
    agreement_level: 'High',
    notes: 'Both engines agree on core extraction rules, minor difference in date format preference',
  },

  fields: [
    {
      field_name: 'company',
      recommended_value: 'Target Store #1234',
      field_state: 'pass',
      field_confidence: 'very_high',
      selected_engine: 'engineA',
      selection_reason: 'Engine A included store number for complete identification',
      signals: {
        final_rule_consistency: 0.88,
        final_engine_self_consistency: 0.91,
        final_ocr_alignment: 0.87,
        final_ocr_corruption: 0.08,
      },
      engineA: {
        extracted_value: 'Target Store #1234',
        rule_consistency: 0.88,
        engine_self_consistency: 0.91,
        ocr_alignment: 0.87,
        ocr_corruption: 0.08,
        judgment_summary: 'Clear vendor identification at receipt header. High confidence.',
        constraint_summary: [
          'Typically at top of receipt',
          'May include store number',
          'Usually largest/first text element',
        ],
        field_extraction: { value: 'Target Store #1234', confidence: 0.91 },
        evidence_trace: [
          'Found at top of document',
          'Includes store identifier #1234',
          'Matches known vendor patterns',
        ],
        reasoning: 'Vendor name clearly positioned at receipt header with store number included.',
      },
      engineB: {
        extracted_value: 'Target',
        rule_consistency: 0.85,
        engine_self_consistency: 0.88,
        ocr_alignment: 0.85,
        ocr_corruption: 0.10,
        judgment_summary: 'Extracted base vendor name without store number.',
        constraint_summary: [
          'Primary business name',
          'Located in header',
          'Should be concise',
        ],
        field_extraction: { value: 'Target', confidence: 0.88 },
        evidence_trace: [
          'Identified "Target" at top',
          'Excluded store number for brevity',
        ],
        reasoning: 'Extracted core vendor name, treated store number as separate metadata.',
      },
    },
    {
      field_name: 'date',
      recommended_value: '25/12/2018 8:13:39 PM',
      field_state: 'pass',
      field_confidence: 'high',
      selected_engine: 'engineB',
      selection_reason: 'Engine B provided more consistent date formatting',
      signals: {
        final_rule_consistency: 0.78,
        final_engine_self_consistency: 0.82,
        final_ocr_alignment: 0.75,
        final_ocr_corruption: 0.15,
      },
      engineA: {
        extracted_value: '03/15/26',
        rule_consistency: 0.72,
        engine_self_consistency: 0.80,
        ocr_alignment: 0.75,
        ocr_corruption: 0.15,
        judgment_summary: 'Extracted date but with shortened year format. May need validation.',
        constraint_summary: [
          'Date format: MM/DD/YYYY or MM/DD/YY',
          'Should appear near top of receipt',
          'Must be valid calendar date',
        ],
        field_extraction: { value: '03/15/26', confidence: 0.80 },
        evidence_trace: [
          'Found "Date:" label',
          'Extracted 03/15/26',
          'Year appears shortened in OCR',
        ],
        reasoning: 'Date field located but OCR shows abbreviated year. Full year not clearly visible.',
      },
      engineB: {
        extracted_value: '25/12/2018 8:13:39 PM',
        rule_consistency: 0.78,
        engine_self_consistency: 0.82,
        ocr_alignment: 0.75,
        ocr_corruption: 0.15,
        judgment_summary: 'Inferred full date with time from context. Medium confidence due to OCR ambiguity.',
        constraint_summary: [
          'Standard date format MM/DD/YYYY',
          'Year should be 4 digits',
          'Date must be reasonable (not future)',
        ],
        field_extraction: { value: '25/12/2018 8:13:39 PM', confidence: 0.82 },
        evidence_trace: [
          'Located date field: 03/15/26',
          'Inferred full year and time from context',
          'Validated as reasonable date',
        ],
        reasoning: 'Expanded abbreviated year to full format based on current year context and receipt patterns.',
      },
    },
    {
      field_name: 'address',
      recommended_value: '123 Main Street, Anytown, ST 12345',
      field_state: 'review_needed',
      field_confidence: 'medium',
      selected_engine: 'engineA',
      selection_reason: 'Engine A provided more complete address',
      state_reason: 'Contains OCR corruption ("?")',
      signals: {
        final_rule_consistency: 0.65,
        final_engine_self_consistency: 0.70,
        final_ocr_alignment: 0.68,
        final_ocr_corruption: 0.28,
      },
      engineA: {
        extracted_value: '123 Main Street, Anytown, ST 12345',
        rule_consistency: 0.65,
        engine_self_consistency: 0.70,
        ocr_alignment: 0.68,
        ocr_corruption: 0.28,
        judgment_summary: 'Address extracted with moderate confidence. Some OCR quality issues detected.',
        constraint_summary: [
          'Should include street, city, state, zip',
          'Located near vendor name',
          'Standard US address format',
        ],
        field_extraction: { value: '123 Main Street, Anytown, ST 12345', confidence: 0.70 },
        evidence_trace: [
          'Found address block below vendor name',
          'Extracted street, city, state, zip',
          'Minor OCR corruption in city name area',
        ],
        reasoning: 'Complete address extracted but OCR quality issues in city name require review.',
      },
      engineB: {
        extracted_value: '123 Main Street',
        rule_consistency: 0.60,
        engine_self_consistency: 0.65,
        ocr_alignment: 0.63,
        ocr_corruption: 0.32,
        judgment_summary: 'Partial address extracted due to OCR corruption.',
        constraint_summary: [
          'Street address required',
          'Additional components optional',
        ],
        field_extraction: { value: '123 Main Street', confidence: 0.65 },
        evidence_trace: [
          'Located street address line',
          'City/state/zip area had OCR issues',
        ],
        reasoning: 'Only extracted street address portion due to corruption in remaining address components.',
      },
    },
    {
      field_name: 'total',
      recommended_value: '9.00',
      field_state: 'pass',
      field_confidence: 'high',
      selected_engine: 'engineA',
      signals: {
        final_rule_consistency: 0.94,
        final_engine_self_consistency: 0.96,
        final_ocr_alignment: 0.93,
        final_ocr_corruption: 0.04,
      },
      engineA: {
        extracted_value: '9.00',
        rule_consistency: 0.94,
        engine_self_consistency: 0.96,
        ocr_alignment: 0.93,
        ocr_corruption: 0.04,
        judgment_summary: 'Total amount clearly identified and validated against tax calculation.',
        constraint_summary: [
          'Currency format',
          'Should match subtotal + tax',
          'Appears after TAX line',
        ],
        field_extraction: { value: '9.00', confidence: 0.96 },
        evidence_trace: [
          'Found "TOTAL" label in OCR text',
          'Extracted value $23.28 immediately after label',
          'Verified calculation: $21.46 + $1.82 = $23.28',
        ],
        reasoning: 'The total amount was clearly marked and matches the arithmetic sum of subtotal and tax.',
      },
      engineB: {
        extracted_value: '9.00',
        rule_consistency: 0.93,
        engine_self_consistency: 0.95,
        ocr_alignment: 0.92,
        ocr_corruption: 0.05,
        judgment_summary: 'Total value extracted with high confidence and validated.',
        constraint_summary: [
          'Numeric with currency symbol',
          'Labeled as TOTAL',
          'Between subtotal and payment info',
        ],
        field_extraction: { value: '9.00', confidence: 0.95 },
        evidence_trace: [
          'Located TOTAL line item',
          'Extracted $23.28',
          'Validated against subtotal',
        ],
        reasoning: 'Clear total line with amount matching expected percentage calculation.',
      },
    },
    {
      field_name: 'phone_number',
      recommended_value: '',
      field_state: 'fail',
      field_confidence: 'low',
      selected_engine: 'none',
      selection_reason: 'Neither engine could confidently extract a phone number',
      state_reason: 'OCR corruption prevented reliable extraction',
      signals: {
        final_rule_consistency: 0.45,
        final_engine_self_consistency: 0.50,
        final_ocr_alignment: 0.40,
        final_ocr_corruption: 0.35,
      },
      engineA: {
        extracted_value: '',
        rule_consistency: 0.45,
        engine_self_consistency: 0.50,
        ocr_alignment: 0.40,
        ocr_corruption: 0.35,
        judgment_summary: 'Phone number pattern detected but with OCR corruption issues.',
        constraint_summary: [
          'Format: (XXX) XXX-XXXX',
          'Usually in footer',
          'May be labeled as customer service',
        ],
        field_extraction: { value: '', confidence: 0.50 },
        evidence_trace: [
          'Found text matching phone pattern',
          'OCR quality too low in that region',
          'Could not confidently extract digits',
        ],
        reasoning: 'Phone number pattern detected but OCR corruption prevented reliable extraction.',
      },
      engineB: {
        extracted_value: '',
        rule_consistency: 0.42,
        engine_self_consistency: 0.48,
        ocr_alignment: 0.38,
        ocr_corruption: 0.38,
        judgment_summary: 'Unable to extract phone number with sufficient confidence.',
        constraint_summary: [
          'Standard US phone format',
          'Located in contact section',
        ],
        field_extraction: { value: '', confidence: 0.48 },
        evidence_trace: [
          'Searched for phone patterns',
          'Low confidence in extracted digits',
          'Recommended manual review',
        ],
        reasoning: 'Phone number region identified but extraction confidence below threshold.',
      },
    },
  ],
};