import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { X, Upload, FileText, CheckCircle, AlertTriangle, Trash2, Plus, Info, Sparkles } from 'lucide-react';

export default function ImportQuestionsModal({ isOpen, onClose, quizId, token, onImportSuccess }) {
    if (!isOpen) return null;

    const [selectedFiles, setSelectedFiles] = useState([]);
    const [analyzing, setAnalyzing] = useState(false);
    const [importing, setImporting] = useState(false);
    const [error, setError] = useState('');
    const [dragActive, setDragActive] = useState(false);
    const [dropzoneHover, setDropzoneHover] = useState(false);
    const [activeTab, setActiveTab] = useState('upload'); // 'upload' | 'preview'
    
    // Cell focus states for spreadsheet-style glowing outline highlights
    const [focusedCell, setFocusedCell] = useState(null); // 'qId-field'
    
    // Preview questions and validation states
    const [questions, setQuestions] = useState([]);
    const [importMode, setImportMode] = useState('add'); // 'add' | 'replace'
    const [validationReport, setValidationReport] = useState(null);
    const [aiStats, setAiStats] = useState({ aiUsed: false, callsCount: 0 });
    const [currentStageIndex, setCurrentStageIndex] = useState(-1);
    const fileInputRef = useRef(null);

    // Reset when modal opens/closes
    useEffect(() => {
        if (isOpen) {
            resetModal();
        }
    }, [isOpen]);

    // Lock body scrolling when modal is active
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    const resetModal = () => {
        setSelectedFiles([]);
        setQuestions([]);
        setValidationReport(null);
        setAiStats({ aiUsed: false, callsCount: 0 });
        setCurrentStageIndex(-1);
        setError('');
        setActiveTab('upload');
        setImportMode('add');
        setFocusedCell(null);
    };

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files) {
            addFiles(Array.from(e.dataTransfer.files));
        }
    };

    const handleFileChange = (e) => {
        if (e.target.files) {
            addFiles(Array.from(e.target.files));
        }
    };

    const addFiles = (filesList) => {
        const updated = [...selectedFiles];
        setError('');

        for (const file of filesList) {
            if (updated.length >= 2) {
                setError('Maximum of 2 files can be uploaded per import operation.');
                break;
            }
            const ext = file.name.split('.').pop().toLowerCase();
            if (!['pdf', 'docx', 'txt'].includes(ext)) {
                setError(`Unsupported file type: .${ext}. Only PDF, DOCX, and TXT are supported.`);
                continue;
            }
            if (file.size > 10 * 1024 * 1024) {
                setError(`File ${file.name} exceeds the 10MB size limit.`);
                continue;
            }
            // Avoid adding duplicates
            if (!updated.some(f => f.name === file.name && f.size === file.size)) {
                updated.push(file);
            }
        }
        setSelectedFiles(updated);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const removeFile = (index) => {
        setSelectedFiles(selectedFiles.filter((_, i) => i !== index));
    };

    const handleAnalyze = async () => {
        if (selectedFiles.length === 0) {
            setError('Please upload at least one document to analyze.');
            return;
        }

        setAnalyzing(true);
        setCurrentStageIndex(0);
        setError('');

        const stageInterval = setInterval(() => {
            setCurrentStageIndex(prev => {
                if (prev < 6) return prev + 1;
                return prev;
            });
        }, 800);



        const formData = new FormData();
        selectedFiles.forEach(file => {
            formData.append('files', file);
        });

        try {
            const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/admin/extract-document`, formData, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });

            const report = res.data.report || {};
            const matchedQuestions = report.matchedQuestions || [];

            // Add client-side editable states
            const editableQuestions = matchedQuestions.map((q, idx) => ({
                id: `q-${idx}-${Date.now()}`,
                sourceNumber: q.sourceNumber,
                questionText: q.questionText || '',
                options: q.options || ['', '', '', ''],
                correctAnswer: q.correctAnswer || '',
                correctLetter: q.correctLetter || 'A',
                explanation: q.explanation || '',
                sourcePage: q.sourcePage || 1,
                confidence: q.confidence || 1.0,
                isConflict: q.isConflict || false,
                isAiParsed: q.isAiParsed || false,
                warnings: q.warnings || []
            }));

            clearInterval(stageInterval);
            setCurrentStageIndex(7); // Preparing review

            setTimeout(() => {
                setQuestions(editableQuestions);
                setValidationReport(report);
                setAiStats(res.data.aiStats || { aiUsed: false, callsCount: 0 });
                setActiveTab('preview');
                setAnalyzing(false);
                setCurrentStageIndex(-1);
            }, 600);
        } catch (err) {
            clearInterval(stageInterval);
            setAnalyzing(false);
            setCurrentStageIndex(-1);
            setError(err.response?.data?.message || 'Error extracting documents.');
        }
    };

    // Client-side inline cell change handlers
    const handleCellChange = (qId, field, value) => {
        setQuestions(questions.map(q => {
            if (q.id === qId) {
                return { ...q, [field]: value };
            }
            return q;
        }));
    };

    const handleOptionChange = (qId, optIdx, value) => {
        setQuestions(questions.map(q => {
            if (q.id === qId) {
                const newOptions = [...q.options];
                newOptions[optIdx] = value;
                
                // Keep correct answer in sync if it matched the modified option
                let newCorrect = q.correctAnswer;
                const letterMap = ['A', 'B', 'C', 'D'];
                if (q.correctLetter === letterMap[optIdx]) {
                    newCorrect = value;
                }

                return { ...q, options: newOptions, correctAnswer: newCorrect };
            }
            return q;
        }));
    };

    const handleCorrectLetterChange = (qId, letter) => {
        setQuestions(questions.map(q => {
            if (q.id === qId) {
                const optIdx = ['A', 'B', 'C', 'D'].indexOf(letter);
                const correctText = q.options[optIdx] || '';
                return { ...q, correctLetter: letter, correctAnswer: correctText };
            }
            return q;
        }));
    };

    const handleAddRow = () => {
        const newRow = {
            id: `q-new-${Date.now()}`,
            sourceNumber: questions.length + 1,
            questionText: '',
            options: ['', '', '', ''],
            correctAnswer: '',
            correctLetter: 'A',
            explanation: '',
            sourcePage: 1,
            confidence: 1.0,
            isConflict: false,
            isAiParsed: false,
            warnings: []
        };
        setQuestions([...questions, newRow]);
    };

    const handleDeleteRow = (qId) => {
        setQuestions(questions.filter(q => q.id !== qId));
    };

    // Client-side question validator to ensure correctness
    const getQuestionStatus = (q) => {
        const missingText = !q.questionText.trim();
        const optionCount = q.options.filter(o => o.trim()).length;
        const missingOptions = optionCount !== 4;
        
        const correctIndex = ['A', 'B', 'C', 'D'].indexOf(q.correctLetter);
        const correctText = q.options[correctIndex] || '';
        const correctMismatch = !correctText.trim() || q.correctAnswer !== correctText;

        if (missingText || missingOptions || correctMismatch) {
            return {
                type: 'error',
                label: '❌ Error',
                text: missingText ? 'Missing question text.' : missingOptions ? 'Must have exactly 4 options.' : 'Correct answer mismatch.'
            };
        }
        if (q.isConflict) {
            return { type: 'conflict', label: '⚠ Conflict', text: 'AI output conflict.' };
        }
        if (q.warnings.length > 0 || q.confidence < 1.0) {
            return { type: 'review', label: '⚠ Review', text: q.warnings.join(' ') };
        }
        if (q.isAiParsed) {
            return { type: 'ai', label: '⚡ AI', text: 'AI structured fallback.' };
        }
        return { type: 'valid', label: '✓ Valid', text: 'Ready.' };
    };

    const getBlockingErrorsCount = () => {
        return questions.filter(q => getQuestionStatus(q).type === 'error').length;
    };

    const handleConfirmImport = async () => {
        if (getBlockingErrorsCount() > 0) {
            alert('Please resolve all validation errors (highlighted in red) before importing.');
            return;
        }

        if (importMode === 'replace') {
            const confirmReplace = window.confirm('⚠️ WARNING: You have selected "Replace existing questions". This will delete all current questions for this quiz. Are you sure you want to proceed?');
            if (!confirmReplace) return;
        }

        setImporting(true);
        setError('');

        // Build backend payload
        const questionsPayload = questions.map(q => ({
            question: q.questionText.trim(),
            options: q.options.map(o => o.trim()),
            correctAnswer: q.correctAnswer.trim(),
            explanation: q.explanation.trim()
        }));



        try {
            if (quizId) {
                // Bulk import directly to DB for existing quiz
                const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/admin/import-questions`, {
                    quizId,
                    questions: questionsPayload,
                    replace: importMode === 'replace'
                }, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                alert(res.data?.message || 'Questions imported successfully.');
                onImportSuccess();
                onClose();
            } else {
                // Pass questions list back to parent creation form (for new quiz creation flow)
                onImportSuccess(questionsPayload);
                alert(`Successfully parsed and buffered ${questionsPayload.length} questions for the new quiz.`);
                onClose();
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to complete question import.');
        } finally {
            setImporting(false);
        }
    };

    // Render helper for cells inputs focusing outline styling
    const getInputStyle = (qId, field, hasError = false) => {
        const isFocused = focusedCell === `${qId}-${field}`;
        return {
            width: '100%',
            padding: '8px 12px',
            border: hasError 
                ? '1px solid #ff3b30' 
                : isFocused 
                    ? '1px solid var(--brand-accent)' 
                    : '1px solid rgba(0,0,0,0.08)',
            boxShadow: isFocused 
                ? '0 0 0 3px rgba(108,99,255,0.15)' 
                : 'none',
            borderRadius: 8,
            fontSize: 13,
            fontFamily: 'inherit',
            background: 'transparent',
            outline: 'none',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            resize: 'vertical'
        };
    };

    return createPortal(
        <div 
            onClick={onClose}
            style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(10, 10, 20, 0.45)', backdropFilter: 'blur(16px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100,
                animation: 'fadeIn 0.25s ease-out',
                overflow: 'hidden'
            }}
        >
            <div 
                onClick={(e) => e.stopPropagation()}
                style={{
                    background: 'var(--color-surface)', 
                    width: activeTab === 'upload' ? '540px' : '96%',
                    maxWidth: activeTab === 'upload' ? '90%' : 1600,
                    height: activeTab === 'upload' ? 'min(520px, 90vh)' : '85vh',
                    maxHeight: '90vh',
                    borderRadius: 24, 
                    boxShadow: '0 24px 60px rgba(10,10,30,0.18)',
                    display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--color-border)',
                    transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
                    margin: 'auto'
                }}
            >
                {/* Header */}
                <div style={{
                    padding: '24px 32px', borderBottom: '1px solid var(--color-border)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
                    background: 'linear-gradient(to right, #fbfbfd, #ffffff)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                            width: 40, height: 40, borderRadius: 12, background: 'rgba(108,99,255,0.1)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            <Upload size={20} color="var(--brand-accent)" />
                        </div>
                        <div>
                            <h2 style={{ fontSize: 17, fontWeight: 850, color: 'var(--color-text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
                                {activeTab === 'upload' ? 'Upload MCQ Documents' : 'Review & Verify Questions'}
                            </h2>
                            <p style={{ fontSize: 11.5, color: 'var(--color-text-secondary)', margin: '2px 0 0 0' }}>
                                {activeTab === 'upload' 
                                    ? 'Select up to 2 files to batch extract questions.' 
                                    : 'Review validation badges and edit cells inline before saving.'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{
                        background: 'rgba(0,0,0,0.03)', border: 'none', cursor: 'pointer', width: 36, height: 36, borderRadius: '50%',
                        color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'background 0.15s ease'
                    }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.06)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0.03)'}>
                        <X size={18} />
                    </button>
                </div>

                {/* Content Panel */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px', display: 'flex', flexDirection: 'column', minHeight: 0, background: '#fafafb' }}>
                    {error && (
                        <div style={{
                            padding: '14px 20px', background: 'rgba(255,59,48,0.06)', border: '1px solid rgba(255,59,48,0.15)',
                            borderRadius: 12, color: 'var(--color-danger)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20,
                            boxShadow: '0 4px 12px rgba(255,59,48,0.02)', animation: 'shake 0.3s ease-in-out'
                        }}>
                            <AlertTriangle size={18} />
                            <span style={{ fontWeight: 600 }}>{error}</span>
                        </div>
                    )}

                    {analyzing ? (
                        /* TAB: ANALYZING PROGRESS JOURNEY VIEW */
                        <div style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                            flex: 1, padding: '40px 20px', background: 'white', borderRadius: 20,
                            boxShadow: '0 4px 20px rgba(0,0,0,0.01)', minHeight: 350,
                            animation: 'fadeIn 0.3s ease-out'
                        }}>
                            <h3 style={{ fontSize: 17, fontWeight: 900, color: 'var(--color-text-primary)', marginBottom: 24, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ animation: 'spin 2s linear infinite', display: 'inline-block' }}>⚙️</span>
                                Processing Document Pipeline
                            </h3>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%', maxWidth: 400 }}>
                                {[
                                    "Uploading document templates",
                                    "Reading raw text (running OCR scan)",
                                    "Detecting quiz boundary markers",
                                    "Extracting questions & parsing metadata",
                                    "Isolating option sets A-D",
                                    "Matching questions with answer keys",
                                    "Validating schema constraints",
                                    "Preparing interactive review grid"
                                ].map((stage, idx) => {
                                    const isCompleted = idx < currentStageIndex;
                                    const isCurrent = idx === currentStageIndex;
                                    const isWaiting = idx > currentStageIndex;
                                    
                                    return (
                                        <div key={idx} style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                            padding: '10px 14px', borderRadius: 10,
                                            background: isCurrent ? 'rgba(108,99,255,0.05)' : isCompleted ? 'rgba(48,209,88,0.03)' : 'transparent',
                                            border: isCurrent ? '1px solid rgba(108,99,255,0.15)' : '1px solid transparent',
                                            transition: 'all 0.3s ease'
                                        }}>
                                            <span style={{ fontSize: 13, fontWeight: 700, color: isCurrent ? 'var(--brand-accent)' : isCompleted ? '#248a3d' : '#a0aec0' }}>
                                                {idx + 1}. {stage}
                                              </span>
                                              <div style={{ fontSize: 11.5, fontWeight: 800 }}>
                                                  {isCompleted && <span style={{ color: '#248a3d' }}>✓ Completed</span>}
                                                  {isCurrent && (
                                                      <span style={{ animation: 'pulse 1.2s infinite ease-in-out', color: 'var(--brand-accent)', display: 'inline-block' }}>
                                                          ● Processing...
                                                      </span>
                                                  )}
                                                  {isWaiting && <span style={{ color: '#a0aec0' }}>○ Waiting</span>}
                                              </div>
                                          </div>
                                      );
                                  })}
                              </div>
                          </div>
                      ) : activeTab === 'upload' ? (
                          /* TAB: UPLOAD FILE VIEW (COMPACT SINGLE COLUMN POPUP) */
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>

                            {/* Drag and Drop Zone */}
                            <div 
                                data-guide="import-dropzone"
                                onDragEnter={handleDrag}
                                onDragOver={handleDrag}
                                onDragLeave={handleDrag}
                                onDrop={handleDrop}
                                onMouseEnter={() => setDropzoneHover(true)}
                                onMouseLeave={() => setDropzoneHover(false)}
                                style={{
                                    border: dragActive ? '2px dashed var(--brand-accent)' : '2px dashed rgba(108,99,255,0.25)',
                                    borderRadius: 20, 
                                    background: dragActive 
                                        ? 'linear-gradient(135deg, rgba(108,99,255,0.04) 0%, rgba(162,155,254,0.04) 100%)' 
                                        : 'linear-gradient(135deg, rgba(255,255,255,0.8) 0%, rgba(248,250,252,0.9) 100%)',
                                    backdropFilter: 'blur(20px)',
                                    boxShadow: dropzoneHover || dragActive 
                                        ? '0 12px 28px rgba(108,99,255,0.06)' 
                                        : '0 4px 16px rgba(0, 0, 0, 0.01)',
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                    padding: '44px 24px', cursor: 'pointer', transition: 'all 0.3s ease',
                                    minHeight: 180
                                }}
                                onClick={() => fileInputRef.current && fileInputRef.current.click()}
                            >
                                <input 
                                    ref={fileInputRef}
                                    type="file" 
                                    multiple
                                    accept=".pdf,.docx,.txt"
                                    onChange={handleFileChange}
                                    style={{ display: 'none' }}
                                />
                                <div style={{
                                    width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg, rgba(108,99,255,0.08), rgba(162,155,254,0.12))',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14,
                                    transform: dropzoneHover ? 'scale(1.06) translateY(-1px)' : 'scale(1)',
                                    transition: 'all 0.2s ease'
                                }}>
                                    <Upload size={24} color="var(--brand-accent)" />
                                </div>
                                <p style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--color-text-primary)', marginBottom: 4, letterSpacing: '-0.01em' }}>
                                    Drag & drop files here, or <span style={{ color: 'var(--brand-accent)' }}>browse</span>
                                </p>
                                <p style={{ fontSize: 11.5, color: 'var(--color-text-secondary)', textAlign: 'center', maxWidth: 360, lineHeight: 1.5 }}>
                                    Supports PDF (including scanned), DOCX, and TXT files. (Max 2 files, 10MB each)
                                </p>
                            </div>



                            {/* Selected Files Summary List */}
                            {selectedFiles.length > 0 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {selectedFiles.map((file, idx) => (
                                        <div key={idx} style={{ 
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                                            background: 'white', padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(0,0,0,0.05)',
                                            boxShadow: '0 2px 10px rgba(0,0,0,0.01)'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                <FileText size={16} color="var(--brand-accent)" />
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
                                                    <span style={{ fontSize: 10.5, color: 'var(--color-text-secondary)' }}>{(file.size / (1024 * 1024)).toFixed(2)} MB</span>
                                                </div>
                                            </div>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); removeFile(idx); }} 
                                                style={{ background: 'transparent', border: 'none', color: '#ff3b30', cursor: 'pointer', fontWeight: 700, fontSize: 12 }}
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Helper Guidance Tip */}
                            <div style={{
                                background: '#f8fafc', padding: 14, borderRadius: 12, border: '1px solid rgba(0,0,0,0.02)',
                                display: 'flex', gap: 10, alignItems: 'flex-start'
                            }}>
                                <Info size={15} color="var(--brand-accent)" style={{ marginTop: 2, flexShrink: 0 }} />
                                <p style={{ margin: 0, fontSize: 11, lineHeight: 1.45, color: 'var(--color-text-secondary)' }}>
                                    Provide your questions file (Q1., 1. A) B) C) D)) and answer key (1-B, Q1: C). The parser will automatically link them. Ambiguous pages will run through the AI schema resolver.
                                </p>
                            </div>
                        </div>
                    ) : (
                        /* TAB: PREVIEW EDITOR GRID VIEW */
                        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                            {/* Summary validation bar */}
                            <div data-guide="review-validation-banner" style={{
                                padding: '16px 20px', background: 'white', borderRadius: 16,
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexShrink: 0,
                                border: '1px solid var(--color-border)', boxShadow: '0 4px 20px rgba(0,0,0,0.015)'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 13.5 }}>
                                    <span style={{ fontWeight: 800, color: 'var(--color-text-primary)' }}>Extracted: {questions.length} Questions</span>
                                    <div style={{ width: 1, height: 16, background: 'rgba(0,0,0,0.08)' }} />
                                    {getBlockingErrorsCount() > 0 ? (
                                        <span style={{ color: 'var(--color-danger)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <AlertTriangle size={16} /> {getBlockingErrorsCount()} critical errors need fixing
                                        </span>
                                    ) : (
                                        <span style={{ color: 'var(--color-success)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <CheckCircle size={16} /> All questions valid & ready to import!
                                        </span>
                                    )}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                    {/* Import Mode selection (Only if quiz exists) */}
                                    {quizId ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderRight: '1px solid rgba(0,0,0,0.08)', paddingRight: 16 }}>
                                            <label style={{ fontSize: 12.5, fontWeight: 750, color: '#4a5568' }}>Import Mode:</label>
                                            <select 
                                                data-guide="review-import-mode"
                                                value={importMode} 
                                                onChange={e => setImportMode(e.target.value)}
                                                style={{ 
                                                    padding: '6px 12px', borderRadius: 8, border: '1px solid var(--color-border)', 
                                                    fontSize: 12.5, fontWeight: 700, background: 'white', cursor: 'pointer',
                                                    outline: 'none', transition: 'border 0.2s ease'
                                                }}
                                                onFocus={e => e.target.style.borderColor = 'var(--brand-accent)'}
                                                onBlur={e => e.target.style.borderColor = 'var(--color-border)'}
                                            >
                                                <option value="add">Append to existing questions</option>
                                                <option value="replace">Replace all existing questions</option>
                                            </select>
                                        </div>
                                    ) : (
                                        <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--brand-accent)', background: 'rgba(108,99,255,0.07)', padding: '6px 12px', borderRadius: 8 }}>Creating new quiz queue</span>
                                    )}

                                    <button 
                                        onClick={handleAddRow}
                                        style={{
                                            background: 'var(--color-surface)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 10, color: '#4a5568',
                                            padding: '8px 16px', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6,
                                            transition: 'background 0.2s ease'
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'white'}
                                    >
                                        <Plus size={14} /> Add Row
                                    </button>
                                </div>
                            </div>

                            {/* AI Stats Usage Info Alert */}
                            {aiStats && aiStats.aiUsed && (
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: 10,
                                    padding: '12px 18px', background: 'linear-gradient(135deg, rgba(108,99,255,0.06) 0%, rgba(162,155,254,0.08) 100%)',
                                    borderRadius: 12, border: '1px solid rgba(108,99,255,0.15)',
                                    marginBottom: 16, flexShrink: 0
                                }}>
                                    <Sparkles size={16} color="var(--brand-accent)" style={{ flexShrink: 0 }} />
                                    <p style={{ margin: 0, fontSize: 12.5, color: '#4d48b3', fontWeight: 700 }}>
                                        AI was used for extracting this document structure. Total AI calls: <span style={{ textDecoration: 'underline' }}>{aiStats.callsCount}</span>. (Gemini API limit is active).
                                    </p>
                                </div>
                            )}

                            {/* Spreadsheet-style preview editor table */}
                            <div data-guide="review-spreadsheet-grid" style={{ flex: 1, overflowX: 'auto', overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 16, background: 'white', boxShadow: '0 4px 30px rgba(0,0,0,0.01)' }} className="custom-scrollbar">
                                <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: 13 }}>
                                    <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 10, boxShadow: '0 1px 0 rgba(0,0,0,0.06)' }}>
                                        <tr>
                                            <th style={{ width: 110, padding: 16, textAlign: 'left', fontWeight: 800, color: '#4a5568' }}>Status</th>
                                            <th style={{ width: 340, padding: 16, textAlign: 'left', fontWeight: 800, color: '#4a5568' }}>Question Text</th>
                                            <th style={{ width: 280, padding: 16, textAlign: 'left', fontWeight: 800, color: '#4a5568' }}>Options (A, B, C, D)</th>
                                            <th style={{ width: 120, padding: 16, textAlign: 'left', fontWeight: 800, color: '#4a5568' }}>Correct Answer</th>
                                            <th style={{ width: 220, padding: 16, textAlign: 'left', fontWeight: 800, color: '#4a5568' }}>Explanation / Metadata</th>
                                            <th style={{ width: 60, padding: 16, textAlign: 'center', fontWeight: 800, color: '#4a5568' }}>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {questions.map((q, idx) => {
                                            const status = getQuestionStatus(q);
                                            const isError = status.type === 'error';
                                            const isReview = status.type === 'review';
                                            const isConflict = status.type === 'conflict';
                                            const isAi = status.type === 'ai';

                                            let bg = 'white';
                                            if (isError) bg = 'rgba(255, 59, 48, 0.02)';
                                            else if (isConflict) bg = 'rgba(255, 159, 10, 0.02)';
                                            else if (isReview) bg = 'rgba(255, 159, 10, 0.01)';

                                            // Render Status color styling
                                            let statusColor = '#30d158'; // Valid green
                                            if (isError) statusColor = '#ff3b30'; // Red
                                            else if (isConflict || isReview) statusColor = '#ff9f0a'; // Orange
                                            else if (isAi) statusColor = '#5e5ce6'; // Purple

                                            return (
                                                <tr key={q.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)', background: bg }}>
                                                    {/* Status Badge & Page */}
                                                    <td style={{ padding: 16, verticalAlign: 'top' }}>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                            <span style={{ 
                                                                fontSize: 10.5, fontWeight: 850, padding: '4px 10px', borderRadius: 20, 
                                                                background: `${statusColor}12`, color: statusColor, width: 'fit-content',
                                                                letterSpacing: '0.02em', border: `1px solid ${statusColor}18`
                                                            }}>
                                                                {status.label}
                                                            </span>
                                                            <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                                                                Pg: {q.sourcePage} (Idx: {q.sourceNumber || idx + 1})
                                                            </span>
                                                        </div>
                                                    </td>

                                                    {/* Question Text Cell */}
                                                    <td style={{ padding: 10, verticalAlign: 'top' }}>
                                                        <textarea 
                                                            value={q.questionText}
                                                            onChange={e => handleCellChange(q.id, 'questionText', e.target.value)}
                                                            onFocus={() => setFocusedCell(`${q.id}-questionText`)}
                                                            onBlur={() => setFocusedCell(null)}
                                                            style={getInputStyle(q.id, 'questionText', isError && !q.questionText.trim())}
                                                        />
                                                    </td>

                                                    {/* Options A-D Cells */}
                                                    <td style={{ padding: 10, verticalAlign: 'top' }}>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                            {['A', 'B', 'C', 'D'].map((lbl, oIdx) => (
                                                                <div key={lbl} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                    <span style={{ fontSize: 11, fontWeight: 800, color: '#7a8090', width: 14 }}>{lbl}</span>
                                                                    <input 
                                                                        type="text"
                                                                        value={q.options[oIdx]}
                                                                        onChange={e => handleOptionChange(q.id, oIdx, e.target.value)}
                                                                        onFocus={() => setFocusedCell(`${q.id}-option-${lbl}`)}
                                                                        onBlur={() => setFocusedCell(null)}
                                                                        placeholder={`Option ${lbl}`}
                                                                        style={getInputStyle(q.id, `option-${lbl}`, isError && !q.options[oIdx].trim())}
                                                                    />
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </td>

                                                    {/* Correct Answer Dropdown Selection */}
                                                    <td style={{ padding: 10, verticalAlign: 'top' }}>
                                                        <select
                                                            value={q.correctLetter}
                                                            onChange={e => handleCorrectLetterChange(q.id, e.target.value)}
                                                            onFocus={() => setFocusedCell(`${q.id}-correctAnswer`)}
                                                            onBlur={() => setFocusedCell(null)}
                                                            style={{
                                                                width: '100%', padding: '8px 12px', borderRadius: 8,
                                                                border: focusedCell === `${q.id}-correctAnswer` ? '1px solid var(--brand-accent)' : '1px solid rgba(0,0,0,0.08)',
                                                                boxShadow: focusedCell === `${q.id}-correctAnswer` ? '0 0 0 3px rgba(108,99,255,0.15)' : 'none',
                                                                fontSize: 13, fontWeight: 700, background: 'white', outline: 'none', cursor: 'pointer',
                                                                transition: 'all 0.2s ease'
                                                            }}
                                                        >
                                                            <option value="A">Option A</option>
                                                            <option value="B">Option B</option>
                                                            <option value="C">Option C</option>
                                                            <option value="D">Option D</option>
                                                        </select>
                                                    </td>

                                                    {/* Explanation / Warnings Cell */}
                                                    <td style={{ padding: 10, verticalAlign: 'top' }}>
                                                        <textarea 
                                                            value={q.explanation}
                                                            onChange={e => handleCellChange(q.id, 'explanation', e.target.value)}
                                                            onFocus={() => setFocusedCell(`${q.id}-explanation`)}
                                                            onBlur={() => setFocusedCell(null)}
                                                            placeholder="Add explanation..."
                                                            style={{
                                                                ...getInputStyle(q.id, 'explanation'),
                                                                minHeight: 45,
                                                                marginBottom: 8
                                                            }}
                                                        />
                                                        {status.text && status.type !== 'valid' && (
                                                            <div style={{ 
                                                                fontSize: 10.5, color: statusColor, background: `${statusColor}08`, 
                                                                padding: '8px 12px', borderRadius: 8, border: `1px solid ${statusColor}15`,
                                                                fontWeight: 600, lineHeight: 1.4
                                                            }}>
                                                                {status.text}
                                                            </div>
                                                        )}
                                                    </td>

                                                    {/* Delete row action */}
                                                    <td style={{ padding: 16, textAlign: 'center', verticalAlign: 'top' }}>
                                                        <button 
                                                            onClick={() => handleDeleteRow(q.id)}
                                                            style={{ 
                                                                background: 'transparent', border: 'none', color: '#ff3b30', cursor: 'pointer', padding: 6,
                                                                borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                                                transition: 'background 0.15s ease'
                                                            }}
                                                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,59,48,0.06)'}
                                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Controls */}
                <div style={{
                    padding: '20px 32px', borderTop: '1px solid var(--color-border)',
                    display: 'flex', justifyContent: activeTab === 'upload' ? 'flex-end' : 'space-between', alignItems: 'center', flexShrink: 0,
                    background: '#fbfbfd'
                }}>
                    {activeTab === 'preview' && (
                        <button 
                            onClick={resetModal}
                            style={{
                                background: 'transparent', border: '1px solid rgba(0,0,0,0.1)', color: 'var(--color-text-secondary)',
                                padding: '10px 20px', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 700,
                                transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.03)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                            Back to Upload
                        </button>
                    )}
                    <div style={{ display: 'flex', gap: 14 }}>
                        <button 
                            onClick={onClose}
                            style={{
                                background: 'transparent', border: 'none', color: 'var(--color-text-secondary)',
                                padding: '10px 20px', cursor: 'pointer', fontSize: 13, fontWeight: 700
                            }}
                        >
                            Cancel
                        </button>
                        {activeTab === 'upload' ? (
                            <button 
                                data-guide="import-analyze-btn"
                                onClick={handleAnalyze}
                                disabled={selectedFiles.length === 0 || analyzing}
                                style={{
                                    background: 'var(--brand-accent)', border: 'none', color: 'white',
                                    padding: '10px 28px', borderRadius: 10, cursor: selectedFiles.length === 0 || analyzing ? 'not-allowed' : 'pointer',
                                    fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8,
                                    opacity: selectedFiles.length === 0 || analyzing ? 0.6 : 1,
                                    boxShadow: '0 4px 16px rgba(108,99,255,0.2)',
                                    transition: 'all 0.25s ease'
                                }}
                                onMouseEnter={e => { if (!analyzing && selectedFiles.length > 0) e.currentTarget.style.transform = 'translateY(-1px)'; }}
                                onMouseLeave={e => e.currentTarget.style.transform = 'none'}
                            >
                                {analyzing ? (
                                    <>Parsing & running AI Fallback...</>
                                ) : (
                                    <>
                                        <Sparkles size={16} /> Analyze Documents
                                    </>
                                )}
                            </button>
                        ) : (
                            <button 
                                data-guide="review-confirm-btn"
                                onClick={handleConfirmImport}
                                disabled={getBlockingErrorsCount() > 0 || importing}
                                style={{
                                    background: getBlockingErrorsCount() > 0 || importing ? '#e2e8f0' : 'var(--color-success)',
                                    color: getBlockingErrorsCount() > 0 || importing ? '#a0aec0' : 'white',
                                    border: 'none', padding: '10px 28px', borderRadius: 10,
                                    cursor: getBlockingErrorsCount() > 0 || importing ? 'not-allowed' : 'pointer',
                                    fontSize: 13, fontWeight: 700, opacity: importing ? 0.8 : 1,
                                    transition: 'all 0.2s ease',
                                    boxShadow: getBlockingErrorsCount() > 0 || importing ? 'none' : '0 4px 16px rgba(48,209,88,0.2)'
                                }}
                            >
                                {importing ? 'Saving to Database...' : 'Confirm Import & Save'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
