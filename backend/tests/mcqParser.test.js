import assert from 'assert/strict';
import { parseMCQ } from '../utils/mcqParser.js';

console.log('🧪 Running MCQ Parser Engine Tests...\n');

const runTests = async () => {
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
    const makeDoc = (text, page = 1) => ({
        documentId: 'doc-123',
        filename: 'test.txt',
        type: 'txt',
        pages: 1,
        blocks: [{ page, type: 'paragraph', text, sourceIndex: 0 }]
    });

    test('Standard format (1. Question A) B) C) D)', () => {
        const text = `1. What is the CPU?
A) Central Processing Unit
B) Computer Personal Unit
C) Central Processor Utility
D) Control Power Unit
Answer: A`;
        const result = parseMCQ(makeDoc(text));
        
        assert.equal(result.length, 1);
        const q = result[0];
        assert.equal(q.sourceNumber, 1);
        assert.equal(q.questionText, 'What is the CPU?');
        assert.equal(q.options.A, 'Central Processing Unit');
        assert.equal(q.options.B, 'Computer Personal Unit');
        assert.equal(q.options.C, 'Central Processor Utility');
        assert.equal(q.options.D, 'Control Power Unit');
        assert.equal(q.sourcePage, 1);
        assert.equal(q.confidence, 1.0);
        assert.equal(q.warnings.length, 1);
        assert(q.warnings[0].includes('Answer key'));
    });

    test('Alternative formats (1) Question a) b) c) d) and Q1. A. B. C. D.)', () => {
        const text = `1) What is DNS?
a) Domain Name System
b) Domain Name Service
c) Digital Network System
d) Digital Name Service

Q2. What is IP?
A. Internet Protocol
B. Intranet Protocol
C. Internal Port
D. Instant Port`;
        const result = parseMCQ(makeDoc(text));
        
        assert.equal(result.length, 2);
        
        // Check Q1
        assert.equal(result[0].sourceNumber, 1);
        assert.equal(result[0].questionText, 'What is DNS?');
        assert.equal(result[0].options.A, 'Domain Name System');
        assert.equal(result[0].confidence, 1.0);
        
        // Check Q2
        assert.equal(result[1].sourceNumber, 2);
        assert.equal(result[1].questionText, 'What is IP?');
        assert.equal(result[1].options.A, 'Internet Protocol');
        assert.equal(result[1].confidence, 1.0);
    });

    test('Multiline question text and options support', () => {
        const text = `1. This is a very long question
that spans over multiple lines in
the document.
A) Option A has multiline
text as well.
B) Option B
C) Option C
D) Option D`;
        const result = parseMCQ(makeDoc(text));
        
        assert.equal(result.length, 1);
        const q = result[0];
        assert.equal(q.questionText, 'This is a very long question that spans over multiple lines in the document.');
        assert.equal(q.options.A, 'Option A has multiline text as well.');
        assert.equal(q.confidence, 1.0);
    });

    test('Duplicate option labels (Error case)', () => {
        const text = `1. Which one is correct?
A) Option A
A) Duplicate Option A
B) Option B
C) Option C
D) Option D`;
        const result = parseMCQ(makeDoc(text));
        
        assert.equal(result.length, 1);
        const q = result[0];
        assert(q.warnings.some(w => w.includes('Duplicate option label detected')));
        assert(q.confidence < 1.0);
    });

    test('Missing option (Error case)', () => {
        const text = `1. Question text
A) Option A
B) Option B
D) Option D`; // Option C is missing
        const result = parseMCQ(makeDoc(text));
        
        assert.equal(result.length, 1);
        const q = result[0];
        assert(q.warnings.some(w => w.includes('Missing option label')));
        assert(q.confidence < 1.0);
    });

    test('Missing question text (Error case)', () => {
        const text = `1.
A) Option A
B) Option B
C) Option C
D) Option D`;
        const result = parseMCQ(makeDoc(text));
        
        assert.equal(result.length, 1);
        const q = result[0];
        assert(q.warnings.some(w => w.includes('Missing question text')));
        assert(q.confidence < 1.0);
    });

    test('Duplicate question numbers (Error case)', () => {
        const text = `1. First question
A) A
B) B
C) C
D) D

1. Second question with same index
A) A
B) B
C) C
D) D`;
        const result = parseMCQ(makeDoc(text));
        
        assert.equal(result.length, 2);
        assert(result[0].warnings.some(w => w.includes('Duplicate question number')));
        assert(result[1].warnings.some(w => w.includes('Duplicate question number')));
        assert(result[0].confidence < 1.0);
        assert(result[1].confidence < 1.0);
    });

    test('Malformed/un-numbered question headers', () => {
        const text = `Q. What is HTTP?
A) HyperText Transfer Protocol
B) HyperText Transfer Package
C) High Transfer Protocol
D) High Text Protocol`;
        const result = parseMCQ(makeDoc(text));
        
        assert.equal(result.length, 1);
        const q = result[0];
        assert.equal(q.sourceNumber, null);
        assert(q.warnings.some(w => w.includes('Malformed question number') || w.includes('Missing or invalid question number')));
        assert(q.confidence < 1.0);
    });

    console.log(`\n📊 MCQ Parser Execution Summary:`);
    console.log(`   Total Tests: ${passed + failed}`);
    console.log(`   Passed:      ${passed}`);
    console.log(`   Failed:      ${failed}`);

    if (failed > 0) {
        process.exit(1);
    } else {
        console.log('\n🟢 All MCQ Parser tests completed successfully!');
    }
};

runTests();
