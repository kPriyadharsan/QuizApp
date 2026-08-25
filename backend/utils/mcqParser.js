/**
 * Deterministic MCQ parsing state machine
 */

export const States = {
    IDLE: 'IDLE',
    QUESTION: 'QUESTION',
    OPTION_A: 'OPTION_A',
    OPTION_B: 'OPTION_B',
    OPTION_C: 'OPTION_C',
    OPTION_D: 'OPTION_D',
    BETWEEN_QUESTIONS: 'BETWEEN_QUESTIONS'
};

/**
 * Detects standard question markers (numeric and malformed)
 */
export const detectQuestionMarker = (text) => {
    // 1. Numeric question marker (e.g., "1.", "1)", "Q1.", "Q1:", "Question 1:", "Q 1)")
    const numericMatch = text.match(/^\s*(?:Question|Q)?\s*(\d+)[\.\)\:-]\s*(.*)$/i);
    if (numericMatch) {
        return {
            number: parseInt(numericMatch[1], 10),
            text: numericMatch[2].trim()
        };
    }
    
    // 2. Malformed/un-numbered question marker (e.g., "Q.", "Question:", "Q:")
    const malformedMatch = text.match(/^\s*(?:Question|Q)[\.\)\:-]\s*(.*)$/i);
    if (malformedMatch) {
        return {
            number: null,
            text: malformedMatch[1].trim()
        };
    }
    
    return null;
};

/**
 * Detects option markers (A, B, C, D)
 */
export const detectOptionMarker = (text) => {
    // Matches "A)", "a)", "A.", "a.", "A:", "a:", "[A]"
    const match = text.match(/^\s*\[?([A-D])\]?[\.\)\:-]\s*(.*)$/i);
    if (match) {
        return {
            label: match[1].toUpperCase(),
            text: match[2].trim()
        };
    }
    return null;
};

/**
 * Parses a normalized document representation into structured MCQs using a state machine.
 */
export const parseMCQ = (document) => {
    if (!document || !Array.isArray(document.blocks)) {
        return [];
    }

    // Flatten blocks into individual trimmed lines with metadata
    const items = [];
    for (const block of document.blocks) {
        const lines = block.text.split(/\r?\n/);
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed) {
                items.push({
                    text: trimmed,
                    page: block.page,
                    sourceIndex: block.sourceIndex
                });
            }
        }
    }

    const candidates = [];
    let candidate = null;
    let state = States.IDLE;

    const finalizeCandidate = (cand) => {
        if (!cand) return;

        const cleanNoise = (text) => {
            return text
                .replace(/\bCO\d+\b/gi, '')
                .replace(/\bK\d+\b/gi, '')
                .replace(/\s+/g, ' ')
                .trim();
        };

        // Clean up texts and strip metadata noise
        cand.questionText = cleanNoise(cand.questionText);
        cand.options.A = cleanNoise(cand.options.A);
        cand.options.B = cleanNoise(cand.options.B);
        cand.options.C = cleanNoise(cand.options.C);
        cand.options.D = cleanNoise(cand.options.D);

        // 1. Missing question text check
        if (!cand.questionText) {
            cand.warnings.push('Missing question text.');
            cand.confidence = Math.max(0, cand.confidence - 0.5);
        }

        // 2. Options validation (exactly 4 required)
        const missingLabels = [];
        ['A', 'B', 'C', 'D'].forEach(label => {
            if (!cand.options[label]) {
                missingLabels.push(label);
            }
        });

        if (missingLabels.length > 0) {
            cand.warnings.push(`Missing option label(s): ${missingLabels.join(', ')}.`);
            cand.confidence = Math.max(0, cand.confidence - (0.25 * missingLabels.length));
        }

        candidates.push(cand);
    };

    for (const item of items) {
        const text = item.text;
        const qMarker = detectQuestionMarker(text);
        const optMarker = detectOptionMarker(text);

        // Transition check: New question starts
        if (qMarker) {
            finalizeCandidate(candidate);

            candidate = {
                sourceNumber: qMarker.number,
                questionText: qMarker.text,
                options: { A: '', B: '', C: '', D: '' },
                sourcePage: item.page,
                sourceText: text,
                warnings: [],
                confidence: 1.0,
                seenLabels: new Set()
            };

            if (qMarker.number === null) {
                candidate.warnings.push('Malformed question number in header.');
                candidate.confidence = Math.max(0, candidate.confidence - 0.2);
            }

            state = States.QUESTION;
            continue;
        }

        // Transition check: Option header detected
        if (optMarker) {
            if (!candidate) {
                // Orphan option found before any question header
                candidate = {
                    sourceNumber: null,
                    questionText: '',
                    options: { A: '', B: '', C: '', D: '' },
                    sourcePage: item.page,
                    sourceText: text,
                    warnings: ['Option found before any question header.'],
                    confidence: 0.1,
                    seenLabels: new Set()
                };
            }

            const label = optMarker.label;
            candidate.sourceText += '\n' + text;

            // Check for duplicate option labels
            if (candidate.seenLabels.has(label)) {
                candidate.warnings.push(`Duplicate option label detected: ${label}.`);
                candidate.confidence = Math.max(0, candidate.confidence - 0.3);
            } else {
                candidate.seenLabels.add(label);
            }

            // Set initial option text
            candidate.options[label] = optMarker.text;

            // Transition state to the option
            if (label === 'A') state = States.OPTION_A;
            else if (label === 'B') state = States.OPTION_B;
            else if (label === 'C') state = States.OPTION_C;
            else if (label === 'D') state = States.OPTION_D;

            continue;
        }

        // If not a question or option marker, process as body text (multiline support)
        if (candidate) {
            candidate.sourceText += '\n' + text;

            // Detect answer keys early to transition state out of options and prevent bloating
            const isAns = text.match(/^(?:Correct\s*Answer|Answer|Ans)\s*:\s*(.*)$/i);
            if (isAns) {
                candidate.warnings.push(`Answer key found in body text: "${text}".`);
                state = States.BETWEEN_QUESTIONS;
                continue;
            }

            if (state === States.QUESTION) {
                candidate.questionText += ' ' + text;
            } else if (state === States.OPTION_A) {
                candidate.options.A += ' ' + text;
            } else if (state === States.OPTION_B) {
                candidate.options.B += ' ' + text;
            } else if (state === States.OPTION_C) {
                candidate.options.C += ' ' + text;
            } else if (state === States.OPTION_D) {
                candidate.options.D += ' ' + text;
            } else if (state === States.BETWEEN_QUESTIONS) {
                candidate.warnings.push(`Unrecognized text content between questions: "${text}".`);
                candidate.confidence = Math.max(0, candidate.confidence - 0.1);
            }
        }
    }

    // Finalize the last question candidate
    finalizeCandidate(candidate);

    // Post-processing: Duplicate question numbers check
    const numberCounts = {};
    for (const cand of candidates) {
        if (cand.sourceNumber !== null && cand.sourceNumber !== undefined) {
            numberCounts[cand.sourceNumber] = (numberCounts[cand.sourceNumber] || 0) + 1;
        }
    }

    for (const cand of candidates) {
        if (cand.sourceNumber !== null && cand.sourceNumber !== undefined) {
            if (numberCounts[cand.sourceNumber] > 1) {
                cand.warnings.push(`Duplicate question number detected: ${cand.sourceNumber}.`);
                cand.confidence = Math.max(0, cand.confidence - 0.4);
            }
        } else {
            cand.warnings.push('Missing or invalid question number.');
            cand.confidence = Math.max(0, cand.confidence - 0.3);
        }

        // Remove helper Set before returning
        delete cand.seenLabels;
    }

    return candidates;
};
