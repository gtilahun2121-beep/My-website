/**
 * exportUtils.ts
 * Client-side report exporters. Zero-dependency: PDF is built as a minimal
 * text PDF (Helvetica + simple table lines), Excel is emitted as an HTML-table
 * .xls workbook that Excel opens natively.
 */

export interface ExportColumn {
  header: string;
  // Each row is a record of header → cell value.
}

export function toDownloadable(rows: (string | number)[][], filename: string, mime: string) {
  const csv = rows
    .map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: mime });
  triggerDownload(blob, filename);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

export function exportCsv(rows: (string | number)[][], filename: string) {
  toDownloadable(rows, filename, 'text/csv;charset=utf-8;');
}

// ---------------------------------------------------------------------------
// Excel (HTML-table .xls — opens cleanly in Microsoft Excel)
// ---------------------------------------------------------------------------

export function exportExcel(rows: (string | number)[][], filename: string, sheetTitle = 'QalNet Report') {
  const esc = (v: string | number) =>
    String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const body = rows
    .map((r, i) => {
      const tag = i === 0 ? 'th' : 'td';
      const cells = r.map((c) => `<${tag} style="${i === 0 ? 'font-weight:bold;background:#f3f4f6;' : ''}mso-number-format:\\"\\@\\";">${esc(c)}</${tag}>`).join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');
  const html = `<?xml version="1.0"?>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="UTF-8"></head>
<body>
<table><tr><td>${esc(sheetTitle)}</td></tr></table>
<table>${body}</table>
</body>
</html>`;
  const blob = new Blob(['\ufeff', html], {
    type: 'application/vnd.ms-excel;charset=utf-8;',
  });
  triggerDownload(blob, filename);
}

// ---------------------------------------------------------------------------
// PDF (minimal text-based, ASCII-safe)
// ---------------------------------------------------------------------------

function pdfEscape(text: string): string {
  // PDF string escaping + drop non-ASCII so Helvetica renders cleanly.
  return text
    .replace(/[\u0000-\u001f]/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/[^\x20-\x7e]/g, ' ');
}

const PAGE_WIDTH = 612; // Letter, points
const PAGE_HEIGHT = 792;
const MARGIN = 36;
const LINE_H = 14;
const HEADER_H = 40;
const FONT_SIZE = 8;

export function exportPdf(rows: (string | number)[][], filename: string, title = 'QalNet Report') {
  const esc = (v: string | number) => pdfEscape(String(v ?? ''));

  const colCount = Math.max(1, rows[0]?.length ?? 1);
  const usable = PAGE_WIDTH - MARGIN * 2;
  const colW = usable / colCount;

  const content: string[] = [];
  const topY = PAGE_HEIGHT - HEADER_H;

  content.push(`q 0 0 0 rg BT /F2 12 Tf ${MARGIN} ${topY} Td (${esc(title)}) Tj ET`);
  content.push(`BT /F1 7 Tf ${MARGIN} ${topY - 14} Td (Generated ${pdfEscape(new Date().toLocaleString())}) Tj ET`);
  content.push(`1 1 1 rg 0.9 0.9 0.9 RG`);

  // Draw header band
  content.push(`${MARGIN} ${topY - 24} ${usable} ${LINE_H} re B`);

  // Draw header text (truncate each cell to its column width)
  const headerCells = (rows[0] ?? []).map((c, ci) => {
    const text = esc(c).slice(0, Math.floor(colW / 4.5));
    return `1 0 0 1 ${MARGIN + 4 + ci * colW} ${topY - 24 + 3} Td (${text}) Tj`;
  });
  content.push(`0 0 0 rg BT /F1 ${FONT_SIZE} Tf ${headerCells.join(' ')} ET`);

  // Body rows
  content.push(`0 0 0 rg BT /F1 ${FONT_SIZE} Tf`);
  const maxRows = Math.max(0, Math.floor((topY - 24 - MARGIN - 10) / LINE_H));
  rows.slice(1, 1 + maxRows).forEach((row, idx) => {
    const y = topY - 24 - LINE_H - idx * LINE_H;
    const cells = row.map((c, ci) => {
      const text = esc(c).slice(0, Math.floor(colW / 4.5));
      return `1 0 0 1 ${MARGIN + 4 + ci * colW} ${y + 2} Td (${text}) Tj`;
    });
    content.push(...cells);
  });
  content.push('ET');

  // Grid lines
  content.push('0.85 0.85 0.85 RG');
  for (let i = 0; i <= rows.slice(1, 1 + maxRows).length + 1; i++) {
    const y = topY - 24 - i * LINE_H;
    content.push(`${MARGIN} ${y} ${usable} 0 S`);
  }
  for (let ci = 0; ci <= colCount; ci++) {
    const x = MARGIN + ci * colW;
    content.push(`${x} ${topY - 24} 0 ${LINE_H * (rows.slice(1, 1 + maxRows).length + 1)} S`);
  }

  content.push('BT /F1 7 Tf 1 0 0 1 36 24 Td (QalNet Platform - Confidential) Tj ET');
  content.push(`Q`);

  const streams = content.join('\n');

  // Build the PDF object graph.
  const objects: { body: string }[] = [];
  objects.push({
    body: `<< /Type /Catalog /Pages 2 0 R >>`,
  });
  objects.push({
    body: `<< /Type /Pages /Kids [3 0 R] /Count 1 >>`,
  });
  objects.push({
    body: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${4} 0 R /F2 ${5} 0 R >> >> /Contents 6 0 R >>`,
  });
  objects.push({
    body: `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`,
  });
  objects.push({
    body: `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>`,
  });
  objects.push({
    body: `<< /Length ${streams.length} >>\nstream\n${streams}\nendstream`,
  });

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((obj, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${obj.body}\nendobj\n`;
  });

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((o) => {
    pdf += `${String(o).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  const blob = new Blob([pdf], { type: 'application/pdf' });
  triggerDownload(blob, filename);
}