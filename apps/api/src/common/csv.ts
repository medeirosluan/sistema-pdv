export function toCsv(
  rows: (string | number | null | undefined)[][],
): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const value =
            cell === null || cell === undefined ? '' : String(cell);
          return /[";,\n]/.test(value)
            ? `"${value.replace(/"/g, '""')}"`
            : value;
        })
        .join(';'),
    )
    .join('\r\n');
}

export function parseCsv(text: string): string[][] {
  const clean = text
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  const firstLine = clean.split('\n')[0] ?? '';
  const semicolons = (firstLine.match(/;/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  const delimiter = semicolons >= commas ? ';' : ',';

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < clean.length; i += 1) {
    const char = clean[i];
    if (inQuotes) {
      if (char === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}
