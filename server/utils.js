const segmenter = new Intl.Segmenter("en", { granularity: "sentence" });

const ABBREV = /(?:^|[\s(])(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|e\.g|i\.e|Fig|Inc|Ltd|Co)\.$/;

function sentencesOf(line) {
  const out = [];
  let carry = "";

  for (const { segment } of segmenter.segment(line)) {
    const s = carry + segment;
    if (ABBREV.test(s.trimEnd())) {
      carry = s; // ends on an abbreviation, so glue it to the next segment
    } else {
      out.push(s);
      carry = "";
    }
  }
  if (carry) out.push(carry);
  return out;
}

function toUnits(text, maxSize) {
  const units = [];

  for (const para of text.split(/\n\s*\n/)) {
    let paraSep = "\n\n";

    for (const rawLine of para.split("\n")) {
      const line = rawLine.trim();
      if (!line) continue;

      let sep = paraSep; // separator before the first unit of this line
      paraSep = "\n";

      for (const segment of sentencesOf(line)) {
        let rest = segment.trim();

        while (rest.length > maxSize) {
          let cut = rest.lastIndexOf(" ", maxSize);
          const hard = cut <= 0;
          if (hard) cut = maxSize;
          units.push({ text: rest.slice(0, cut), sep });
          sep = hard ? "" : " ";
          rest = rest.slice(cut).trimStart();
        }
        if (rest) {
          units.push({ text: rest, sep });
          sep = " ";
        }
      }
    }
  }
  return units;
}

function chunkText(text, maxChunkSize = 4000, overlapSize = 500) {
  const units = toUnits(text, maxChunkSize);
  const join = (list) => list.map((u, i) => (i ? u.sep : "") + u.text).join("");

  const chunks = [];
  let current = [];
  let length = 0;

  for (const unit of units) {
    const add = (current.length ? unit.sep.length : 0) + unit.text.length;

    if (current.length && length + add > maxChunkSize) {
      chunks.push(join(current));

      let overlap = [];
      for (let i = current.length - 1; i >= 0; i--) {
        const candidate = [current[i], ...overlap];
        if (join(candidate).length > overlapSize) break;
        overlap = candidate;
      }
      while (
        overlap.length &&
        join(overlap).length + unit.sep.length + unit.text.length > maxChunkSize
      ) {
        overlap.shift();
      }
      current = overlap;
      length = join(current).length;
    }

    length += (current.length ? unit.sep.length : 0) + unit.text.length;
    current.push(unit);
  }

  if (current.length) chunks.push(join(current));
  return chunks;
}

function chunkSections(text, maxChunkSize = 4000, overlapSize = 500) {
  const sections = [];
  const stack = []; // current heading hierarchy: [{ level, title }]
  let path = "";
  let body = [];
  let inFence = false;

  const flush = () => {
    const content = body.join("\n").trim();
    body = [];
    if (content) sections.push({ heading: path, content });
  };

  for (const line of text.split("\n")) {
    if (/^\s*```/.test(line)) inFence = !inFence; // don't treat "# comment" in code as a heading

    const m = !inFence && line.match(/^(#{1,6})\s+(.*\S)\s*$/);
    if (m) {
      flush();
      const level = m[1].length;
      while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
      stack.push({ level, title: m[2] });
      path = stack.map((s) => s.title).join(" > ");
    } else {
      body.push(line);
    }
  }
  flush();

  const chunks = [];
  for (const { heading, content } of sections) {
    const prefix = heading ? `${heading}\n\n` : "";
    const room = Math.max(200, maxChunkSize - prefix.length);
    const overlap = Math.min(overlapSize, Math.floor(room / 4));

    for (const piece of chunkText(content, room, overlap)) {
      chunks.push({ heading, text: prefix + piece });
    }
  }
  return chunks;
}

module.exports = { chunkText, chunkSections };
