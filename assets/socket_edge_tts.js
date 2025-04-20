class SocketEdgeTTS {
	constructor(_indexpart, _filename, _filenum,
		_voice, _pitch, _rate, _volume, _text,
		_statArea, /* REMOVED _obj_threads_info */ _save_to_var,
		_onCompleteOrErrorCallback, _retrySettings = { maxRetries: 20, delay: 5000 }) { // Added retrySettings
		this.bytes_data_separator = new TextEncoder().encode("Path:audio\r\n")
		this.data_separator = new Uint8Array(this.bytes_data_separator)

		this.my_uint8Array = new Uint8Array(0)
		this.audios = [] // Still needed temporarily to process incoming blobs

		this.indexpart = _indexpart
		this.my_filename = _filename // Base filename (e.g., directory name)
		this.my_filenum = _filenum // Part number (e.g., '0001')
		this.my_voice = _voice
		this.my_pitch = _pitch
		this.my_rate = _rate
		this.my_volume = _volume
		this.my_text = _text
		this.socket
		this.statArea = _statArea
		this.mp3_saved = false // Indicates if audio data has been successfully processed and stored in my_uint8Array
		this.save_to_var = _save_to_var // Still relevant to know if data should be kept for merging
		// REMOVED: this.obj_threads_info = _obj_threads_info // No longer needed here
		this.end_message_received = false
		this.start_save = false // Flag used by audio_single_language.js to track merge/save status
		this.onCompleteOrErrorCallback = _onCompleteOrErrorCallback; // Store the callback
		this.callbackCalled = false; // Ensure callback is called only once

		// --- Retry Logic ---
		this.maxRetries = _retrySettings.maxRetries;
		this.retryDelay = _retrySettings.delay;
		this.currentRetryCount = 0;
		// --- End Retry Logic ---

		//Start
		this.start_works()
	}

	// Clear method remains largely the same, ensures resources are released
	clear() {
		if (this.socket && this.socket.readyState < 2) { // 0=CONNECTING, 1=OPEN
			this.socket.close();
		}
		this.socket = null;
		this.end_message_received = false
		this.my_uint8Array = null // Allow garbage collection
		this.audios = []; // Clear temporary blobs
		this.mp3_saved = false;
		this.start_save = false;
		// Don't nullify the callback here, might be needed if clear is called before completion in some scenarios
	}

	// Helper to attempt retry or signal final failure
	_handleErrorOrRetry(errorContext) {
		if (this.currentRetryCount < this.maxRetries) {
			this.currentRetryCount++;
			const retryMsg = `Error (${errorContext}) - Retrying (${this.currentRetryCount}/${this.maxRetries})...`;
			console.warn(`Part ${this.indexpart + 1}: ${retryMsg}`);
			this.update_stat(retryMsg);
			// Use setTimeout for the delay before restarting
			setTimeout(() => {
				// Check if cleared externally before retrying
				if (this.currentRetryCount <= this.maxRetries) {
					this.start_works(); // Attempt to restart the process
				} else {
					console.log(`Part ${this.indexpart + 1}: Retry cancelled as instance was cleared.`);
				}
			}, this.retryDelay);
		} else {
			// Retries exhausted, signal final failure
			const finalErrorMsg = `Failed (${errorContext}) after ${this.maxRetries} retries.`;
			console.error(`Part ${this.indexpart + 1}: ${finalErrorMsg}`);
			this.update_stat(finalErrorMsg);
			this._triggerCallback(true); // Signal final error
		}
	}


	// Helper to safely call the completion callback once
	_triggerCallback(error = false) {
		if (!this.callbackCalled) {
			this.callbackCalled = true;
			// Prevent further retries once callback is triggered
			this.currentRetryCount = this.maxRetries + 1;
			if (this.onCompleteOrErrorCallback) {
				// Introduce a small random delay before calling back to stagger next requests slightly
				const delay = Math.random() * 50; // Random delay up to 50 milliseconds
				setTimeout(() => {
					// Pass the index and an error flag
					this.onCompleteOrErrorCallback(this.indexpart, error);
				}, delay);
			} else {
				console.error("onCompleteOrErrorCallback is not defined in SocketEdgeTTS instance!");
			}
		}
	}


	date_to_string() {
		const date = new Date()
		const options = {
			weekday: 'short',
			month: 'short',
			day: '2-digit',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			timeZoneName: 'short',
		}
		const dateString = date.toLocaleString('en-US', options)
		return dateString.replace(/\u200E/g, '') + ' GMT+0000 (Coordinated Universal Time)'
	}

	onSocketOpen(event) {
		this.end_message_received = false
		this.update_stat("Connecting...") // More accurate initial status

		try {
			var my_data = this.date_to_string()
			this.socket.send(
				"X-Timestamp:" + my_data + "\r\n" +
				"Content-Type:application/json; charset=utf-8\r\n" +
				"Path:speech.config\r\n\r\n" +
				'{"context":{"synthesis":{"audio":{"metadataoptions":{' +
				'"sentenceBoundaryEnabled":false,"wordBoundaryEnabled":true},' +
				'"outputFormat":"audio-24khz-96kbitrate-mono-mp3"' +
				"}}}}\r\n"
			)

			this.socket.send(
				this.ssml_headers_plus_data(
					this.connect_id(),
					my_data,
					this.mkssml()
				)
			)
			this.update_stat("Sent request")
		} catch (error) {
			console.error(`Error sending data on WebSocket for part ${this.indexpart + 1}:`, error);
			this.update_stat("Error sending request");
			this._triggerCallback(true); // Signal error
			this.clear(); // Close socket if send fails
		}
	}

	async onSocketMessage(event) {
		const data = await event.data;
		if (typeof data == "string") {
			if (data.includes("Path:turn.end")) {
				this.end_message_received = true;
				// Process accumulated audio blobs now
				await this.processAudioBlobs();
			} else if (data.includes("Path:audio_metadata")) {
				// Ignore metadata messages for now
			} else {
				// console.log("Received string data:", data); // Optional: Log other string messages
			}
		} else if (data instanceof Blob) {
			// Accumulate audio blobs
			this.audios.push(data);
		}
	}

	// New method to process the collected audio blobs into my_uint8Array
	async processAudioBlobs() {
		if (this.audios.length === 0 && this.end_message_received) {
			console.warn(`Part ${this.indexpart + 1}: Received 'turn.end' but no audio data blobs.`);
			this.update_stat("Error: No audio data");
			this.mp3_saved = false;
			this._triggerCallback(true); // Signal error: completed but no data
			return;
		}

		try {
			let combinedLength = 0;
			const processedParts = [];

			for (const blob of this.audios) {
				const reader_result = await blob.arrayBuffer();
				const uint8_Array = new Uint8Array(reader_result);

				// Find the start of the actual audio data
				let posIndex = this.findIndex(uint8_Array, this.data_separator);
				if (posIndex !== -1) {
					const audioPart = uint8_Array.slice(posIndex + this.data_separator.length);
					if (audioPart.length > 0) {
						processedParts.push(audioPart);
						combinedLength += audioPart.length;
					}
				} else {
					// If separator not found, assume the whole blob might be audio data (less common)
					// This might need adjustment based on actual EdgeTTS behavior for fragmented messages
					console.warn(`Part ${this.indexpart + 1}: Audio separator not found in a blob chunk.`);
					processedParts.push(uint8_Array);
					combinedLength += uint8_Array.length;
				}
			}

			// Combine all processed parts into the final array
			this.my_uint8Array = new Uint8Array(combinedLength);
			let currentPosition = 0;
			for (const part of processedParts) {
				this.my_uint8Array.set(part, currentPosition);
				currentPosition += part.length;
			}

			this.audios = []; // Clear temporary blobs

			if (this.my_uint8Array.length > 0) {
				this.mp3_saved = true;
				this.update_stat("Processed");
				// Don't trigger callback here yet, wait for socket close
			} else {
				console.warn(`Part ${this.indexpart + 1}: Processed blobs but result is empty.`);
				this.update_stat("Error: Empty audio");
				this.mp3_saved = false;
				this._triggerCallback(true); // Signal error: processed but empty
			}

		} catch (error) {
			console.error(`Error processing audio blobs for part ${this.indexpart + 1}:`, error);
			this.update_stat("Error processing audio");
			this.mp3_saved = false;
			this._triggerCallback(true); // Signal error during processing
		}
	}


	update_stat(msg) {
		// Ensure statArea exists and is visible before updating
		if (this.statArea && this.statArea.style.display !== 'none') {
			// Use requestAnimationFrame for potentially smoother UI updates
			requestAnimationFrame(() => {
				try {
					let statlines = this.statArea.value.split('\n');
					// Ensure the line exists before trying to update it
					if (this.indexpart < statlines.length) {
						statlines[this.indexpart] = `Part ${(this.indexpart + 1).toString().padStart(4, '0')}: ${msg}`;
						this.statArea.value = statlines.join('\n');
						// Optional: Auto-scroll
						// this.statArea.scrollTop = this.statArea.scrollHeight;
					} else {
						// Append if index is out of bounds (shouldn't normally happen with pre-population)
						this.statArea.value += `\nPart ${(this.indexpart + 1).toString().padStart(4, '0')}: ${msg}`;
					}
				} catch (e) {
					console.warn("Error updating stat area:", e);
				}
			});
		}
	}

	onSocketClose(event) {
		// Determine if the closure was expected (after processing) or unexpected
		// A clean closure requires 'turn.end' and successfully processed audio data
		const cleanClosure = this.end_message_received && this.mp3_saved;
		const errorClosure = !this.end_message_received || !this.mp3_saved;

		if (cleanClosure) {
			// Only update to "Completed" if it wasn't already marked as failed during processing
			if (!this.callbackCalled) { // Avoid overwriting a failure status set earlier
				this.update_stat("Completed"); // Final status update
			}
			this._triggerCallback(false); // Signal successful completion (or confirm existing success)
		} else {
			// Handle unexpected closure only if a final callback hasn't been made yet
			if (!this.callbackCalled) {
				let reason = `Connection Closed (Code: ${event.code}, Reason: ${event.reason || 'No reason'})`;
				if (!this.end_message_received) reason += " - No 'turn.end'.";
				if (!this.mp3_saved) reason += " - Audio not saved.";
				console.warn(`Part ${this.indexpart + 1}: ${reason}`);
				// Attempt retry or signal final failure
				this._handleErrorOrRetry("Connection Closed");
			}
		}
		// Resources are cleaned up via _triggerCallback -> caller -> clearOldRun/part.clear()
	}

	start_works() {
		// Reset state variables relevant for a new attempt (needed for retries)
		this.my_uint8Array = new Uint8Array(0);
		this.audios = [];
		this.mp3_saved = false;
		this.end_message_received = false;
		// DO NOT reset this.currentRetryCount here, it tracks retries for the instance lifecycle
		// DO NOT reset this.callbackCalled here, it prevents multiple final callbacks

		// Update status based on whether this is the first attempt or a retry
		const initialMessage = this.currentRetryCount === 0 ? "Initializing" : `Retrying (${this.currentRetryCount}/${this.maxRetries})...`;
		this.update_stat(initialMessage);

		if ("WebSocket" in window) {
			try {
				// Ensure previous socket is closed before creating a new one
				if (this.socket && this.socket.readyState < 2) {
					// Remove listeners before closing to prevent triggering onSocketClose for the old socket during retry setup
					this.socket.removeEventListener('open', this.onSocketOpen);
					this.socket.removeEventListener('message', this.onSocketMessage);
					this.socket.removeEventListener('close', this.onSocketClose);
					this.socket.removeEventListener('error', this.onSocketError); // Use bound handler
					this.socket.close();
				}
				this.socket = null; // Ensure socket is nullified before creating a new one

				this.socket = new WebSocket(
					"wss://speech.platform.bing.com/consumer/speech/synthesize/" +
					"readaloud/edge/v1?TrustedClientToken=" +
					"6A5AA1D4EAFF4E9FB37E23D68491D6F4" + // <<< STILL THE LIKELY PROBLEM POINT
					"&ConnectionId=" + this.connect_id()
				);
				this.socket.binaryType = 'blob'; // Ensure we receive blobs
				// Bind event listeners correctly
				this.socket.addEventListener('open', this.onSocketOpen.bind(this));
				this.socket.addEventListener('message', this.onSocketMessage.bind(this));
				this.socket.addEventListener('close', this.onSocketClose.bind(this));
				// Add explicit error handler, bind it
				this.socket.addEventListener('error', this.onSocketError.bind(this)); // Bind the error handler

			} catch (error) {
				console.error(`Error creating WebSocket for part ${this.indexpart + 1}:`, error);
				// Attempt retry or signal final failure
				this._handleErrorOrRetry("WebSocket Creation Failed");
			}
		} else {
			console.error("WebSocket NOT supported by your Browser!");
			this.update_stat("Error: WebSocket Not Supported");
			this._triggerCallback(true); // Signal error immediately, no retry possible
		}
	}

	// Bound WebSocket error handler
	onSocketError(event) {
		// Check if a callback has already been triggered (e.g., by onSocketClose)
		if (!this.callbackCalled) {
			console.error(`WebSocket Error for part ${this.indexpart + 1}:`, event);
			// Attempt retry or signal final failure
			this._handleErrorOrRetry("WebSocket Error");
		} else {
			console.warn(`WebSocket Error for part ${this.indexpart + 1} occurred after completion callback was already triggered.`, event);
		}
	}

	mkssml() {
		// Basic XML escaping for the text content
		const escapedText = this.my_text
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&apos;');

		return (
			"<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>\n" + // Assuming en-US, might need dynamic lang based on voice
			"<voice name='" + this.my_voice + "'><prosody pitch='" + this.my_pitch + "' rate='" + this.my_rate + "' volume='" + this.my_volume + "'>\n" +
			escapedText + "</prosody></voice></speak>"
		);
	}

	connect_id() {
		const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
			const r = (Math.random() * 16) | 0;
			const v = c == 'x' ? r : (r & 0x3) | 0x8;
			return v.toString(16);
		});
		return uuid.replace(/-/g, '');
	}

	// REMOVED saveFiles method - saving is handled by the caller

	// REMOVED save_mp3 method - processing logic moved to processAudioBlobs, saving handled by caller

	ssml_headers_plus_data(request_id, timestamp, ssml) {
		return "X-RequestId:" + request_id + "\r\n" +
			"Content-Type:application/ssml+xml\r\n" +
			"X-Timestamp:" + timestamp + "Z\r\n" + // Ensure Z for UTC is included if needed
			"Path:ssml\r\n\r\n" +
			ssml;
	}

	findIndex(uint8Array, separator) {
		for (let i = 0; i < uint8Array.length - separator.length + 1; i++) {
			let found = true;
			for (let j = 0; j < separator.length; j++) {
				if (uint8Array[i + j] !== separator[j]) {
					found = false;
					break;
				}
			}
			if (found) {
				return i;
			}
		}
		return -1;
	}
}