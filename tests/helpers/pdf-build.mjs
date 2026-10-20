/* Tiny raw PDF writer for tests: lets a test control the exact content stream, fonts and resources. */
export function buildPdf({ pages, fonts = {}, extraObjects = [], catalogExtra = '', info = '' }) {
  const objs = []; const add = body => { objs.push(body); return objs.length; };
  const catalogId = add(''), pagesId = add('');
  const fontIds = {}; for (const [name, dict] of Object.entries(fonts)) fontIds[name] = add(dict);
  const pageIds = [];
  for (const pg of pages) {
    const contentId = add(null); const resFonts = Object.keys(fontIds).map(n => `/${n} ${fontIds[n]} 0 R`).join(' ');
    const len = Buffer.byteLength(pg.content, 'latin1'); objs[contentId - 1] = `<< /Length ${len} >>\nstream\n${pg.content}\nendstream`;
    const pid = add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pg.w || 612} ${pg.h || 792}] /Resources << /Font << ${resFonts} >> ${pg.resources || ''} >> /Contents ${contentId} 0 R ${pg.extra || ''} >>`);
    pageIds.push(pid);
  }
  for (const e of extraObjects) add(typeof e === 'function' ? e(pageIds) : e);
  objs[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R ${typeof catalogExtra === 'function' ? catalogExtra(pageIds) : catalogExtra} >>`;
  objs[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map(i => i + ' 0 R').join(' ')}] /Count ${pageIds.length} >>`;
  let out = '%PDF-1.7\n%\xE2\xE3\xCF\xD3\n'; const offs = [];
  objs.forEach((b, i) => { offs.push(Buffer.byteLength(out, 'latin1')); out += `${i + 1} 0 obj\n${b}\nendobj\n`; });
  const xref = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('') + `trailer\n<< /Size ${objs.length + 1} /Root ${catalogId} 0 R ${info} >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}
export const STD_FONTS = { F1: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>', F2: '<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman /Encoding /WinAnsiEncoding >>', F3: '<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>' };
