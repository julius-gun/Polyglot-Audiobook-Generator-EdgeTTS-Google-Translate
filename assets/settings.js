// Manages application settings, including loading/saving and UI toggles.

// Depends on:
// - DOM Elements: #advanced-audio-settings, .pointsselect, .pointstype, .voices, .rate, .pitch, .max-threads, .mergefiles,
//                 #rate-str, #pitch-str, #max-threads-int, #mergefiles-str, #stat-area,
//                 #text-area
// - Globals: threads_info (needs careful handling - might need refactoring later)
// - Functions: (Potentially) updateUI or similar if settings affect dropdowns directly (currently not the case)

// Global state for settings visibility (consider encapsulating later if needed)
let settingsVisible = false;

// Toggles the visibility of advanced settings sections
function toggleAdvancedSettingsVisibility() {
    settingsVisible = !settingsVisible; // Toggle state

    // Get the main container for advanced audio settings
    const advancedSettingsContainer = document.getElementById('advanced-audio-settings');

    // Toggle visibility class for the container
    if (advancedSettingsContainer) {
        advancedSettingsContainer.classList.toggle('hide', !settingsVisible);
        console.log(`Advanced settings visibility toggled. Visible: ${settingsVisible}`);
    } else {
        console.warn("Advanced audio settings container ('#advanced-audio-settings') not found.");
    }

    // --- Removed logic targeting old/individual elements ---
    // const elementsToToggle = [
    //     document.getElementById('period-replacement-options'),
    //     document.getElementById('div-rate'), // These are now inside language rows
    //     document.getElementById('div-pitch'), // These are now inside language rows
    //     document.getElementById('div-threads'), // Now inside advanced-audio-settings
    //     document.getElementById('div-mergefiles'), // Now inside advanced-audio-settings
    //     document.getElementById('dop-settings-label')
    // ];
    // elementsToToggle.forEach(el => {
    //     if (el) el.classList.toggle('hidden-option', !settingsVisible);
    // });

    // --- Removed logic for options/optionslite class toggle ---
    // const optionsContainer = document.querySelector('.options');
    // if (optionsContainer) {
    //     optionsContainer.classList.toggle('optionslite', !settingsVisible);
    // }

    // --- Removed logic related to text/stat area display toggle (should be handled elsewhere if needed) ---
    // const textArea = document.getElementById('text-area'); // Assuming 'text-area' is the ID for source-text container?
    // const statArea = document.getElementById('stat-area');
    // if (textArea) textArea.style.display = 'block';
    // if (statArea) statArea.style.display = 'block';

    // --- Removed logic for displaying book parts (misplaced here) ---
    // if (typeof book !== 'undefined' && book && book.all_sentences.length > 0) { ... }

    // --- Removed logic for hiding dop-settings-label ---
    // const dopSettingsLabel = document.getElementById('dop-settings-label');
    // if (dopSettingsLabel) { dopSettingsLabel.style.display = 'none'; }
}


// Saves current settings to localStorage
function saveSettings() {
    try {
        // Query elements within the function to ensure they exist
        const pointsSelect = document.querySelector('.pointsselect'); // Keep if still used
        const pointsType = document.querySelector('.pointstype'); // Keep if still used
        // Note: Voice saving might need adjustment based on the new structure (sl-voice, tl1-voice etc.)
        // This '.voices' selector is likely outdated. Consider saving each voice select individually if needed.
        // const voice = document.querySelector('.voices');
        const slRate = document.getElementById('sl-rate');
        const slPitch = document.getElementById('sl-pitch');
        // Add saving for TL rates/pitches if needed
        const max_threads = document.querySelector('.max-threads'); // Correct selector
        const mergefiles = document.querySelector('.mergefiles'); // Correct selector

        // Save slider values
        if (slRate) localStorage.setItem('sl_rate_value', slRate.value);
        if (slPitch) localStorage.setItem('sl_pitch_value', slPitch.value);
        if (max_threads) localStorage.setItem('max_threads_value', max_threads.value);
        if (mergefiles) localStorage.setItem('mergefiles_value', mergefiles.value);

        // Save text values associated with sliders (optional, can be derived)
        // const rate_str = document.querySelector('#rate-str'); // Outdated ID?
        // const pitch_str = document.querySelector('#pitch-str'); // Outdated ID?
        const threads_value_span = document.querySelector('.threads-value'); // Use class
        const merge_value_span = document.querySelector('.merge-value'); // Use class
        if (threads_value_span) localStorage.setItem('threads_value_textContent', threads_value_span.textContent);
        if (merge_value_span) localStorage.setItem('merge_value_textContent', merge_value_span.textContent);


        // Save other settings if they exist
        if (pointsSelect) localStorage.setItem('pointsSelect_value', pointsSelect.value);
        if (pointsType) localStorage.setItem('pointsType_innerHTML', pointsType.innerHTML);
        // if (voice) localStorage.setItem('voice_value', voice.value); // Outdated

        // Save visibility state
        localStorage.setItem('settingsVisible', settingsVisible);
        console.log(`Settings saved. Visibility: ${settingsVisible}`);

    } catch (e) {
        console.error("Error saving settings to localStorage:", e);
    }
}

// Loads settings from localStorage and applies them
function loadSettings() {
    try {
        // Query elements within the function
        const pointsSelect = document.querySelector('.pointsselect'); // Keep if used
        const pointsType = document.querySelector('.pointstype'); // Keep if used
        // const voice = document.querySelector('.voices'); // Outdated
        const slRate = document.getElementById('sl-rate');
        const slPitch = document.getElementById('sl-pitch');
        // Add loading for TL rates/pitches if needed
        const max_threads = document.querySelector('.max-threads'); // Correct selector
        const mergefiles = document.querySelector('.mergefiles'); // Correct selector

        // Load slider values
        if (slRate && localStorage.getItem('sl_rate_value')) { slRate.value = localStorage.getItem('sl_rate_value'); }
        if (slPitch && localStorage.getItem('sl_pitch_value')) { slPitch.value = localStorage.getItem('sl_pitch_value'); }
        if (max_threads && localStorage.getItem('max_threads_value')) { max_threads.value = localStorage.getItem('max_threads_value'); }
        if (mergefiles && localStorage.getItem('mergefiles_value')) { mergefiles.value = localStorage.getItem('mergefiles_value'); }

        // Load text values associated with sliders (optional, can be derived by triggering change handler)
        const threads_value_span = document.querySelector('.threads-value'); // Use class
        const merge_value_span = document.querySelector('.merge-value'); // Use class
        if (threads_value_span && localStorage.getItem('threads_value_textContent')) { threads_value_span.textContent = localStorage.getItem('threads_value_textContent'); }
        if (merge_value_span && localStorage.getItem('merge_value_textContent')) { merge_value_span.textContent = localStorage.getItem('merge_value_textContent'); }
        // It might be better to trigger the slider change handler after loading values instead of saving/loading textContent

        // Load other settings if they exist
        if (pointsSelect && localStorage.getItem('pointsSelect_value')) { pointsSelect.value = localStorage.getItem('pointsSelect_value'); }
        if (pointsType && localStorage.getItem('pointsType_innerHTML')) { pointsType.innerHTML = localStorage.getItem('pointsType_innerHTML'); }
        // if (voice && localStorage.getItem('voice_value')) { voice.value = localStorage.getItem('voice_value'); } // Outdated

        // Load visibility state
        if (localStorage.getItem('settingsVisible')) {
            settingsVisible = localStorage.getItem('settingsVisible') === 'true';
        } else {
            settingsVisible = false; // Default to hidden if not saved
        }
        console.log(`Settings loaded. Initial visibility: ${settingsVisible}`);

        // Apply initial visibility based on loaded settings
        const advancedSettingsContainer = document.getElementById('advanced-audio-settings');
        if (advancedSettingsContainer) {
            advancedSettingsContainer.classList.toggle('hide', !settingsVisible);
        } else {
            console.warn("Advanced audio settings container ('#advanced-audio-settings') not found during load.");
        }

        // --- Removed logic applying .hidden-option to old elements ---
        // const elementsToToggle = [ ... ];
        // elementsToToggle.forEach(el => { ... });

        // --- Removed logic applying optionslite class ---
        // const optionsContainer = document.querySelector('.options');
        // if (optionsContainer) { ... }

        // Update global threads_info (needs refactor - this global dependency is problematic)
        // This should ideally be updated when the slider value changes, not just on load.
        // if (typeof threads_info !== 'undefined' && max_threads) {
        //      threads_info.count = parseInt(max_threads.value); // 'count' seems wrong here, maybe 'max'?
        // } else if (typeof threads_info !== 'undefined') {
        //      threads_info.count = 10; // Default
        // }


    } catch (e) {
        console.error("Error loading settings from localStorage:", e);
    }
}

// Note: loadSettings() should be called during initialization (e.g., in initialization.js)
// Note: saveSettings() should be called before unload (listener in event_listeners.js)