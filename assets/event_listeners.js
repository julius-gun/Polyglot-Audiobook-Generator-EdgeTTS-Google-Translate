// Contains the main event listener attachment function and its direct handlers.

// Depends on:
// - Functions:
//   - handleGenerateButtonClick (app_logic.js)
//   - toggleTheme, openBookView, saveEpub, reloadPage (ui_helpers.js)
//   - showTargetLang, hideTargetLang (ui.js)
//   - updateVoiceDropdown (voice-dropdown-menu.js)
//   - insertTextIntoSourceArea, convertFb2ToTxt, convertEpubToTxt, convertZipToTxt (texts_converter.js)

// Helper function to attach event listeners
function attachEventListeners() {
    // --- Button Listeners ---
    const generateButton = document.getElementById('generate-button');
    // handleGenerateButtonClick is defined in app_logic.js
    if (generateButton) {
        generateButton.removeEventListener('click', handleGenerateButtonClick); // Prevent duplicates
        generateButton.addEventListener('click', handleGenerateButtonClick);
    }
  
    // Added: Insert File Button Listener
    const insertFileButton = document.getElementById('insert-file-button');
    if (insertFileButton) {
      insertFileButton.removeEventListener('click', handleInsertFileClick); // Prevent duplicates
      insertFileButton.addEventListener('click', handleInsertFileClick);
    }
  
    // Added: Settings Button Listener
    const settingsButton = document.getElementById('settings-button');
    if (settingsButton) {
      settingsButton.removeEventListener('click', toggleAdvancedSettings); // Prevent duplicates
      settingsButton.addEventListener('click', toggleAdvancedSettings);
    }
  
    // openBookView, saveEpub, reloadPage are defined in ui_helpers.js
    const openBookViewButton = document.getElementById('open-book-view-button');
    if (openBookViewButton) {
        openBookViewButton.removeEventListener('click', openBookView);
        openBookViewButton.addEventListener('click', openBookView);
    }
  
    const saveEpubButton = document.getElementById('save-epub-button');
    // saveEpub is defined in epub_generator.js
    if (saveEpubButton) {
        saveEpubButton.removeEventListener('click', saveEpub);
        saveEpubButton.addEventListener('click', saveEpub);
    }
  
    const reloadPageButton = document.getElementById('reload-page-button');
    if (reloadPageButton) {
        reloadPageButton.removeEventListener('click', reloadPage);
        reloadPageButton.addEventListener('click', reloadPage);
    }
  
    // --- Add/Remove Language Button Listeners ---
  
    // Listener for the initial '+' button next to source language
    const addFirstTargetButton = document.getElementById('add-first-target-button');
    if (addFirstTargetButton) {
      addFirstTargetButton.removeEventListener('click', handleAddFirstTarget); // Prevent duplicates
      addFirstTargetButton.addEventListener('click', handleAddFirstTarget);
    }
  
    // Listeners for '+' buttons within target language containers
    document.querySelectorAll('.add-lang-button:not(#add-first-target-button)').forEach(button => {
      const targetContainerId = button.dataset.targetContainerId; // Use data attribute
      if (targetContainerId) {
        button.removeEventListener('click', showTargetLangHandler); // Remove previous listener if any
        button.addEventListener('click', showTargetLangHandler); // Add listener
      }
    });
  
    // Listeners for '-' buttons within target language containers
    document.querySelectorAll('.remove-lang-button').forEach(button => {
      const targetContainerId = button.dataset.targetContainerId; // Use data attribute
      if (targetContainerId) {
        button.removeEventListener('click', hideTargetLangHandler); // Remove previous listener if any
        button.addEventListener('click', hideTargetLangHandler); // Add listener
      }
    });
  
    // --- Language Dropdown Change Listeners ---
    const languageSelects = document.querySelectorAll('#sl, #tl1, #tl2, #tl3, #tl4');
    languageSelects.forEach(select => {
      // Remove existing listener to prevent duplicates if attachEventListeners is called multiple times
      select.removeEventListener('change', handleLanguageChange);
      // Add the new listener
      select.addEventListener('change', handleLanguageChange);
    });
  
    // --- Slider Change Listeners (Rate, Pitch, Threads, Merge) ---
    const sliders = document.querySelectorAll('.rate-slider, .pitch-slider, .max-threads, .mergefiles'); // Added .max-threads, .mergefiles
    sliders.forEach(slider => {
      slider.removeEventListener('input', handleSliderChange); // Prevent duplicates
      slider.addEventListener('input', handleSliderChange);
      // Trigger initial update for threads/merge sliders if they exist
      if (slider.classList.contains('max-threads') || slider.classList.contains('mergefiles')) {
          handleSliderChange({ target: slider });
      }
    });
  
    const fileInput = document.getElementById('file-input');
    if (fileInput) {
      fileInput.removeEventListener('change', handleFileInsert); // Prevent duplicates
      fileInput.addEventListener('change', handleFileInsert);
    }
  
    // UI language selector listener is attached within createLanguageSelector in language_dropdown.js
  }
  
  // --- Event Handlers ---
  
  // Simple handler to trigger file input click
  function handleInsertFileClick() {
    document.getElementById('file-input')?.click();
  }
  
  // Handler to toggle advanced audio settings visibility
  function toggleAdvancedSettings() {
    const settingsContainer = document.getElementById('advanced-audio-settings');
    if (settingsContainer) {
        settingsContainer.classList.toggle('hide');
        // Optionally, save the visibility state to localStorage if needed
        // try {
        //     localStorage.setItem('advancedSettingsVisible', !settingsContainer.classList.contains('hide'));
        // } catch (e) {
        //     console.warn("Could not save advanced settings visibility state:", e);
        // }
    }
  }
  
  
  // Handler for the initial '+' button click
  // Depends on: showTargetLang (ui.js)
  function handleAddFirstTarget() {
    showTargetLang('tl1-container');
    // Hide this button after it's clicked
    document.getElementById('add-first-target-button')?.classList.add('hide');
  }
  
  // Handler for language dropdown changes
  // Depends on: updateVoiceDropdown (voice-dropdown-menu.js)
  function handleLanguageChange(event) {
    const langSelect = event.target;
    const selectedLangCode = langSelect.value;
    const langSelectId = langSelect.id; // e.g., "sl", "tl1"
  
    // Determine the corresponding voice select ID
    const voiceSelectId = langSelectId + '-voice'; // e.g., "sl-voice", "tl1-voice"
    const voiceSelect = document.getElementById(voiceSelectId);
  
    if (voiceSelect && typeof updateVoiceDropdown === 'function') {
      console.log(`Language changed for ${langSelectId} to ${selectedLangCode}. Updating ${voiceSelectId}.`);
      updateVoiceDropdown(voiceSelect, selectedLangCode);
    } else {
      console.warn(`Could not find voice select '${voiceSelectId}' or updateVoiceDropdown function.`);
    }
  }
  
  // Handler for add language button clicks (for TL2, TL3, TL4)
  // Depends on: showTargetLang (ui.js)
  function showTargetLangHandler(event) {
    const targetContainerId = event.currentTarget.dataset.targetContainerId;
    if (targetContainerId) {
      showTargetLang(targetContainerId);
    }
  }
  
  // Handler for remove language button clicks
  // Depends on: hideTargetLang (ui.js)
  function hideTargetLangHandler(event) {
    const targetContainerId = event.currentTarget.dataset.targetContainerId;
    if (targetContainerId) {
      hideTargetLang(targetContainerId);
    }
  }
  
  // Handler for slider changes
  function handleSliderChange(event) {
    const slider = event.target;
    const value = slider.value;
    let valueSpan;
    let textContent;
  
    if (slider.classList.contains('rate-slider')) {
      valueSpan = slider.parentElement.querySelector('.rate-value');
      const prefix = value > 0 ? '+' : '';
      textContent = `${prefix}${value}%`;
    } else if (slider.classList.contains('pitch-slider')) {
      valueSpan = slider.parentElement.querySelector('.pitch-value');
      const prefix = value > 0 ? '+' : '';
      textContent = `${prefix}${value}Hz`;
    } else if (slider.classList.contains('max-threads')) {
      valueSpan = slider.parentElement.querySelector('.threads-value'); // Corrected selector
      textContent = `${value}`; // Display integer value
    } else if (slider.classList.contains('mergefiles')) {
      valueSpan = slider.parentElement.querySelector('.merge-value'); // Corrected selector
      textContent = value == 100 ? "ALL" : `${value} pcs.`; // Display "ALL" or number
    }
  
    if (valueSpan) {
      valueSpan.textContent = textContent;
    }
  }