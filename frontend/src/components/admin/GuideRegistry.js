export const GUIDE_REGISTRY = {
    'question-management': {
        id: 'question-management',
        title: 'Question Management Guide',
        steps: [
            {
                id: 'select-quiz',
                target: '[data-guide="select-quiz-prompt"]',
                title: 'Select a Target Quiz',
                description: 'Start by picking a quiz from the dropdown list to load its question set.',
                whyItMatters: 'Questions are always grouped inside a specific parent quiz.',
                position: 'bottom',
                action: 'change'
            },
            {
                id: 'questions-list',
                target: '[data-guide="questions-header"]',
                title: 'Questions Directory',
                description: 'This region lists the questions currently assigned to the selected quiz.',
                whyItMatters: 'You can view index offsets, point values, edit individual lines, or delete items from here.',
                position: 'right',
                action: 'view'
            },
            {
                id: 'guide-me-btn',
                target: '[data-guide="guide-me-btn"]',
                title: 'Interactive Tutorials',
                description: 'Click this button to trigger guided walks for manual question entries or automated bulk file imports.',
                whyItMatters: 'Keeps dashboard workflows clear and guides first-time quiz creators.',
                position: 'left',
                action: 'click'
            },
            {
                id: 'import-mcq',
                target: '[data-guide="import-mcq-btn"]',
                title: 'Bulk Document Importer',
                description: 'Need to import questions in bulk? Click here to launch the AI-powered file parser.',
                whyItMatters: 'Extracts questions, option sets, and links answer keys directly from PDFs or Word docs.',
                position: 'left',
                action: 'click'
            }
        ]
    },
    'manual-question-entry': {
        id: 'manual-question-entry',
        title: 'Manual Question Creator',
        steps: [
            {
                id: 'manual-text',
                target: '[data-guide="manual-question-text"]',
                title: 'Question Prompt',
                description: 'Enter the core text or prompt of the question in this field.',
                whyItMatters: 'Supports text formatting. Be clear and descriptive.',
                position: 'left',
                action: 'input',
                required: true
            },
            {
                id: 'manual-opt-a',
                target: '[data-guide="manual-option-0"]',
                title: 'Option A',
                description: 'Type the description for option choice A here.',
                whyItMatters: 'Every question must have exactly 4 choices to be valid.',
                position: 'left',
                action: 'input',
                required: true
            },
            {
                id: 'manual-opt-b',
                target: '[data-guide="manual-option-1"]',
                title: 'Option B',
                description: 'Type the description for option choice B.',
                whyItMatters: 'Ensures standardized MERN quiz options structure.',
                position: 'left',
                action: 'input',
                required: true
            },
            {
                id: 'manual-opt-c',
                target: '[data-guide="manual-option-2"]',
                title: 'Option C',
                description: 'Type the description for option choice C.',
                whyItMatters: 'Required option slot.',
                position: 'left',
                action: 'input',
                required: true
            },
            {
                id: 'manual-opt-d',
                target: '[data-guide="manual-option-3"]',
                title: 'Option D',
                description: 'Type the description for option choice D.',
                whyItMatters: 'Required option slot.',
                position: 'left',
                action: 'input',
                required: true
            },
            {
                id: 'manual-correct',
                target: '[data-guide="manual-correct-answer"]',
                title: 'Mark Correct Answer',
                description: 'Click the Option letters (A, B, C, or D) on the left side of the input boxes to mark that row as correct. The input border will highlight green.',
                whyItMatters: 'Indicates the true value used by the grading engine. Never leave correct answers unassigned.',
                position: 'left',
                action: 'click',
                required: true
            },
            {
                id: 'manual-explain',
                target: '[data-guide="manual-explanation"]',
                title: 'Explanation (Optional)',
                description: 'Type details or hints explaining why this choice is correct.',
                whyItMatters: 'Students view this description during exam reviews to learn and correct mistakes.',
                position: 'left',
                action: 'input'
            },
            {
                id: 'manual-save',
                target: '[data-guide="manual-save-btn"]',
                title: 'Add Question',
                description: 'Click here to save your question to the selected quiz.',
                whyItMatters: 'Performs live structure checks before committing record insertions.',
                position: 'top',
                action: 'click'
            }
        ]
    },
    'smart-import': {
        id: 'smart-import',
        title: 'Bulk Smart Importer',
        steps: [

            {
                id: 'import-dropzone',
                target: '[data-guide="import-dropzone"]',
                title: 'File Dropzone',
                description: 'Drag and drop your files here. You can drop up to 2 files simultaneously.',
                whyItMatters: 'Accepts PDF, DOCX, and TXT. One file should contain questions, and the other can contain answers.',
                position: 'top',
                action: 'drop'
            },
            {
                id: 'import-analyze',
                target: '[data-guide="import-analyze-btn"]',
                title: 'Analyze Documents',
                description: 'Click "Analyze" to run the extraction pipeline (Deterministic matching, OCR, and fallback AI structuring).',
                whyItMatters: 'Initiates processing. Real-time extraction status logs will detail parser progression.',
                position: 'top',
                action: 'click'
            }
        ]
    },
    'import-review': {
        id: 'import-review',
        title: 'Spreadsheet Review Grid',
        steps: [
            {
                id: 'review-grid',
                target: '[data-guide="review-spreadsheet-grid"]',
                title: 'Spreadsheet Editor',
                description: 'Double-click any cell in the table to correct parsed questions, options, or explanations directly.',
                whyItMatters: 'Ensures full formatting control. Correct any parsing issues before writing to the database.',
                position: 'top',
                action: 'view'
            },
            {
                id: 'review-validation',
                target: '[data-guide="review-validation-banner"]',
                title: 'Validation Summary',
                description: 'Shows extraction details, missing keys, and warning blocks. Red-tagged rows must be corrected.',
                whyItMatters: 'Bypasses the insert button if any critical structure errors remain.',
                position: 'bottom',
                action: 'view'
            }
        ]
    },
    'final-publish': {
        id: 'final-publish',
        title: 'Publish Questions',
        steps: [
            {
                id: 'review-mode',
                target: '[data-guide="review-import-mode"]',
                title: 'Import Modes',
                description: 'Choose "Add" to append questions, or "Replace" to erase existing quiz sets before committing.',
                whyItMatters: 'Protects quiz integrity. Ensure you do not overwrite live questions accidentally.',
                position: 'top',
                action: 'click'
            },
            {
                id: 'review-confirm',
                target: '[data-guide="review-confirm-btn"]',
                title: 'Publish to Quiz',
                description: 'Click Save Import to commit all spreadsheet entries to the database.',
                whyItMatters: 'Finalizes the pipeline. Commits bulk operations safely.',
                position: 'top',
                action: 'click'
            }
        ]
    }
};
