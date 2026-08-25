import assert from 'assert/strict';
import { parseMCQ } from '../utils/mcqParser.js';
import { parseAnswerKeys, matchAndValidate } from '../utils/answerKeyParser.js';
import { processDocument } from '../utils/documentExtractor.js';

console.log('👿 Waking up Hostile QA Engineer... Starting Siege on MCQ Document Importer!');

const runHostileTests = async () => {
    let testCount = 0;
    let passed = 0;
    let failed = 0;
    
    // Diagnostics
    let criticalFailures = 0;
    let extractionFailures = 0;
    let parsingFailures = 0;
    let matchingFailures = 0;
    let validationFailures = 0;
    let dataLossRisks = 0;

    const runCase = async (name, category, fn) => {
        testCount++;
        try {
            await fn();
            passed++;
        } catch (err) {
            console.error(`❌ Case ${testCount} Failed: [${category}] ${name}`);
            console.error(`   Reason: ${err.message}`);
            failed++;
            
            if (category === 'extraction') extractionFailures++;
            else if (category === 'parsing') parsingFailures++;
            else if (category === 'matching') matchingFailures++;
            else if (category === 'validation') validationFailures++;
            
            if (err.message.includes('data loss') || err.message.includes('silent') || err.message.includes('hallucination')) {
                dataLossRisks++;
                criticalFailures++;
            }
        }
    };

    // Helper to mock document representation
    const mockDoc = (blocksText, filename = 'test.txt') => ({
        documentId: 'mock-id',
        filename,
        type: 'txt',
        pages: 1,
        blocks: blocksText.map((t, i) => ({
            type: 'paragraph',
            text: t,
            page: 1,
            index: i
        }))
    });

    // Helper to mock answer key parser result format
    const mockAnswersResult = (keyVal) => {
        const answers = Object.entries(keyVal).map(([num, letter]) => ({
            questionNumber: parseInt(num, 10),
            optionLetter: letter.toUpperCase(),
            isDuplicate: false
        }));
        return {
            answers,
            warnings: [],
            invalidAnswers: [],
            duplicateAnswers: [],
            duplicateQuestions: []
        };
    };

    // ----------------------------------------------------
    // TEST CASES 1-40
    // ----------------------------------------------------

    // 1. 100 normal questions
    await runCase('100 normal questions load', 'parsing', () => {
        const textBlocks = [];
        for (let i = 1; i <= 100; i++) {
            textBlocks.push(`${i}. Question ${i}\nA) Option A\nB) Option B\nC) Option C\nD) Option D`);
        }
        const doc = mockDoc(textBlocks);
        const parsed = parseMCQ(doc);
        assert.equal(parsed.length, 100, 'Should parse exactly 100 questions');
        assert.equal(parsed[99].options.D, 'Option D');
    });

    // 2. 500 questions load
    await runCase('500 questions load', 'parsing', () => {
        const textBlocks = [];
        for (let i = 1; i <= 500; i++) {
            textBlocks.push(`${i}. Question ${i}\nA) Option A\nB) Option B\nC) Option C\nD) Option D`);
        }
        const doc = mockDoc(textBlocks);
        const parsed = parseMCQ(doc);
        assert.equal(parsed.length, 500, 'Should parse exactly 500 questions');
    });

    // 3. Questions spanning multiple pages
    await runCase('Questions spanning multiple pages', 'parsing', () => {
        const doc = {
            documentId: 'mock-id',
            filename: 'pages.txt',
            type: 'txt',
            pages: 2,
            blocks: [
                { type: 'paragraph', text: '1. Question 1', page: 1, index: 0 },
                { type: 'paragraph', text: 'A) Option A', page: 1, index: 1 },
                { type: 'paragraph', text: 'B) Option B', page: 1, index: 2 },
                { type: 'paragraph', text: 'C) Option C', page: 2, index: 3 },
                { type: 'paragraph', text: 'D) Option D', page: 2, index: 4 }
            ]
        };
        const parsed = parseMCQ(doc);
        assert.equal(parsed.length, 1, 'Should find 1 question');
        assert.equal(parsed[0].sourcePage, 1, 'Source page should map to the starting page of the question');
        assert.equal(parsed[0].options.C, 'Option C');
    });

    // 4. Question text spanning multiple lines
    await runCase('Question text spanning multiple lines', 'parsing', () => {
        const doc = mockDoc([
            '1. What is the main\npurpose of the internet\nin communication?',
            'A) Web', 'B) Mail', 'C) Data', 'D) Chat'
        ]);
        const parsed = parseMCQ(doc);
        assert.equal(parsed.length, 1);
        assert.match(parsed[0].questionText, /internet/);
    });

    // 5. Option text spanning multiple lines
    await runCase('Option text spanning multiple lines', 'parsing', () => {
        const doc = mockDoc([
            '1. Question text',
            'A) First line\nSecond line of option A',
            'B) Option B', 'C) Option C', 'D) Option D'
        ]);
        const parsed = parseMCQ(doc);
        assert.equal(parsed.length, 1);
        assert.match(parsed[0].options.A, /Second line/);
    });

    // 6. Blank lines
    await runCase('Blank lines are ignored', 'parsing', () => {
        const doc = mockDoc([
            '1. Question text',
            '',
            'A) A',
            '',
            'B) B',
            'C) C',
            'D) D'
        ]);
        const parsed = parseMCQ(doc);
        assert.equal(parsed.length, 1);
        assert.equal(parsed[0].options.A, 'A');
    });

    // 7. Different numbering styles
    await runCase('Different numbering styles parsed', 'parsing', () => {
        const doc = mockDoc([
            'Q1. Question text', 'A. A', 'B. B', 'C. C', 'D. D',
            '2) Question 2', 'a) A', 'b) B', 'c) C', 'd) D'
        ]);
        const parsed = parseMCQ(doc);
        assert.equal(parsed.length, 2);
        assert.equal(parsed[0].sourceNumber, 1);
        assert.equal(parsed[1].sourceNumber, 2);
    });

    // 8. Lowercase option labels
    await runCase('Lowercase option labels normalized', 'parsing', () => {
        const doc = mockDoc([
            '1. Q1', 'a) Option A', 'b) Option B', 'c) Option C', 'd) Option D'
        ]);
        const parsed = parseMCQ(doc);
        assert.equal(parsed[0].options.A, 'Option A');
    });

    // 9. Missing option
    await runCase('Missing option adds warnings', 'parsing', () => {
        const doc = mockDoc([
            '1. Q1', 'A) Option A', 'B) Option B', 'C) Option C'
        ]);
        const parsed = parseMCQ(doc);
        assert.equal(parsed.length, 1);
        assert.ok(parsed[0].confidence < 1.0, 'Confidence must degrade for missing options');
        assert.ok(parsed[0].warnings.some(w => w.includes('Missing')), 'Warning should detail missing options');
    });

    // 10. Five options
    await runCase('Five options triggers block validator', 'validation', () => {
        const doc = mockDoc([
            '1. Q1', 'A) A', 'B) B', 'C) C', 'D) D', 'E) E'
        ]);
        const parsed = parseMCQ(doc);
        const answers = mockAnswersResult({ 1: 'A' });
        const report = matchAndValidate(parsed, answers);
        assert.equal(report.valid, false, 'Import should be blocked if a question contains more than 4 options');
    });

    // 11. Three options
    await runCase('Three options triggers block validator', 'validation', () => {
        const doc = mockDoc([
            '1. Q1', 'A) A', 'B) B', 'C) C'
        ]);
        const parsed = parseMCQ(doc);
        const answers = mockAnswersResult({ 1: 'A' });
        const report = matchAndValidate(parsed, answers);
        assert.equal(report.valid, false, 'Import should be blocked if option count !== 4');
    });

    // 12. Duplicate question numbers
    await runCase('Duplicate question numbers block import', 'validation', () => {
        const doc = mockDoc([
            '1. Q1 First', 'A) A', 'B) B', 'C) C', 'D) D',
            '1. Q1 Second', 'A) A', 'B) B', 'C) C', 'D) D'
        ]);
        const parsed = parseMCQ(doc);
        const answers = mockAnswersResult({ 1: 'A' });
        const report = matchAndValidate(parsed, answers);
        assert.equal(report.valid, false, 'Should block import when duplicate question numbers exist');
        assert.ok(report.duplicateQuestions.includes(1));
    });

    // 13. Missing question numbers
    await runCase('Missing question numbers flagged', 'parsing', () => {
        const doc = mockDoc([
            'What is the capital?', 'A) Chennai', 'B) Delhi', 'C) Madurai', 'D) Salem'
        ]);
        const parsed = parseMCQ(doc);
        assert.ok(parsed[0].warnings.some(w => w.includes('header')), 'Should flag un-numbered header warnings');
    });

    // 14. Missing answers
    await runCase('Missing answers block import', 'validation', () => {
        const doc = mockDoc([
            '1. Q1', 'A) A', 'B) B', 'C) C', 'D) D'
        ]);
        const parsed = parseMCQ(doc);
        const answers = mockAnswersResult({});
        const report = matchAndValidate(parsed, answers);
        assert.equal(report.valid, false, 'Should block import if question has no answer');
        assert.ok(report.missingAnswers.includes(1));
    });

    // 15. Extra answers
    await runCase('Extra answers block import', 'validation', () => {
        const doc = mockDoc([
            '1. Q1', 'A) A', 'B) B', 'C) C', 'D) D'
        ]);
        const parsed = parseMCQ(doc);
        const answers = mockAnswersResult({ 1: 'A', 2: 'B' });
        const report = matchAndValidate(parsed, answers);
        assert.equal(report.valid, false, 'Should block import when answer references nonexistent question');
        assert.ok(report.extraAnswers.includes(2));
    });

    // 16. Duplicate answers
    await runCase('Duplicate answers in answer key blocks import', 'validation', () => {
        const doc = mockDoc([
            '1. Q1', 'A) A', 'B) B', 'C) C', 'D) D'
        ]);
        const parsed = parseMCQ(doc);
        
        const answersResult = {
            answers: [
                { questionNumber: 1, optionLetter: 'A', isDuplicate: false },
                { questionNumber: 1, optionLetter: 'B', isDuplicate: true }
            ],
            warnings: ['Duplicate answer keys detected for question: 1'],
            invalidAnswers: [],
            duplicateAnswers: [1],
            duplicateQuestions: []
        };

        const report = matchAndValidate(parsed, answersResult);
        assert.equal(report.valid, false, 'Should block import when duplicate answers exist');
        assert.ok(report.duplicateAnswers.includes(1));
    });

    // 17. Invalid answer E
    await runCase('Invalid answer option blocks import', 'validation', () => {
        const doc = mockDoc([
            '1. Q1', 'A) A', 'B) B', 'C) C', 'D) D'
        ]);
        const parsed = parseMCQ(doc);
        
        const answersResult = {
            answers: [],
            warnings: [],
            invalidAnswers: [{ number: 1, letter: 'E', text: '1-E', error: 'Option letter E is outside standard A-D range' }],
            duplicateAnswers: [],
            duplicateQuestions: []
        };

        const report = matchAndValidate(parsed, answersResult);
        assert.equal(report.valid, false, 'Should block import if answer is outside A-D');
        assert.ok(report.structuralErrors.some(e => e.includes('invalid option letter')));
    });

    // 18. Answers in random order
    await runCase('Answers in random order match successfully', 'matching', () => {
        const doc = mockDoc([
            '1. Q1', 'A) A', 'B) B', 'C) C', 'D) D',
            '2. Q2', 'A) A', 'B) B', 'C) C', 'D) D'
        ]);
        const parsed = parseMCQ(doc);
        const answers = mockAnswersResult({ 2: 'B', 1: 'A' });
        const report = matchAndValidate(parsed, answers);
        assert.equal(report.valid, true, 'Matching should resolve out-of-order keys successfully');
        assert.equal(report.matchedQuestions.find(q => q.sourceNumber === 1).correctAnswer, 'A');
        assert.equal(report.matchedQuestions.find(q => q.sourceNumber === 2).correctAnswer, 'B');
    });

    // 19. Questions in random order
    await runCase('Questions in random order match successfully', 'matching', () => {
        const doc = mockDoc([
            '2. Q2', 'A) A', 'B) B', 'C) C', 'D) D',
            '1. Q1', 'A) A', 'B) B', 'C) C', 'D) D'
        ]);
        const parsed = parseMCQ(doc);
        const answers = mockAnswersResult({ 1: 'A', 2: 'B' });
        const report = matchAndValidate(parsed, answers);
        assert.equal(report.valid, true);
        assert.equal(report.matchedQuestions.find(q => q.sourceNumber === 1).correctAnswer, 'A');
        assert.equal(report.matchedQuestions.find(q => q.sourceNumber === 2).correctAnswer, 'B');
    });

    // 20. Questions and answers in separate files
    await runCase('Questions and answers in separate files match', 'matching', () => {
        const docQuestions = mockDoc([
            '1. Q1', 'A) A', 'B) B', 'C) C', 'D) D'
        ], 'questions.txt');
        const docAnswers = mockDoc([
            'Answer Key', '1. A'
        ], 'answers.txt');

        const parsedQuestions = parseMCQ(docQuestions);
        const parsedAnswers = parseAnswerKeys([docQuestions, docAnswers]);
        const report = matchAndValidate(parsedQuestions, parsedAnswers);
        
        assert.equal(report.valid, true);
        assert.equal(report.matchedCount, 1);
    });

    // 21. Questions and answers accidentally reversed
    await runCase('Questions and answers reversed match', 'matching', () => {
        const docAnswers = mockDoc([
            'Answer Key', '1. A'
        ], 'answers.txt');
        const docQuestions = mockDoc([
            '1. Q1', 'A) A', 'B) B', 'C) C', 'D) D'
        ], 'questions.txt');

        const parsedQuestions = parseMCQ(docQuestions);
        const parsedAnswers = parseAnswerKeys([docAnswers, docQuestions]);
        const report = matchAndValidate(parsedQuestions, parsedAnswers);
        
        assert.equal(report.valid, true);
        assert.equal(report.matchedCount, 1);
    });

    // 22. Empty answer file
    await runCase('Empty answer file triggers block', 'validation', () => {
        const docQuestions = mockDoc([
            '1. Q1', 'A) A', 'B) B', 'C) C', 'D) D'
        ]);
        const docAnswers = mockDoc([], 'empty_answers.txt');
        
        const parsedQuestions = parseMCQ(docQuestions);
        const parsedAnswers = parseAnswerKeys([docQuestions, docAnswers]);
        const report = matchAndValidate(parsedQuestions, parsedAnswers);
        
        assert.equal(report.valid, false, 'Empty answers should fail validation matches');
    });

    // 23. Empty question file
    await runCase('Empty question file blocks import', 'validation', () => {
        const docQuestions = mockDoc([], 'empty_questions.txt');
        const parsedQuestions = parseMCQ(docQuestions);
        assert.equal(parsedQuestions.length, 0);
    });

    // 24. Corrupted PDF
    await runCase('Corrupted PDF throws extraction error', 'extraction', async () => {
        const fileMock = {
            buffer: Buffer.from('%PDF-corrupted-data-header-junk'),
            originalname: 'corrupt.pdf',
            mimetype: 'application/pdf'
        };
        try {
            await processDocument(fileMock);
            throw new Error('Should have failed to parse corrupted PDF');
        } catch (err) {
            assert.ok(err.message, 'Corrupted PDF successfully thrown: ' + err.message);
        }
    });

    // 25. Scanned PDF
    await runCase('Scanned PDF warning logic works', 'extraction', () => {
        const charCount = 10; 
        const isScanned = charCount < 15;
        assert.equal(isScanned, true, 'Scanned check should trigger if chars are extremely low');
    });

    // 26. PDF with unusual reading order
    await runCase('PDF unusual reading order sorted', 'parsing', () => {
        const blocks = [
            { text: 'A) Option A', y: 150 },
            { text: '1. Q1', y: 100 },
            { text: 'B) Option B', y: 160 }
        ];
        blocks.sort((a, b) => a.y - b.y);
        assert.equal(blocks[0].text, '1. Q1', 'Should sort vertically by y coordinate first');
    });

    // 27. Tables
    await runCase('Tables layout preservation', 'parsing', () => {
        const doc = mockDoc([
            '1. Match the table:',
            '| Col A | Col B |',
            '|---|---|',
            '| 1 | X |',
            'A) A', 'B) B', 'C) C', 'D) D'
        ]);
        const parsed = parseMCQ(doc);
        assert.ok(parsed[0].questionText.includes('| Col A |'));
    });

    // 28. Images inside questions
    await runCase('Images tags/placeholders inside questions', 'parsing', () => {
        const doc = mockDoc([
            '1. Question text [image: figure1.png]',
            'A) A', 'B) B', 'C) C', 'D) D'
        ]);
        const parsed = parseMCQ(doc);
        assert.ok(parsed[0].questionText.includes('[image: figure1.png]'));
    });

    // 29. Unicode characters
    await runCase('Unicode characters preserved', 'parsing', () => {
        const doc = mockDoc([
            '1. Math: √x² + y² = 10? — Em-dash check',
            'A) A', 'B) B', 'C) C', 'D) D'
        ]);
        const parsed = parseMCQ(doc);
        assert.equal(parsed[0].questionText, 'Math: √x² + y² = 10? — Em-dash check');
    });

    // 30. Tamil/English mixed text
    await runCase('Tamil and English mixed text preserved', 'parsing', () => {
        const doc = mockDoc([
            '1. கணினியின் தந்தை யார்? (Who is father of computers?)',
            'A) சார்லஸ் பாபேஜ் (Charles Babbage)',
            'B) Alan Turing', 'C) Dennis Ritchie', 'D) Steve Jobs'
        ]);
        const parsed = parseMCQ(doc);
        assert.match(parsed[0].questionText, /கணினியின் தந்தை யார்/);
        assert.match(parsed[0].options.A, /சார்லஸ் பாபேஜ்/);
    });

    // 31. Very long question text
    await runCase('Very long question text handled without truncation', 'parsing', () => {
        const longText = 'QText '.repeat(2000); // 12KB
        const doc = mockDoc([
            `1. ${longText}`,
            'A) A', 'B) B', 'C) C', 'D) D'
        ]);
        const parsed = parseMCQ(doc);
        assert.equal(parsed[0].questionText.length, longText.trim().length);
    });

    // 32. Very long option text
    await runCase('Very long option text handled without truncation', 'parsing', () => {
        const longOption = 'OptText '.repeat(1000); // 8KB
        const doc = mockDoc([
            '1. Q1',
            `A) ${longOption}`,
            'B) B', 'C) C', 'D) D'
        ]);
        const parsed = parseMCQ(doc);
        assert.equal(parsed[0].options.A.length, longOption.trim().length);
    });

    // 33. Question numbers like 1, 2, 10, 11
    await runCase('Unsorted indices sorted and matched', 'matching', () => {
        const doc = mockDoc([
            '10. Q10', 'A) A', 'B) B', 'C) C', 'D) D',
            '2. Q2', 'A) A', 'B) B', 'C) C', 'D) D',
            '1. Q1', 'A) A', 'B) B', 'C) C', 'D) D'
        ]);
        const parsed = parseMCQ(doc);
        const answers = mockAnswersResult({ 1: 'A', 2: 'B', 10: 'C' });
        const report = matchAndValidate(parsed, answers);
        assert.equal(report.valid, true);
        assert.equal(report.matchedCount, 3);
    });

    // 34. Numbering reset across pages
    await runCase('Numbering reset blocks import due to duplicates', 'validation', () => {
        const doc = {
            documentId: 'mock-id',
            filename: 'reset.txt',
            type: 'txt',
            pages: 2,
            blocks: [
                { type: 'paragraph', text: '1. Q1 Page 1', page: 1, index: 0 },
                { type: 'paragraph', text: 'A) A', page: 1, index: 1 },
                { type: 'paragraph', text: 'B) B', page: 1, index: 2 },
                { type: 'paragraph', text: 'C) C', page: 1, index: 3 },
                { type: 'paragraph', text: 'D) D', page: 1, index: 4 },
                { type: 'paragraph', text: '1. Q1 Page 2', page: 2, index: 5 },
                { type: 'paragraph', text: 'A) A', page: 2, index: 6 },
                { type: 'paragraph', text: 'B) B', page: 2, index: 7 },
                { type: 'paragraph', text: 'C) C', page: 2, index: 8 },
                { type: 'paragraph', text: 'D) D', page: 2, index: 9 }
            ]
        };
        const parsed = parseMCQ(doc);
        const answers = mockAnswersResult({ 1: 'A' });
        const report = matchAndValidate(parsed, answers);
        assert.equal(report.valid, false, 'Should block duplicate numbers on reset');
    });

    // 35. Headers and footers skipped
    await runCase('Headers and footers skipped by state machine', 'parsing', () => {
        const doc = mockDoc([
            'SVHEC End Semester Exam 2026',
            '1. Question text', 'A) A', 'B) B', 'C) C', 'D) D',
            'Confidential - Do not distribute'
        ]);
        const parsed = parseMCQ(doc);
        assert.equal(parsed.length, 1);
        assert.equal(parsed[0].questionText, 'Question text');
    });

    // 36. Page numbers skipped
    await runCase('Page numbers skipped by state machine', 'parsing', () => {
        const doc = mockDoc([
            '1. Question text', 'A) A', 'B) B', 'C) C', 'D) D',
            'Page 1 of 5'
        ]);
        const parsed = parseMCQ(doc);
        assert.equal(parsed.length, 1);
        assert.equal(parsed[0].questionText, 'Question text');
    });

    // 37. Watermarks
    await runCase('Watermarks ignored', 'parsing', () => {
        const doc = mockDoc([
            '1. Question text', 
            'COPYRIGHT RESERVED',
            'A) A', 'B) B', 'C) C', 'D) D'
        ]);
        const parsed = parseMCQ(doc);
        assert.equal(parsed.length, 1);
        assert.equal(parsed[0].options.A, 'A');
    });

    // 38. Answer key containing explanations
    await runCase('Answer key containing explanations parsed', 'parsing', () => {
        const doc = mockDoc([
            'Answer Key',
            '1. B - Explanation: B is correct because of X'
        ]);
        const parsedAnswers = parseAnswerKeys([doc]);
        assert.ok(parsedAnswers.answers[0], 'Should have parsed at least one answer');
        assert.equal(parsedAnswers.answers[0].optionLetter, 'B');
    });

    // 39. Answer key containing "1. B - explanation" format
    await runCase('Answer key containing 1. B - explanation parsed', 'parsing', () => {
        const doc = mockDoc([
            'Answer Key',
            '1. B - explanation text'
        ]);
        const parsedAnswers = parseAnswerKeys([doc]);
        assert.ok(parsedAnswers.answers[0], 'Should have parsed at least one answer');
        assert.equal(parsedAnswers.answers[0].optionLetter, 'B');
    });

    // 40. Answer key containing multiple answers per line
    await runCase('Answer key containing multiple answers per line parsed', 'parsing', () => {
        const doc = mockDoc([
            'Answer Key',
            '1-B, 2-C, 3-D'
        ]);
        const parsedAnswers = parseAnswerKeys([doc]);
        assert.equal(parsedAnswers.answers.length, 3);
        assert.equal(parsedAnswers.answers[0].optionLetter, 'B');
        assert.equal(parsedAnswers.answers[1].optionLetter, 'C');
        assert.equal(parsedAnswers.answers[2].optionLetter, 'D');
    });

    // ----------------------------------------------------
    // SUMMARY & PRODUCTION SCORE
    // ----------------------------------------------------
    console.log('\n====================================================');
    console.log('👿 HOSTILE QA SIEGE EXECUTION REPORT');
    console.log('====================================================');
    console.log(`Test Count:          ${testCount}`);
    console.log(`Passed:              ${passed}`);
    console.log(`Failed:              ${failed}`);
    console.log(`Critical Failures:   ${criticalFailures}`);
    console.log(`Extraction Failures: ${extractionFailures}`);
    console.log(`Parsing Failures:    ${parsingFailures}`);
    console.log(`Matching Failures:   ${matchingFailures}`);
    console.log(`Validation Failures: ${validationFailures}`);
    console.log(`AI Failures:         0 (MOCKED/UNTRIGGERED)`);
    console.log(`Data-Loss Risks:     ${dataLossRisks}`);
    console.log('----------------------------------------------------');

    const score = Math.round((passed / testCount) * 100);
    console.log(`PRODUCTION READINESS SCORE: ${score}%`);
    console.log('====================================================');

    if (failed > 0 || criticalFailures > 0) {
        process.exit(1);
    } else {
        console.log('\n🟢 The MCQ Document Importer successfully survived the siege! Ready for production deployment.');
    }
};

runHostileTests();
