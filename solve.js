// A faster drop-in for csv-reader 1.0.0 (make.fun's reference program).
//
// run(input) returns exactly csv-reader 1.0.0's readCsv answer for every input: {columns, rows, errors} for the
// input {text, header}, under the same broken-row policy:
//
//   - a U+FEFF at the very start of the text is dropped;
//   - a record ends at LF or CRLF, and a line left with no characters is no record;
//   - outside a quoted field a CR not followed by LF is dropped (stray_cr);
//   - a field that opens with a quote runs to the next quote that is not doubled, "" inside it one quote, and each
//     CRLF or lone CR inside it is read as LF; what follows its closing quote, up to the next comma or line break, is
//     appended to it as it stands (quote_junk, when the field ends); a quote that never closes is read as a literal
//     character and the text after it is read again as an unquoted field (unterminated_quote);
//   - a quote inside an unquoted field is a literal character; fields stay strings, never trimmed or converted;
//   - columns is the first record when header is true, else null; rows holds the records after it (every record
//     when header is false), each padded with "" (short_row, with fields: its count) or cut (long_row, with extra:
//     the cut fields) to the first record's width;
//   - each error is {code, line, row}: line the 1-based line its record starts on (every LF, CRLF and lone CR
//     inside a quoted field counted), row its record's index in rows (null for the header), in the order met.
//
// The reference reads one character at a time and builds each field a character at a time. This reader slices
// whole runs of ordinary characters at once: it keeps, for each character that can change anything (a comma, a
// quote, CR, LF), the next place it occurs, found with indexOf and reused while the read position has not passed
// it, so the text between two such characters is never rescanned and never touched a character at a time. Field
// results are handed back through shared slots, not a fresh object per field.

const COMMA_END = 0;
const BREAK_END = 1;
const EOF_END = 2;

export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const n = text.length;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  let pos = 0;
  let line = 1;
  if (text.charCodeAt(0) === 0xfeff) pos = 1;

  // The record being read: the line it starts on and the index in rows it takes (null: the header).
  let recordLine = 1;
  let recordRow = null;

  // The next occurrence of each special character at or after the last place it was searched from: at is its
  // index, -1 when there is none from `from` on, -2 when never searched. A cached entry answers any later search
  // from a position `from` covers; anything else is searched again.
  const cacheComma = { at: -2, from: 0 };
  const cacheLf = { at: -2, from: 0 };
  const cacheCr = { at: -2, from: 0 };
  const cacheQuote = { at: -2, from: 0 };
  function nextOf(cache, ch, from) {
    const at = cache.at;
    if (at !== -2 && cache.from <= from && (at === -1 || at >= from)) return at;
    const found = text.indexOf(ch, from);
    cache.at = found;
    cache.from = from;
    return found;
  }

  // The field just read, handed back through these slots by readUnquoted and readQuoted.
  let fValue = '';
  let fEnded = EOF_END;
  let fAdded = 0;

  // Reads unquoted characters onto `value` up to the next comma or line break: a CR not followed by LF is dropped
  // (stray_cr). Sets fValue, fEnded and fAdded (the characters this call kept).
  function readUnquoted(value) {
    let added = 0;
    for (;;) {
      const ic = nextOf(cacheComma, ',', pos);
      const il = nextOf(cacheLf, '\n', pos);
      const ir = nextOf(cacheCr, '\r', pos);
      let j = n;
      let code = 0;
      if (ic !== -1 && ic < j) { j = ic; code = 44; }
      if (il !== -1 && il < j) { j = il; code = 10; }
      if (ir !== -1 && ir < j) { j = ir; code = 13; }
      if (code === 0) {
        if (pos < n) {
          value += text.slice(pos);
          added += n - pos;
          pos = n;
        }
        fValue = value; fEnded = EOF_END; fAdded = added;
        return;
      }
      if (code === 44) {
        if (j > pos) { value += text.slice(pos, j); added += j - pos; }
        pos = j + 1;
        fValue = value; fEnded = COMMA_END; fAdded = added;
        return;
      }
      if (code === 10) {
        if (j > pos) { value += text.slice(pos, j); added += j - pos; }
        pos = j + 1;
        line += 1;
        fValue = value; fEnded = BREAK_END; fAdded = added;
        return;
      }
      // code === 13: a CR.
      if (text.charCodeAt(j + 1) === 10) {
        if (j > pos) { value += text.slice(pos, j); added += j - pos; }
        pos = j + 2;
        line += 1;
        fValue = value; fEnded = BREAK_END; fAdded = added;
        return;
      }
      if (j > pos) { value += text.slice(pos, j); added += j - pos; }
      errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
      pos = j + 1;
    }
  }

  // Reads a quoted field whose opening quote is at pos. Sets fValue, fEnded and fAdded.
  function readQuoted() {
    const open = pos;
    const openLine = line;
    let i = pos + 1;
    let segStart = i;
    let parts = null;
    for (;;) {
      const iq = nextOf(cacheQuote, '"', i);
      const ir = nextOf(cacheCr, '\r', i);
      const il = nextOf(cacheLf, '\n', i);
      let j = n;
      let code = 0;
      if (iq !== -1 && iq < j) { j = iq; code = 34; }
      if (ir !== -1 && ir < j) { j = ir; code = 13; }
      if (il !== -1 && il < j) { j = il; code = 10; }
      if (code === 0) {
        // The quote never closes: it is a literal character, and the text after it is read again as unquoted.
        pos = open + 1;
        line = openLine;
        errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
        readUnquoted('"');
        return;
      }
      if (code === 10) {
        line += 1;
        i = j + 1;
        continue;
      }
      if (code === 13) {
        // CRLF and a lone CR inside quotes are each one LF.
        if (parts === null) parts = [];
        parts.push(text.slice(segStart, j), '\n');
        line += 1;
        i = text.charCodeAt(j + 1) === 10 ? j + 2 : j + 1;
        segStart = i;
        continue;
      }
      // code === 34: a quote.
      if (text.charCodeAt(j + 1) === 34) {
        if (parts === null) parts = [];
        parts.push(text.slice(segStart, j), '"');
        i = j + 2;
        segStart = i;
        continue;
      }
      // The closing quote.
      let value;
      if (parts === null) {
        value = text.slice(segStart, j);
      } else {
        parts.push(text.slice(segStart, j));
        value = parts.join('');
      }
      pos = j + 1;
      if (pos >= n) { fValue = value; fEnded = EOF_END; fAdded = 0; return; }
      const c = text.charCodeAt(pos);
      if (c === 44) {
        pos += 1;
        fValue = value; fEnded = COMMA_END; fAdded = 0;
        return;
      }
      if (c === 10) {
        pos += 1;
        line += 1;
        fValue = value; fEnded = BREAK_END; fAdded = 0;
        return;
      }
      if (c === 13 && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
        fValue = value; fEnded = BREAK_END; fAdded = 0;
        return;
      }
      // What follows the closing quote is appended as it stands, up to the next comma or line break.
      readUnquoted(value);
      if (fAdded > 0) errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
      return;
    }
  }

  for (;;) {
    // Lines with no characters are no records.
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === 10) {
        pos += 1;
        line += 1;
      } else if (c === 13 && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= n) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    const fields = [];
    let quoted = false;
    let ended;
    do {
      quoted = text.charCodeAt(pos) === 34;
      if (quoted) readQuoted(); else readUnquoted('');
      fields.push(fValue);
      ended = fEnded;
    } while (ended === COMMA_END);

    // A line that held only stray CRs is left with no characters: no record (its stray_cr errors stay).
    if (fields.length === 1 && fields[0] === '' && !quoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
