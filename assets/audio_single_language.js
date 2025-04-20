// Contains logic for generating single-language audiobooks using AudioPipelineManager.

// Depends on:
// - Functions:
//   - splitIntoSentences, sleep (translation_utils.js)
//   - formatTime (ui_helpers.js)
//   - saveAs (FileSaver.js - loaded globally)
// - Classes: AudioPipelineManager (audio_pipeline.js)
// - UI Elements: source-text, sl-voice, sl-rate, sl-pitch, max-threads, mergefiles,
//                stat-area, progress-container, progress-bar, progress-info,
//                output, open-book-view-button, save-epub-button, translation-finished-message,
//                reload-page-button, advanced-audio-settings

// --- Configuration ---
const TARGET_CHUNK_LENGTH = 3200; // Target character length for audio chunks

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
        alert("Please enter some source text before generating audio."); // TODO: Use translated alert
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
        alert("Please select a source language voice."); // TODO: Use translated alert
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
        statArea.value = "Initializing audio generation...\n";
        statArea.classList.remove('hide');
        statArea.style.display = 'block';
    }
    if (progressContainer) progressContainer.style.display = 'block';
    if (progressBar) {
        progressBar.style.width = '0%';
        progressBar.textContent = '0%';
    }
    if (progressInfo) {
        progressInfo.style.display = 'block';
        progressInfo.innerHTML = `<span>Processed: 0 / 0</span> | <span>ETA: Calculating...</span>`; // TODO: Translate
    }
    if (advancedSettingsContainer) advancedSettingsContainer.classList.remove('hide');

    // Hide bilingual-specific buttons/messages
    document.getElementById('open-book-view-button')?.classList.add('hide');
    document.getElementById('save-epub-button')?.classList.add('hide');
    document.getElementById('translation-finished-message')?.classList.add('hide');

    // 6. Process text using the chunking function
    console.log("Processing text using chunkTextForAudio...");
    const audioChunks = chunkTextForAudio(sourceText, TARGET_CHUNK_LENGTH);

    if (audioChunks.length === 0) {
        alert("Could not split the text into processable chunks."); // TODO: Translate
        resetSingleLanguageUI(); // Clean up UI
        console.log("--- generateSingleLanguageAudiobook END (No chunks) ---");
        return;
    }

    // Update progress total immediately
    if (progressInfo) {
        // TODO: Translate "Processed", "ETA", "Calculating..."
        progressInfo.innerHTML = `<span>Processed: 0 / ${audioChunks.length}</span> | <span>ETA: Calculating...</span>`;
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
        handlePipelineError(`Failed to initialize audio pipeline: ${error.message}`);
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
        const etaString = (etaSeconds === null || !isFinite(etaSeconds))
            ? 'Calculating...' // TODO: Translate
            : formatTime(etaSeconds * 1000);

        // TODO: Translate "Processed", "Failed", "ETA"
        progressInfo.innerHTML = `
            <span>Processed: ${processed} / ${total}</span> |
            ${failed > 0 ? `<span>Failed: ${failed}</span> |` : ''}
            <span>ETA: ${etaString}</span>
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

    let finalMessage = "\n--- Audio Generation Finished ---"; // TODO: Translate
    if (failed > 0) {
        finalMessage += ` (${failed} part(s) failed)`;
    }
    finalMessage += " ---";

    if (statArea) {
        statArea.value += finalMessage;
        statArea.scrollTop = statArea.scrollHeight; // Scroll to bottom
    }
    if (progressInfo) {
        let finalProgressText = " | <span>Finished!</span>"; // TODO: Translate
        if (failed > 0) {
            finalProgressText += ` (${failed} failed)`;
        }
        progressInfo.innerHTML += finalProgressText;
    }

    // Trigger saving/merging logic AFTER the pipeline is fully complete
    if (processed > 0) { // Only save if at least one part succeeded
        console.log("Triggering post-pipeline saving/merging...");
        saveAudioResults(results, currentBaseFilename, currentMergeSettings);
    } else {
        console.log("Skipping saving/merging as no parts were processed successfully.");
        // Clean up instances even if not saved
        results.forEach(instance => instance?.clear());
    }

    // Pipeline is done, clear the reference
    currentPipelineManager = null;
}

/**
 * Handles critical errors reported by the AudioPipelineManager.
 * @param {string} errorMessage - The error message.
 */
function handlePipelineError(errorMessage) {
    console.error("Audio Pipeline Error:", errorMessage);
    const statArea = document.getElementById('stat-area');
    const progressInfo = document.getElementById('progress-info');

    const errorText = `\n--- PIPELINE ERROR: ${errorMessage} ---`; // TODO: Translate

    if (statArea) {
        statArea.value += errorText;
        statArea.scrollTop = statArea.scrollHeight;
    }
    if (progressInfo) {
        progressInfo.innerHTML += ` | <span style="color: red;">Error!</span>`; // TODO: Translate
    }
    alert(`Audio generation failed: ${errorMessage}`); // TODO: Translate

    // Pipeline might be in an inconsistent state, clear the reference
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
        currentPipelineManager.clear();
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
        statArea.style.display = 'none';
    }
    if (progressContainer) progressContainer.style.display = 'none';
    if (progressBar) {
        progressBar.style.width = '0%';
        progressBar.textContent = '0%';
    }
    if (progressInfo) {
        progressInfo.style.display = 'none';
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
 * @param {Array<SocketEdgeTTS|null>} results - Array of task instances.
 * @param {string} baseFilename - Base name for files.
 * @param {object} mergeSettings - Merge configuration.
 */
function saveAudioResults(results, baseFilename, mergeSettings) {
    if (!results || results.length === 0) {
        console.log("No results to save.");
        return;
    }

    if (!mergeSettings.enabled) {
        console.log("Saving individual files...");
        saveIndividualFiles_Pipeline(results, baseFilename);
    } else {
        console.log("Merging files...");
        doMerge_Pipeline(results, baseFilename, mergeSettings.chunkSize);
    }
}

/**
 * Saves individual MP3 files from successful task results.
 * @param {Array<SocketEdgeTTS|null>} results - Array of task instances.
 * @param {string} baseFilename - Base name for files.
 */
async function saveIndividualFiles_Pipeline(results, baseFilename) {
    let savedCount = 0;
    for (let i = 0; i < results.length; i++) {
        const instance = results[i];
        // Check if instance exists, completed successfully (mp3_saved), and has data
        if (instance && instance.mp3_saved && instance.my_uint8Array && instance.my_uint8Array.length > 0) {
            const audioBlob = new Blob([instance.my_uint8Array.buffer], { type: 'audio/mpeg' });
            // Use the filenum stored in the instance
            const filename = `${baseFilename}_part_${instance.my_filenum}.mp3`;
            console.log(`Saving individual file: ${filename}`);
            instance.update_stat("Saving..."); // Update status before saveAs

            try {
                saveAs(audioBlob, filename); // FileSaver.js
                instance.update_stat("Download Started");
                savedCount++;
                // Delay clearing slightly to ensure status update is visible
                await sleep(50);
            } catch (e) {
                console.error(`Error initiating download for ${filename}:`, e);
                instance.update_stat("Error Downloading");
            } finally {
                 // Clear instance regardless of save success/failure after processing
                 instance.clear();
                 results[i] = null; // Nullify in the array after processing
            }
        } else if (instance) {
            // If instance exists but failed or has no data, just clear it
            instance.clear();
            results[i] = null;
        }
    }
    console.log(`Attempted to save ${savedCount} individual files.`);
}

/**
 * Merges results into chunks and saves them.
 * @param {Array<SocketEdgeTTS|null>} results - Array of task instances.
 * @param {string} baseFilename - Base name for files.
 * @param {number} chunkSize - Number of parts per merged file (Infinity for all).
 */
async function doMerge_Pipeline(results, baseFilename, chunkSize) {
    const totalParts = results.length;
    if (totalParts === 0) return;

    const actualChunkSize = chunkSize === Infinity ? totalParts : chunkSize;
    let mergedCount = 0;

    for (let i = 0; i < totalParts; i += actualChunkSize) {
        const chunkStart = i;
        const chunkEnd = Math.min(chunkStart + actualChunkSize - 1, totalParts - 1);

        let combinedLength = 0;
        const partsInChunk = [];
        const indicesInChunk = [];

        // Collect valid audio data from the current chunk
        for (let j = chunkStart; j <= chunkEnd; j++) {
            const instance = results[j];
            if (instance && instance.mp3_saved && instance.my_uint8Array && instance.my_uint8Array.length > 0) {
                partsInChunk.push(instance.my_uint8Array);
                combinedLength += instance.my_uint8Array.length;
                indicesInChunk.push(j); // Keep track of original indices
                instance.update_stat("Merging..."); // Update status
            } else {
                 console.warn(`Skipping part ${j + 1} in merge chunk (failed or no data).`);
                 // Ensure failed/skipped parts are cleared if they exist
                 if(instance) {
                     instance.clear();
                     results[j] = null;
                 }
            }
        }

        // If data was collected for this chunk, combine and save
        if (partsInChunk.length > 0 && combinedLength > 0) {
            console.log(`Combining audio for merge chunk: Parts ${chunkStart + 1} to ${chunkEnd + 1}`);
            const combinedUint8Array = new Uint8Array(combinedLength);
            let currentPosition = 0;
            for (const partData of partsInChunk) {
                combinedUint8Array.set(partData, currentPosition);
                currentPosition += partData.length;
            }

            const mergeNum = Math.floor(chunkStart / actualChunkSize) + 1;
            const isSingleFile = actualChunkSize >= totalParts && chunkStart === 0;

            await saveMerge_Pipeline(combinedUint8Array, mergeNum, baseFilename, isSingleFile);
            mergedCount++;

            // Clear the instances that were successfully merged
            for (const index of indicesInChunk) {
                 if (results[index]) { // Check if not already cleared
                     results[index].update_stat("Merged & Saved"); // Or "Download Started" if saveMerge uses saveAs
                     await sleep(10); // Small delay for UI
                     results[index].clear();
                     results[index] = null; // Nullify in the array
                 }
            }
        } else {
             console.log(`Skipping merge for chunk ${chunkStart + 1}-${chunkEnd + 1}: No valid parts found.`);
             // Ensure any remaining instances in this chunk that weren't processed are cleared
             for (let j = chunkStart; j <= chunkEnd; j++) {
                 if (results[j]) {
                     results[j].clear();
                     results[j] = null;
                 }
             }
        }
    }
     console.log(`Attempted to save ${mergedCount} merged files.`);
     // Final check to clear any remaining instances that might have been missed (e.g., outside loop bounds)
     results.forEach((instance, index) => {
         if (instance) {
             console.warn(`Clearing unprocessed instance at index ${index}`);
             instance.clear();
             results[index] = null;
         }
     });
}

/**
 * Saves a single merged audio chunk to a file.
 * @param {Uint8Array} combinedData - The combined audio data.
 * @param {number} mergeNum - The sequential number of this merge chunk.
 * @param {string} baseFilename - Base name for the file.
 * @param {boolean} isSingleFile - True if this merge represents the entire output.
 */
async function saveMerge_Pipeline(combinedData, mergeNum, baseFilename, isSingleFile) {
    const audioBlob = new Blob([combinedData.buffer], { type: 'audio/mpeg' });
    let filename;

    if (isSingleFile) {
        filename = `${baseFilename}.mp3`;
    } else {
        const paddedMergeNum = mergeNum.toString().padStart(4, '0');
        filename = `${baseFilename}_part_${paddedMergeNum}.mp3`;
    }

    console.log(`Saving merged file: ${filename}`);

    try {
        saveAs(audioBlob, filename); // FileSaver.js
        // Note: Status updates for individual parts were done in doMerge_Pipeline
        // We could add a final overall status update here if needed.
    } catch (e) {
        console.error(`Error initiating download for merged file ${filename}:`, e);
        // How to signal error back to the user effectively here? Alert?
        alert(`Error saving merged file ${filename}. See console for details.`); // TODO: Translate
    }
    // No instances to clear here, handled in the caller (doMerge_Pipeline)
}


// --- Removed Functions (Previously in this file) ---
// - audioGenerationState (object)
// - startAudioGeneration_SingleLang
// - clearOldRun_SingleLang (renamed to resetSingleLanguageUI)
// - queueNextAudioTask_SingleLang
// - handleTaskCompletion_SingleLang
// - saveIndividualFile_SingleLang (replaced by saveIndividualFiles_Pipeline)
// - updateAudioProgress (replaced by handlePipelineProgress)
// - checkCompletion_SingleLang (handled by pipeline manager and onComplete)
// - doMerge_SingleLang (replaced by doMerge_Pipeline)
// - saveMerge_SingleLang (replaced by saveMerge_Pipeline)