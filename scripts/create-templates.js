'use strict';

/**
 * Generate 4 reference.docx templates for Pandoc
 * Based on Master Architecture §3.3
 *
 * Pandoc reads these Word style names from reference.docx:
 *   Heading 1~3, First Paragraph, Body Text, Source Code,
 *   Verbatim Char, Block Text, Table Caption, Image Caption, TOC Heading
 */

const {
  Document, Packer, Paragraph, TextRun,
  HeadingLevel, AlignmentType,
  BorderStyle, ShadingType, convertMillimetersToTwip,
  Footer, Header, PageNumber
} = require('docx');
const fs = require('fs');
const path = require('path');

const TEMPLATES_DIR = path.join(__dirname, '..', 'templates', 'docx');
if (!fs.existsSync(TEMPLATES_DIR)) fs.mkdirSync(TEMPLATES_DIR, { recursive: true });

const pt = (size) => size * 2;
const mm = (val) => convertMillimetersToTwip(val);

const A4_SECTION = {
  page: {
    size: { width: mm(210), height: mm(297) },
    margin: { top: mm(25), right: mm(25), bottom: mm(25), left: mm(25) }
  }
};

// Shared paragraph styles builder
function makeParaStyles(cfg) {
  return [
    { id: 'BodyText', name: 'Body Text', basedOn: 'Normal', run: cfg.body.run, paragraph: cfg.body.paragraph },
    { id: 'FirstParagraph', name: 'First Paragraph', basedOn: 'Normal', run: cfg.body.run, paragraph: cfg.body.paragraph },
    { id: 'SourceCode', name: 'Source Code', basedOn: 'Normal', run: cfg.code.run, paragraph: cfg.code.paragraph },
    { id: 'BlockText', name: 'Block Text', basedOn: 'Normal', run: cfg.block.run, paragraph: cfg.block.paragraph },
    { id: 'Caption', name: 'Caption', basedOn: 'Normal', run: cfg.caption },
    { id: 'TableCaption', name: 'Table Caption', basedOn: 'Normal', run: cfg.caption },
    { id: 'ImageCaption', name: 'Image Caption', basedOn: 'Normal', run: cfg.caption },
    { id: 'TOCHeading', name: 'TOC Heading', basedOn: 'Normal', run: cfg.toc },
  ];
}

function sampleContent() {
  return [
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun('Document Title')] }),
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('Heading 1 Sample')] }),
    new Paragraph({ style: 'FirstParagraph', children: [new TextRun('First paragraph of a section.')] }),
    new Paragraph({ style: 'BodyText', children: [new TextRun('Normal body text paragraph with content.')] }),
    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun('Heading 2 Sample')] }),
    new Paragraph({ style: 'BodyText', children: [new TextRun('More body text content here.')] }),
    new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun('Heading 3 Sample')] }),
    new Paragraph({ style: 'SourceCode', children: [new TextRun('console.log("Hello World");')] }),
    new Paragraph({ style: 'BlockText', children: [new TextRun('This is a block quote text.')] }),
    new Paragraph({ style: 'Caption', children: [new TextRun('Caption text for figures or tables.')] }),
  ];
}

// ① business-report.docx — §3.3-①
function createBusinessReport() {
  return new Document({
    styles: {
      default: {
        document: { run: { font: 'Malgun Gothic', size: pt(11), color: '333333' }, paragraph: { spacing: { line: 360, after: 120 } } },
        heading1: { run: { font: 'Malgun Gothic', size: pt(18), bold: true, color: '1B365D' }, paragraph: { spacing: { before: 480, after: 240 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '1B365D' } } } },
        heading2: { run: { font: 'Malgun Gothic', size: pt(14), bold: true, color: '2E5090' }, paragraph: { spacing: { before: 360, after: 160 } } },
        heading3: { run: { font: 'Malgun Gothic', size: pt(12), bold: true, color: '4472C4' }, paragraph: { spacing: { before: 240, after: 120 } } },
        title: { run: { font: 'Malgun Gothic', size: pt(28), bold: true, color: '1B365D' }, paragraph: { alignment: AlignmentType.CENTER, spacing: { after: 200 }, border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: '1B365D' } } } },
      },
      paragraphStyles: makeParaStyles({
        body: { run: { font: 'Malgun Gothic', size: pt(11), color: '333333' }, paragraph: { spacing: { line: 360, after: 120 } } },
        code: { run: { font: 'Consolas', size: pt(9), color: '2D2D2D' }, paragraph: { spacing: { line: 276 }, shading: { type: ShadingType.CLEAR, fill: 'F8F9FA' }, border: { left: { style: BorderStyle.SINGLE, size: 18, color: '4472C4' } } } },
        block: { run: { font: 'Malgun Gothic', size: pt(10.5), italics: true, color: '555555' }, paragraph: { indent: { left: mm(10) }, border: { left: { style: BorderStyle.SINGLE, size: 18, color: 'D1D5DB' } } } },
        caption: { font: 'Malgun Gothic', size: pt(9), italics: true, color: '666666' },
        toc: { font: 'Malgun Gothic', size: pt(16), bold: true, color: '1B365D' },
      }),
      characterStyles: [{ id: 'VerbatimChar', name: 'Verbatim Char', run: { font: 'Consolas', size: pt(9.5), color: 'E74C3C' } }],
    },
    sections: [{
      properties: { ...A4_SECTION },
      headers: { default: new Header({ children: [new Paragraph({ children: [new TextRun({ text: 'LinkMD Document', font: 'Malgun Gothic', size: pt(8), color: '999999' })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], font: 'Malgun Gothic', size: pt(9), color: '999999' })] })] }) },
      children: sampleContent(),
    }],
  });
}

// ② technical-doc.docx — §3.3-②
function createTechnicalDoc() {
  return new Document({
    styles: {
      default: {
        document: { run: { font: 'Malgun Gothic', size: pt(10.5), color: '2D2D2D' }, paragraph: { spacing: { line: 336, after: 100 } } },
        heading1: { run: { font: 'Malgun Gothic', size: pt(16), bold: true, color: '16213E' }, paragraph: { spacing: { before: 400, after: 200 } } },
        heading2: { run: { font: 'Malgun Gothic', size: pt(13), bold: true, color: '0F3460' }, paragraph: { spacing: { before: 320, after: 160 } } },
        heading3: { run: { font: 'Malgun Gothic', size: pt(11.5), bold: true, color: '533483' }, paragraph: { spacing: { before: 240, after: 120 } } },
        title: { run: { font: 'Malgun Gothic', size: pt(24), bold: true, color: '1A1A2E' }, paragraph: { alignment: AlignmentType.LEFT, spacing: { after: 200 } } },
      },
      paragraphStyles: makeParaStyles({
        body: { run: { font: 'Malgun Gothic', size: pt(10.5), color: '2D2D2D' }, paragraph: { spacing: { line: 336, after: 100 } } },
        code: { run: { font: 'Consolas', size: pt(9), color: '2D2D2D' }, paragraph: { spacing: { line: 276 }, shading: { type: ShadingType.CLEAR, fill: 'F5F5F5' }, border: { top: { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' }, bottom: { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' }, left: { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' }, right: { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' } } } },
        block: { run: { font: 'Malgun Gothic', size: pt(10), italics: true, color: '555555' }, paragraph: { indent: { left: mm(10) }, border: { left: { style: BorderStyle.SINGLE, size: 18, color: '533483' } } } },
        caption: { font: 'Malgun Gothic', size: pt(9), italics: true, color: '666666' },
        toc: { font: 'Malgun Gothic', size: pt(14), bold: true, color: '16213E' },
      }),
      characterStyles: [{ id: 'VerbatimChar', name: 'Verbatim Char', run: { font: 'Consolas', size: pt(9.5), color: 'E74C3C' } }],
    },
    sections: [{
      properties: { ...A4_SECTION },
      headers: { default: new Header({ children: [new Paragraph({ children: [new TextRun({ text: 'Technical Document', font: 'Malgun Gothic', size: pt(8), color: '999999' })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'Confidential  |  Page ', size: pt(8), color: '999999' }), new TextRun({ children: [PageNumber.CURRENT], size: pt(8), color: '999999' })] })] }) },
      children: sampleContent(),
    }],
  });
}

// ③ simple-clean.docx — §3.3-③
function createSimpleClean() {
  return new Document({
    styles: {
      default: {
        document: { run: { font: 'Malgun Gothic', size: pt(11), color: '333333' }, paragraph: { spacing: { line: 360, after: 120 } } },
        heading1: { run: { font: 'Malgun Gothic', size: pt(16), bold: true, color: '111111' }, paragraph: { spacing: { before: 400, after: 200 } } },
        heading2: { run: { font: 'Malgun Gothic', size: pt(13), bold: true, color: '333333' }, paragraph: { spacing: { before: 320, after: 160 } } },
        heading3: { run: { font: 'Malgun Gothic', size: pt(11), bold: true, color: '555555' }, paragraph: { spacing: { before: 240, after: 120 } } },
      },
      paragraphStyles: makeParaStyles({
        body: { run: { font: 'Malgun Gothic', size: pt(11), color: '333333' }, paragraph: { spacing: { line: 360, after: 120 } } },
        code: { run: { font: 'Consolas', size: pt(9), color: '2D2D2D' }, paragraph: { spacing: { line: 276 }, shading: { type: ShadingType.CLEAR, fill: 'F5F5F5' } } },
        block: { run: { font: 'Malgun Gothic', size: pt(10.5), italics: true, color: '555555' }, paragraph: { indent: { left: mm(10) } } },
        caption: { font: 'Malgun Gothic', size: pt(9), color: '666666' },
        toc: { font: 'Malgun Gothic', size: pt(14), bold: true, color: '111111' },
      }),
      characterStyles: [{ id: 'VerbatimChar', name: 'Verbatim Char', run: { font: 'Consolas', size: pt(9.5), color: '555555' } }],
    },
    sections: [{ properties: { ...A4_SECTION }, children: sampleContent() }],
  });
}

// ④ government-report.docx — §3.3-④
function createGovernmentReport() {
  return new Document({
    styles: {
      default: {
        document: { run: { font: 'Malgun Gothic', size: pt(11), color: '000000' }, paragraph: { spacing: { line: 384, after: 120 }, indent: { firstLine: mm(10) } } },
        heading1: { run: { font: 'Malgun Gothic', size: pt(16), bold: true, color: '000000' }, paragraph: { spacing: { before: 480, after: 240 }, indent: { firstLine: 0 } } },
        heading2: { run: { font: 'Malgun Gothic', size: pt(14), bold: true, color: '000000' }, paragraph: { spacing: { before: 360, after: 160 }, indent: { firstLine: 0 } } },
        heading3: { run: { font: 'Malgun Gothic', size: pt(12), bold: true, color: '000000' }, paragraph: { spacing: { before: 240, after: 120 }, indent: { firstLine: 0 } } },
        title: { run: { font: 'Malgun Gothic', size: pt(22), bold: true, color: '000000' }, paragraph: { alignment: AlignmentType.CENTER, spacing: { after: 400 } } },
      },
      paragraphStyles: makeParaStyles({
        body: { run: { font: 'Malgun Gothic', size: pt(11), color: '000000' }, paragraph: { spacing: { line: 384, after: 120 }, indent: { firstLine: mm(10) } } },
        code: { run: { font: 'Consolas', size: pt(9), color: '000000' }, paragraph: { spacing: { line: 276 }, indent: { firstLine: 0 }, border: { top: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, left: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, right: { style: BorderStyle.SINGLE, size: 1, color: '000000' } } } },
        block: { run: { font: 'Malgun Gothic', size: pt(10.5), color: '333333' }, paragraph: { indent: { left: mm(15), firstLine: 0 } } },
        caption: { font: 'Malgun Gothic', size: pt(9), color: '333333' },
        toc: { font: 'Malgun Gothic', size: pt(16), bold: true, color: '000000' },
      }),
      characterStyles: [{ id: 'VerbatimChar', name: 'Verbatim Char', run: { font: 'Consolas', size: pt(9.5), color: '000000' } }],
    },
    sections: [{
      properties: { ...A4_SECTION },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '- ', size: pt(9) }), new TextRun({ children: [PageNumber.CURRENT], size: pt(9) }), new TextRun({ text: ' -', size: pt(9) })] })] }) },
      children: sampleContent(),
    }],
  });
}

async function main() {
  const templates = [
    { name: 'business-report', fn: createBusinessReport },
    { name: 'technical-doc', fn: createTechnicalDoc },
    { name: 'simple-clean', fn: createSimpleClean },
    { name: 'government-report', fn: createGovernmentReport },
  ];

  for (const { name, fn } of templates) {
    const doc = fn();
    const buffer = await Packer.toBuffer(doc);
    const outPath = path.join(TEMPLATES_DIR, `${name}.docx`);
    fs.writeFileSync(outPath, buffer);
    console.log(`Created: ${name}.docx (${buffer.length} bytes)`);
  }
  console.log('\nAll 4 templates generated successfully.');
}

main().catch(console.error);
