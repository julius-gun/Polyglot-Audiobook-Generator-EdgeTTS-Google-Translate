// Contains logic for generating single-language audiobooks.

// Depends on:
// - Functions:
//   - splitIntoSentences, mergeShortSentences (translation_utils.js)
//   - formatTime (ui_helpers.js)
// - Classes: SocketEdgeTTS (socket_edge_tts.js)
// - UI Elements: source-text, sl-voice, sl-rate, sl-pitch, max-threads, mergefiles,
//                stat-area, progress-container, progress-bar, progress-info,
//                output, open-book-view-button, save-epub-button, translation-finished-message,
//                reload-page-button, advanced-audio-settings

// --- State Management (scoped within the generation process) ---
let audioGenerationState = {
    run_work: false,
    parts_book: [], // Array to hold SocketEdgeTTS instances or null after processing
    audio_sentences: [], // Array of text chunks to process
    current_part_index: 0, // Index for the next sentence to process
    processed_parts_count: 0, // Counter for successfully completed parts
    failed_parts_count: 0, // Counter for failed parts
    threads_info: { count: 0, max: 10 }, // Current active threads and max allowed
    startTime: 0,
    merge_enabled: false,
    merge_chunk_size: Infinity, // Default to ALL (Infinity)
    base_filename: "Audiobook", // Default filename base
};

// --- Main Function ---
async function generateSingleLanguageAudiobook() {
    console.log("Starting Single Language Audiobook Generation Process...");

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
    const bookContainer = document.getElementById('output');
    const advancedSettingsContainer = document.getElementById('advanced-audio-settings');

    // 2. Get and validate source text
    const sourceText = sourceTextArea?.value;
    if (!sourceText || sourceText.trim() === "") {
        alert("Please enter some source text before generating audio."); // TODO: Use translated alert
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
        return;
    }

    // Format rate/pitch as expected by SocketEdgeTTS (+X% / +XHz)
    const rate = `${rateValue >= 0 ? '+' : ''}${rateValue}%`;
    const pitch = `${pitchValue >= 0 ? '+' : ''}${pitchValue}Hz`;
    // Merge if value is > 1. Value 1 means individual files. Value 100 means merge all.
    const mergeEnabled = mergeValue > 1;
    const mergeChunkSize = mergeValue === 100 ? Infinity : mergeValue; // Use Infinity for ALL

    // 4. Prepare UI
    if (bookContainer) bookContainer.innerHTML = ''; // Clear bilingual output
    if (statArea) {
        statArea.value = "Initializing audio generation...\n";
        statArea.classList.remove('hide'); // Make sure stat area is visible
        statArea.style.display = 'block'; // Explicitly set display style
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
    // Show advanced settings container in single language mode
    if (advancedSettingsContainer) {
        advancedSettingsContainer.classList.remove('hide');
        console.log("Made advanced audio settings visible for single language mode.");
    } else {
        console.warn("Advanced audio settings container ('#advanced-audio-settings') not found.");
    }

    // Hide bilingual-specific buttons/messages
    document.getElementById('open-book-view-button')?.classList.add('hide');
    document.getElementById('save-epub-button')?.classList.add('hide');
    document.getElementById('translation-finished-message')?.classList.add('hide');
    // Consider keeping reload/cancel button? Maybe rename it.
    // document.getElementById('reload-page-button')?.classList.add('hide');

    // 5. Initialize state
    clearOldRun_SingleLang(); // Reset state variables
    audioGenerationState.run_work = true;
    audioGenerationState.threads_info.max = maxThreads;
    audioGenerationState.threads_info.count = 0; // Reset active count
    audioGenerationState.merge_enabled = mergeEnabled;
    audioGenerationState.merge_chunk_size = mergeChunkSize;
    // *** Determine base filename HERE ***
    const firstWords = sourceText.split(' ').slice(0, 5).join(' ') || `Audio_${Date.now()}`;
    const sanitizedFirstWords = firstWords.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    // Ensure there's a fallback if sanitizedFirstWords becomes empty
    const baseFilename = sanitizedFirstWords.substring(0, 50) || "Audiobook";
    audioGenerationState.base_filename = baseFilename; // Set state variable
    console.log("Determined base filename:", audioGenerationState.base_filename); // Log the determined name

    // 6. Process text (Using translation_utils for simplicity)
    // TODO: Re-evaluate if ProcessingFile logic is needed for better chunking (like script.js had)
    const sentences = splitIntoSentences(sourceText);
    audioGenerationState.audio_sentences = mergeShortSentences(sentences); // Use merged sentences

    if (audioGenerationState.audio_sentences.length === 0) {
        alert("Could not split the text into processable sentences."); // TODO: Translate
        clearOldRun_SingleLang(); // Clean up UI
        return;
    }

    // Pre-allocate parts_book array
    audioGenerationState.parts_book = new Array(audioGenerationState.audio_sentences.length).fill(null);

    // Update status area with sentence count
    if (statArea) {
        statArea.value = ""; // Clear init message
        audioGenerationState.audio_sentences.forEach((_, index) => {
            statArea.value += `Part ${(index + 1).toString().padStart(4, '0')}: Pending\n`;
        });
        // Ensure scroll is at the top initially
        statArea.scrollTop = 0;
    }
    // Update progress info total
    updateAudioProgress(); // Initial update with total count

    // 7. Start the process directly
    startAudioGeneration_SingleLang(voice, rate, pitch);
}

// --- Helper Functions ---

function startAudioGeneration_SingleLang(voice, rate, pitch) {
    if (!audioGenerationState.run_work) return; // Check if cancelled

    // Log the base filename being used
    console.log(`Starting generation with: BaseFilename=${audioGenerationState.base_filename}, Voice=${voice}, Rate=${rate}, Pitch=${pitch}, Threads=${audioGenerationState.threads_info.max}, Merge=${audioGenerationState.merge_enabled}, ChunkSize=${audioGenerationState.merge_chunk_size === Infinity ? 'ALL' : audioGenerationState.merge_chunk_size}`);

    audioGenerationState.startTime = Date.now();
    updateAudioProgress(); // Initial progress update (0 / total)

    // Start filling the pipeline based on max threads
    for (let i = 0; i < audioGenerationState.threads_info.max; i++) {
        queueNextAudioTask_SingleLang(voice, rate, pitch);
    }
}

function clearOldRun_SingleLang() {
    console.log("Clearing old run state...");
    audioGenerationState.run_work = false;
    // Ensure all sockets are closed and instances cleared
    audioGenerationState.parts_book.forEach(part => part?.clear());
    audioGenerationState.parts_book = [];
    audioGenerationState.audio_sentences = [];
    audioGenerationState.current_part_index = 0;
    audioGenerationState.processed_parts_count = 0;
    audioGenerationState.failed_parts_count = 0;
    audioGenerationState.threads_info = { count: 0, max: 10 };
    // REMOVED: audioGenerationState.save_path_handle = null;
    audioGenerationState.startTime = 0;
    audioGenerationState.merge_enabled = false;
    audioGenerationState.merge_chunk_size = Infinity;
    audioGenerationState.base_filename = "Audiobook";


    // Reset UI elements if they exist
    const statArea = document.getElementById('stat-area');
    const progressContainer = document.getElementById('progress-container');
    const progressBar = document.getElementById('progress-bar');
    const progressInfo = document.getElementById('progress-info');
    const advancedSettingsContainer = document.getElementById('advanced-audio-settings');

    if (statArea) {
        statArea.value = "";
        statArea.classList.add('hide');
        statArea.style.display = 'none'; // Ensure hidden
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
     // Hide advanced settings when clearing
     if (advancedSettingsContainer) {
         advancedSettingsContainer.classList.add('hide');
     }
}

// Renamed from addEdgeTTS_SingleLang to better reflect its role
function queueNextAudioTask_SingleLang(voice, rate, pitch) {
    // Check if generation should continue and if there are sentences left to start
    if (!audioGenerationState.run_work || audioGenerationState.current_part_index >= audioGenerationState.audio_sentences.length) {
        // No more *new* tasks to queue. Existing tasks might still be running.
        checkCompletion_SingleLang(); // Check if everything currently running has finished
        return;
    }

    // Check if max threads are already running
    if (audioGenerationState.threads_info.count >= audioGenerationState.threads_info.max) {
        // console.log("Max threads reached, waiting for a task to complete...");
        return; // Wait for a completion callback to trigger queuing the next task
    }

    const index = audioGenerationState.current_part_index;
    const text = audioGenerationState.audio_sentences[index];
    const fileNum = (index + 1).toString().padStart(4, '0');
    const statArea = document.getElementById('stat-area');

    console.log(`Queueing part ${index + 1}/${audioGenerationState.audio_sentences.length}`);

    // Increment active thread count and index for next call *before* creating the instance
    audioGenerationState.threads_info.count++;
    audioGenerationState.current_part_index++;

    // --- FORMAT THE VOICE NAME ---
    // Original voice value format: "<code>, <ShortName>" e.g., "en-US, AndrewMultilingualNeural"
    // Required format for SSML name attribute: "Microsoft Server Speech Text to Speech Voice (<lang>-<COUNTRY>, <ShortName>)"
    let formattedVoice = voice; // Default to original value if formatting fails
    if (voice && voice.includes(',')) {
         // Construct the long name using the original value which already has the comma
         formattedVoice = `Microsoft Server Speech Text to Speech Voice (${voice})`; // Use the original 'code, name' value
         console.log(`Formatted voice name for SSML: ${formattedVoice}`);
    } else {
         console.warn(`Voice format does not contain a comma, using as-is: ${voice}. This might cause issues.`);
         // Attempt to construct the long name anyway, but it might be wrong
         formattedVoice = `Microsoft Server Speech Text to Speech Voice (${voice})`;
    }
    // --- END FORMATTING ---


    // Create and store the SocketEdgeTTS instance
    const ttsInstance = new SocketEdgeTTS(
        index,
        audioGenerationState.base_filename, // Use the base filename (directory name or default)
        fileNum,
        formattedVoice, // *** USE THE FORMATTED VOICE NAME ***
        pitch,
        rate,
        "+0%", // Volume (not currently adjustable in UI)
        text,
        statArea,
        audioGenerationState.threads_info, // Pass for potential status updates (though less needed now)
        audioGenerationState.merge_enabled, // Pass true if merging files in memory (used by SocketEdgeTTS?) - Check usage, maybe remove
        // *** Completion Callback ***
        (completedIndex, errorOccurred) => {
            handleTaskCompletion_SingleLang(completedIndex, errorOccurred, voice, rate, pitch); // Pass original voice value here if needed later
        }
    );

    audioGenerationState.parts_book[index] = ttsInstance;

    // Immediately try to queue another task if threads are available and sentences remain
    queueNextAudioTask_SingleLang(voice, rate, pitch);
}

// Handles the completion of a SocketEdgeTTS task
function handleTaskCompletion_SingleLang(index, errorOccurred, voice, rate, pitch) {
    if (index < 0 || index >= audioGenerationState.parts_book.length) {
        console.error(`Invalid index received from completion callback: ${index}`);
        return;
    }

    const part = audioGenerationState.parts_book[index];
    if (!part) {
        // This might happen if clearOldRun was called, or double callback
        console.warn(`Completion callback received for already cleared/missing part index: ${index}`);
        return;
    }

    // Decrement active thread count regardless of success/failure
    audioGenerationState.threads_info.count--;

    if (errorOccurred) {
        console.error(`Part ${index + 1} failed.`);
        audioGenerationState.failed_parts_count++;
        // Optional: Implement retry logic here
        // part.clear(); // Clean up the failed instance
        // audioGenerationState.parts_book[index] = null; // Remove reference
        // Don't save or merge failed parts
    } else {
        console.log(`Part ${index + 1} completed successfully.`);
        audioGenerationState.processed_parts_count++;

        // Handle saving/merging based on settings
        if (!audioGenerationState.merge_enabled) {
            // Save individual file immediately
            saveIndividualFile_SingleLang(index);
        } else {
            // Merging enabled, check if a chunk can be merged now
            doMerge_SingleLang();
        }
    }

    updateAudioProgress(); // Update overall progress bar and ETA

    // Always try to queue the next task, as a thread has become free
    queueNextAudioTask_SingleLang(voice, rate, pitch);

    // Final check for overall completion after handling this task
    checkCompletion_SingleLang();
}

// New function to save individual files when merging is disabled
async function saveIndividualFile_SingleLang(index) {
    const part = audioGenerationState.parts_book[index];
    if (!part || !part.mp3_saved || part.start_save || !part.my_uint8Array || part.my_uint8Array.length === 0) {
        console.warn(`Skipping save for individual file index ${index}: Invalid state or no data.`);
        if (part) {
             part.clear(); // Clean up even if not saved
             audioGenerationState.parts_book[index] = null;
        }
        return;
    }

    part.start_save = true; // Mark as saving started
    const audioBlob = new Blob([part.my_uint8Array.buffer], { type: 'audio/mpeg' });
    const filename = `${audioGenerationState.base_filename}_part_${part.my_filenum}.mp3`;

    console.log(`Saving individual file: ${filename}`);
    part.update_stat("Saving...");

    // Always use download fallback (saveAs)
        try {
            saveAs(audioBlob, filename); // FileSaver.js
            console.log(`File ${filename} download initiated.`);
            part.update_stat("Download Started");
            // Clear part immediately after initiating download
            part.clear();
            audioGenerationState.parts_book[index] = null;
        } catch (e) {
            console.error(`Error initiating download for ${filename}:`, e);
            part.update_stat("Error Downloading");
            part.start_save = false; // Reset flag on error
            // Don't clear if download failed? Maybe keep data for manual retry?
    }
    // Check completion again after potential save/clear
    checkCompletion_SingleLang();
}


function updateAudioProgress() {
    const totalParts = audioGenerationState.audio_sentences.length;
    // Base progress on successful parts + failed parts to show overall progress
    const completed = audioGenerationState.processed_parts_count + audioGenerationState.failed_parts_count;
    const progressBar = document.getElementById('progress-bar');
    const progressInfo = document.getElementById('progress-info');

    if (totalParts === 0) return; // Avoid division by zero

    const percent = Math.round((completed / totalParts) * 100);

    if (progressBar) {
        progressBar.style.width = percent + '%';
        progressBar.textContent = percent + '%';
    }

    if (progressInfo) {
        const elapsedTime = Date.now() - audioGenerationState.startTime;
        let etaString = 'Calculating...'; // TODO: Translate

        // Calculate ETA based on completed parts (success or fail)
        if (completed > 0 && elapsedTime > 0 && isFinite(elapsedTime)) {
            const timePerPart = elapsedTime / completed;
            const estimatedTotalTime = timePerPart * totalParts;
            const estimatedTimeRemaining = Math.max(0, estimatedTotalTime - elapsedTime);
            if (isFinite(estimatedTimeRemaining)) {
                 // formatTime is defined in ui_helpers.js
                etaString = formatTime(estimatedTimeRemaining);
            }
        }

        // TODO: Translate "Processed", "Failed", "ETA"
        progressInfo.innerHTML = `
            <span>Processed: ${audioGenerationState.processed_parts_count} / ${totalParts}</span> |
            ${audioGenerationState.failed_parts_count > 0 ? `<span>Failed: ${audioGenerationState.failed_parts_count}</span> |` : ''}
            <span>ETA: ${etaString}</span>
        `;
    }
}

// Checks if all tasks are finished (processed or failed) and updates UI accordingly
function checkCompletion_SingleLang() {
    const totalParts = audioGenerationState.audio_sentences.length;
    const completedCount = audioGenerationState.processed_parts_count + audioGenerationState.failed_parts_count;

    // Check if all parts have been accounted for and no threads are active
    if (audioGenerationState.run_work && completedCount === totalParts && audioGenerationState.threads_info.count === 0) {
        console.log(`All tasks finished. Success: ${audioGenerationState.processed_parts_count}, Failed: ${audioGenerationState.failed_parts_count}`);

        // If merging, ensure the final merge check is done
        if (audioGenerationState.merge_enabled) {
            doMerge_SingleLang(true); // Force final check
        }

        // Check if all parts are truly finalized (saved/cleared or marked as failed)
        // A part is finalized if it's null (saved/cleared) or if it exists but failed (errorOccurred was true)
            // A simpler check: are all entries null? (meaning successful save/merge cleared them)
        const allFinalized = audioGenerationState.parts_book.every((part) => part === null);


        // Update UI only if all parts are actually cleared/null (meaning saved successfully)
        // This might need refinement if we want to show "Finished" even with errors.
        // Let's show finished if the counts match and threads are zero, regardless of null check for now.
        console.log("All parts accounted for and threads idle. Marking run as finished.");
        audioGenerationState.run_work = false; // Mark as finished

        const statArea = document.getElementById('stat-area');
        const progressInfo = document.getElementById('progress-info');

        let finalMessage = "\n--- Audio Generation Finished ---";
        if (audioGenerationState.failed_parts_count > 0) {
            finalMessage += ` (${audioGenerationState.failed_parts_count} part(s) failed)`;
        }
        finalMessage += " ---"; // TODO: Translate

        if (statArea) {
            statArea.value += finalMessage;
            statArea.scrollTop = statArea.scrollHeight; // Scroll to bottom
        }
        if (progressInfo) {
             let finalProgressText = " | <span>Finished!</span>"; // TODO: Translate
             if (audioGenerationState.failed_parts_count > 0) {
                 finalProgressText += ` (${audioGenerationState.failed_parts_count} failed)`;
             }
             progressInfo.innerHTML += finalProgressText;
        }

    }
}


function doMerge_SingleLang(forceFinalCheck = false) {
    if (!audioGenerationState.merge_enabled) { // No merging if disabled
        return;
    }
    // Don't run merge logic if the main process isn't supposed to be running anymore,
    // unless it's the final forced check.
    if (!audioGenerationState.run_work && !forceFinalCheck) {
        return;
    }

    const chunkSize = audioGenerationState.merge_chunk_size === Infinity
        ? audioGenerationState.audio_sentences.length // If Infinity, chunk size is total length
        : audioGenerationState.merge_chunk_size;
    const totalParts = audioGenerationState.audio_sentences.length;
    let lastMergeEnd = -1; // Track the end index of the last merged chunk

    // Iterate through potential merge chunks
    for (let i = 0; i < totalParts; i += chunkSize) {
        const chunkStart = i;
        // Ensure chunkEnd doesn't exceed totalParts - 1
        const chunkEnd = Math.min(chunkStart + chunkSize - 1, totalParts - 1);

        // Skip if this chunk or parts of it were already merged (based on lastMergeEnd)
        // This logic might be flawed if chunks overlap weirdly, but okay for simple cases.
        if (chunkStart <= lastMergeEnd) {
            continue;
        }

        let canMerge = true;
        let combinedLength = 0;
        const partsInChunk = [];

        // Check if all parts in this chunk are ready (processed successfully and not already being saved)
        for (let j = chunkStart; j <= chunkEnd; j++) {
            const part = audioGenerationState.parts_book[j];
            // Part must exist, be successfully processed (mp3_saved=true), not already saving, and have data
            if (!part || !part.mp3_saved || part.start_save || !part.my_uint8Array || part.my_uint8Array.length === 0) {
                canMerge = false;
                // If forcing a final check, we don't break, just note this chunk can't be merged yet.
                // If not forcing, we can break early.
                if (!forceFinalCheck) {
                    break;
                }
            } else {
                // Only add valid parts to the list for merging
                partsInChunk.push(part);
                combinedLength += part.my_uint8Array.length;
            }
        }

        // If the chunk is ready (all parts valid) and has data, save it
        if (canMerge && partsInChunk.length > 0 && combinedLength > 0) {
            // Ensure all parts intended for this chunk are actually included
            if (partsInChunk.length === (chunkEnd - chunkStart + 1)) {
                console.log(`Merging chunk: Parts ${chunkStart + 1} to ${chunkEnd + 1}`);
                const mergeNum = Math.floor(chunkStart / chunkSize) + 1; // Calculate merge file number
                saveMerge_SingleLang(mergeNum, chunkStart, chunkEnd, combinedLength);
                lastMergeEnd = chunkEnd; // Update the last merged index
            } else {
                 console.warn(`Merge condition met for chunk ${chunkStart + 1}-${chunkEnd + 1}, but not all parts were valid. Skipping merge for now.`);
                 // This indicates some parts in the chunk failed or are not ready.
                 // We won't merge this chunk. Individual failed parts are handled elsewhere.
            }
        }
    }
    // No need for final completion check here, it's handled by checkCompletion_SingleLang triggered by callbacks
}

// Saves a merged chunk of audio
async function saveMerge_SingleLang(mergeNum, fromIndex, toIndex, totalLength) {
    // Find the first valid part in the range to act as a reference (e.g., for filename)
    let firstValidPart = null;
    for (let k = fromIndex; k <= toIndex; k++) {
        if (audioGenerationState.parts_book[k] && audioGenerationState.parts_book[k].mp3_saved && !audioGenerationState.parts_book[k].start_save) {
            firstValidPart = audioGenerationState.parts_book[k];
            break;
        }
    }

    if (!firstValidPart) {
        console.warn(`Attempted to save merge chunk ${mergeNum} (${fromIndex + 1}-${toIndex + 1}), but no valid starting part found or already saving.`);
        return; // Cannot proceed
    }

    console.log(`Combining audio for merge chunk ${mergeNum} (${fromIndex + 1}-${toIndex + 1})...`);
    const combinedUint8Array = new Uint8Array(totalLength);
    let currentPosition = 0;
    let actualLength = 0;

    // Mark all parts in this chunk as starting to save and combine data
    for (let k = fromIndex; k <= toIndex; k++) {
        const part = audioGenerationState.parts_book[k];
        // Only include parts that were successfully processed and have data
        if (part && part.mp3_saved && part.my_uint8Array && part.my_uint8Array.length > 0) {
            if (!part.start_save) { // Double check not already saving
                 part.start_save = true;
                 part.update_stat("Merging..."); // Update status
                 combinedUint8Array.set(part.my_uint8Array, currentPosition);
                 currentPosition += part.my_uint8Array.length;
                 actualLength += part.my_uint8Array.length;
            } else {
                 console.warn(`Part ${k+1} was already marked for saving during merge operation.`);
            }
        } else {
            // This part failed or wasn't processed, skip it in the merge.
            console.warn(`Skipping part ${k + 1} in merge chunk ${mergeNum} (failed, no data, or already saving).`);
            // Ensure failed/skipped parts are also marked appropriately if needed, though they shouldn't reach here if `canMerge` was checked properly.
            // If a part failed, it should ideally be nullified or marked earlier.
        }
    }

    // Check if we actually combined any data
    if (actualLength === 0) {
        console.warn(`Merge chunk ${mergeNum} resulted in zero data. Aborting save.`);
         // Reset start_save flag for parts that might have been marked? Difficult state.
         // Best to rely on the initial check in doMerge_SingleLang.
        return;
    }

    // Use the actual combined length in case some parts were skipped
    const finalCombinedArray = combinedUint8Array.slice(0, actualLength);
    const audioBlob = new Blob([finalCombinedArray.buffer], { type: 'audio/mpeg' });

    // Determine filename
    let filename;
    const totalParts = audioGenerationState.audio_sentences.length;
    // Check if this merge covers the entire book
    const isSingleFile = (audioGenerationState.merge_chunk_size === Infinity || audioGenerationState.merge_chunk_size >= totalParts)
                         && fromIndex === 0 && toIndex === totalParts - 1;

    if (isSingleFile) {
        filename = `${audioGenerationState.base_filename}.mp3`;
    } else {
        // Pad merge number for consistent sorting
        const paddedMergeNum = mergeNum.toString().padStart(4, '0');
        filename = `${audioGenerationState.base_filename}_part_${paddedMergeNum}.mp3`;
    }

    console.log(`Saving merged file: ${filename}`);

    // Always use download fallback (saveAs)
        try {
            saveAs(audioBlob, filename); // FileSaver.js
            console.log(`File ${filename} download initiated.`);
            // Clear parts after initiating download
            for (let k = fromIndex; k <= toIndex; k++) {
                const part = audioGenerationState.parts_book[k];
                // Only clear parts that were actually part of this successful merge
                if (part && part.start_save) { // Check start_save flag
                    part.update_stat("Download Started");
                    part.clear();
                    audioGenerationState.parts_book[k] = null;
                }
            }
        } catch (e) {
            console.error(`Error initiating download for ${filename}:`, e);
             // Update status for the parts that failed to save/download
             for (let k = fromIndex; k <= toIndex; k++) {
                 const part = audioGenerationState.parts_book[k];
                 if (part && part.start_save) { // Check start_save flag
                     part.update_stat("Error Downloading");
                     part.start_save = false; // Allow potential retry? Unlikely to work.
             }
        }
    }
    // Check completion again after potential save/clear
    checkCompletion_SingleLang();
}