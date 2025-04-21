const translations = {
    en: {
        pageTitle: 'Polyglot Audiobook Generator - Google Translate & EdgeTTS',
        sourceLabel: 'Source Language:',
        targetLabel1: 'Target Language 1:',
        targetLabel2: 'Target Language 2:',
        targetLabel3: 'Target Language 3:',
        targetLabel4: 'Target Language 4:',
        enterText: 'Enter your source text here...',
        generateButton: 'Generate',
        translated: 'Translated',
        eta: 'ETA',
        translationError: 'Translation Error',
        uiLanguage: 'User Interface Language',
        openBookViewButton: 'Open in Book-View',
        saveEpubButton: 'Save as EPUB',
        reloadPageButton: 'Delete',
        translationFinishedMessage: 'Translation process over.',
        enterSourceTextLabel: 'Enter source text:', // Added translation for "Enter source text:"
        prioritizedLabel: '--- Prioritized ---',
        allLanguagesLabel: '--- All Languages ---',
        multilingualLabel: '--- Multilingual ---',
        headerLanguageLabel: 'Language',
        headerVoiceLabel: 'Voice Selection',
        insertFileButton: 'Insert Text File',
        languages: { // Only keep keys needed for translation lookup
            'auto': 'Autodetect Language'
        },
        statusCompleted: 'Completed',
        statusProcessed: 'Processed',
        statusSentRequest: 'Sent request',
        statusConnecting: 'Connecting...',
        statusErrorSendingRequest: 'Error sending request',
        statusErrorNoAudio: 'Error: No audio data',
        statusErrorEmptyAudio: 'Error: Empty audio',
        statusErrorProcessingAudio: 'Error processing audio',
        statusConnClosed: 'Connection Closed', // Base message, code/reason added dynamically
        statusErrorWebSocketCreate: 'WebSocket Creation Failed',
        statusErrorWebSocketSupport: 'Error: WebSocket Not Supported',
        statusErrorWebSocket: 'WebSocket Error',
        statusRetrying: 'Retrying ({0}/{1})...', // {0} = current retry, {1} = max retries
        statusFailedAfterRetries: 'Failed ({0}) after {1} retries.', // {0} = context, {1} = max retries
        statusInitializing: 'Initializing',
        statusQueued: 'Queued',
        statusPending: 'Pending',
        statusIdle: 'Idle',
        statusRunning: 'Running',
        statusStopping: 'Stopping',
        statusError: 'Error', // General error status
        statusFailed: 'Failed', // Simple failed status
        statusFailedLabel: 'Failed:', // Label in progress info
        statusFailedExclaim: 'Failed!', // Status in progress info
        statusFailedProgress: 'Failed ({0}/{1})', // Progress bar text {0}=failed, {1}=total
        statusFinishedExclaim: 'Finished!', // Status in progress info
        statusCalculating: 'Calculating...', // ETA calculation
        statusAddingToZip: 'Adding to ZIP...',
        statusGeneratingZip: 'Generating ZIP file: {0} (Compressing {1} files)...', // {0} = filename, {1} = count
        statusZipDownloadStarted: 'ZIP file download started: {0}', // {0} = filename
        statusSavedInZip: 'Saved in ZIP',
        statusZipCreationFailed: 'ZIP Creation Failed',
        statusSaving: 'Saving...',
        statusDownloadStarted: 'Download Started',
        statusErrorDownloading: 'Error Downloading',
        statusMerging: 'Merging...',
        statusMergedAndSaved: 'Merged & Saved',
        // Alerts & User Messages
        alertEnterSourceText: 'Please enter some source text before generating.', // Modified original alert text slightly
        alertSelectVoice: 'Please select a source language voice.', // Modified original alert text slightly
        alertCouldNotSplit: 'Could not split the text into processable chunks.',
        alertAudioGenerationFailed: 'Audio generation failed: {0} part(s) could not be created after retries.', // {0} = count
        alertJszipNotFound: 'Error: JSZip library not found. Cannot create ZIP.',
        alertJszipLoad: 'Please ensure the library is loaded.',
        alertZipError: 'Error generating or saving ZIP file: {0}', // {0} = error message
        alertNoFilesAddedToZip: 'No valid files were added to the ZIP archive.',
        alertSaveMergedError: 'Error saving merged file {0}. See console for details.', // {0} = filename
        alertPipelineError: 'Audio generation failed: {0}', // {0} = error message
        alertPopupBlocked: 'Could not open book view window. Please check your popup blocker settings.',
        alertFileTypeNotSupported: 'File type "{0}" not supported for text insertion.', // {0} = file extension
        alertFileReadError: 'Error reading file: {0}', // {0} = filename
        alertFb2Error: 'Error processing FB2 file: {0}', // {0} = filename
        alertEpubError: 'Error processing EPUB file: {0}', // {0} = filename
        alertZipProcError: 'Error processing ZIP file. It might be corrupted or contain unsupported file types.',
        alertGenericFileError: 'An error occurred while processing the files. Check the console for details.',
        // UI Labels, Placeholders, Titles, etc.
        advancedAudioSettingsTitle: 'Advanced Audio Settings',
        labelThreads: 'Threads:',
        labelMergeBy: 'Merge by:',
        labelRate: 'Rate:',
        labelPitch: 'Pitch:',
        textAll: 'ALL', // For merge slider
        textPieces: 'pcs.', // For merge slider suffix
        placeholderStatArea: 'Audio generation status will appear here...',
        titleSettingsButton: 'Settings',
        // Help System (Example)
        helpPeriodReplacementTitle: 'Period Replacement Mode: {0}', // {0} = mode (V1/V2/V3)
        helpPeriodReplacementV1: 'Replaces all periods in the text with the selected character.',
        helpPeriodReplacementV2: 'Preserves periods at line endings, but replaces all other periods with the selected character.',
        helpPeriodReplacementV3: 'Preserves periods at line endings, and replaces only periods followed by spaces with the selected character plus a space.',
        helpPeriodReplacementDefault: 'Click to cycle through modes.',
        // Audio Generation Process Messages
        audioGenFailedMessage: '--- Audio Generation FAILED ---',
        audioGenFailedDetails: '{0} part(s) failed after retries.', // {0} = count
        audioGenFailedNoOutput: 'No output file was generated. Please check the errors above.',
        audioGenSuccessMessage: '--- Audio Generation Finished Successfully ---',
        audioGenSuccessDetails: ' ({0}/{1} parts created)', // {0} = processed, {1} = total
        pipelineErrorMessage: '--- PIPELINE ERROR: {0} ---', // {0} = error message
        pipelineErrorLabel: 'Pipeline Error!', // Label in progress info
        // Voice Dropdown Placeholders
        voiceErrorLoading: 'Error: Voice data not loaded.',
        voiceSelectLanguage: 'Select a language first',
        voiceNoneAvailable: 'No voices available at all',
        voiceFallbackHint: '(Fallback)', // Added to optgroup label when showing all voices
        // Firefox Warning
        firefoxWarningTitle: 'Notice:',
        firefoxWarningBody: 'This application currently experiences issues in Firefox due to browser-specific restrictions on accessing translation services. For the best experience, please use Google Chrome or another Chromium-based browser.',
        // EPUB Metadata
        epubDefaultTitle: 'Bilingual Book', // For EPUB metadata
        epubDefaultAuthor: 'PolyglotAudiobookGenerator', // Default author
        epubDefaultFilename: 'Bilingual Book.epub', // Default EPUB filename
        processingFileDefaultName: 'Book', // Default name in processing_file.js
        bookViewWindowTitle: 'Book View', // Title for the book view popup window
        audioGenerationProgressTitle: "Audio Generation Progress", // <<< ADDED KEY
    },
};
