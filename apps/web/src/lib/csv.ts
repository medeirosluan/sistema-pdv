export function downloadCsv(
  filename: string,
  rows: (string | number)[][],
): void {
  const content = rows
    .map((row) =>
      row
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(';'),
    )
    .join('\r\n');
  downloadTextFile(filename, content);
}

export function downloadTextFile(
  filename: string,
  content: string,
  mime = 'text/csv;charset=utf-8;',
): void {
  const blob = new Blob(['\uFEFF', content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
