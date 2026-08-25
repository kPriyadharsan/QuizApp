/**
 * Answer Key Parser and Matching Engine
 */

/**
 * Detects standard answer key formats:
 * 1-B, 1. B, 1) B, Q1: B, Q1 - B, 1 : B, 1-b, Q1 = B
 */
export const detectAnswerKeyLine = (text) => {
    // Matches question/index prefix, separator (dot, parenthesis, hyphen, colon, equals), and answer letter
    const match = text.match(/^\s*(?:Question|Q)?\s*(\d+)\s*(?:[\.\)\:-]|\s+-|=)\s*([a-zA-Z])\s*$/);
    if (match) {
        return {
            number: parseInt(match[1], 10),
            letter: match[2].toUpperCase()
        };
    }
    return null;
};

/**
 * Inspects a line to verify if it represents a malformed answer indicator
 */
export const checkMalformedAnswerLine = (text) => {
    // 1. Number and separator with no letter (e.g., "1-", "Q1:")
    const matchNoLetter = text.match(/^\s*(?:Question|Q)?\s*(\d+)\s*(?:[\.\)\:-]|\s+-|=)\s*$/i);
    if (matchNoLetter) {
        return { error: 'Missing answer option letter.' };
    }
    
    // 2. Number and separator with multiple letters (e.g., "1-AB", "Q1: YES")
    const matchMultiLetters = text.match(/^\s*(?:Question|Q)?\s*(\d+)\s*(?:[\.\)\:-]|\s+-|=)\s*([a-zA-Z]{2,})\s*$/i);
    if (matchMultiLetters) {
        return { error: `Multiple option letters provided: '${matchMultiLetters[2]}'.` };
    }
    
    // 3. Starts with Answer prefix but does not match standard pattern
    if (text.match(/^(?:Correct\s*Answer|Answer|Ans)\s*:\s*(.*)$/i)) {
        const content = text.replace(/^(?:Correct\s*Answer|Answer|Ans)\s*:\s*/i, '').trim();
        if (content.length !== 1 || !content.match(/[A-Za-z]/)) {
            return { error: `Malformed answer value: '${content}'.` };
        }
    }
    
    return null;
};

/**
 * Parses all answer keys found across document blocks
 */
export const parseAnswerKeys = (documents) => {
    const answers = [];
    const invalidAnswers = [];
    const duplicateAnswers = [];
    const seenNumbers = new Set();

    if (!documents || !Array.isArray(documents)) {
        return { answers, invalidAnswers, duplicateAnswers };
    }

    // Filter out documents that are clearly question papers to avoid false positives
    let docsToParse = documents;
    if (documents.length > 1) {
        const cleanDocs = documents.filter(doc => {
            const fullText = (doc.blocks || []).map(b => b.text).join('\n');
            const hasOptionsPattern = /\bA\).*?\bB\).*?\bC\).*?\bD\)/is.test(fullText) || 
                                     /\bA\..*?\bB\..*?\bC\..*?\bD\./is.test(fullText);
            return !hasOptionsPattern;
        });
        if (cleanDocs.length > 0 && cleanDocs.length < documents.length) {
            docsToParse = cleanDocs;
        }
    }

    for (const doc of docsToParse) {
        if (!doc || !Array.isArray(doc.blocks)) continue;

        // Consolidate the entire text of the document to resolve multi-line splits
        let fullText = doc.blocks.map(b => b.text).join('\n');
        
        // 1. Resolve hyphens split across line boundaries (e.g. "17-\nB" or "17-\r\n B")
        let normalized = fullText.replace(/-\s*\r?\n\s*/g, '-');
        
        // 2. Replace all remaining newlines and tabs with spaces
        normalized = normalized.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ');

        // 3. Scan the normalized text globally to find all answer key indicators: (Number)(Separator)(Letter)
        // Matches standard formats: "1-B", "1. B", "1) B", "Q1: B", "Q1 - B", "1-b", "Q1 = B"
        const matchRegex = /\b(?:Question|Q)?(\d+)\s*(?:[\.\)\:-]|\s+-|=)\s*([a-zA-Z])\b/gi;
        let match;
        
        while ((match = matchRegex.exec(normalized)) !== null) {
            const number = parseInt(match[1], 10);
            const letter = match[2].toUpperCase();
            const originalMatchText = match[0];

            // Reject options outside A-D
            if (!['A', 'B', 'C', 'D'].includes(letter)) {
                invalidAnswers.push({
                    number,
                    letter,
                    text: originalMatchText,
                    error: `Option letter '${letter}' is outside range A-D.`,
                    page: 1,
                    filename: doc.filename
                });
                continue;
            }

            // Detect duplicates
            if (seenNumbers.has(number)) {
                if (!duplicateAnswers.includes(number)) {
                    duplicateAnswers.push(number);
                }
                answers.push({
                    questionNumber: number,
                    optionLetter: letter,
                    text: originalMatchText,
                    page: 1,
                    filename: doc.filename,
                    isDuplicate: true
                });
            } else {
                seenNumbers.add(number);
                answers.push({
                    questionNumber: number,
                    optionLetter: letter,
                    text: originalMatchText,
                    page: 1,
                    filename: doc.filename
                });
            }
        }

        // 4. Fallback: If no answers were parsed using separator regex, scan for simple space separators: "1 B"
        if (answers.length === 0 && invalidAnswers.length === 0) {
            const fallbackRegex = /\b(?:Question|Q)?(\d+)\s+([a-zA-Z])\b/gi;
            let fbMatch;
            while ((fbMatch = fallbackRegex.exec(normalized)) !== null) {
                const number = parseInt(fbMatch[1], 10);
                const letter = fbMatch[2].toUpperCase();
                const originalMatchText = fbMatch[0];

                if (!['A', 'B', 'C', 'D'].includes(letter)) {
                    continue; // Skip non A-D words to prevent false positives on general text
                }

                if (seenNumbers.has(number)) {
                    if (!duplicateAnswers.includes(number)) {
                        duplicateAnswers.push(number);
                    }
                    answers.push({
                        questionNumber: number,
                        optionLetter: letter,
                        text: originalMatchText,
                        page: 1,
                        filename: doc.filename,
                        isDuplicate: true
                    });
                } else {
                    seenNumbers.add(number);
                    answers.push({
                        questionNumber: number,
                        optionLetter: letter,
                        text: originalMatchText,
                        page: 1,
                        filename: doc.filename
                    });
                }
            }
        }
    }

    return {
        answers,
        invalidAnswers,
        duplicateAnswers
    };
};

/**
 * Matches extracted question candidates with parsed answer keys.
 * Performs rigorous validations and creates the validation report.
 */
export const matchAndValidate = (questions, answersResult) => {
    const { answers, invalidAnswers, duplicateAnswers } = answersResult;

    const totalQuestions = questions.length;
    // Count unique answers
    const uniqueAnswers = answers.filter(ans => !ans.isDuplicate);
    const totalAnswers = uniqueAnswers.length + duplicateAnswers.length;

    const matchedQuestions = [];
    const missingAnswers = [];
    const extraAnswers = [];
    const duplicateQuestions = [];
    const structuralErrors = [];
    const warnings = [];

    // 1. Check duplicate questions
    const questionNumbers = questions.map(q => q.sourceNumber).filter(n => n !== null && n !== undefined);
    const questionCounts = {};
    questionNumbers.forEach(n => {
        questionCounts[n] = (questionCounts[n] || 0) + 1;
    });
    Object.keys(questionCounts).forEach(n => {
        if (questionCounts[n] > 1) {
            duplicateQuestions.push(parseInt(n, 10));
        }
    });

    // Map unique answer keys by question number for quick matching
    const answerMap = {};
    answers.forEach(ans => {
        if (!ans.isDuplicate) {
            answerMap[ans.questionNumber] = ans.optionLetter;
        }
    });

    // 2. Perform matching and find missing answers
    questions.forEach(q => {
        const qNum = q.sourceNumber;

        if (qNum === null || qNum === undefined) {
            structuralErrors.push('A question candidate is missing its question index.');
            return;
        }

        const correctLetter = answerMap[qNum];
        const correctLetterOption = correctLetter || '';
        const correctAnswerText = correctLetterOption ? (q.options[correctLetterOption] || '') : '';
        
        matchedQuestions.push({
            sourceNumber: qNum,
            questionText: q.questionText,
            options: [q.options.A, q.options.B, q.options.C, q.options.D],
            correctAnswer: correctAnswerText,
            correctLetter: correctLetterOption,
            explanation: q.explanation || '',
            sourcePage: q.sourcePage,
            sourceText: q.sourceText,
            confidence: q.confidence,
            isConflict: q.isConflict || false,
            isAiParsed: q.isAiParsed || false,
            aiFallback: q.aiFallback
        });

        if (!correctLetterOption) {
            missingAnswers.push(qNum);
        }
    });

    // 3. Find extra answers (exist in answer key but have no matching question number)
    uniqueAnswers.forEach(ans => {
        const num = ans.questionNumber;
        const hasQuestion = questions.some(q => q.sourceNumber === num);
        if (!hasQuestion) {
            extraAnswers.push(num);
        }
    });

    // 4. Gather individual question validation warnings
    questions.forEach(q => {
        if (q.warnings && q.warnings.length > 0) {
            warnings.push(...q.warnings.map(w => `Question ${q.sourceNumber}: ${w}`));
        }
    });

    // 5. Build Structural Errors list to block import if violated
    // Rule A: Question has no answer
    if (missingAnswers.length > 0) {
        structuralErrors.push(`Question(s) ${missingAnswers.join(', ')} do not have a matching answer in the answer key.`);
    }

    // Rule B: Answer references nonexistent question
    if (extraAnswers.length > 0) {
        structuralErrors.push(`Answer(s) ${extraAnswers.join(', ')} reference question number(s) that do not exist in the questions list.`);
    }

    // Rule C: Answer is not A-D
    invalidAnswers.forEach(ia => {
        if (ia.number) {
            structuralErrors.push(`Answer for question ${ia.number} specifies invalid option letter '${ia.letter}' (must be A-D).`);
        } else {
            structuralErrors.push(`Malformed answer key line: "${ia.text}" (${ia.error})`);
        }
    });

    // Rule D: Question does not have exactly 4 options
    questions.forEach(q => {
        const optionCount = Object.values(q.options).filter(opt => opt.trim()).length;
        if (optionCount !== 4) {
            structuralErrors.push(`Question ${q.sourceNumber} has ${optionCount} options. Each question must have exactly 4 options.`);
        }
    });

    // Rule E: Duplicate question numbers exist
    if (duplicateQuestions.length > 0) {
        structuralErrors.push(`Duplicate question number(s) found in document: ${duplicateQuestions.join(', ')}.`);
    }

    // Rule F: Duplicate answers exist
    if (duplicateAnswers.length > 0) {
        structuralErrors.push(`Duplicate answer keys found for question number(s): ${duplicateAnswers.join(', ')}.`);
    }

    const valid = structuralErrors.length === 0;

    return {
        valid,
        totalQuestions,
        totalAnswers,
        matchedCount: matchedQuestions.length,
        matchedQuestions,
        missingAnswers,
        extraAnswers,
        invalidAnswers: invalidAnswers.map(ia => ia.text),
        duplicateQuestions,
        duplicateAnswers,
        structuralErrors,
        warnings
    };
};
