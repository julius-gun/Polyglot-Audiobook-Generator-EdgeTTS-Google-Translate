// Contains logic for generating multi-language audiobooks.

// Depends on:
// - Functions:
//   - detectLanguage, translateBatch (translation_api.js)
//   - splitIntoSentences, mergeShortSentences, createTranslationBatches, sleep (translation_utils.js)
//   - updateProgress (progress_bar.js)
//   - displayTranslatedBatch (ui.js) // Reused for showing text
//   - formatString (ui_helpers.js)
//   - fetchTranslation (translation_api.js)
// - Classes: AudioPipelineManager (audio_pipeline.js) // Will be needed later
// - UI Elements: source-text, sl, sl-voice, tl[1-4]-container, tl[1-4], tl[1-4]-voice, output, stat-area, progress-container, progress-bar, progress-info, translation-finished-message, open-book-view-button, save-epub-button, reload-page-button
// - Globals: currentLanguage (main.js)

// Store translations globally within this module's scope for access across functions
let multiLangSentences = []; // Array to hold { original: "...", translations: { "lang": "...", ... } }
// Store the pipeline manager instance globally within this module
let multiLangPipelineManager = null;
let multiLangBaseFilename = "MultiLangAudiobook"; // Default filename

async function generateMultiLanguageAudio(sourceLang, sourceVoice, targetVoices) {
    console.log("--- generateMultiLanguageAudio START ---");

    // 1. Prepare list of audio tasks
    const allAudioTasks = [];
    const targetLangs = Object.keys(targetVoices);
    let finalIndexCounter = 0;

    // Get audio settings (rate/pitch) for all languages involved
    const audioSettings = {};
    audioSettings[sourceLang] = {
        rate: `${document.getElementById('sl-rate')?.value || 0}%`,
        pitch: `${document.getElementById('sl-pitch')?.value || 0}Hz`,
        volume: "+0%" // Assuming default volume for now
    };
    for (let i = 1; i <= 4; i++) {
    const langSelect = document.getElementById(`tl${i}`);
    const rateSlider = document.getElementById(`tl${i}-rate`);
    const pitchSlider = document.getElementById(`tl${i}-pitch`);
    if (langSelect && langSelect.value && rateSlider && pitchSlider) {
        const lang = langSelect.value;
        if (targetVoices[lang]) { // Only get settings for selected target languages
             audioSettings[lang] = {
                rate: `${rateSlider.value || 0}%`,
                pitch: `${pitchSlider.value || 0}Hz`,
                volume: "+0%"
            };
        }
    }
}
console.log("Audio Settings:", audioSettings);


for (let sentenceIndex = 0; sentenceIndex < multiLangSentences.length; sentenceIndex++) {
    const sentenceData = multiLangSentences[sentenceIndex];

    // Task for original sentence
    if (sentenceData.original && sentenceData.original.trim().length > 0) {
        allAudioTasks.push({
            text: sentenceData.original,
            voice: sourceVoice,
            rate: audioSettings[sourceLang].rate,
            pitch: audioSettings[sourceLang].pitch,
            volume: audioSettings[sourceLang].volume,
            lang: sourceLang, // Store lang for reference
            type: 'source', // Mark type
            sentenceIndex: sentenceIndex, // Original sentence index
            finalIndex: finalIndexCounter++ // Final concatenation order index
        });
    } else {
         console.warn(`Skipping empty original sentence at index ${sentenceIndex}`);
    }


    // Tasks for translated sentences
    for (const targetLang of targetLangs) {
        const translationText = sentenceData.translations[targetLang];
        // Check if translation exists and is not an error message
        if (translationText && translationText.trim().length > 0 && translationText !== fetchTranslation('translationError', currentLanguage)) {
             allAudioTasks.push({
                text: translationText,
                voice: targetVoices[targetLang],
                rate: audioSettings[targetLang].rate,
                pitch: audioSettings[targetLang].pitch,
                volume: audioSettings[targetLang].volume,
                lang: targetLang,
                type: 'target',
                sentenceIndex: sentenceIndex,
                finalIndex: finalIndexCounter++
            });
        } else {
             console.warn(`Skipping empty or error translation for lang ${targetLang} at sentence index ${sentenceIndex}`);
             // Increment counter even for skipped optional parts to maintain relative order?
             // No, only increment for tasks actually added.
        }
    }
}

if (allAudioTasks.length === 0) {
    console.error("No valid audio tasks could be created.");
    alert("Error: No audio could be generated (perhaps all sentences were empty or translations failed?).");
    // Reset UI? Show reload button?
    document.getElementById('reload-page-button')?.classList.remove('hide');
    return;
}

console.log(`Created ${allAudioTasks.length} audio tasks.`);
// console.log("Sample Task:", allAudioTasks[0]); // For debugging

// 2. Reset UI for Audio Phase
const statArea = document.getElementById('stat-area');
const progressContainer = document.getElementById('progress-container');
const progressBar = document.getElementById('progress-bar');
const progressInfo = document.getElementById('progress-info');
const translationFinishedMessage = document.getElementById('translation-finished-message');

translationFinishedMessage?.classList.add('hide'); // Hide translation message
statArea?.classList.remove('hide'); // Show status area for detailed logs
statArea.value = fetchTranslation('placeholderStatArea', currentLanguage); // Set placeholder

// Update progress title (using new function in ui.js)
updateProgressTitle('audioGenerationProgressTitle'); // Need to add this key to translations

// Reset progress bar/info for audio phase
progressContainer?.classList.remove('hide');
progressInfo?.classList.remove('hide');
if (progressBar) {
    progressBar.style.width = '0%';
    progressBar.textContent = '0%';
    progressBar.style.backgroundColor = ''; // Reset color
}
if (progressInfo) {
    // Update labels for audio generation
    const processedText = fetchTranslation('statusProcessed', currentLanguage);
    const etaText = fetchTranslation('eta', currentLanguage);
    const calculatingText = fetchTranslation('statusCalculating', currentLanguage);
    progressInfo.innerHTML = `<span>${processedText}: 0 / ${allAudioTasks.length}</span> | <span>${etaText}: ${calculatingText}</span>`;
}

// Clear previous pipeline if exists
if (multiLangPipelineManager) {
    multiLangPipelineManager.clear();
}

// Determine base filename
const sourceTextArea = document.getElementById('source-text');
const firstWords = sourceTextArea?.value.split(' ').slice(0, 5).join(' ') || `MultiLang_${Date.now()}`;
const sanitizedFirstWords = firstWords.replace(/[^a-z0-9]/gi, '_').toLowerCase();
multiLangBaseFilename = sanitizedFirstWords.substring(0, 50) || "MultiLangAudiobook";
console.log("Determined base filename for audio:", multiLangBaseFilename);


// 3. Configure AudioPipelineManager
const maxThreads = parseInt(document.querySelector('.max-threads')?.value || '10', 10);
const pipelineConfig = {
    tasks: allAudioTasks, // Pass the array of task objects
    // audioSettings: {}, // Manager's audioSettings are ignored (overridden by task)
    concurrencyLimit: maxThreads,
    baseFilename: multiLangBaseFilename, // For context, not direct use in task creation now
    statArea: statArea,
    onProgress: handleMultiLangAudioProgress, // Specific progress handler
    onComplete: handleMultiLangAudioComplete, // Specific completion handler
    onError: handleMultiLangAudioError      // Specific error handler
    // retrySettings can be added if needed, defaults are used otherwise
};

console.log("Creating and starting AudioPipelineManager for multi-language audio...");
try {
    multiLangPipelineManager = new AudioPipelineManager(pipelineConfig);
    await sleep(50); // Brief delay for UI
    multiLangPipelineManager.start();
    console.log("--- Multi-language audio pipeline STARTED ---");
} catch (error) {
    console.error("Failed to create or start multi-language AudioPipelineManager:", error);
    const errorMsgTemplate = fetchTranslation('alertPipelineError', currentLanguage);
    handleMultiLangAudioError(formatString(errorMsgTemplate, error.message));
    // Reset UI?
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
        : formatTime(etaSeconds * 1000); // formatTime is in ui_helpers.js

    const processedText = fetchTranslation('statusProcessed', currentLanguage);
    const failedText = fetchTranslation('statusFailedLabel', currentLanguage);
    const etaText = fetchTranslation('eta', currentLanguage);

    // Update progress info content for audio phase
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

// --- Handle Failures ---
if (failed > 0 || processed === 0) {
    const errorMsgTemplate = fetchTranslation('alertAudioGenerationFailed', currentLanguage);
    const errorMsg = formatString(errorMsgTemplate, failed);
    console.error(errorMsg);

    let finalMessage = `\n--- ${fetchTranslation('audioGenFailedMessage', currentLanguage)} ---`;
    const detailsTemplate = fetchTranslation('audioGenFailedDetails', currentLanguage);
    finalMessage += `\n${formatString(detailsTemplate, failed)}`;
    finalMessage += `\n${fetchTranslation('audioGenFailedNoOutput', currentLanguage)}`;
    finalMessage += "\n---";

    if (statArea) {
        statArea.value += finalMessage;
        statArea.scrollTop = statArea.scrollHeight;
    }
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
    cleanupTaskInstances(results); // cleanupTaskInstances is in audio_helpers.js
    multiLangPipelineManager = null;
    reloadButton?.classList.remove('hide'); // Show reload button on failure
    return;
}

// --- Handle Success ---
let finalMessage = `\n--- ${fetchTranslation('audioGenSuccessMessage', currentLanguage)} ---`;
const successDetailsTemplate = fetchTranslation('audioGenSuccessDetails', currentLanguage);
finalMessage += formatString(successDetailsTemplate, processed, total);
finalMessage += "\n--- Merging final audio file... ---"; // Add merging message

if (statArea) {
    statArea.value += finalMessage;
    statArea.scrollTop = statArea.scrollHeight;
}
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

// --- Merge and Save Audio ---
try {
    console.log("Filtering and sorting successful results...");
    // Filter successful results AND ensure they have the finalIndex property
    const successfulResults = results.filter(instance =>
        instance && instance.mp3_saved && instance.my_uint8Array && instance.my_uint8Array.length > 0 && typeof instance.finalIndex === 'number'
    );

    // Sort based on the finalIndex assigned during task creation
    successfulResults.sort((a, b) => a.finalIndex - b.finalIndex);

    if (successfulResults.length !== processed) {
         console.warn(`Mismatch between processed count (${processed}) and filterable/sortable results (${successfulResults.length}). Some results might be missing 'finalIndex'.`);
         // Proceeding with potentially incomplete audio.
    }

    if (successfulResults.length > 0) {
        console.log(`Concatenating ${successfulResults.length} audio parts...`);
        const audioDataArrays = successfulResults.map(instance => instance.my_uint8Array);

        // concatenateUint8Arrays is defined in audio_helpers.js
        const combinedAudioData = concatenateUint8Arrays(audioDataArrays);

        const finalFilename = `${multiLangBaseFilename}.mp3`;
        console.log(`Saving combined audio as ${finalFilename}`);
        const audioBlob = new Blob([combinedAudioData.buffer], { type: 'audio/mpeg' });

        // saveAs is from FileSaver.js
        saveAs(audioBlob, finalFilename);

        if (statArea) {
            statArea.value += `\n--- Combined audio saved as ${finalFilename} ---`;
            statArea.scrollTop = statArea.scrollHeight;
        }
    } else {
        console.error("No successful audio parts found to merge after pipeline completion.");
         if (statArea) {
            statArea.value += `\n--- Error: No successful audio parts found to merge. ---`;
            statArea.scrollTop = statArea.scrollHeight;
        }
         // Treat as failure? Update progress bar/info?
         if (progressBar) progressBar.style.backgroundColor = '#dc3545';
         if (progressInfo) progressInfo.innerHTML += ` | <span style="color: red;">Merge Error!</span>`;
    }

} catch (error) {
    console.error("Error during final audio merging or saving:", error);
    if (statArea) {
        statArea.value += `\n--- Error during final merge/save: ${error.message} ---`;
        statArea.scrollTop = statArea.scrollHeight;
    }
    // Treat as failure? Update progress bar/info?
    if (progressBar) progressBar.style.backgroundColor = '#dc3545';
    if (progressInfo) progressInfo.innerHTML += ` | <span style="color: red;">Save Error!</span>`;
} finally {
    // --- Cleanup ---
    console.log("Cleaning up task instances after completion attempt...");
    cleanupTaskInstances(results); // Clean up all original results
    multiLangPipelineManager = null;
    reloadButton?.classList.remove('hide'); // Show reload button after completion
}
}

function handleMultiLangAudioError(errorMessage) {
console.error("Multi-Language Audio Pipeline Error:", errorMessage);
const statArea = document.getElementById('stat-area');
const progressInfo = document.getElementById('progress-info');
const progressBar = document.getElementById('progress-bar');
const reloadButton = document.getElementById('reload-page-button');

const errorText = `\n--- ${fetchTranslation('pipelineErrorMessage', currentLanguage, errorMessage)} ---`; // Use key

if (statArea) {
    statArea.classList.remove('hide'); // Ensure visible
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
alert(errorMessage); // Show the raw error message

// Clean up if pipeline manager exists
if (multiLangPipelineManager) {
    multiLangPipelineManager.clear();
    multiLangPipelineManager = null;
}
reloadButton?.classList.remove('hide'); // Show reload button on error
}

// Add the new translation key
// (This should ideally be added to ui_translations.js, but adding here for completeness)
if (typeof translations !== 'undefined' && translations.en) {
translations.en.audioGenerationProgressTitle = "Audio Generation Progress";
// Add translations for other languages if needed
// translations.ru.audioGenerationProgressTitle = "Прогресс генерации аудио";
} else {
console.error("Could not add 'audioGenerationProgressTitle' key to translations object.");
}