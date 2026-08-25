import assert from 'assert/strict';
import { 
    detectAnswerKeyLine, 
    checkMalformedAnswerLine,
    parseAnswerKeys,
    matchAndValidate 
} from '../utils/answerKeyParser.js';

console.log('🧪 Running Answer Key Parser & Matching Engine Tests...\n');

const runTests = () => {
    let passed = 0;
    let failed = 0;

    const test = (name, fn) => {
        try {
            fn();
            console.log(`   Passed: ${name}`);
            passed++;
        } catch (err) {
            console.error(`❌ Failed: ${name}`);
            console.error(err);
            failed++;
        }
    };

    // Helper to generate blocks mock
    const makeDoc = (text) => ({
        documentId: 'doc-123',
        filename: 'key.txt',
        type: 'txt',
        pages: 1,
        blocks: [{ page: 1, type: 'paragraph', text, sourceIndex: 0 }]
    });

    // 1. Format Detection Tests
    test('Format detection - standard variations (1-B, 1. B, Q1: B, 1-b, etc.)', () => {
        const cases = [
            { text: '1-B', num: 1, letter: 'B' },
            { text: '1. B', num: 1, letter: 'B' },
            { text: '1) B', num: 1, letter: 'B' },
            { text: 'Q1: B', num: 1, letter: 'B' },
            { text: 'Q1 - B', num: 1, letter: 'B' },
            { text: '1 : B', num: 1, letter: 'B' },
            { text: '1-b', num: 1, letter: 'B' },
            { text: 'Q1 = B', num: 1, letter: 'B' }
        ];

        for (const tc of cases) {
            const parsed = detectAnswerKeyLine(tc.text);
            assert.ok(parsed, `Failed to parse format: "${tc.text}"`);
            assert.equal(parsed.number, tc.num);
            assert.equal(parsed.letter, tc.letter);
        }
    });

    // 2. Option Range Checks
    test('Range check - rejects options outside A-D', () => {
        const doc = makeDoc('1-E\n2-Z');
        const parsed = parseAnswerKeys([doc]);
        
        assert.equal(parsed.answers.length, 0);
        assert.equal(parsed.invalidAnswers.length, 2);
        assert.equal(parsed.invalidAnswers[0].letter, 'E');
        assert.equal(parsed.invalidAnswers[1].letter, 'Z');
    });

    // 3. Malformed Line Checks
    test('Malformed line detection', () => {
        assert.ok(checkMalformedAnswerLine('1-')); // Missing letter
        assert.ok(checkMalformedAnswerLine('1-AB')); // Multiple letters
        assert.ok(checkMalformedAnswerLine('Answer: NONE')); // Invalid word answer
        
        // Valid should return null
        assert.equal(checkMalformedAnswerLine('1-B'), null);
    });

    // 4. Match and Validate Test Suite
    test('Match and Validate - Valid matched pair', () => {
        const questions = [
            { sourceNumber: 1, questionText: 'Q1', options: { A: 'A1', B: 'B1', C: 'C1', D: 'D1' }, confidence: 1.0, warnings: [], sourcePage: 1, sourceText: '1. Q1...' }
        ];
        const answersResult = {
            answers: [{ questionNumber: 1, optionLetter: 'B', text: '1-B', page: 1, filename: 'key.txt' }],
            invalidAnswers: [],
            duplicateAnswers: []
        };

        const report = matchAndValidate(questions, answersResult);
        
        assert.equal(report.valid, true);
        assert.equal(report.totalQuestions, 1);
        assert.equal(report.totalAnswers, 1);
        assert.equal(report.matchedCount, 1);
        assert.equal(report.matchedQuestions[0].correctAnswer, 'B1');
        assert.equal(report.structuralErrors.length, 0);
    });

    test('Match and Validate - Blocks on Question with no answer', () => {
        const questions = [
            { sourceNumber: 1, questionText: 'Q1', options: { A: 'A1', B: 'B1', C: 'C1', D: 'D1' }, confidence: 1.0 }
        ];
        const answersResult = {
            answers: [],
            invalidAnswers: [],
            duplicateAnswers: []
        };

        const report = matchAndValidate(questions, answersResult);
        
        assert.equal(report.valid, false);
        assert.equal(report.missingAnswers.length, 1);
        assert.equal(report.missingAnswers[0], 1);
        assert(report.structuralErrors.some(e => e.includes('do not have a matching answer')));
    });

    test('Match and Validate - Blocks on Answer referencing nonexistent question', () => {
        const questions = [];
        const answersResult = {
            answers: [{ questionNumber: 5, optionLetter: 'A', text: '5-A', page: 1, filename: 'key.txt' }],
            invalidAnswers: [],
            duplicateAnswers: []
        };

        const report = matchAndValidate(questions, answersResult);
        
        assert.equal(report.valid, false);
        assert.equal(report.extraAnswers.length, 1);
        assert.equal(report.extraAnswers[0], 5);
        assert(report.structuralErrors.some(e => e.includes('reference question number(s) that do not exist')));
    });

    test('Match and Validate - Blocks on Question having fewer than 4 options', () => {
        const questions = [
            { sourceNumber: 1, questionText: 'Q1', options: { A: 'A1', B: '', C: 'C1', D: 'D1' }, confidence: 1.0 } // 3 options
        ];
        const answersResult = {
            answers: [{ questionNumber: 1, optionLetter: 'A', text: '1-A', page: 1, filename: 'key.txt' }],
            invalidAnswers: [],
            duplicateAnswers: []
        };

        const report = matchAndValidate(questions, answersResult);
        
        assert.equal(report.valid, false);
        assert(report.structuralErrors.some(e => e.includes('must have exactly 4 options')));
    });

    test('Match and Validate - Blocks on Duplicate question numbers', () => {
        const questions = [
            { sourceNumber: 1, questionText: 'Q1 First', options: { A: 'A', B: 'B', C: 'C', D: 'D' }, confidence: 1.0 },
            { sourceNumber: 1, questionText: 'Q1 Second', options: { A: 'A', B: 'B', C: 'C', D: 'D' }, confidence: 1.0 }
        ];
        const answersResult = {
            answers: [{ questionNumber: 1, optionLetter: 'A', text: '1-A', page: 1, filename: 'key.txt' }],
            invalidAnswers: [],
            duplicateAnswers: []
        };

        const report = matchAndValidate(questions, answersResult);
        
        assert.equal(report.valid, false);
        assert.equal(report.duplicateQuestions.length, 1);
        assert.equal(report.duplicateQuestions[0], 1);
        assert(report.structuralErrors.some(e => e.includes('Duplicate question number(s) found')));
    });

    test('Match and Validate - Blocks on Duplicate answers', () => {
        const questions = [
            { sourceNumber: 1, questionText: 'Q1', options: { A: 'A', B: 'B', C: 'C', D: 'D' }, confidence: 1.0 }
        ];
        const answersResult = {
            answers: [
                { questionNumber: 1, optionLetter: 'A', text: '1-A', page: 1, filename: 'key.txt' },
                { questionNumber: 1, optionLetter: 'B', text: '1-B', page: 1, filename: 'key.txt', isDuplicate: true }
            ],
            invalidAnswers: [],
            duplicateAnswers: [1]
        };

        const report = matchAndValidate(questions, answersResult);
        
        assert.equal(report.valid, false);
        assert.equal(report.duplicateAnswers.length, 1);
        assert.equal(report.duplicateAnswers[0], 1);
        assert(report.structuralErrors.some(e => e.includes('Duplicate answer keys found')));
    });

    console.log(`\n📊 Answer Key Matching Execution Summary:`);
    console.log(`   Total Tests: ${passed + failed}`);
    console.log(`   Passed:      ${passed}`);
    console.log(`   Failed:      ${failed}`);

    if (failed > 0) {
        process.exit(1);
    } else {
        console.log('\n🟢 All Answer Key tests completed successfully!');
    }
};

runTests();
