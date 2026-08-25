import assert from 'assert/strict';
import { extractAmbiguousSectionsWithAI } from '../services/aiService.js';

console.log('🧪 Running AI Fallback & Conflict Resolution Tests...\n');

const runTests = async () => {
    let passed = 0;
    let failed = 0;

    const test = async (name, fn) => {
        try {
            await fn();
            console.log(`   Passed: ${name}`);
            passed++;
        } catch (err) {
            console.error(`❌ Failed: ${name}`);
            console.error(err);
            failed++;
        }
    };

    // 1. Environment and Configuration Validation
    await test('Configuration - throws if API key is missing', async () => {
        await assert.rejects(async () => {
            await extractAmbiguousSectionsWithAI('mock text', 'gemini', null, 'gemini-1.5-flash');
        }, /AI API key is missing/);
    });

    await test('Configuration - rejects unsupported providers', async () => {
        await assert.rejects(async () => {
            await extractAmbiguousSectionsWithAI('mock text', 'invalid-provider', 'key-123');
        }, /Unsupported AI provider/);
    });

    // 2. Conflict Checking Logic Simulation
    await test('Conflict check - detects difference in question text', () => {
        const cleanStr = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

        const detQuestion = 'What is the TCP protocol?';
        const aiQuestion = 'What is the UDP protocol?'; // Conflicting question text
        
        const isConflict = !!(cleanStr(detQuestion) !== cleanStr(aiQuestion) && detQuestion.trim() && aiQuestion.trim());
        assert.equal(isConflict, true, 'Should detect text conflict');
    });

    await test('Conflict check - detects difference in options text', () => {
        const cleanStr = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

        const detOptions = { A: 'Transmission Control Protocol', B: 'IP', C: 'UDP', D: 'DNS' };
        const aiOptions = { A: 'Telemetry Control Protocol', B: 'IP', C: 'UDP', D: 'DNS' }; // Option A differs

        const isConflict = ['A', 'B', 'C', 'D'].some(o => 
            !!(cleanStr(detOptions[o]) !== cleanStr(aiOptions[o]) && detOptions[o].trim() && aiOptions[o].trim())
        );
        assert.equal(isConflict, true, 'Should detect options conflict');
    });

    await test('Merge Check - no conflict merges details and restores confidence', () => {
        const candidate = {
            sourceNumber: 1,
            questionText: 'What is HTTP?',
            options: { A: '', B: 'Protocol', C: 'Language', D: 'Service' }, // Option A is missing (low confidence)
            confidence: 0.5,
            warnings: ['Missing option label A']
        };

        const aiResult = {
            sourceNumber: 1,
            questionText: 'What is HTTP?',
            options: { A: 'HyperText Transfer Protocol', B: 'Protocol', C: 'Language', D: 'Service' },
            confidence: 1.0,
            warnings: []
        };

        // Simulating the merge logic from extractDocument controller
        const cleanStr = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const qConflict = !!(cleanStr(candidate.questionText) !== cleanStr(aiResult.questionText) && candidate.questionText.trim() && aiResult.questionText.trim());
        const optConflict = ['A', 'B', 'C', 'D'].some(o => 
            !!(cleanStr(candidate.options[o]) !== cleanStr(aiResult.options[o]) && candidate.options[o].trim() && aiResult.options[o].trim())
        );

        assert.equal(qConflict || optConflict, false, 'Should be NO conflict because missing option A text is empty in candidate');

        // Merging
        candidate.questionText = aiResult.questionText || candidate.questionText;
        candidate.options = {
            A: aiResult.options.A || candidate.options.A,
            B: aiResult.options.B || candidate.options.B,
            C: aiResult.options.C || candidate.options.C,
            D: aiResult.options.D || candidate.options.D
        };
        candidate.confidence = 1.0;
        candidate.warnings = candidate.warnings.filter(w => !w.includes('Missing option label') && !w.includes('Missing question text'));

        assert.equal(candidate.options.A, 'HyperText Transfer Protocol');
        assert.equal(candidate.confidence, 1.0);
        assert.equal(candidate.warnings.length, 0);
    });

    console.log(`\n📊 AI Fallback Engine Execution Summary:`);
    console.log(`   Total Tests: ${passed + failed}`);
    console.log(`   Passed:      ${passed}`);
    console.log(`   Failed:      ${failed}`);

    if (failed > 0) {
        process.exit(1);
    } else {
        console.log('\n🟢 All AI Fallback tests completed successfully!');
    }
};

runTests();
