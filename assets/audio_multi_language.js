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

// Constants for translation batching
const GOOGLE_TRANSLATE_CHARACTER_LIMIT = 1500; // REDUCED for safe GET request URL length
const API_CALL_DELAY_MIN_MS = 200;
const API_CALL_DELAY_MAX_MS = 500;


async function generateMultiLanguageAudio(sourceLang, sourceVoice, targets) {
    console.log("--- generateMultiLanguageAudio START ---");
    // Reset UI elements specifically for this flow
    document.getElementById('reload-page-button')?.classList.add('hide');
    const bookContainer = document.getElementById('output'); // Get bookContainer early
    bookContainer.innerHTML = ''; // Clear previous output
    document.getElementById('stat-area')?.classList.add('hide');
    document.getElementById('translation-finished-message')?.classList.add('hide');
    document.getElementById('open-book-view-button')?.classList.add('hide');
    document.getElementById('save-epub-button')?.classList.add('hide');


    const sourceText = document.getElementById('source-text').value;
    const targetLangsInSequence = targets.map(t => t.lang);

    if (targetLangsInSequence.length === 0) {
        alert(fetchTranslation('alertSelectTargetLang', currentLanguage));
        return;
    }

    // --- 1. Translation Phase (with concurrent display) ---
    console.log("Phase 1: Translation & Immediate Display");
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

    console.log(`Source text split into ${originalSentences.length} sentences.`);

    // --- Translation Optimization ---
    // Identify unique target languages that actually need translation (not source, no repeats)
    const uniqueTargetLangsToTranslate = [...new Set(targetLangsInSequence)].filter(lang => lang !== sourceLang);
    console.log("Unique languages to translate:", uniqueTargetLangsToTranslate);

    // Create sub-batches from originalSentences for the API calls
    const sentenceSubBatches = createTranslationBatches(originalSentences, GOOGLE_TRANSLATE_CHARACTER_LIMIT);
    console.log(`Created ${sentenceSubBatches.length} sub-batches for translation API calls.`);

    let sentenceCursor = 0; // Keep track of which original sentence we're on

    try {
        if (uniqueTargetLangsToTranslate.length > 0) {
        for (let batchIndex = 0; batchIndex < sentenceSubBatches.length; batchIndex++) {
            const currentSentenceSubBatch = sentenceSubBatches[batchIndex];
            if (currentSentenceSubBatch.length === 0) continue;

                console.log(`Translating sub-batch ${batchIndex + 1}/${sentenceSubBatches.length} from ${sourceLang} to ${uniqueTargetLangsToTranslate.join(', ')}...`);

            const subBatchTranslationResult = await translateBatch(currentSentenceSubBatch, sourceLang, uniqueTargetLangsToTranslate, currentLanguage);

                // --- Process and display this batch immediately ---
                for (let i = 0; i < currentSentenceSubBatch.length; i++) {
                    const originalSentenceText = currentSentenceSubBatch[i];
                    const sentenceData = {
                        original: originalSentenceText,
                        translations: {}
                    };

                    // Populate translations for this sentence
                    for (const lang of uniqueTargetLangsToTranslate) {
                        if (subBatchTranslationResult.translations && subBatchTranslationResult.translations[lang]) {
                            sentenceData.translations[lang] = subBatchTranslationResult.translations[lang][i];
                        } else {
                            sentenceData.translations[lang] = fetchTranslation('translationError', currentLanguage);
                        }
                    }

                    // Handle languages that are the same as source (no translation needed)
                    for (const lang of targetLangsInSequence) {
                        if (lang === sourceLang) {
                            sentenceData.translations[lang] = originalSentenceText;
                        }
                    }
                    multiLangSentences.push(sentenceData);

                    // --- IMMEDIATE DISPLAY ---
                    // Create a display object for just this sentence
                    const displayTargets = {};
                    targets.forEach(target => {
                        const lang = target.lang;
                        if (!displayTargets[lang]) {
                            displayTargets[lang] = [];
                        }
                        displayTargets[lang].push(sentenceData.translations[lang] || fetchTranslation('translationError', currentLanguage));
                    });

                    displayTranslatedBatch([originalSentenceText], displayTargets, sourceLang, Object.keys(displayTargets));
                    await sleep(5); // Small delay for UI update
                    }

                // Update progress based on the number of original sentences processed in the batch
                translatedSentencesCount += currentSentenceSubBatch.length;
                updateProgress(translatedSentencesCount, totalSentencesToTranslate, translationStartTime);

                if (batchIndex < sentenceSubBatches.length - 1) {
                    await sleep(API_CALL_DELAY_MIN_MS, API_CALL_DELAY_MAX_MS);
                }
            }
        } else {
            // Handle case where no translation is needed (e.g., source only, or fr -> fr)
            for (const originalSentenceText of originalSentences) {
                    const sentenceData = {
                        original: originalSentenceText,
                        translations: {}
                    };
                // Just copy the source text for all targets
            for (const lang of targetLangsInSequence) {
                    sentenceData.translations[lang] = originalSentenceText;
            }
            multiLangSentences.push(sentenceData);

            // Display this sentence immediately. Create a temporary display object for target languages
            // to conform to displayTranslatedBatch's expected format.
             const displayTargets = {};
             targets.forEach(target => {
                    displayTargets[target.lang] = [originalSentenceText];
             });

            displayTranslatedBatch([originalSentenceText], displayTargets, sourceLang, Object.keys(displayTargets));
                await sleep(5);
            }
            updateProgress(totalSentencesToTranslate, totalSentencesToTranslate, translationStartTime);
        }

        console.log("All sentences translated and displayed. Total in multiLangSentences:", multiLangSentences.length);

    } catch (error) {
        console.error("Error during batched translation process:", error);
        alert(fetchTranslation('alertTranslationFailed', currentLanguage));
        if (progressContainer) progressContainer.classList.add('hide');
        if (progressInfo) progressInfo.classList.add('hide');
        document.getElementById('reload-page-button')?.classList.remove('hide');
        return;
    }
    
    // --- Translation UI Finalization ---
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

    // 3.1 Get Audio Settings
    const sourceSettings = {
        rate: `${document.getElementById('sl-rate')?.value || 0}%`,
        pitch: `${document.getElementById('sl-pitch')?.value || 0}Hz`,
        volume: "+0%",
        voice: sourceVoice
    };

    const targetSettings = {};
    targets.forEach(target => {
        const rateSlider = document.getElementById(`${target.id}-rate`);
        const pitchSlider = document.getElementById(`${target.id}-pitch`);
        targetSettings[target.id] = {
            rate: `${rateSlider?.value || 0}%`,
            pitch: `${pitchSlider?.value || 0}Hz`,
            volume: "+0%",
            voice: target.voice,
            lang: target.lang
                };
    });
    console.log("Audio Settings For All Slots:", { source: sourceSettings, targets: targetSettings });

    // 3.2 Prepare a list of UNIQUE audio generation jobs
    const uniqueAudioJobs = new Map();
    const audioSequenceForAssembly = []; // Will store the keys in playback order for each sentence

    for (const sentenceData of multiLangSentences) {
        const sentenceAudioSequence = []; // Keys for this sentence in order

        // Job for the original (source) sentence
        if (sentenceData.original && sentenceData.original.trim().length > 0) {
            const text = sentenceData.original;
            // Key includes text, voice, and prosody for true uniqueness
            const key = `${sourceLang}|${text}|${sourceSettings.voice}|${sourceSettings.rate}|${sourceSettings.pitch}`;

            if (!uniqueAudioJobs.has(key)) {
                uniqueAudioJobs.set(key, {
                    key: key, // Store key for mapping results
                    text: text,
                    voice: sourceSettings.voice,
                    rate: sourceSettings.rate,
                    pitch: sourceSettings.pitch,
                    volume: sourceSettings.volume,
                lang: sourceLang,
            });
            }
            sentenceAudioSequence.push(key);
        }

        // Jobs for translated sentences, in the specified sequence
        for (const target of targets) {
            // `target` is { lang: 'en', voice: '...', id: 'tl1' }
            const translationText = sentenceData.translations[target.lang];
            const settings = targetSettings[target.id]; // Get settings for this specific slot (tl1, tl2, etc.)

            if (translationText && translationText.trim().length > 0 && translationText !== fetchTranslation('translationError', currentLanguage)) {
                const key = `${target.lang}|${translationText}|${settings.voice}|${settings.rate}|${settings.pitch}`;

                if (!uniqueAudioJobs.has(key)) {
                    uniqueAudioJobs.set(key, {
                        key: key,
                    text: translationText,
                        voice: settings.voice,
                        rate: settings.rate,
                        pitch: settings.pitch,
                        volume: settings.volume,
                        lang: target.lang,
                    });
                }
                sentenceAudioSequence.push(key);
            }
        }
        audioSequenceForAssembly.push(sentenceAudioSequence);
    }

    const allAudioTasks = Array.from(uniqueAudioJobs.values());

    if (allAudioTasks.length === 0) {
        console.error("No valid audio tasks could be created.");
        alert(fetchTranslation('alertNoAudioTasks', currentLanguage)); // Add this key
        document.getElementById('reload-page-button')?.classList.remove('hide');
        return;
    }
    console.log(`Created ${allAudioTasks.length} unique audio tasks for generation.`);
    console.log("Audio sequence for assembly has been mapped for all sentences.");

    // 3.3 Reset UI for Audio Phase & Configure Pipeline
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

    // 3.3 Configure and Start AudioPipelineManager
    const maxThreads = parseInt(document.querySelector('.max-threads')?.value || '10', 10);
    const pipelineConfig = {
        tasks: allAudioTasks,
        audioSettings: { voice: sourceVoice }, // Restored: Provide a default/fallback voice to satisfy the constructor check.
        concurrencyLimit: maxThreads,
        baseFilename: multiLangBaseFilename,
        statArea: statArea,
        onProgress: handleMultiLangAudioProgress,
        onComplete: (completionData) => handleMultiLangAudioComplete(completionData, audioSequenceForAssembly),
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
        const etaString = (etaSeconds === null || !isFinite(etaSeconds)) ?
            calculatingText :
            formatTime(etaSeconds * 1000);
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

async function handleMultiLangAudioComplete(completionData, audioSequenceForAssembly) {
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
        console.log("Building audio cache from successful results...");
        const audioCache = new Map();
        for (const instance of results) {
            if (instance && instance.mp3_saved && instance.my_uint8Array?.length > 0 && instance.originalTask) {
                // The key was stored on the originalTask object.
                audioCache.set(instance.originalTask.key, instance.my_uint8Array);
            }
        }
        console.log(`Audio cache built with ${audioCache.size} entries.`);

        if (audioCache.size > 0) {
            console.log("Assembling final audio file from cache using predefined sequence...");
            const finalAudioParts = [];
            for (const sentenceSequence of audioSequenceForAssembly) {
                for (const key of sentenceSequence) {
                    if (audioCache.has(key)) {
                        finalAudioParts.push(audioCache.get(key));
                    } else {
                        console.warn(`Audio part not found in cache for key: ${key}`);
                    }
                }
            }

            console.log(`Concatenating ${finalAudioParts.length} audio parts...`);
            const combinedAudioData = concatenateUint8Arrays(finalAudioParts);
            const finalFilename = `${multiLangBaseFilename}.mp3`;
            console.log(`Saving combined audio as ${finalFilename}`);
            const audioBlob = new Blob([combinedAudioData.buffer], { type: 'audio/mpeg' });
            saveAs(audioBlob, finalFilename); // FileSaver.js

            if (statArea) {
                const message = formatString(fetchTranslation('statusCombinedAudioSaved', currentLanguage), finalFilename);
                statArea.value += `\n--- ${message} ---`;
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
            const message = formatString(fetchTranslation('alertMergeSaveError', currentLanguage), error.message);
            statArea.value += `\n--- ${message} ---`;
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

    const errorText = `\n--- ${formatString(fetchTranslation('pipelineErrorMessage', currentLanguage), errorMessage)} ---`;

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
    translations.en.statusMergingAudio = "Assembling and saving final audio file...";
    translations.en.statusCombinedAudioSaved = "Combined audio saved as {0}";
    translations.en.alertNoAudioPartsToMerge = "Error: No successful audio parts found to merge.";
    translations.en.statusMergeError = "Merge Error!";
    translations.en.alertMergeSaveError = "Error during final merge/save: {0}";
    translations.en.statusSaveError = "Save Error!";

} else {
    console.error("Could not add new keys to translations object. 'translations' or 'translations.en' is undefined.");
}