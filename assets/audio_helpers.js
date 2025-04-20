// Contains helper functions for audio generation tasks

/**
 * Creates and runs a single SocketEdgeTTS task.
 * @param {object} taskConfig - Configuration for the task.
 * @param {number} taskConfig.index - The index of this task.
 * @param {string} taskConfig.text - The text to synthesize.
 * @param {string} taskConfig.voice - The formatted voice name for SSML.
 * @param {string} taskConfig.rate - The speech rate (e.g., "+0%").
 * @param {string} taskConfig.pitch - The speech pitch (e.g., "+0Hz").
 * @param {string} taskConfig.volume - The speech volume (e.g., "+0%").
 * @param {string} taskConfig.baseFilename - Base name for potential file saving.
 * @param {string} taskConfig.fileNum - The file number string (e.g., "0001").
 * @param {HTMLElement} taskConfig.statArea - The status display area.
 * @param {boolean} taskConfig.mergeEnabled - Whether merging is intended (passed to SocketEdgeTTS).
 * @param {object} taskConfig.retrySettings - Retry configuration object.
 * @param {function(number, boolean, SocketEdgeTTS)} completionCallback - Called when the task finishes or fails.
 *                                      Provides (index, errorOccurred, instance).
 * @returns {SocketEdgeTTS} The created SocketEdgeTTS instance.
 */
function createAndRunAudioTask(taskConfig, completionCallback) {
    console.log(`Creating task ${taskConfig.index + 1}: Voice=${taskConfig.voice}, FileNum=${taskConfig.fileNum}`);

    const ttsInstance = new SocketEdgeTTS(
        taskConfig.index,
        taskConfig.baseFilename,
        taskConfig.fileNum,
        taskConfig.voice,
        taskConfig.pitch,
        taskConfig.rate,
        taskConfig.volume, // Volume
        taskConfig.text,
        taskConfig.statArea,
        taskConfig.mergeEnabled, // Pass merge flag
        // Completion Callback Wrapper
        (completedIndex, errorOccurred) => {
            // Pass the instance itself along with index and error status
            completionCallback(completedIndex, errorOccurred, ttsInstance);
        },
        taskConfig.retrySettings // --- ADDED: Pass retry settings to constructor ---
    );
    // Note: SocketEdgeTTS constructor now calls start_works() internally

    return ttsInstance;
}


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
 * Creates a ZIP archive containing individual MP3 files from successful task results
 * and initiates the download. Cleans up the processed instances afterwards.
 * @param {Array<SocketEdgeTTS>} successfulResults - Array of successful task instances.
 * @param {string} baseFilename - Base name for the ZIP file and internal files.
 * @param {HTMLElement} [statArea=null] - Optional UI element for status updates.
 */
async function saveAsZip_Pipeline(successfulResults, baseFilename, statArea = null) {
    // Helper function to update status area safely
    const updateStatus = (message) => {
        if (statArea) {
            // Append message on a new line
            statArea.value += `\n${message}`;
            statArea.scrollTop = statArea.scrollHeight; // Scroll to bottom
        }
        console.log(message); // Also log to console
    };

    // Check for JSZip library
    if (typeof JSZip === 'undefined') {
        const errorMsg = "Error: JSZip library not found. Cannot create ZIP.";
        updateStatus(errorMsg);
        alert(errorMsg + " Please ensure the library is loaded."); // User feedback
        // Clean up instances as we cannot proceed
        cleanupTaskInstances(successfulResults);
        return;
    }

    const zip = new JSZip();
    let zipCount = 0;
    const totalFiles = successfulResults.length;

    updateStatus(`Creating ZIP archive for ${totalFiles} files...`);

    // Sort results by indexpart to ensure correct order in the ZIP file (optional but good practice)
    successfulResults.sort((a, b) => a.indexpart - b.indexpart);

    for (const instance of successfulResults) {
        // Double-check instance validity (though input should be pre-filtered)
        if (instance && instance.my_uint8Array && instance.my_uint8Array.length > 0 && instance.my_filenum) {
            const filename = `${baseFilename}_part_${instance.my_filenum}.mp3`;
            instance.update_stat("Adding to ZIP..."); // Update individual part status
            zip.file(filename, instance.my_uint8Array, { binary: true });
            zipCount++;
            await sleep(2); // Tiny sleep to allow UI updates during loop
        } else {
            console.warn(`Skipping invalid instance in saveAsZip_Pipeline: Index ${instance?.indexpart}`);
        }
    }

    if (zipCount > 0) {
        const zipFilename = `${baseFilename}_${zipCount}-parts.zip`;
        updateStatus(`Generating ZIP file: ${zipFilename} (Compressing ${zipCount} files)...`);

        try {
            // Generate the ZIP file blob
            const zipBlob = await zip.generateAsync({
                type: "blob",
                compression: "DEFLATE",
                compressionOptions: { level: 6 }, // Balance between speed and compression
                // Progress callback (optional)
                // streamFiles: true // Consider for very large files/memory constraints
            }, (metadata) => {
                // Optional: Update progress during zipping (can be verbose)
                // const percent = metadata.percent.toFixed(0);
                // if (percent % 10 === 0) { // Update every 10%
                //     console.log(`Zipping progress: ${percent}%`);
                // }
            });

            // Initiate download using FileSaver.js
            saveAs(zipBlob, zipFilename);
            updateStatus(`ZIP file download started: ${zipFilename}`);

            // Update status for all included instances AFTER saveAs is called
            for (const instance of successfulResults) {
                if (instance && typeof instance.update_stat === 'function') {
                    instance.update_stat("Saved in ZIP");
                }
            }

        } catch (e) {
            const errorMsg = `Error generating or saving ZIP file: ${e.message}`;
            updateStatus(errorMsg);
            console.error(errorMsg, e);
            alert(errorMsg); // User feedback

            // Update status for instances to show error
            for (const instance of successfulResults) {
                 if (instance && typeof instance.update_stat === 'function') {
                    instance.update_stat("ZIP Creation Failed");
                 }
            }
        } finally {
            // --- IMPORTANT: Clean up instances after attempting to save ---
            // updateStatus("Cleaning up processed audio parts...");
            cleanupTaskInstances(successfulResults); // Clean up the instances passed to this function
            // updateStatus("Cleanup complete.");
        }

    } else {
        updateStatus("No valid files were added to the ZIP archive.");
        // Clean up instances even if none were added (shouldn't happen if successfulResults > 0 initially)
        cleanupTaskInstances(successfulResults);
    }
}