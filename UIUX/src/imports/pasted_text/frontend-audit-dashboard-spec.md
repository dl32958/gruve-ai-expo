你的前端应该“解决什么问题”

快速告诉人：哪些字段可信，哪些要复核（field_state + confidence）

点开就能解释为什么（selection_reason + 四个 final 信号）

需要审计时能追溯到 evidence / reasoning（engine 的 extraction 和 self-judge）

1) 页面布局（单页 Dashboard）
Overall Layout

顶部：Header bar（项目名 + run 状态 + 下载按钮）

左侧：Inputs panel（上传/字段/运行）

右侧：Results panel（最重要，默认看到最终判断）

底部可折叠：Explain & Debug drawer（Stage 1/2/3 明细）

视觉风格：白底 + 轻灰分隔 + 圆角卡片（12px～16px）+ 微阴影（非常轻）+ 字体层级明确（标题 18/20、正文 14/16）。

2) Inputs Panel（左侧）
2.1 Upload Card

组件：UploadCard

用到字段：metadata.image_path（运行后显示）、用户本地文件（上传前）

UI：

Dropzone + “Browse”

上传后：左侧显示缩略图（可点开大图预览）

一行小字：支持 jpg/png/pdf（如果你只做 image 就写 jpg/png）

2.2 Document Type

组件：DocCategorySelect

用到字段：metadata.doc_category

UI：下拉（receipt / invoice…）

美观：下拉选中后显示一个小 tag，例如 “receipt”

2.3 Fields Editor

组件：FieldsTagEditor

用到字段：metadata.fields

UI：

tags 输入框（可删可加）

默认建议：company/date/address/total

可选：phone number（你 demo 里有）

2.4 Run Controls

组件：RunControls

用到字段：metadata.debug（开关）

UI：

“Run Pipeline”

Debug toggle（开：允许保存/下载中间产物）

2.5 Progress

组件：StageProgress

UI：5-step 进度条（跟你 pipeline 控制台一致）
1 OCR
2 Constraints (A/B)
3 Extraction (A/B)
4 Rule synthesis + self-judge
5 Cross-judge

美观：每一步旁边显示一个小圆点，正在跑的 step 有动效（轻微脉冲）

3) Results Panel（右侧）
3.1 Run Summary Bar（顶端一条）

组件：RunSummaryBar

用到字段：metadata.timestamp, metadata.elapsed_seconds

额外可从 field_results 推导：

overall_status：

all pass -> “All Passed”

any review_needed -> “Needs Review”

any fail -> “Failed Fields”

UI：

左：状态徽标（绿色/黄色/红色）

中：timestamp（小号灰字）

右：elapsed_seconds + “Download final JSON”

3.2 Field Results Grid（核心）

组件：FieldCardGrid

数据来源：field_results（每个字段一张卡）

Field Card（折叠态）

组件：FieldCard(field_name, result)

用到字段：

recommended_value

field_state

field_confidence

selected_engine

selection_reason（如果非空则显示一行）

UI（从上到下）：

Title：字段名（company/date/address/total/phone number）

Value：recommended_value（大字体，最多两行，超出省略号）

Badges：

State badge：pass / review_needed / fail（最显眼）

Confidence badge：very_high/high/medium/low（次显眼）

Engine badge：engineA/engineB/none（小）

Optional line：selection_reason（灰字，最多一行）

美观建议：

卡片左侧加一条 4px 的颜色条：pass=绿、review=黄、fail=红

recommended_value 为空时显示 “—” 并把 fail badge 放更显眼

3.3 Field Details Drawer（展开态：解释“为什么”）

点击 Field Card 打开右侧抽屉（或卡片内折叠），建议抽屉更像产品。

组件：FieldDetailsDrawer

用到字段（全部来自 CrossJudgmentResult）：

recommended_value

selected_engine

selection_reason

final_rule_consistency

final_engine_self_consistency

final_ocr_alignment

final_ocr_corruption

field_confidence

field_state

state_reason

Drawer 内部结构（3块）

(A) Final Decision (Summary)

展示：recommended_value + state + confidence

如果 state_reason 非空，显示 “Reason: …”

(B) Signals (4 个最终信号)

以 2x2 小表格显示：

rule_consistency

engine_self_consistency

ocr_alignment

ocr_corruption

美观：每项右侧用 pill 标签（high/strong/absent…）

(C) Engine Comparison (A vs B)

两列对比卡片：

Engine A（标题 + 关键自评）

Engine B

这里的数据来自 self-justification（见下一节 Explain drawer）；如果你暂时不在 final_result 里带入，可以在 UI 里显示“Load traces”按钮，从 debug 文件或后端接口取。

4) Explain & Debug Drawer（底部折叠）

这块是“可审计性”的核心，但默认要收起来，不打扰产品感。

组件：ExplainDebugDrawer

Tab：Stage 1 / Stage 2 / Stage 3

Stage 1: OCR Raw Text

你 pipeline 里确实有 OCR raw text 的概念（OCR 输出），但不在 final_result schema；建议前端通过 debug 文件或接口拿到（你 debug 会保存 raw_text）。

UI：

一个可搜索的 text area

高亮：输入框 search 命中高亮（例如搜 “Total”）

Stage 2: Constraints + Extraction（Engine A & B）

(A) Constraints

数据：constraint_summary（每个 field 一组规则）

UI：字段分组折叠列表（company/date/…）

(B) Extraction Output

数据：ExtractionResult

field_extraction[field]

evidence_trace[field]

reasoning[field]

UI：每个 field 一行，可点开三段：

Extracted value（单行）

Evidence trace（短文本块）

Reasoning（更短，限制 3～4 行，超出可展开）

Stage 3: Rule Synthesis + Self-Judge

(A) Consolidated Rules

数据：consolidated_rules[field] + synthesis_summary

UI：字段 -> 规则 bullet list；顶部显示 agreement_level + notes

(B) Self-Justification（Engine A/B 分 tab）

数据：SelfJustificationResult

extracted_value

rule_consistency

engine_self_consistency

ocr_alignment

ocr_corruption

judgment_summary

UI：按 field 列表展示，每个 field 有一个“评分条”：

e.g. rule_consistency=high（显示为高）

ocr_corruption=possible/present（显示警告）

5) 输出最终长什么样（用户视角）

用户跑完后，右侧看到：

顶部：Needs Review · 00:50:52 · 185.6s · Download JSON

Field Cards：

company：pass · very_high · engineA · “TA -K …”

date：pass · high · engineB · “25/12/2018 8:13:39 PM”

address：review_needed · medium · engineA · （因为 ?）

total：pass · high · engineA · “9.00”

phone number：fail · low · none · “—”
（这些字段完全来自你 final_result 示例）

点开 address 卡：

Reason: contains OCR corruption (“?”)

Signals：rule=high, self=strong, alignment=strong, corruption=possible

Compare A vs B：显示两边 extraction + evidence + self-judge summary（从 Stage 2/3 拿）

6) 美观性细节（很实用的“设计规则”）

对齐：所有卡片内元素左对齐；badge 统一高度（24px）

层级：

value 比 labels 大一档

reasoning 永远比 evidence 更淡（减少噪音）

字数控制：

selection_reason / judgment_summary 默认 1 行，超出 “Show more”

一致性：

所有枚举值（pass/high/strong）用固定的 pill 显示，不要一会儿文字一会儿图标

可读性：

OCR raw text 用等宽字体（monospace）

JSON 展示也用等宽字体，可折叠（但默认别展示大段 JSON）

7) 一个关键建议：前端最好“只消费 final_result”

你 notebook 里 Stage 1/2/3 的信息很多，但如果你想让前端稳定、易交付：

默认页面只依赖 final_result（metadata + field_results）

Explain/Debug 的内容通过 debug 文件/接口按需加载（否则 UI 会被中间产物绑死）