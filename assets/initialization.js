// Contains the main initialization logic executed when the DOM is ready.

// --- Initialization ---

// Modify DOMContentLoaded to set initial UI language and populate dropdowns
document.addEventListener('DOMContentLoaded', async () => {
    // Calculate globals dependent on languageData
    // Note: languageCodes and maxCodeLength are declared globally in main.js for now.
    // Consider passing them or recalculating if they are only needed here.
    languageCodes = languageData.map(lang => lang.Code); // Get language codes from languageData
    const allCodes = languageData.map(lang => lang.Code);
    allCodes.push('auto'); // Include 'auto' for calculation
    maxCodeLength = Math.max(...allCodes.map(code => code.length));
  
  
    if (navigator.userAgent.toLowerCase().includes('firefox')) {
      const warningDiv = document.getElementById('firefox-warning');
      if (warningDiv) {
        warningDiv.classList.remove('hide');
      }
    }
  
    // Load UI language preference
    let preferredLanguage = null;
    try {
      preferredLanguage = localStorage.getItem('uiLanguage');
    } catch (e) {
      console.warn("Could not read UI language preference from localStorage:", e);
    }
  
    if (preferredLanguage && languageCodes.includes(preferredLanguage)) {
      currentLanguage = preferredLanguage;
    } else {
      // Fallback to browser language if no preference stored or invalid
      const userPreferredLanguage = navigator.language || navigator.userLanguage;
      let browserLangCode = userPreferredLanguage; // e.g., en-US
      if (!languageCodes.includes(browserLangCode)) {
        browserLangCode = userPreferredLanguage.split('-')[0]; // e.g., en
      }
      if (browserLangCode && languageCodes.includes(browserLangCode)) {
        currentLanguage = browserLangCode;
      } else {
        currentLanguage = 'en'; // Ultimate fallback
      }
    }
  
    // --- Initial Population (will be refined by updateUI) ---
    // Add language selector to the page (placeholder, will be replaced by updateUI)
    const languageSelectorContainer = document.getElementById('language-selector-container');
    const languageSelectorLabel = document.querySelector('#language-selector-container label');
    languageSelectorLabel.htmlFor = 'ui-language-selector';
    // Create and append a temporary selector, updateUI will replace it correctly styled.
    const tempUiSelector = document.createElement('select');
    tempUiSelector.id = 'ui-language-selector';
    languageSelectorContainer.appendChild(tempUiSelector);
  
  
  
  
    // --- Call updateUI to correctly populate language dropdowns and translate ---
    // updateUI is defined in ui.js
    await updateUI(); // This will now handle initial population and translation
  
    // --- Populate Voice Dropdowns ---
    // REMOVED: populateVoiceDropdowns(); // This is now handled within updateUI
  
    // Attach event listeners after the initial UI is built
    // attachEventListeners is defined in event_listeners.js (will be moved there)
    attachEventListeners(); // This will now attach handleGenerateButtonClick
  
    // --- Initialize Slider Values ---
    // Ensure sliders show their initial values correctly
    // handleSliderChange is defined in event_listeners.js (will be moved there)
    document.querySelectorAll('.rate-slider, .pitch-slider, .max-threads, .mergefiles').forEach(slider => { // Added threads/merge
      handleSliderChange({ target: slider }); // Trigger update using the handler
    });
  
    // Load advanced settings visibility state if saved
    // loadSettings(); // Uncomment if loadSettings function is implemented in settings.js
  });