// Contains logic for generating multi-language audiobooks.

// Depends on:
// - Functions:
//   - detectLanguage, translateBatch (translation_api.js)
//   - splitIntoSentences, mergeShortSentences, createTranslationBatches, sleep (translation_utils.js)
//   - updateProgress (progress_bar.js)
//   - displayTranslatedBatch (ui.js) // Reused for showing text
//   - formatString, formatTime (ui_helpers.js) // Added formatTime
//   - fetchTranslation (translation_api.js)
//   - concatenateUint8Arrays (audio_helpers.js) // NEW dependency
//   - cleanupTaskInstances (audio_helpers.js) // Existing dependency
// - Classes: AudioPipelineManager (audio_pipeline.js)
// - UI Elements: source-text, sl, sl-voice, tl[1-4]-container, tl[1-4], tl[1-4]-voice, output, stat-area, progress-container, progress-bar, progress-info, translation-finished-message, open-book-view-button, save-epub-button, reload-page-button
// - Globals: currentLanguage (main.js)

// Store translations globally within this module's scope for access across functions
let multiLangSentences = []; // Array to hold { original: "...", translations: { "lang": "...", ... } }
// Store the pipeline manager instance globally within this module
let multiLangPipelineManager = null;
let multiLangBaseFilename = "MultiLangAudiobook"; // Default filename

async function generateMultiLanguageAudio(sourceLang, sourceVoice, targetVoicesMap) {
    console.log("--- generateMultiLanguageAudio START ---");
    // Reset UI elements specifically for this flow
    document.getElementById('reload-page-button')?.classList.add('hide');
    document.getElementById('output').innerHTML = ''; // Clear previous output
    document.getElementById('stat-area')?.classList.add('hide');
    document.getElementById('translation-finished-message')?.classList.add('hide');
    document.getElementById('open-book-view-button')?.classList.add('hide');
    document.getElementById('save-epub-button')?.classList.add('hide');


    const sourceText = document.getElementById('source-text').value;
    const targetLangs = Object.keys(targetVoicesMap);

    if (targetLangs.length === 0) {
        alert(fetchTranslation('alertSelectTargetLang', currentLanguage));
        return;
    }

    // --- 1. Translation Phase ---
    console.log("Phase 1: Translation");
    const progressContainer = document.getElementById('progress-container');
    const progressBar = document.getElementById('progress-bar');
    const progressInfo = document.getElementById('progress-info');

    updateProgressTitle('translationProgressTitle');
    if (progressContainer) progressContainer.classList.remove('hide');
    if (progressInfo) progressInfo.classList.remove('hide');
    if (progressBar) {
        progressBar.style.width = '0%';
        progressBar.textContent = '0%';
        progressBar.style.backgroundColor = '';
    }

    // splitIntoSentences is from translation_utils.js
    const originalSentences = splitIntoSentences(sourceText);
    if (!originalSentences || originalSentences.length === 0) {
        alert(fetchTranslation('alertCouldNotSplit', currentLanguage));
        document.getElementById('reload-page-button')?.classList.remove('hide');
        return;
    }

    multiLangSentences = []; // Reset global array
    const totalSentencesToTranslate = originalSentences.length;
    let translatedSentencesCount = 0;
    const translationStartTime = Date.now();
    updateProgress(0, totalSentencesToTranslate, translationStartTime); // Initial call for translation progress

    console.log(`Translating ${originalSentences.length} sentences from ${sourceLang} to ${targetLangs.join(', ')}...`);

    try {
        // translateBatch is from translation_api.js
        const translationResult = await translateBatch(originalSentences, sourceLang, targetLangs, currentLanguage);

        if (translationResult && translationResult.translations) {
            for (let i = 0; i < originalSentences.length; i++) {
                const sentenceData = {
                    original: originalSentences[i],
                    translations: {}
                };
                for (const targetLang of targetLangs) {
                    if (translationResult.translations[targetLang] && translationResult.translations[targetLang][i]) {
                        sentenceData.translations[targetLang] = translationResult.translations[targetLang][i];
                    } else {
                        sentenceData.translations[targetLang] = fetchTranslation('translationError', currentLanguage);
                        console.warn(`Missing translation for sentence ${i} to lang ${targetLang}`);
                    }
                }
                multiLangSentences.push(sentenceData);
                translatedSentencesCount++;
                updateProgress(translatedSentencesCount, totalSentencesToTranslate, translationStartTime);
            }
            console.log("All sentences translated and stored in multiLangSentences.");
        } else {
            throw new Error("Translation result was invalid or missing translations map.");
        }
    } catch (error) {
        console.error("Error during batch translation:", error);
        alert(fetchTranslation('alertTranslationFailed', currentLanguage));
        if (progressContainer) progressContainer.classList.add('hide');
        if (progressInfo) progressInfo.classList.add('hide');
        document.getElementById('reload-page-button')?.classList.remove('hide');
        return;
    }

    // --- 2. Display Translated Sentences ---
    console.log("Phase 2: Displaying Translations");
    const bookContainer = document.getElementById('output');
    bookContainer.innerHTML = ''; // Ensure it's clear

    for (const sentenceData of multiLangSentences) {
        const displayBatch = [sentenceData.original];
        const displayTranslationsData = {};
        for (const lang of targetLangs) {
            displayTranslationsData[lang] = [sentenceData.translations[lang] || fetchTranslation('translationError', currentLanguage)];
        }
        // displayTranslatedBatch is from ui.js
        displayTranslatedBatch(displayBatch, displayTranslationsData, sourceLang, targetLangs);
        await sleep(5); // Small delay for UI update, especially with many sentences
    }

    document.getElementById('translation-finished-message')?.classList.remove('hide');
    if (progressBar) {
        progressBar.style.width = '100%';
        progressBar.textContent = '100%';
        progressBar.style.backgroundColor = '#28a745';
    }
    if (progressInfo) {
        const finishedText = fetchTranslation('statusFinishedExclaim', currentLanguage);
        const translatedText = fetchTranslation('translated', currentLanguage);
        progressInfo.innerHTML = `<span>${translatedText}: ${totalSentencesToTranslate} / ${totalSentencesToTranslate}</span> | <span>${finishedText}</span>`;
    }
    // Make book view available
    if (multiLangSentences.length > 0) {
        document.getElementById('open-book-view-button')?.classList.remove('hide');
    }


    // --- 3. Audio Generation Phase ---
    console.log("Phase 3: Audio Generation Setup");

    // Get audio settings (rate/pitch) for all languages involved
    const audioSettingsForTasks = {}; // Renamed to avoid confusion with pipeline's own audioSettings
    audioSettingsForTasks[sourceLang] = {
        rate: `${document.getElementById('sl-rate')?.value || 0}%`,
        pitch: `${document.getElementById('sl-pitch')?.value || 0}Hz`,
        volume: "+0%"
    };
    for (let i = 1; i <= 4; i++) {
        const langSelect = document.getElementById(`tl${i}`);
        const rateSlider = document.getElementById(`tl${i}-rate`);
        const pitchSlider = document.getElementById(`tl${i}-pitch`);
        if (langSelect && langSelect.value && rateSlider && pitchSlider) {
            const lang = langSelect.value;
            if (targetVoicesMap[lang]) {
                 audioSettingsForTasks[lang] = { // Use new name here
                    rate: `${rateSlider.value || 0}%`,
                    pitch: `${pitchSlider.value || 0}Hz`,
                    volume: "+0%"
                };
            }
        }
    }
    console.log("Audio Settings for Tasks:", audioSettingsForTasks);

    // 3.1 Prepare list of audio tasks
    const allAudioTasks = [];
    let finalIndexCounter = 0;

    for (let sentenceIndex = 0; sentenceIndex < multiLangSentences.length; sentenceIndex++) {
        const sentenceData = multiLangSentences[sentenceIndex];

        // Task for original sentence
        if (sentenceData.original && sentenceData.original.trim().length > 0) {
            allAudioTasks.push({
                text: sentenceData.original,
                voice: sourceVoice,
                rate: audioSettingsForTasks[sourceLang].rate, // Use new name
                pitch: audioSettingsForTasks[sourceLang].pitch, // Use new name
                volume: audioSettingsForTasks[sourceLang].volume, // Use new name
                lang: sourceLang,
                type: 'source',
                sentenceIndex: sentenceIndex,
                finalIndex: finalIndexCounter++
            });
        } else {
             console.warn(`Skipping empty original sentence at index ${sentenceIndex}`);
        }

        // Tasks for translated sentences
        for (const targetLang of targetLangs) {
            const translationText = sentenceData.translations[targetLang];
            if (translationText && translationText.trim().length > 0 && translationText !== fetchTranslation('translationError', currentLanguage)) {
                 allAudioTasks.push({
                    text: translationText,
                    voice: targetVoicesMap[targetLang],
                    rate: audioSettingsForTasks[targetLang].rate, // Use new name
                    pitch: audioSettingsForTasks[targetLang].pitch, // Use new name
                    volume: audioSettingsForTasks[targetLang].volume, // Use new name
                    lang: targetLang,
                    type: 'target',
                    sentenceIndex: sentenceIndex,
                    finalIndex: finalIndexCounter++
                });
            } else {
                 console.warn(`Skipping empty or error translation for lang ${targetLang} at sentence index ${sentenceIndex}`);
            }
        }
    }

    if (allAudioTasks.length === 0) {
        console.error("No valid audio tasks could be created.");
        alert(fetchTranslation('alertNoAudioTasks', currentLanguage)); // Add this key
        document.getElementById('reload-page-button')?.classList.remove('hide');
        return;
    }
    console.log(`Created ${allAudioTasks.length} audio tasks for generation.`);

    // 3.2 Reset UI for Audio Phase
    const statArea = document.getElementById('stat-area');
    // Progress bar elements are already defined (progressContainer, progressBar, progressInfo)
    // We will re-purpose them.

    document.getElementById('translation-finished-message')?.classList.add('hide');
    statArea?.classList.remove('hide');
    statArea.value = fetchTranslation('placeholderStatArea', currentLanguage);

    updateProgressTitle('audioGenerationProgressTitle');

    if (progressBar) {
        progressBar.style.width = '0%';
        progressBar.textContent = '0%';
        progressBar.style.backgroundColor = ''; // Reset color
    }
    if (progressInfo) {
        const processedText = fetchTranslation('statusProcessed', currentLanguage);
        const etaText = fetchTranslation('eta', currentLanguage);
        const calculatingText = fetchTranslation('statusCalculating', currentLanguage);
        progressInfo.innerHTML = `<span>${processedText}: 0 / ${allAudioTasks.length}</span> | <span>${etaText}: ${calculatingText}</span>`;
    }

    if (multiLangPipelineManager) {
        multiLangPipelineManager.clear();
    }

    const sourceTextArea = document.getElementById('source-text');
    const firstWords = sourceTextArea?.value.split(' ').slice(0, 3).join(' ') || `MultiLang_${Date.now()}`;
    const sanitizedFirstWords = firstWords.replace(/[^a-z0-9_]/gi, '_').toLowerCase(); // Allow underscore
    multiLangBaseFilename = sanitizedFirstWords.substring(0, 30) || "MultiLangAudiobook";
    console.log("Determined base filename for audio:", multiLangBaseFilename);


    // 3.3 Configure AudioPipelineManager
    const maxThreads = parseInt(document.querySelector('.max-threads')?.value || '10', 10);
    const pipelineConfig = {
        tasks: allAudioTasks,
        audioSettings: { // ADD THIS
            voice: sourceVoice, // Provide a placeholder/default voice
            // Rate and pitch are not strictly necessary here as tasks override them,
            // but can be included for completeness or if the manager might use them.
            // For now, just the voice is needed to pass the constructor check.
            // rate: "+0%",
            // pitch: "+0Hz",
        },
        concurrencyLimit: maxThreads,
        baseFilename: multiLangBaseFilename,
        statArea: statArea,
        onProgress: handleMultiLangAudioProgress,
        onComplete: handleMultiLangAudioComplete,
        onError: handleMultiLangAudioError
    };

    console.log("Creating and starting AudioPipelineManager for multi-language audio...");
    try {
        multiLangPipelineManager = new AudioPipelineManager(pipelineConfig);
        await sleep(50);
        multiLangPipelineManager.start();
        console.log("--- Multi-language audio pipeline STARTED ---");
    } catch (error) {
        console.error("Failed to create or start multi-language AudioPipelineManager:", error);
        const errorMsgTemplate = fetchTranslation('alertPipelineError', currentLanguage);
        handleMultiLangAudioError(formatString(errorMsgTemplate, error.message));
        document.getElementById('reload-page-button')?.classList.remove('hide');
    }
}


// --- Multi-Language Audio Pipeline Callbacks ---

function handleMultiLangAudioProgress(progressData) {
    const { processed, failed, total, etaSeconds } = progressData;
    const progressBar = document.getElementById('progress-bar');
    const progressInfo = document.getElementById('progress-info');

    if (total === 0) return;

    const completed = processed + failed;
    const percent = Math.round((completed / total) * 100);

    if (progressBar) {
        progressBar.style.width = percent + '%';
        progressBar.textContent = percent + '%';
    }

    if (progressInfo) {
        const calculatingText = fetchTranslation('statusCalculating', currentLanguage);
        const etaString = (etaSeconds === null || !isFinite(etaSeconds))
            ? calculatingText
            : formatTime(etaSeconds * 1000);

        const processedText = fetchTranslation('statusProcessed', currentLanguage);
        const failedText = fetchTranslation('statusFailedLabel', currentLanguage);
        const etaText = fetchTranslation('eta', currentLanguage);

        progressInfo.innerHTML = `
            <span>${processedText}: ${processed} / ${total}</span> |
            ${failed > 0 ? `<span style="color: red;">${failedText} ${failed}</span> |` : ''}
            <span>${etaText}: ${etaString}</span>
        `;
    }
}

async function handleMultiLangAudioComplete(completionData) {
    const { processed, failed, total, results } = completionData;
    console.log(`Multi-Language Pipeline finished. Success: ${processed}, Failed: ${failed}, Total: ${total}`);

    const statArea = document.getElementById('stat-area');
    const progressInfo = document.getElementById('progress-info');
    const progressBar = document.getElementById('progress-bar');
    const reloadButton = document.getElementById('reload-page-button');

    if (failed > 0 || processed === 0) {
        const errorMsgTemplate = fetchTranslation('alertAudioGenerationFailed', currentLanguage);
        const errorMsg = formatString(errorMsgTemplate, failed);
        console.error(errorMsg);

        let finalMessage = `\n--- ${fetchTranslation('audioGenFailedMessage', currentLanguage)} ---`;
        const detailsTemplate = fetchTranslation('audioGenFailedDetails', currentLanguage);
        finalMessage += `\n${formatString(detailsTemplate, failed)}`;
        finalMessage += `\n${fetchTranslation('audioGenFailedNoOutput', currentLanguage)}`;
        finalMessage += "\n---";

        if (statArea) statArea.value += finalMessage;
        if (progressInfo) {
            const processedText = fetchTranslation('statusProcessed', currentLanguage);
            const failedText = fetchTranslation('statusFailedLabel', currentLanguage);
            const failedExclaimText = fetchTranslation('statusFailedExclaim', currentLanguage);
            progressInfo.innerHTML = `
                <span>${processedText}: ${processed} / ${total}</span> |
                <span style="color: red;">${failedText} ${failed}</span> |
                <span style="color: red;">${failedExclaimText}</span>
            `;
        }
        if (progressBar) {
            const failedProgressTemplate = fetchTranslation('statusFailedProgress', currentLanguage);
            progressBar.style.backgroundColor = '#dc3545';
            progressBar.textContent = formatString(failedProgressTemplate, failed, total);
        }

        console.log("Cleaning up task instances due to failure...");
        cleanupTaskInstances(results);
        multiLangPipelineManager = null;
        reloadButton?.classList.remove('hide');
        return;
    }

    let finalMessage = `\n--- ${fetchTranslation('audioGenSuccessMessage', currentLanguage)} ---`;
    const successDetailsTemplate = fetchTranslation('audioGenSuccessDetails', currentLanguage);
    finalMessage += `\n${formatString(successDetailsTemplate, processed, total)}`;
    finalMessage += `\n--- ${fetchTranslation('statusMergingAudio', currentLanguage)} ---`; // Add merging message KEY

    if (statArea) statArea.value += finalMessage;
    if (progressInfo) {
        const processedText = fetchTranslation('statusProcessed', currentLanguage);
        const finishedExclaimText = fetchTranslation('statusFinishedExclaim', currentLanguage);
        progressInfo.innerHTML = `
            <span>${processedText}: ${processed} / ${total}</span> |
            <span>${finishedExclaimText}</span>
        `;
    }
    if (progressBar) {
        progressBar.style.width = '100%';
        progressBar.textContent = '100%';
        progressBar.style.backgroundColor = '#28a745';
    }

    try {
        console.log("Filtering and sorting successful results for final audio...");
        const successfulResults = results.filter(instance =>
            instance && instance.mp3_saved && instance.my_uint8Array && instance.my_uint8Array.length > 0 && typeof instance.finalIndex === 'number'
        );
        successfulResults.sort((a, b) => a.finalIndex - b.finalIndex);

        if (successfulResults.length !== processed) {
             console.warn(`Mismatch between processed count (${processed}) and filterable/sortable results (${successfulResults.length}).`);
        }

        if (successfulResults.length > 0) {
            console.log(`Concatenating ${successfulResults.length} audio parts...`);
            const audioDataArrays = successfulResults.map(instance => instance.my_uint8Array);

            // concatenateUint8Arrays is from audio_helpers.js
            const combinedAudioData = concatenateUint8Arrays(audioDataArrays);
            const finalFilename = `${multiLangBaseFilename}.mp3`;
            console.log(`Saving combined audio as ${finalFilename}`);
            const audioBlob = new Blob([combinedAudioData.buffer], { type: 'audio/mpeg' });
            saveAs(audioBlob, finalFilename); // FileSaver.js

            if (statArea) {
                statArea.value += `\n--- ${fetchTranslation('statusCombinedAudioSaved', currentLanguage, finalFilename)} ---`; // KEY
                statArea.scrollTop = statArea.scrollHeight;
            }
        } else {
            console.error("No successful audio parts found to merge.");
             if (statArea) statArea.value += `\n--- ${fetchTranslation('alertNoAudioPartsToMerge', currentLanguage)} ---`; // KEY
             if (progressBar) progressBar.style.backgroundColor = '#dc3545';
             if (progressInfo) progressInfo.innerHTML += ` | <span style="color: red;">${fetchTranslation('statusMergeError', currentLanguage)}</span>`; // KEY
        }
    } catch (error) {
        console.error("Error during final audio merging or saving:", error);
        if (statArea) {
            statArea.value += `\n--- ${fetchTranslation('alertMergeSaveError', currentLanguage, error.message)} ---`; // KEY
            statArea.scrollTop = statArea.scrollHeight;
        }
        if (progressBar) progressBar.style.backgroundColor = '#dc3545';
        if (progressInfo) progressInfo.innerHTML += ` | <span style="color: red;">${fetchTranslation('statusSaveError', currentLanguage)}</span>`; // KEY
    } finally {
        console.log("Cleaning up task instances after completion attempt...");
        cleanupTaskInstances(results);
        multiLangPipelineManager = null;
        reloadButton?.classList.remove('hide');
    }
}

function handleMultiLangAudioError(errorMessage) {
    console.error("Multi-Language Audio Pipeline Error:", errorMessage);
    const statArea = document.getElementById('stat-area');
    const progressInfo = document.getElementById('progress-info');
    const progressBar = document.getElementById('progress-bar');
    const reloadButton = document.getElementById('reload-page-button');

    const errorText = `\n--- ${fetchTranslation('pipelineErrorMessage', currentLanguage, errorMessage)} ---`;

    if (statArea) {
        statArea.classList.remove('hide');
        statArea.value += errorText;
        statArea.scrollTop = statArea.scrollHeight;
    }
    if (progressInfo) {
        const pipelineErrorLabel = fetchTranslation('pipelineErrorLabel', currentLanguage);
        progressInfo.innerHTML += ` | <span style="color: red;">${pipelineErrorLabel}</span>`;
    }
    if (progressBar) {
        progressBar.style.backgroundColor = '#dc3545';
        progressBar.textContent = fetchTranslation('statusError', currentLanguage);
    }
    alert(errorMessage);

    if (multiLangPipelineManager) {
        multiLangPipelineManager.clear();
        multiLangPipelineManager = null;
    }
    reloadButton?.classList.remove('hide');
}

// Add new translation keys
// (This should ideally be added to ui_translations.js)
if (typeof translations !== 'undefined' && translations.en) {
    translations.en.audioGenerationProgressTitle = "Audio Generation Progress";
    translations.en.alertSelectTargetLang = "Please select at least one target language for multi-language audio.";
    translations.en.translationProgressTitle = "Translation Progress";
    translations.en.alertTranslationFailed = "The translation process failed. Please check the log and try again.";
    translations.en.alertNoAudioTasks = "No audio tasks could be created. This might be due to empty text or translation errors.";
    translations.en.statusMergingAudio = "Merging final audio file...";
    translations.en.statusCombinedAudioSaved = "Combined audio saved as {0}";
    translations.en.alertNoAudioPartsToMerge = "Error: No successful audio parts found to merge.";
    translations.en.statusMergeError = "Merge Error!";
    translations.en.alertMergeSaveError = "Error during final merge/save: {0}";
    translations.en.statusSaveError = "Save Error!";

} else {
    console.error("Could not add new keys to translations object. 'translations' or 'translations.en' is undefined.");
}