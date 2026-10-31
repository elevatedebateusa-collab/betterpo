export interface ParsedSenator {
  id: string;
  name: string;
  school: string;
  recency: number;
}

/**
 * Intelligent parser for Tabroom Congressional Debate rosters & recency charts.
 * Automatically extracts:
 * 1. Initial recency order from leading or trailing numbers (e.g. "1\tJohn Doe", "1. John Doe", "John Doe (1)")
 * 2. Senator Name (normalizing "Last, First" if present)
 * 3. School Affiliation
 * Defaults to 1-based sequential order if no explicit number is present.
 */
export function parseTabroomRecencyList(text: string): ParsedSenator[] {
  if (!text || !text.trim()) return [];

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  return lines.map((line, index) => {
    let recency = index + 1;
    let remainder = line;

    // 1. Detect leading rank / recency number: "1\t...", "1. ...", "#1 ...", "1 - ..."
    const leadingMatch = remainder.match(/^#?(\d+)[\.\)\:\t\s\-]+(.*)$/);
    if (leadingMatch) {
      const parsedNum = parseInt(leadingMatch[1], 10);
      if (!isNaN(parsedNum) && parsedNum > 0) {
        recency = parsedNum;
        remainder = leadingMatch[2].trim();
      }
    } else {
      // 2. Detect trailing rank / recency number: "... - 1", "... (1)"
      const trailingMatch = remainder.match(/^(.*?)\s*[\-\t\(]\s*#?(\d+)\s*\)?$/);
      if (trailingMatch) {
        const parsedNum = parseInt(trailingMatch[2], 10);
        if (!isNaN(parsedNum) && parsedNum > 0) {
          recency = parsedNum;
          remainder = trailingMatch[1].trim();
        }
      }
    }

    let name = remainder;
    let school = '';

    // 3. Delimiter extraction for Name & School
    if (remainder.includes('\t')) {
      const parts = remainder.split('\t').map((p) => p.trim()).filter(Boolean);
      if (parts.length >= 2) {
        name = parts[0];
        school = parts.slice(1).join(' ');
      }
    } else if (remainder.includes(' - ')) {
      const parts = remainder.split(' - ').map((p) => p.trim());
      name = parts[0];
      school = parts.slice(1).join(' - ');
    } else if (remainder.includes('(') && remainder.includes(')')) {
      const parenMatch = remainder.match(/^(.*?)\s*\((.*?)\)$/);
      if (parenMatch) {
        name = parenMatch[1].trim();
        school = parenMatch[2].trim();
      }
    } else if (remainder.includes(',')) {
      const parts = remainder.split(',').map((p) => p.trim());
      if (parts.length === 2) {
        // "LastName, FirstName" -> "FirstName LastName"
        name = `${parts[1]} ${parts[0]}`;
      } else if (parts.length >= 3) {
        // "LastName, FirstName, School"
        name = `${parts[1]} ${parts[0]}`;
        school = parts.slice(2).join(', ');
      }
    }

    // Clean any stray separators
    name = name.replace(/^[\s\-–—:]+|[\s\-–—:]+$/g, '').trim();
    school = school.replace(/^[\s\-–—:]+|[\s\-–—:]+$/g, '').trim();

    return {
      id: `senator_${index}_${Math.random().toString(36).substring(2, 7)}`,
      name,
      school,
      recency,
    };
  });
}

