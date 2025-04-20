// Manages the concurrent execution of audio generation tasks.

// Depends on:
// - createAndRunAudioTask (audio_helpers.js)
// - formatTime (ui_helpers.js) - For ETA calculation

const PipelineStatus = {
    IDLE: 'Idle',
    RUNNING: 'Running',
    STOPPING: 'Stopping',
    COMPLETED: 'Completed',
    ERROR: 'Error'
};

class AudioPipelineManager {
    /**
     * Initializes the audio pipeline manager.
     * @param {object} config - Configuration object.
     * @param {string[]} config.textChunks - Array of text chunks to process.
     * @param {object} config.audioSettings - Common audio settings.
     * @param {string} config.audioSettings.voice - The voice name (unformatted).
     * @param {string} config.audioSettings.rate - Speech rate (e.g., "+0%").
     * @param {string} config.audioSettings.pitch - Speech pitch (e.g., "+0Hz").
     * @param {string} [config.audioSettings.volume="+0%"] - Speech volume.
     * @param {number} config.concurrencyLimit - Max number of tasks to run simultaneously.
     * @param {string} config.baseFilename - Base filename for output files.
     * @param {object} config.mergeSettings - Merge configuration.
     * @param {boolean} config.mergeSettings.enabled - Whether merging is enabled.
     * @param {number} config.mergeSettings.chunkSize - Number of parts per merged file (Infinity for all).
     * @param {HTMLElement} config.statArea - The UI element for status updates.
     * @param {function(object):void} [config.onProgress] - Callback for progress updates. Receives { processed, failed, total, etaSeconds }.
     * @param {function(object):void} [config.onComplete] - Callback when all tasks finish. Receives { processed, failed, total, results: SocketEdgeTTS[] | null[] }.
     * @param {function(string):void} [config.onError] - Callback for critical pipeline errors. Receives error message.
     */
    constructor(config) {
        // --- Configuration ---
        this.textChunks = config.textChunks || [];
        this.audioSettings = { volume: "+0%", ...config.audioSettings }; // Ensure volume default
        this.concurrencyLimit = config.concurrencyLimit || 1;
        this.baseFilename = config.baseFilename || "Audiobook";
        this.mergeSettings = { enabled: false, chunkSize: Infinity, ...config.mergeSettings };
        this.statArea = config.statArea; // Required for task updates

        // --- Callbacks ---
        this.onProgress = config.onProgress;
        this.onComplete = config.onComplete;
        this.onError = config.onError;

        // --- State ---
        this.status = PipelineStatus.IDLE;
        this.startTime = 0;
        this.nextTaskIndex = 0;
        this.activeTaskCount = 0;
        this.processedCount = 0;
        this.failedCount = 0;
        this.totalTasks = this.textChunks.length;
        this.taskInstances = new Array(this.totalTasks).fill(null); // Stores SocketEdgeTTS instances

        // --- Input Validation ---
        if (!this.statArea) {
            console.error("AudioPipelineManager: statArea element is required.");
            // Optionally throw an error or use onError callback
            if (this.onError) this.onError("Configuration Error: Status area element not provided.");
            this.status = PipelineStatus.ERROR; // Prevent starting
        }
        if (this.totalTasks === 0) {
            console.warn("AudioPipelineManager: No text chunks provided.");
            // No need to set error state, it just won't do anything when started.
        }
        if (!this.audioSettings.voice) {
            console.error("AudioPipelineManager: Voice setting is required.");
            if (this.onError) this.onError("Configuration Error: Voice setting not provided.");
            this.status = PipelineStatus.ERROR;
        }

        console.log(`AudioPipelineManager initialized: ${this.totalTasks} tasks, concurrency ${this.concurrencyLimit}`);
    }

    /** Formats the voice name for SSML */
    _formatVoiceName(voiceValue) {
        // Original voice value format: "<code>, <ShortName>" e.g., "en-US, AndrewMultilingualNeural"
        // Required format for SSML name attribute: "Microsoft Server Speech Text to Speech Voice (<lang>-<COUNTRY>, <ShortName>)"
        if (voiceValue && voiceValue.includes(',')) {
            // Construct the long name using the original value which already has the comma
            return `Microsoft Server Speech Text to Speech Voice (${voiceValue})`;
        } else {
            console.warn(`Voice format does not contain a comma, using as-is: ${voiceValue}. This might cause issues.`);
            // Attempt to construct the long name anyway, but it might be wrong
            return `Microsoft Server Speech Text to Speech Voice (${voiceValue || ''})`;
        }
    }

    /** Calculates Estimated Time Remaining in seconds */
    _calculateETASeconds() {
        if (this.processedCount + this.failedCount === 0 || this.startTime === 0) {
            return null; // Not enough data or not started
        }
        const completedCount = this.processedCount + this.failedCount;
        const elapsedTimeMs = Date.now() - this.startTime;
        if (elapsedTimeMs <= 0) return null;

        const timePerTaskMs = elapsedTimeMs / completedCount;
        const estimatedTotalTimeMs = timePerTaskMs * this.totalTasks;
        const estimatedRemainingTimeMs = Math.max(0, estimatedTotalTimeMs - elapsedTimeMs);

        return isFinite(estimatedRemainingTimeMs) ? Math.round(estimatedRemainingTimeMs / 1000) : null;
    }

    /** Updates the status line for a specific task */
    _updateTaskStatus(index, message) {
        if (this.statArea && this.statArea.style.display !== 'none') {
            requestAnimationFrame(() => {
                try {
                    let statlines = this.statArea.value.split('\n');
                    const lineIndex = index; // Assuming index corresponds to line number
                    const lineContent = `Part ${(index + 1).toString().padStart(4, '0')}: ${message}`;

                    if (lineIndex >= 0 && lineIndex < statlines.length) {
                        statlines[lineIndex] = lineContent;
                        this.statArea.value = statlines.join('\n');
                    } else if (lineIndex === statlines.length) {
                        // Append if it's the next line (handles initial population)
                        this.statArea.value += (this.statArea.value ? '\n' : '') + lineContent;
                    } else {
                        console.warn(`_updateTaskStatus: Index ${index} out of bounds for stat area lines (${statlines.length})`);
                        // Optionally pad with empty lines if needed, but pre-population is better
                    }
                    // Optional: Auto-scroll logic could be added here or in the caller's onProgress
                } catch (e) {
                    console.warn("Error updating stat area:", e);
                }
            });
        }
    }


    /** Attempts to queue the next available task if conditions allow. */
    _tryQueueNextTask() {
        if (this.status !== PipelineStatus.RUNNING) {
            // console.log("_tryQueueNextTask: Not running.");
            return; // Stop queuing if not in running state
        }
        if (this.nextTaskIndex >= this.totalTasks) {
            // console.log("_tryQueueNextTask: No tasks left to queue.");
            this._checkCompletion(); // Check if finished now that no more tasks are starting
            return; // All tasks have been queued
        }
        if (this.activeTaskCount >= this.concurrencyLimit) {
            // console.log("_tryQueueNextTask: Concurrency limit reached.");
            return; // Max threads running
        }

        const index = this.nextTaskIndex;
        const text = this.textChunks[index];
        const fileNum = (index + 1).toString().padStart(4, '0');

        console.log(`Pipeline: Queueing task ${index + 1}/${this.totalTasks}`);
        this._updateTaskStatus(index, "Queued"); // Update status immediately

        // Increment *before* async operation
        this.nextTaskIndex++;
        this.activeTaskCount++;

        const formattedVoice = this._formatVoiceName(this.audioSettings.voice);

        const taskConfig = {
            index: index,
            text: text,
            voice: formattedVoice,
            rate: this.audioSettings.rate,
            pitch: this.audioSettings.pitch,
            volume: this.audioSettings.volume,
            baseFilename: this.baseFilename,
            fileNum: fileNum,
            statArea: this.statArea, // Pass statArea ref to the task runner
            mergeEnabled: this.mergeSettings.enabled, // Pass merge flag (used by SocketEdgeTTS?) - Check if needed by SocketEdgeTTS itself
        };

        try {
            // createAndRunAudioTask is defined in audio_helpers.js
            const ttsInstance = createAndRunAudioTask(
                taskConfig,
                // Completion Callback Wrapper (bound to this instance)
                this._handleTaskCompletion.bind(this)
            );

            // Store the instance
            this.taskInstances[index] = ttsInstance;

        } catch (error) {
            console.error(`Pipeline: Error creating/running task ${index + 1}:`, error);
            // Simulate immediate failure for this task
            this._handleTaskCompletion(index, true, null); // Pass null as instance might not exist
        }

        // Try to queue another task immediately if slots are available
        // Use setTimeout to yield execution briefly, preventing potential stack overflow on high concurrency/fast tasks
        setTimeout(() => this._tryQueueNextTask(), 0);
    }

    /**
     * Handles the completion callback from createAndRunAudioTask.
     * @param {number} completedIndex - The index of the completed task.
     * @param {boolean} errorOccurred - True if the task failed.
     * @param {SocketEdgeTTS | null} instance - The completed SocketEdgeTTS instance (or null if creation failed).
     */
    _handleTaskCompletion(completedIndex, errorOccurred, instance) {
        // console.log(`Pipeline: Task ${completedIndex + 1} completed. Error: ${errorOccurred}`);

        // Basic validation
        if (completedIndex < 0 || completedIndex >= this.totalTasks) {
            console.error(`Pipeline: Invalid index ${completedIndex} received from task completion.`);
            // Decrement active count anyway, as *something* finished
            if (this.activeTaskCount > 0) this.activeTaskCount--;
            // Try to queue next and check completion defensively
            this._tryQueueNextTask();
            this._checkCompletion();
            return;
        }

        // Decrement active count *before* potentially calling callbacks or queuing next
        if (this.activeTaskCount > 0) this.activeTaskCount--;

        // Update counters
        if (errorOccurred) {
            this.failedCount++;
            // Update status area via the instance if available, otherwise manually
            if (instance) {
                // Instance handles its own final error status update via onSocketClose/Error
                // We might want to ensure a consistent final message here though.
                this._updateTaskStatus(completedIndex, "Failed"); // Overwrite status
            } else {
                this._updateTaskStatus(completedIndex, "Failed (Creation Error)");
            }
            // Store null or keep the failed instance? Keep instance for potential inspection by caller.
            // this.taskInstances[completedIndex] = null; // Option: Nullify failed tasks
        } else {
            this.processedCount++;
            // Instance should have updated its status to "Completed" or similar via onSocketClose
            // We can rely on that or force an update here. Let's rely on instance for now.
            // this._updateTaskStatus(completedIndex, "Success");
        }

        // --- Reporting ---
        if (this.onProgress) {
            const etaSeconds = this._calculateETASeconds();
            this.onProgress({
                processed: this.processedCount,
                failed: this.failedCount,
                total: this.totalTasks,
                etaSeconds: etaSeconds,
                // Optionally pass back the completed index and status
                // completedIndex: completedIndex,
                // errorOccurred: errorOccurred
            });
        }

        // --- Continue Pipeline ---
        // Try to queue the next task now that a slot is free
        this._tryQueueNextTask();

        // --- Check for Overall Completion ---
        // This check needs to happen *after* trying to queue the next task,
        // especially if this was the last active task.
        this._checkCompletion();
    }

    /** Checks if all tasks are completed and triggers the onComplete callback. */
    _checkCompletion() {
        // Only check if the pipeline is running or stopping
        if (this.status !== PipelineStatus.RUNNING && this.status !== PipelineStatus.STOPPING) {
            return;
        }

        const completedCount = this.processedCount + this.failedCount;

        // Check if all tasks are accounted for AND no tasks are currently active
        if (completedCount === this.totalTasks && this.activeTaskCount === 0) {
            const finalStatus = this.failedCount > 0 ? PipelineStatus.ERROR : PipelineStatus.COMPLETED;
            console.log(`Pipeline: All tasks finished. Status: ${finalStatus}. Success: ${this.processedCount}, Failed: ${this.failedCount}`);
            this.status = finalStatus;

            if (this.onComplete) {
                this.onComplete({
                    processed: this.processedCount,
                    failed: this.failedCount,
                    total: this.totalTasks,
                    results: this.taskInstances // Pass back the array of instances/nulls
                });
            }
            // No automatic cleanup here - let the caller decide based on results
        } else {
            // console.log(`_checkCompletion: Not finished. Completed: ${completedCount}/${this.totalTasks}, Active: ${this.activeTaskCount}`);
        }
    }

    // --- Public Methods ---

    /** Starts the audio generation pipeline. */
    start() {
        if (this.status !== PipelineStatus.IDLE && this.status !== PipelineStatus.COMPLETED && this.status !== PipelineStatus.ERROR) {
            console.warn(`Pipeline: Cannot start, already in state: ${this.status}`);
            return;
        }
        if (this.totalTasks === 0) {
            console.warn("Pipeline: Cannot start, no tasks to process.");
            this.status = PipelineStatus.COMPLETED; // Consider it completed immediately
            if (this.onComplete) {
                this.onComplete({ processed: 0, failed: 0, total: 0, results: [] });
            }
            return;
        }
        if (this.status === PipelineStatus.ERROR && this.onError) {
            // Don't start if initialized with an error
            console.error("Pipeline: Cannot start due to initialization error.");
            return;
        }


        console.log("Pipeline: Starting...");
        this.status = PipelineStatus.RUNNING;
        this.startTime = Date.now();
        this.nextTaskIndex = 0;
        this.activeTaskCount = 0;
        this.processedCount = 0;
        this.failedCount = 0;
        this.taskInstances.fill(null); // Reset results array

        // Pre-populate stat area (optional, but helpful)
        if (this.statArea) {
            this.statArea.value = ""; // Clear previous run
            for (let i = 0; i < this.totalTasks; i++) {
                this._updateTaskStatus(i, "Pending");
            }
            this.statArea.scrollTop = 0; // Scroll to top
        }


        // Initial progress update
        if (this.onProgress) {
            this.onProgress({ processed: 0, failed: 0, total: this.totalTasks, etaSeconds: null });
        }

        // Start filling the pipeline
        for (let i = 0; i < this.concurrencyLimit; i++) {
            this._tryQueueNextTask();
        }
    }

    /** Requests the pipeline to stop gracefully. Prevents new tasks from starting. */
    stop() {
        if (this.status !== PipelineStatus.RUNNING) {
            console.warn(`Pipeline: Cannot stop, not in RUNNING state (current: ${this.status})`);
            return;
        }
        console.log("Pipeline: Stopping...");
        this.status = PipelineStatus.STOPPING;
        // Existing tasks will continue to run until completion.
        // _tryQueueNextTask will prevent new tasks from starting.
        // _checkCompletion will eventually trigger onComplete when active tasks reach zero.

        // Note: We don't actively cancel running SocketEdgeTTS tasks here,
        // as they lack an external cancel method. They will complete or error out.
    }

    /** Forcefully stops and cleans up all tasks (use with caution). */
    clear() {
        console.log("Pipeline: Force clearing...");
        this.status = PipelineStatus.IDLE; // Or a specific 'Cleared' state if needed
        this.taskInstances.forEach(instance => {
            if (instance && typeof instance.clear === 'function') {
                instance.clear();
            }
        });
        this.taskInstances.fill(null);
        this.activeTaskCount = 0;
        this.nextTaskIndex = 0;
        this.processedCount = 0;
        this.failedCount = 0;
        this.startTime = 0;
        // Optionally clear stat area? Or leave it to the caller? Leave for caller.
    }
}