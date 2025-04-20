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
    const progressBar = document.getElementById('progress-bar'); // Get progress bar for final state

    // --- Check for Failures ---
    if (failed > 0) {
        console.error(`Audio generation failed: ${failed} part(s) could not be created after retries.`);
        let finalMessage = `\n--- Audio Generation FAILED ---`; // TODO: Translate
        finalMessage += `\n${failed} part(s) failed after retries.`;
        finalMessage += `\nNo output file was generated. Please check the errors above.`;
        finalMessage += "\n---";

        if (statArea) {
            statArea.value += finalMessage;
            statArea.scrollTop = statArea.scrollHeight; // Scroll to bottom
        }
        if (progressInfo) {
            // TODO: Translate "Failed!"
            progressInfo.innerHTML = `
                <span>Processed: ${processed} / ${total}</span> |
                <span style="color: red;">Failed: ${failed}</span> |
                <span style="color: red;">Failed!</span>
            `;
        }
         if (progressBar) {
             // Optionally indicate failure state on progress bar
             progressBar.style.backgroundColor = '#dc3545'; // Red color for failure
             progressBar.textContent = `Failed (${failed}/${total})`; // TODO: Translate
         }

        // Clean up all instances (failed and potentially successful ones)
        console.log("Cleaning up task instances due to failure...");
        cleanupTaskInstances(results); // Call cleanup function

        // Pipeline is done, clear the reference
        currentPipelineManager = null;
        return; // Stop execution here
    }

    // --- Handle Success ---
    // This part only runs if failed === 0
    let finalMessage = "\n--- Audio Generation Finished Successfully ---"; // TODO: Translate
    finalMessage += ` (${processed}/${total} parts created)`;
    finalMessage += " ---";

    if (statArea) {
        statArea.value += finalMessage;
        statArea.scrollTop = statArea.scrollHeight; // Scroll to bottom
    }
    if (progressInfo) {
        // TODO: Translate "Finished!"
        progressInfo.innerHTML = `
            <span>Processed: ${processed} / ${total}</span> |
            <span>Finished!</span>
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
        // Pass results, filename, and settings. This function will handle clearing instances internally after saving.
        saveAudioResults(results, currentBaseFilename, currentMergeSettings);
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

    const errorText = `\n--- PIPELINE ERROR: ${errorMessage} ---`; // TODO: Translate

    if (statArea) {
        statArea.value += errorText;
        statArea.scrollTop = statArea.scrollHeight;
    }
    if (progressInfo) {
        progressInfo.innerHTML += ` | <span style="color: red;">Pipeline Error!</span>`; // TODO: Translate
    }
     if (progressBar) {
         progressBar.style.backgroundColor = '#dc3545'; // Red color for failure
         progressBar.textContent = 'Error'; // TODO: Translate
    }
    alert(`Audio generation failed: ${errorMessage}`); // TODO: Translate

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
        statArea.style.display = 'none';
    }
    if (progressContainer) progressContainer.style.display = 'none';
    if (progressBar) {
        progressBar.style.width = '0%';
        progressBar.textContent = '0%';
        progressBar.style.backgroundColor = ''; // Reset background color
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
 * Cleans up all task instances by calling their clear() method.
 * @param {Array<SocketEdgeTTS|null>} results - Array of task instances.
 */
function cleanupTaskInstances(results) {
    if (!results) return;
    console.log(`Cleaning up ${results.length} task instance slots.`);
    results.forEach((instance, index) => {
        if (instance && typeof instance.clear === 'function') {
            // console.log(`Clearing instance ${index + 1}`);
            instance.clear();
        }
        // Ensure the slot in the original array is nullified if needed elsewhere,
        // though the pipeline manager is usually discarded after completion.
        // results[index] = null; // Optional: Nullify the slot
    });
}


/**
 * Orchestrates saving or merging based on settings after pipeline completion.
 * Assumes this is only called when all tasks succeeded (failed === 0).
 * @param {Array<SocketEdgeTTS|null>} results - Array of task instances (all should be successful).
 * @param {string} baseFilename - Base name for files.
 * @param {object} mergeSettings - Merge configuration.
 */
function saveAudioResults(results, baseFilename, mergeSettings) {
    // Filter out any null/unexpected failures just in case, though theoretically not needed now
    const successfulResults = results.filter(instance => instance && instance.mp3_saved && instance.my_uint8Array && instance.my_uint8Array.length > 0);

    if (successfulResults.length === 0) {
        console.log("No successful results with audio data found to save.");
        // Clean up any potentially remaining non-null instances from the original array
        cleanupTaskInstances(results);
        return;
    }

    console.log(`Processing ${successfulResults.length} successful parts for saving/merging.`);

    if (!mergeSettings.enabled) {
        console.log("Saving individual files...");
        // Pass only successful results; this function will clear them after saving
        saveIndividualFiles_Pipeline(successfulResults, baseFilename);
    } else {
        console.log("Merging files...");
        // Pass only successful results; this function will clear them after merging/saving
        doMerge_Pipeline(successfulResults, baseFilename, mergeSettings.chunkSize);
    }

    // Note: Instances are cleared within saveIndividualFiles_Pipeline and doMerge_Pipeline
    // We might still want to run cleanupTaskInstances on the *original* results array
    // IF the filtering step above could potentially leave some non-null instances behind
    // (e.g., instances that exist but mp3_saved is false). Let's add it for safety.
    // cleanupTaskInstances(results); // This might be redundant if sub-functions handle all cases.
    // Let's rely on the sub-functions for now as they process the instances directly.
}

/**
 * Saves individual MP3 files from successful task results.
 * Assumes input array contains only successful instances.
 * @param {Array<SocketEdgeTTS>} successfulResults - Array of successful task instances.
 * @param {string} baseFilename - Base name for files.
 */
async function saveIndividualFiles_Pipeline(successfulResults, baseFilename) {
    let savedCount = 0;
    for (const instance of successfulResults) {
        // No need to re-check instance.mp3_saved here if the input is guaranteed
            const audioBlob = new Blob([instance.my_uint8Array.buffer], { type: 'audio/mpeg' });
            const filename = `${baseFilename}_part_${instance.my_filenum}.mp3`;
            console.log(`Saving individual file: ${filename}`);
            instance.update_stat("Saving..."); // Update status before saveAs

            try {
                saveAs(audioBlob, filename); // FileSaver.js
                instance.update_stat("Download Started");
                savedCount++;
            await sleep(50); // Delay clearing slightly
            } catch (e) {
                console.error(`Error initiating download for ${filename}:`, e);
                instance.update_stat("Error Downloading");
            } finally {
                 // Clear instance regardless of save success/failure after processing
                 instance.clear();
             // No need to nullify in the passed array 'successfulResults'
        }
    }
    console.log(`Attempted to save ${savedCount} individual files.`);
}

/**
 * Merges results into chunks and saves them.
 * Assumes input array contains only successful instances.
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

    for (let i = 0; i < totalParts; i += actualChunkSize) {
        const chunkStart = i;
        const chunkEnd = Math.min(chunkStart + actualChunkSize, totalParts); // Use exclusive end index for slice
        const chunkInstances = successfulResults.slice(chunkStart, chunkEnd);

        if (chunkInstances.length === 0) continue; // Should not happen with successfulResults, but check anyway

        let combinedLength = 0;
        const partsInChunk = [];
        const indicesProcessed = []; // Keep track of original indices if needed, though less critical now

        // Collect audio data from the current chunk
        for (const instance of chunkInstances) {
            // No need to re-check instance.mp3_saved
                partsInChunk.push(instance.my_uint8Array);
                combinedLength += instance.my_uint8Array.length;
            indicesProcessed.push(instance.indexpart); // Store original index
                instance.update_stat("Merging..."); // Update status
        }

        // If data was collected for this chunk, combine and save
        if (partsInChunk.length > 0 && combinedLength > 0) {
            const firstPartNum = chunkInstances[0].my_filenum; // Get file number of the first part in the chunk
            const lastPartNum = chunkInstances[chunkInstances.length - 1].my_filenum; // Get file number of the last part

            console.log(`Combining audio for merge chunk: Parts ${firstPartNum} to ${lastPartNum}`);
            const combinedUint8Array = new Uint8Array(combinedLength);
            let currentPosition = 0;
            for (const partData of partsInChunk) {
                combinedUint8Array.set(partData, currentPosition);
                currentPosition += partData.length;
            }

            const mergeNum = Math.floor(chunkStart / actualChunkSize) + 1;
            const isSingleFile = actualChunkSize >= totalParts && chunkStart === 0;

            // Pass chunk details for better filename generation if needed
            await saveMerge_Pipeline(combinedUint8Array, mergeNum, baseFilename, isSingleFile, firstPartNum, lastPartNum, totalParts);
            mergedFileCount++;

            // Clear the instances that were successfully merged in this chunk
            for (const instance of chunkInstances) {
                 instance.update_stat("Merged & Saved"); // Or "Download Started"
                     await sleep(10); // Small delay for UI
                 instance.clear();
                 // No need to nullify in successfulResults array
            }
        } else {
             // This block should ideally not be reached if input is only successful results
             console.warn(`Skipping merge for chunk starting at index ${chunkStart}: No valid parts found (unexpected).`);
             // Clear instances in this chunk just in case
             for (const instance of chunkInstances) {
                 instance.clear();
             }
        }
    }
     console.log(`Attempted to save ${mergedFileCount} merged files.`);
     // Final check: Any instances left in successfulResults? Should be empty now.
     successfulResults.forEach((instance) => {
         if (instance && typeof instance.clear === 'function') { // Check if clear exists, indicating it wasn't cleared
             console.warn(`Clearing unprocessed instance ${instance.indexpart + 1} after merging loop.`);
             instance.clear();
         }
     });
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
        // How to signal error back to the user effectively here? Alert?
        alert(`Error saving merged file ${filename}. See console for details.`); // TODO: Translate
    }
    // No instances to clear here, handled in the caller (doMerge_Pipeline)
}

