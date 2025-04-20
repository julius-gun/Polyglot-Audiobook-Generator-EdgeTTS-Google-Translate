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
        }
    );
    // Note: SocketEdgeTTS constructor now calls start_works() internally

    return ttsInstance;
}