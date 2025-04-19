// Manages application settings, including loading/saving and UI toggles.

// Depends on:
// - DOM Elements: .pointsselect, .pointstype, .voices, .rate, .pitch, .max-threads, .mergefiles,
//                 #rate-str, #pitch-str, #max-threads-int, #mergefiles-str, #stat-area,
//                 #period-replacement-options, #div-rate, #div-pitch, #div-threads, #div-mergefiles,
//                 #dop-settings-label, .options, #text-area
// - Globals: threads_info (needs careful handling - might need refactoring later)
// - Functions: (Potentially) updateUI or similar if settings affect dropdowns directly (currently not the case)

// Global state for settings visibility (consider encapsulating later if needed)
let settingsVisible = false;

// Toggles the visibility of advanced settings sections
function toggleAdvancedSettingsVisibility() {
    settingsVisible = !settingsVisible; // Toggle state

    // Get all elements to toggle
    const elementsToToggle = [
        document.getElementById('period-replacement-options'),
        document.getElementById('div-rate'),
        document.getElementById('div-pitch'),
        document.getElementById('div-threads'),
        document.getElementById('div-mergefiles'),
        document.getElementById('dop-settings-label')
    ];
    const optionsContainer = document.querySelector('.options');
    const textArea = document.getElementById('text-area');
    const statArea = document.getElementById('stat-area');

    // Toggle visibility class for each element
    elementsToToggle.forEach(el => {
        if (el) el.classList.toggle('hidden-option', !settingsVisible);
    });

    // Toggle class for options container styling
    if (optionsContainer) {
        optionsContainer.classList.toggle('optionslite', !settingsVisible);
    }

    // Always show text/stat areas (as per original lite_mod logic)
    if (textArea) textArea.style.display = 'block';
    if (statArea) statArea.style.display = 'block';

    // Logic to display book parts in text area (from original lite_mod)
    // TODO: This part feels misplaced in settings. Revisit if book handling is refactored.
    if (typeof book !== 'undefined' && book && book.all_sentences.length > 0) {
        if (textArea) {
            textArea.value = ""; // Clear first
            let tmp_ind = 0;
            for (let part of book.all_sentences) {
                tmp_ind += 1;
                textArea.value += "Part " + tmp_ind + ":\n" + part + "\n\n";
            }
        }
    }

    // Hide the 'dopSettings' label (originally shown when text area was hidden)
    const dopSettingsLabel = document.getElementById('dop-settings-label');
    if (dopSettingsLabel) {
        dopSettingsLabel.style.display = 'none';
    }

    // Note: The original function name 'lite_mod' was potentially confusing.
    // Renamed to 'toggleAdvancedSettingsVisibility' for clarity.
}


// Saves current settings to localStorage
function saveSettings() {
    try {
        // Query elements within the function to ensure they exist
        const pointsSelect = document.querySelector('.pointsselect');
        const pointsType = document.querySelector('.pointstype');
        const voice = document.querySelector('.voices'); // Note: This might be the old voice select, needs update if using new structure
        const rate = document.querySelector('.rate');
        const pitch = document.querySelector('.pitch');
        const max_threads = document.querySelector('.max-threads');
        const mergefiles = document.querySelector('.mergefiles');
        const rate_str = document.querySelector('#rate-str');
        const pitch_str = document.querySelector('#pitch-str');
        const max_threads_int = document.querySelector('#max-threads-int');
        const mergefiles_str = document.querySelector('#mergefiles-str');
        const statArea = document.getElementById('stat-area');

        if (pointsSelect) localStorage.setItem('pointsSelect_value', pointsSelect.value);
        if (pointsType) localStorage.setItem('pointsType_innerHTML', pointsType.innerHTML);
        if (voice) localStorage.setItem('voice_value', voice.value); // Might need adjustment for new voice selects
        if (rate) localStorage.setItem('rate_value', rate.value);
        if (pitch) localStorage.setItem('pitch_value', pitch.value);
        if (max_threads) localStorage.setItem('max_threads_value', max_threads.value);
        if (mergefiles) localStorage.setItem('mergefiles_value', mergefiles.value);
        if (rate_str) localStorage.setItem('rate_str_textContent', rate_str.textContent);
        if (pitch_str) localStorage.setItem('pitch_str_textContent', pitch_str.textContent);
        if (max_threads_int) localStorage.setItem('max_threads_int_textContent', max_threads_int.textContent);
        if (mergefiles_str) localStorage.setItem('mergefiles_str_textContent', mergefiles_str.textContent);
        if (statArea) localStorage.setItem('statArea_style_display', statArea.style.display); // Might be less relevant now

        localStorage.setItem('settingsVisible', settingsVisible); // Save visibility state
    } catch (e) {
        console.error("Error saving settings to localStorage:", e);
    }
}

// Loads settings from localStorage and applies them
function loadSettings() {
    try {
        // Query elements within the function
        const pointsSelect = document.querySelector('.pointsselect');
        const pointsType = document.querySelector('.pointstype');
        const voice = document.querySelector('.voices'); // Note: This might be the old voice select
        const rate = document.querySelector('.rate');
        const pitch = document.querySelector('.pitch');
        const max_threads = document.querySelector('.max-threads');
        const mergefiles = document.querySelector('.mergefiles');
        const rate_str = document.querySelector('#rate-str');
        const pitch_str = document.querySelector('#pitch-str');
        const max_threads_int = document.querySelector('#max-threads-int');
        const mergefiles_str = document.querySelector('#mergefiles-str');
        const statArea = document.getElementById('stat-area');

        // Load values and apply if elements exist
        if (pointsSelect && localStorage.getItem('pointsSelect_value')) { pointsSelect.value = localStorage.getItem('pointsSelect_value'); }
        if (pointsType && localStorage.getItem('pointsType_innerHTML')) { pointsType.innerHTML = localStorage.getItem('pointsType_innerHTML'); }
        if (voice && localStorage.getItem('voice_value')) { voice.value = localStorage.getItem('voice_value'); } // Might need adjustment
        if (rate && localStorage.getItem('rate_value')) { rate.value = localStorage.getItem('rate_value'); }
        if (pitch && localStorage.getItem('pitch_value')) { pitch.value = localStorage.getItem('pitch_value'); }
        if (max_threads && localStorage.getItem('max_threads_value')) { max_threads.value = localStorage.getItem('max_threads_value'); }
        if (mergefiles && localStorage.getItem('mergefiles_value')) { mergefiles.value = localStorage.getItem('mergefiles_value'); }
        if (rate_str && localStorage.getItem('rate_str_textContent')) { rate_str.textContent = localStorage.getItem('rate_str_textContent'); }
        if (pitch_str && localStorage.getItem('pitch_str_textContent')) { pitch_str.textContent = localStorage.getItem('pitch_str_textContent'); }
        if (max_threads_int && localStorage.getItem('max_threads_int_textContent')) { max_threads_int.textContent = localStorage.getItem('max_threads_int_textContent'); }
        if (mergefiles_str && localStorage.getItem('mergefiles_str_textContent')) { mergefiles_str.textContent = localStorage.getItem('mergefiles_str_textContent'); }
        if (statArea && localStorage.getItem('statArea_style_display')) { statArea.style.display = localStorage.getItem('statArea_style_display'); } // Might be less relevant

        // Load visibility state
        if (localStorage.getItem('settingsVisible')) {
            settingsVisible = localStorage.getItem('settingsVisible') === 'true';
        }

        // Apply initial visibility based on loaded settings
        // Query elements needed for visibility toggle
        const elementsToToggle = [
            document.getElementById('period-replacement-options'),
            document.getElementById('div-rate'),
            document.getElementById('div-pitch'),
            document.getElementById('div-threads'),
            document.getElementById('div-mergefiles'),
            document.getElementById('dop-settings-label')
        ];
        const optionsContainer = document.querySelector('.options');

        elementsToToggle.forEach(el => {
            if (el) el.classList.toggle('hidden-option', !settingsVisible);
        });
        if (optionsContainer) {
            optionsContainer.classList.toggle('optionslite', !settingsVisible);
        }

        // Update global threads_info (needs refactor)
        if (typeof threads_info !== 'undefined' && max_threads) {
             threads_info.count = parseInt(max_threads.value);
        } else if (typeof threads_info !== 'undefined') {
             // Default if max_threads element not found or value not loaded
             threads_info.count = 10; // Or some other sensible default
        }


    } catch (e) {
        console.error("Error loading settings from localStorage:", e);
    }
}

// Note: loadSettings() should be called during initialization (e.g., in initialization.js)
// Note: saveSettings() should be called before unload (listener in event_listeners.js)