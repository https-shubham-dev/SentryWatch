import PDFDocument from 'pdfkit';
import { IApi } from '../../models/Api.js';
import { ICheck } from '../../models/Check.js';

/** gen-design.md ink / mist / status palette for print surfaces */
const COLORS = {
  bg: '#0A0E14',
  panel: '#121821',
  border: '#293241',
  text: '#E8ECF1',
  muted: '#8B96A5',
  accent: '#4C8DFF',
  ok: '#3DD68C',
  critical: '#F0563D',
} as const;

export interface CheckExportSummary {
  total: number;
  passed: number;
  failed: number;
  uptimePercent: number;
  avgLatencyMs: number | null;
  rangeLabel: string;
}

export function computeCheckExportSummary(
  checks: Array<Pick<ICheck, 'passed' | 'latencyMs' | 'executedAt'>>,
  rangeLabel: string,
): CheckExportSummary {
  const total = checks.length;
  const passed = checks.filter((c) => c.passed).length;
  const failed = total - passed;
  const latencies = checks
    .map((c) => c.latencyMs)
    .filter((l): l is number => l !== null && l !== undefined);
  const avgLatencyMs =
    latencies.length > 0
      ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
      : null;

  return {
    total,
    passed,
    failed,
    uptimePercent: total > 0 ? Math.round((passed / total) * 1000) / 10 : 0,
    avgLatencyMs,
    rangeLabel,
  };
}

/**
 * Build a dark-themed PDF buffer of check history (pdfkit, server-side).
 */
export function buildCheckHistoryPdf(
  api: Pick<IApi, 'name' | 'method' | 'url'>,
  checks: Array<Pick<ICheck, 'executedAt' | 'passed' | 'statusCode' | 'latencyMs' | 'errorType'>>,
  summary: CheckExportSummary,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      margin: 40,
      size: 'A4',
      info: {
        Title: `SentryWatch — ${api.name} check history`,
        Author: 'SentryWatch',
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const left = 40;
    const contentWidth = pageWidth - 80;

    const paintBackground = () => {
      doc.save();
      doc.rect(0, 0, pageWidth, pageHeight).fill(COLORS.bg);
      doc.restore();
    };

    paintBackground();
    doc.on('pageAdded', paintBackground);

    // Header
    doc.fillColor(COLORS.accent).font('Helvetica-Bold').fontSize(11).text('SentryWatch', left, 40);
    doc
      .fillColor(COLORS.muted)
      .font('Helvetica')
      .fontSize(9)
      .text('Check history export', left, 54);

    doc
      .fillColor(COLORS.text)
      .font('Helvetica-Bold')
      .fontSize(16)
      .text(api.name, left, 78, { width: contentWidth });

    doc
      .fillColor(COLORS.muted)
      .font('Courier')
      .fontSize(9)
      .text(`${api.method}  ${api.url}`, left, doc.y + 4, { width: contentWidth });

    // Summary panel
    const summaryTop = doc.y + 16;
    doc.save();
    doc.roundedRect(left, summaryTop, contentWidth, 56, 2).fill(COLORS.panel);
    doc.restore();
    doc
      .strokeColor(COLORS.border)
      .lineWidth(1)
      .roundedRect(left, summaryTop, contentWidth, 56, 2)
      .stroke();

    const colW = contentWidth / 4;
    const summaryItems: Array<{ label: string; value: string }> = [
      { label: 'Uptime', value: `${summary.uptimePercent}%` },
      {
        label: 'Avg latency',
        value: summary.avgLatencyMs !== null ? `${summary.avgLatencyMs} ms` : '—',
      },
      { label: 'Checks', value: `${summary.total} (${summary.passed} pass / ${summary.failed} fail)` },
      { label: 'Range', value: summary.rangeLabel },
    ];

    summaryItems.forEach((item, i) => {
      const x = left + 12 + i * colW;
      doc
        .fillColor(COLORS.muted)
        .font('Helvetica')
        .fontSize(8)
        .text(item.label, x, summaryTop + 12, { width: colW - 16 });
      doc
        .fillColor(COLORS.text)
        .font('Courier-Bold')
        .fontSize(10)
        .text(item.value, x, summaryTop + 28, { width: colW - 16 });
    });

    doc.y = summaryTop + 72;

    // Table header
    const drawTableHeader = (y: number) => {
      doc.save();
      doc.rect(left, y, contentWidth, 22).fill(COLORS.panel);
      doc.restore();
      doc.strokeColor(COLORS.border).rect(left, y, contentWidth, 22).stroke();

      const headers = [
        { label: 'Timestamp', x: left + 8, w: 150 },
        { label: 'Status', x: left + 160, w: 50 },
        { label: 'HTTP', x: left + 220, w: 70 },
        { label: 'Latency', x: left + 300, w: 70 },
      ];
      doc.fillColor(COLORS.muted).font('Helvetica-Bold').fontSize(8);
      headers.forEach((h) => doc.text(h.label, h.x, y + 7, { width: h.w }));
      return y + 22;
    };

    let rowY = drawTableHeader(doc.y);

    const ensureSpace = (needed: number) => {
      if (rowY + needed > pageHeight - 50) {
        doc.addPage();
        rowY = drawTableHeader(40);
      }
    };

    // Newest first already from query
    for (const check of checks) {
      ensureSpace(18);
      const statusLabel = check.passed ? 'PASS' : 'FAIL';
      const statusColor = check.passed ? COLORS.ok : COLORS.critical;
      const httpLabel =
        check.statusCode !== null && check.statusCode !== undefined
          ? String(check.statusCode)
          : check.errorType || 'ERR';
      const latencyLabel =
        check.latencyMs !== null && check.latencyMs !== undefined ? `${check.latencyMs} ms` : '—';
      const ts = new Date(check.executedAt).toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC');

      doc
        .strokeColor(COLORS.border)
        .moveTo(left, rowY + 16)
        .lineTo(left + contentWidth, rowY + 16)
        .stroke();

      doc.fillColor(COLORS.text).font('Courier').fontSize(8).text(ts, left + 8, rowY + 4, {
        width: 150,
      });
      doc.fillColor(statusColor).font('Courier-Bold').fontSize(8).text(statusLabel, left + 160, rowY + 4, {
        width: 50,
      });
      doc.fillColor(COLORS.text).font('Courier').fontSize(8).text(httpLabel, left + 220, rowY + 4, {
        width: 70,
      });
      doc.fillColor(COLORS.text).font('Courier').fontSize(8).text(latencyLabel, left + 300, rowY + 4, {
        width: 70,
      });

      rowY += 16;
    }

    if (checks.length === 0) {
      doc
        .fillColor(COLORS.muted)
        .font('Helvetica')
        .fontSize(9)
        .text('No checks in the selected range.', left + 8, rowY + 8);
    }

    // Footer
    const footerY = pageHeight - 36;
    doc
      .fillColor(COLORS.muted)
      .font('Helvetica')
      .fontSize(8)
      .text(`Generated ${new Date().toISOString()} · SentryWatch`, left, footerY, {
        width: contentWidth,
        align: 'left',
      });

    doc.end();
  });
}
