// Contains logic for generating single-language audiobooks using AudioPipelineManager.

// Depends on:
// - Functions:
//   - splitIntoSentences, sleep (translation_utils.js)
//   - formatTime (ui_helpers.js)
//   - saveAs (FileSaver.js - loaded globally)
//   - saveAsZip_Pipeline, cleanupTaskInstances (audio_helpers.js) // <-- Added dependencies
//   - formatString (assumed helper)
//   - fetchTranslation (translation_api.js) // Added dependency
// - Classes: AudioPipelineManager (audio_pipeline.js)
// - UI Elements: source-text, sl-voice, sl-rate, sl-pitch, max-threads, mergefiles,
//                stat-area, progress-container, progress-bar, progress-info,
//                output, open-book-view-button, save-epub-button, translation-finished-message,
//                reload-page-button, advanced-audio-settings
// - Globals: translations, currentLanguage

// --- Configuration ---
const TARGET_CHUNK_LENGTH = 3200; // Target character length for audio chunks
const ZIP_DOWNLOAD_THRESHOLD = 10; // Download as ZIP if more than this many individual files requested

// --- State ---
let currentPipelineManager = null; // Holds the active pipeline instance
let currentBaseFilename = "Audiobook"; // Store filename for access in callbacks
let currentMergeSettings = { enabled: false, chunkSize: Infinity }; // Store merge settings

// --- Text Chunking ---
/**
 * Splits text into sentences and then combines them into larger chunks
 * suitable for TTS processing, aiming for a target character length.
 * @param {string} text The input text.
 * @param {number} targetLength The desired maximum length for each chunk.
 * @returns {string[]} An array of text chunks.
 */
function chunkTextForAudio(text, targetLength) {
    // splitIntoSentences is defined in translation_utils.js
    const sentences = splitIntoSentences(text);
    if (!sentences || sentences.length === 0) {
        return [];
    }

    const chunks = [];
    let currentChunk = "";

    for (let i = 0; i < sentences.length; i++) {
        const sentence = sentences[i].trim(); // Trim whitespace from sentence
        if (!sentence) continue; // Skip empty sentences

        const separator = (currentChunk.length > 0) ? " " : ""; // Add space between sentences

        // Check if adding the next sentence exceeds the target length
        if (currentChunk.length > 0 && (currentChunk.length + separator.length + sentence.length > targetLength)) {
            chunks.push(currentChunk);
            currentChunk = sentence;
        } else {
            currentChunk += separator + sentence;
        }
    }

    // Add the last remaining chunk
    if (currentChunk.length > 0) {
        chunks.push(currentChunk);
    }

    console.log(`Chunking complete: ${sentences.length} sentences -> ${chunks.length} chunks (Target length: ${targetLength})`);
    return chunks;
}


// --- Main Function ---
async function generateSingleLanguageAudiobook() {
    console.log("--- generateSingleLanguageAudiobook START (Pipeline Mode) ---");

    // 1. Get UI elements
    const sourceTextArea = document.getElementById('source-text');
    const sourceVoiceSelect = document.getElementById('sl-voice');
    const sourceRateSlider = document.getElementById('sl-rate');
    const sourcePitchSlider = document.getElementById('sl-pitch');
    const threadsSlider = document.querySelector('.max-threads');
    const mergeSlider = document.querySelector('.mergefiles');
    const statArea = document.getElementById('stat-area');
    const progressContainer = document.getElementById('progress-container');
    const progressBar = document.getElementById('progress-bar');
    const progressInfo = document.getElementById('progress-info');
    const bookContainer = document.getElementById('output'); // Though not used for output here
    const advancedSettingsContainer = document.getElementById('advanced-audio-settings');

    // 2. Get and validate source text
    const sourceText = sourceTextArea?.value;
    if (!sourceText || sourceText.trim() === "") {
        // Use fetchTranslation for the alert
        alert(fetchTranslation('alertEnterSourceText', currentLanguage));
        console.log("--- generateSingleLanguageAudiobook END (No source text) ---");
        return;
    }

    // 3. Get settings
    const voice = sourceVoiceSelect?.value;
    const rateValue = sourceRateSlider?.value || 0;
    const pitchValue = sourcePitchSlider?.value || 0;
    const maxThreads = parseInt(threadsSlider?.value || '10', 10);
    const mergeValue = parseInt(mergeSlider?.value || '100', 10); // 100 means ALL

    if (!voice) {
        // Use fetchTranslation for the alert
        alert(fetchTranslation('alertSelectVoice', currentLanguage));
        console.log("--- generateSingleLanguageAudiobook END (No voice selected) ---");
        return;
    }

    // Format rate/pitch as expected by SocketEdgeTTS (+X% / +XHz)
    const rate = `${rateValue >= 0 ? '+' : ''}${rateValue}%`;
    const pitch = `${pitchValue >= 0 ? '+' : ''}${pitchValue}Hz`;
    const mergeEnabled = mergeValue > 1;
    const mergeChunkSize = mergeValue === 100 ? Infinity : mergeValue;

    // Store merge settings and base filename for callbacks
    currentMergeSettings = { enabled: mergeEnabled, chunkSize: mergeChunkSize };
    const firstWords = sourceText.split(' ').slice(0, 5).join(' ') || `Audio_${Date.now()}`;
    const sanitizedFirstWords = firstWords.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    currentBaseFilename = sanitizedFirstWords.substring(0, 50) || "Audiobook";
    console.log("Determined base filename:", currentBaseFilename);

    // 4. Reset UI and clear any previous pipeline
    console.log("Resetting UI and clearing previous pipeline (if any)...");
    resetSingleLanguageUI(); // Clears UI and calls currentPipelineManager.clear()

    // 5. Prepare UI for new run
    console.log("Preparing UI for single language audio...");
    if (bookContainer) bookContainer.innerHTML = ''; // Clear bilingual output area
    if (statArea) {
        statArea.value = "Initializing audio generation...\n"; // Keep this initial message hardcoded or create a key if needed
        statArea.classList.remove('hide');
    }
    if (progressContainer) progressContainer.classList.remove('hide');
    if (progressBar) {
        progressBar.style.width = '0%';
        progressBar.textContent = '0%';
        progressBar.style.backgroundColor = ''; // Reset color on new run
    }
    if (progressInfo) {
        progressInfo.classList.remove('hide'); // NEW: Remove hide class
        progressInfo.innerHTML = ''; // Clear previous content, wait for total count
    }

    // Hide bilingual-specific buttons/messages
    document.getElementById('open-book-view-button')?.classList.add('hide');
    document.getElementById('save-epub-button')?.classList.add('hide');
    document.getElementById('translation-finished-message')?.classList.add('hide');

    // 6. Process text using the chunking function
    console.log("Processing text using chunkTextForAudio...");
    const audioChunks = chunkTextForAudio(sourceText, TARGET_CHUNK_LENGTH);

    if (audioChunks.length === 0) {
        // Use fetchTranslation for the alert
        alert(fetchTranslation('alertCouldNotSplit', currentLanguage));
        resetSingleLanguageUI(); // Clean up UI
        console.log("--- generateSingleLanguageAudiobook END (No chunks) ---");
        return;
    }

    // Update progress total immediately (Moved slightly earlier, before pipeline config)
    // This ensures the total is shown even before the pipeline starts processing
    if (progressInfo) {
        // Use fetchTranslation for labels
        const processedText = fetchTranslation('statusProcessed', currentLanguage);
        const etaText = fetchTranslation('eta', currentLanguage);
        const calculatingText = fetchTranslation('statusCalculating', currentLanguage);
        // Ensure the total count is updated correctly here
        progressInfo.innerHTML = `<span>${processedText}: 0 / ${audioChunks.length}</span> | <span>${etaText}: ${calculatingText}</span>`;
    }

    // 7. Configure and Start the Pipeline
    const pipelineConfig = {
        textChunks: audioChunks,
        audioSettings: {
            voice: voice, // Pass the raw voice value, manager will format
            rate: rate,
            pitch: pitch,
            volume: "+0%" // Default volume
        },
        concurrencyLimit: maxThreads,
        baseFilename: currentBaseFilename, // Pass to manager (used by tasks)
        mergeSettings: currentMergeSettings, // Pass to manager (used by tasks?) - Check if needed by task runner
        statArea: statArea, // Pass the UI element
        onProgress: handlePipelineProgress,
        onComplete: handlePipelineComplete,
        onError: handlePipelineError
    };

    console.log("Creating and starting AudioPipelineManager...");
    try {
        currentPipelineManager = new AudioPipelineManager(pipelineConfig);
        // Brief delay to allow UI repaint before pipeline starts hammering the CPU/network
        await sleep(50);
        currentPipelineManager.start();
        console.log("--- generateSingleLanguageAudiobook END (Pipeline Started) ---");
    } catch (error) {
        console.error("Failed to create or start AudioPipelineManager:", error);
        // Use fetchTranslation for the template
        const errorMsgTemplate = fetchTranslation('alertPipelineError', currentLanguage);
        handlePipelineError(formatString(errorMsgTemplate, error.message)); // Pass formatted, translated message
        resetSingleLanguageUI(); // Clean up UI on critical init error
    }
}

// --- Pipeline Callbacks ---

/**
 * Handles progress updates from the AudioPipelineManager.
 * @param {object} progressData - Data from the pipeline.
 * @param {number} progressData.processed - Number of successfully processed tasks.
 * @param {number} progressData.failed - Number of failed tasks.
 * @param {number} progressData.total - Total number of tasks.
 * @param {number|null} progressData.etaSeconds - Estimated time remaining in seconds.
 */
function handlePipelineProgress(progressData) {
    const { processed, failed, total, etaSeconds } = progressData;
    const progressBar = document.getElementById('progress-bar');
    const progressInfo = document.getElementById('progress-info');

    if (total === 0) return; // Avoid division by zero

    const completed = processed + failed;
    const percent = Math.round((completed / total) * 100);

    if (progressBar) {
        progressBar.style.width = percent + '%';
        progressBar.textContent = percent + '%';
    }

    if (progressInfo) {
        // formatTime is defined in ui_helpers.js
        // Use fetchTranslation for labels
        const calculatingText = fetchTranslation('statusCalculating', currentLanguage);
        const etaString = (etaSeconds === null || !isFinite(etaSeconds))
            ? calculatingText
            : formatTime(etaSeconds * 1000);

        const processedText = fetchTranslation('statusProcessed', currentLanguage);
        const failedText = fetchTranslation('statusFailedLabel', currentLanguage);
        const etaText = fetchTranslation('eta', currentLanguage);

        progressInfo.innerHTML = `
            <span>${processedText}: ${processed} / ${total}</span> |
            ${failed > 0 ? `<span>${failedText} ${failed}</span> |` : ''}
            <span>${etaText}: ${etaString}</span>
        `;
    }
}

/**
 * Handles the completion event from the AudioPipelineManager.
 * @param {object} completionData - Data from the pipeline.
 * @param {number} completionData.processed - Total successfully processed tasks.
 * @param {number} completionData.failed - Total failed tasks.
 * @param {number} completionData.total - Total tasks.
 * @param {Array<SocketEdgeTTS|null>} completionData.results - Array of task instances or nulls.
 */
function handlePipelineComplete(completionData) {
    const { processed, failed, total, results } = completionData;
    console.log(`Pipeline finished. Success: ${processed}, Failed: ${failed}, Total: ${total}`);

    const statArea = document.getElementById('stat-area');
    const progressInfo = document.getElementById('progress-info');
    const progressBar = document.getElementById('progress-bar'); // Get progress bar for final state

    // --- Check for Failures ---
    if (failed > 0) {
        // Use fetchTranslation for templates
        const alertMsgTemplate = fetchTranslation('alertAudioGenerationFailed', currentLanguage);
        console.error(formatString(alertMsgTemplate, failed));

        let finalMessage = `\n${fetchTranslation('audioGenFailedMessage', currentLanguage)}`;
        const detailsTemplate = fetchTranslation('audioGenFailedDetails', currentLanguage);
        finalMessage += `\n${formatString(detailsTemplate, failed)}`;
        finalMessage += `\n${fetchTranslation('audioGenFailedNoOutput', currentLanguage)}`;
        finalMessage += "\n---";

        if (statArea) {
            statArea.value += finalMessage;
            statArea.scrollTop = statArea.scrollHeight; // Scroll to bottom
        }
        if (progressInfo) {
            // Use fetchTranslation for labels
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
            // Use fetchTranslation for template
            const failedProgressTemplate = fetchTranslation('statusFailedProgress', currentLanguage);
            progressBar.style.backgroundColor = '#dc3545'; // Red color for failure
            progressBar.textContent = formatString(failedProgressTemplate, failed, total);
        }

        // Clean up all instances (failed and potentially successful ones)
        console.log("Cleaning up task instances due to failure...");
        cleanupTaskInstances(results); // Call cleanup function

        // Pipeline is done, clear the reference
        currentPipelineManager = null;
        return; // Stop execution here
    }

    // --- Handle Success ---
    // Use fetchTranslation for templates
    let finalMessage = `\n${fetchTranslation('audioGenSuccessMessage', currentLanguage)}`;
    const successDetailsTemplate = fetchTranslation('audioGenSuccessDetails', currentLanguage);
    finalMessage += formatString(successDetailsTemplate, processed, total);
    finalMessage += " ---";

    if (statArea) {
        statArea.value += finalMessage;
        statArea.scrollTop = statArea.scrollHeight; // Scroll to bottom
    }
    if (progressInfo) {
        // Use fetchTranslation for labels
        const processedText = fetchTranslation('statusProcessed', currentLanguage);
        const finishedExclaimText = fetchTranslation('statusFinishedExclaim', currentLanguage);
        progressInfo.innerHTML = `
            <span>${processedText}: ${processed} / ${total}</span> |
            <span>${finishedExclaimText}</span>
        `;
    }
    if (progressBar) {
        // Ensure progress bar shows 100% and maybe a success color
        progressBar.style.width = '100%';
        progressBar.textContent = '100%';
        progressBar.style.backgroundColor = '#28a745'; // Green color for success
    }


    // Trigger saving/merging logic only on complete success
    if (processed > 0) { // Should always be true if failed === 0 and total > 0
        console.log("Triggering post-pipeline saving/merging...");
        // Pass results, filename, settings, and statArea. This function will handle calling the appropriate save/zip/merge function.
        // The called function will handle clearing instances internally.
        saveAudioResults(results, currentBaseFilename, currentMergeSettings, statArea); // Pass statArea
    } else if (total === 0) {
        console.log("Pipeline finished successfully, but there were no tasks to process.");
    } else {
        // This case (failed=0, processed=0, total>0) should theoretically not happen
        // but handle defensively.
        console.warn("Pipeline finished with no failures but also no processed parts. Skipping save.");
        cleanupTaskInstances(results); // Clean up anyway
    }

    // Pipeline is done, clear the reference
    currentPipelineManager = null;
}

/**
 * Handles critical errors reported by the AudioPipelineManager (e.g., initialization errors).
 * @param {string} errorMessage - The error message.
 */
function handlePipelineError(errorMessage) {
    console.error("Audio Pipeline Error:", errorMessage);
    const statArea = document.getElementById('stat-area');
    const progressInfo = document.getElementById('progress-info');
    const progressBar = document.getElementById('progress-bar');

    const errorText = `\n${errorMessage}`; // Use the passed message

    if (statArea) {
        statArea.value += errorText;
        statArea.scrollTop = statArea.scrollHeight;
    }
    if (progressInfo) {
        // Use fetchTranslation for label
        const pipelineErrorLabel = fetchTranslation('pipelineErrorLabel', currentLanguage);
        progressInfo.innerHTML += ` | <span style="color: red;">${pipelineErrorLabel}</span>`;
    }
    if (progressBar) {
        progressBar.style.backgroundColor = '#dc3545'; // Red color for failure
        // Use fetchTranslation for status
        progressBar.textContent = fetchTranslation('statusError', currentLanguage);
    }
    alert(errorMessage); // Show the translated error message

    // Pipeline might be in an inconsistent state, clear the reference
    // No results array to clean up here as the pipeline likely didn't even start properly
    currentPipelineManager = null;
    // Consider resetting UI further if needed
}

// --- UI Reset ---

/**
 * Resets UI elements specific to single language generation and clears the current pipeline.
 */
function resetSingleLanguageUI() {
    console.log("--- resetSingleLanguageUI START ---");

    // Clear any active pipeline
    if (currentPipelineManager) {
        console.log("Clearing active pipeline manager...");
        currentPipelineManager.clear(); // This should call clear on active instances
        currentPipelineManager = null;
    }

    // Reset UI elements
    const statArea = document.getElementById('stat-area');
    const progressContainer = document.getElementById('progress-container');
    const progressBar = document.getElementById('progress-bar');
    const progressInfo = document.getElementById('progress-info');
    const advancedSettingsContainer = document.getElementById('advanced-audio-settings');

    if (statArea) {
        statArea.value = "";
        statArea.classList.add('hide');
        // statArea.style.display = 'none';
    }
    if (progressContainer) progressContainer.style.display = 'none';
    if (progressContainer) progressContainer.classList.add('hide'); // NEW: Add hide class

    if (progressBar) {
        progressBar.style.width = '0%';
        progressBar.textContent = '0%';
        progressBar.style.backgroundColor = ''; // Reset background color
    }
    if (progressInfo) {
        progressInfo.classList.add('hide'); // NEW: Add hide class
        progressInfo.innerHTML = '';
    }
    // Keep advanced settings visible if they were manually opened? Or always hide on reset?
    // Let's hide them on reset for now.
    if (advancedSettingsContainer) {
        // Don't hide if settings are meant to be persistently visible via settings.js state
        // This needs coordination with how settings visibility is managed globally.
        // Assuming settings.js handles the toggle, we don't force-hide here.
        // advancedSettingsContainer.classList.add('hide');
    }
    console.log("--- resetSingleLanguageUI END ---");
}


// --- Post-Pipeline Saving/Merging Logic ---



/**
 * Orchestrates saving or merging based on settings after pipeline completion.
 * Assumes this is only called when all tasks succeeded (failed === 0).
 * @param {Array<SocketEdgeTTS|null>} results - Array of task instances (all should be successful).
 * @param {string} baseFilename - Base name for files.
 * @param {object} mergeSettings - Merge configuration.
 * @param {HTMLElement} statArea - The UI element for status updates.
 */
async function saveAudioResults(results, baseFilename, mergeSettings, statArea) {
    // Filter out any null/unexpected failures just in case
    const successfulResults = results.filter(instance => instance && instance.mp3_saved && instance.my_uint8Array && instance.my_uint8Array.length > 0);

    if (successfulResults.length === 0) {
        console.log("No successful results with audio data found to save.");
        return;
    }

    console.log(`Processing ${successfulResults.length} successful parts for saving/merging.`);

    try {
        if (!mergeSettings.enabled) {
            // Individual files requested
            if (successfulResults.length > ZIP_DOWNLOAD_THRESHOLD) {
                // More files than threshold -> ZIP them
                console.log(`More than ${ZIP_DOWNLOAD_THRESHOLD} individual files requested. Creating ZIP archive...`);
                // saveAsZip_Pipeline is defined in audio_helpers.js and handles cleanup
                await saveAsZip_Pipeline(successfulResults, baseFilename, statArea);
            } else {
                // Fewer files than threshold -> Save individually
                console.log("Saving individual files...");
                // saveIndividualFiles_Pipeline is defined below and handles cleanup
                await saveIndividualFiles_Pipeline(successfulResults, baseFilename);
            }
        } else {
            // Merging enabled
            console.log("Merging files...");
            // doMerge_Pipeline is defined below and handles cleanup
            await doMerge_Pipeline(successfulResults, baseFilename, mergeSettings.chunkSize);
        }
    } catch (error) {
        // Catch errors from the saving/merging/zipping functions if they throw
        console.error("Error during post-pipeline processing (save/merge/zip):", error);
        if (statArea) {
            statArea.value += `\nError during file processing: ${error.message}`;
            statArea.scrollTop = statArea.scrollHeight;
        }
        // Attempt cleanup even if saving failed, as some instances might still hold data
        // cleanupTaskInstances is defined in audio_helpers.js
        console.log("Attempting cleanup after error during save/merge/zip...");
        cleanupTaskInstances(successfulResults); // Clean up the filtered list
    }

    // NOTE: Cleanup is now handled *within* saveAsZip_Pipeline, saveIndividualFiles_Pipeline, and doMerge_Pipeline.
    // No need for a separate cleanup call here unless the saving functions fail to clean up internally.
}


/**
 * Saves individual MP3 files from successful task results.
 * Assumes input array contains only successful instances.
 * @param {Array<SocketEdgeTTS>} successfulResults - Array of successful task instances.
 * @param {string} baseFilename - Base name for files.
 */
async function saveIndividualFiles_Pipeline(successfulResults, baseFilename) {
    let savedCount = 0;
    const instancesToClear = [...successfulResults]; // Copy array as we modify status

    for (const instance of instancesToClear) {
        // Check instance validity again just in case
        if (instance && instance.my_uint8Array && instance.my_uint8Array.length > 0 && instance.my_filenum) {
            const audioBlob = new Blob([instance.my_uint8Array.buffer], { type: 'audio/mpeg' });
            const filename = `${baseFilename}_part_${instance.my_filenum}.mp3`;
            console.log(`Saving individual file: ${filename}`);
            // Pass translated status to update_stat
            instance.update_stat(fetchTranslation("statusSaving", currentLanguage));

            try {
                saveAs(audioBlob, filename); // FileSaver.js
                // Pass translated status to update_stat
                instance.update_stat(fetchTranslation("statusDownloadStarted", currentLanguage));
                savedCount++;
                await sleep(50); // Small delay between downloads might help slightly, but ZIP is better
            } catch (e) {
                console.error(`Error initiating download for ${filename}:`, e);
                // Pass translated status to update_stat
                instance.update_stat(fetchTranslation("statusErrorDownloading", currentLanguage));
            }
            // NOTE: Cleanup happens *after* the loop now
        } else {
            console.warn(`Skipping invalid instance in saveIndividualFiles_Pipeline: Index ${instance?.indexpart}`);
        }
    }
    console.log(`Attempted to save ${savedCount} individual files.`);

    // --- IMPORTANT: Clean up instances after the loop ---
    console.log("Cleaning up processed audio parts after individual save attempts...");
    // cleanupTaskInstances is defined in audio_helpers.js
    cleanupTaskInstances(instancesToClear);
    console.log("Cleanup complete.");
}

/**
 * Merges results into chunks and saves them.
 * Assumes input array contains only successful instances.
 * Cleans up instances after attempting to save each chunk.
 * @param {Array<SocketEdgeTTS>} successfulResults - Array of successful task instances.
 * @param {string} baseFilename - Base name for files.
 * @param {number} chunkSize - Number of parts per merged file (Infinity for all).
 */
async function doMerge_Pipeline(successfulResults, baseFilename, chunkSize) {
    const totalParts = successfulResults.length;
    if (totalParts === 0) return;

    // Sort results by indexpart to ensure correct order before merging
    successfulResults.sort((a, b) => a.indexpart - b.indexpart);

    const actualChunkSize = chunkSize === Infinity ? totalParts : chunkSize;
    let mergedFileCount = 0;
    const allProcessedInstances = []; // Keep track of all instances processed across chunks for final cleanup check

    for (let i = 0; i < totalParts; i += actualChunkSize) {
        const chunkStart = i;
        const chunkEnd = Math.min(chunkStart + actualChunkSize, totalParts); // Use exclusive end index for slice
        const chunkInstances = successfulResults.slice(chunkStart, chunkEnd);
        allProcessedInstances.push(...chunkInstances); // Add instances from this chunk to the master list

        if (chunkInstances.length === 0) continue; // Should not happen with successfulResults, but check anyway

        let combinedLength = 0;
        const partsInChunk = [];
        const indicesProcessed = []; // Keep track of original indices if needed, though less critical now

        // Collect audio data from the current chunk
        for (const instance of chunkInstances) {
            if (instance && instance.my_uint8Array && instance.my_uint8Array.length > 0) {
                partsInChunk.push(instance.my_uint8Array);
                combinedLength += instance.my_uint8Array.length;
                // Pass translated status to update_stat
                instance.update_stat(fetchTranslation("statusMerging", currentLanguage));
            } else {
                console.warn(`Skipping invalid instance during merge: Index ${instance?.indexpart}`);
            }
        }

        // If data was collected for this chunk, combine and save
        if (partsInChunk.length > 0 && combinedLength > 0) {
            const firstPartNum = chunkInstances[0]?.my_filenum || "unknown";
            const lastPartNum = chunkInstances[chunkInstances.length - 1]?.my_filenum || "unknown";

            console.log(`Combining audio for merge chunk: Parts ${firstPartNum} to ${lastPartNum}`);
            const combinedUint8Array = new Uint8Array(combinedLength);
            let currentPosition = 0;
            for (const partData of partsInChunk) {
                combinedUint8Array.set(partData, currentPosition);
                currentPosition += partData.length;
            }

            const mergeNum = Math.floor(chunkStart / actualChunkSize) + 1;
            const isSingleFile = actualChunkSize >= totalParts && chunkStart === 0;

            // Save the merged chunk
            await saveMerge_Pipeline(combinedUint8Array, mergeNum, baseFilename, isSingleFile, firstPartNum, lastPartNum, totalParts);
            mergedFileCount++;

            // Update status for successfully merged instances in this chunk
            for (const instance of chunkInstances) {
                if (instance && typeof instance.update_stat === 'function') {
                    // Pass translated status to update_stat
                    instance.update_stat(fetchTranslation("statusMergedAndSaved", currentLanguage));
                }
            }
            await sleep(25); // Small delay after saving chunk

        } else {
            console.warn(`Skipping merge for chunk starting at index ${chunkStart}: No valid parts found.`);
        }

        // --- IMPORTANT: Clean up instances belonging to this chunk ---
        console.log(`Cleaning up instances for merge chunk ${chunkStart + 1}-${chunkEnd}...`);
        // cleanupTaskInstances is defined in audio_helpers.js
        cleanupTaskInstances(chunkInstances); // Clean up only the instances processed in this chunk
        console.log("Chunk cleanup complete.");

    } // End loop through chunks

    console.log(`Attempted to save ${mergedFileCount} merged files.`);

}


/**
 * Saves a single merged audio chunk to a file.
 * @param {Uint8Array} combinedData - The combined audio data.
 * @param {number} mergeNum - The sequential number of this merge chunk.
 * @param {string} baseFilename - Base name for the file.
 * @param {boolean} isSingleFile - True if this merge represents the entire output.
 * @param {string} firstPartNum - The file number string (e.g., "0001") of the first part in this chunk.
 * @param {string} lastPartNum - The file number string (e.g., "0050") of the last part in this chunk.
 * @param {number} totalSuccessfulParts - The total number of parts being merged overall.
 */
async function saveMerge_Pipeline(combinedData, mergeNum, baseFilename, isSingleFile, firstPartNum, lastPartNum, totalSuccessfulParts) {
    const audioBlob = new Blob([combinedData.buffer], { type: 'audio/mpeg' });
    let filename;

    if (isSingleFile) {
        // Filename for a single merged file containing all parts
        filename = `${baseFilename}_${totalSuccessfulParts}-parts.mp3`;
    } else {
        // Filename for a chunk, indicating the range of parts included
        filename = `${baseFilename}_parts_${firstPartNum}-${lastPartNum}.mp3`;
    }

    console.log(`Saving merged file: ${filename}`);

    try {
        saveAs(audioBlob, filename); // FileSaver.js
        // Status updates for individual parts were done in doMerge_Pipeline
    } catch (e) {
        console.error(`Error initiating download for merged file ${filename}:`, e);
        // Use fetchTranslation for template
        const alertMsgTemplate = fetchTranslation('alertSaveMergedError', currentLanguage);
        alert(formatString(alertMsgTemplate, filename));
        // Re-throw the error so the caller (doMerge_Pipeline) can potentially handle it? Or just log here.
        // throw e; // Optional: re-throw
    }
    // No instances to clear here, handled in the caller (doMerge_Pipeline)
}

