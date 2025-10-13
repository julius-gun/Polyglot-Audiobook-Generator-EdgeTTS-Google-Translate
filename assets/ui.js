// Contains functions for UI manipulation, event handling, and UI helpers

// Depends on: updateUI, currentLanguage (global from main.js), ensureTranslationsAvailable (translation_api.js),
//             fetchTranslation (sync from translation_api.js), createLanguageDropdown, createLanguageSelector (language_dropdown.js - sync),
//             updateVoiceDropdown (voice-dropdown-menu.js - sync), attachEventListeners (event_listeners.js)

// Make setLanguage async to wait for translations
async function setLanguage(lang) {
  currentLanguage = lang;
  // Store preference
  try {
    localStorage.setItem('uiLanguage', lang);
  } catch (e) {
    console.warn("Could not save UI language preference to localStorage:", e);
  }
  // Ensure translations are loaded BEFORE updating the UI
  // ensureTranslationsAvailable is defined in translation_api.js
  await ensureTranslationsAvailable(lang);
  updateUI(); // Trigger the synchronous update process
}

// Function to translate static UI elements (now synchronous)
function translateUIElements() {
  const uiElements = {
    // Header & General
    pageTitle: document.getElementById('page-title'), // For browser tab title
    pageTitleH1: document.getElementById('page-title-h1'), // <<< Add this line for the visible H1
    settingsButtonTitle: document.getElementById('settings-button'), // Attribute: title
    infoButtonTitle: document.getElementById('info-button'), // Attribute: title
    uiLanguageText: document.getElementById('ui-language-text'), // Span inside label
    headerLanguageLabel: document.getElementById('header-language-label'),
    headerVoiceLabel: document.getElementById('header-voice-label'),
    // Source Language
    slLabel: document.getElementById('sl-label'),
    slVoiceLabel: document.getElementById('sl-voice-label'), // NEW
    slRateLabel: document.getElementById('sl-rate-label'),
    slPitchLabel: document.getElementById('sl-pitch-label'),
    // Target Languages
    tl1Label: document.getElementById('tl1-label'),
    tl1VoiceLabel: document.getElementById('tl1-voice-label'), // NEW
    tl1RateLabel: document.getElementById('tl1-rate-label'),
    tl1PitchLabel: document.getElementById('tl1-pitch-label'),
    tl2Label: document.getElementById('tl2-label'),
    tl2VoiceLabel: document.getElementById('tl2-voice-label'), // NEW
    tl2RateLabel: document.getElementById('tl2-rate-label'),
    tl2PitchLabel: document.getElementById('tl2-pitch-label'),
    tl3Label: document.getElementById('tl3-label'),
    tl3VoiceLabel: document.getElementById('tl3-voice-label'), // NEW
    tl3RateLabel: document.getElementById('tl3-rate-label'),
    tl3PitchLabel: document.getElementById('tl3-pitch-label'),
    tl4Label: document.getElementById('tl4-label'),
    tl4VoiceLabel: document.getElementById('tl4-voice-label'), // NEW
    tl4RateLabel: document.getElementById('tl4-rate-label'),
    tl4PitchLabel: document.getElementById('tl4-pitch-label'),
    // Advanced Settings
    advancedAudioSettingsTitle: document.getElementById('advanced-audio-settings-title'),
    threadsLabel: document.getElementById('threads-label'),
    mergeByLabel: document.getElementById('merge-by-label'),
    insertFileButton: document.getElementById('insert-file-button'),
    // Text Area & Buttons
    enterSourceTextLabel: document.getElementById('enter-source-text-label'),
    enterText: document.getElementById('source-text'), // Attribute: placeholder
    generateButton: document.getElementById('generate-button'),
    openBookViewButton: document.getElementById('open-book-view-button'),
    saveEpubButton: document.getElementById('save-epub-button'),
    reloadPageButton: document.getElementById('reload-page-button'),
    // Progress & Status
    progressTranslatedLabel: document.getElementById('progress-translated-label'), // Label part
    progressEtaLabel: document.getElementById('progress-eta-label'), // Label part
    progressEtaValue: document.getElementById('progress-eta-value'), // Value part (for Calculating...)
    translationFinishedMessage: document.getElementById('translation-finished-message'),
    statAreaPlaceholder: document.getElementById('stat-area'), // Attribute: placeholder
    // Firefox Warning
    firefoxWarningTitle: document.getElementById('firefox-warning-title'),
    firefoxWarningBody: document.getElementById('firefox-warning-body'),
    // Info Modal
    infoModalTitle: document.getElementById('info-modal-title'),
    infoModalText1: document.getElementById('info-modal-text1'),
    infoModalText2: document.getElementById('info-modal-text2'),
    infoModalLink: document.getElementById('info-modal-link'),
  };

  // Helper to get translation (now synchronous)
  // Uses the simplified fetchTranslation from translation_api.js
  const getTranslation = (key) => {
    // fetchTranslation is now synchronous
    return fetchTranslation(key, currentLanguage);
  };

  for (const key in uiElements) {
    if (uiElements.hasOwnProperty(key)) {
      const element = uiElements[key];
      if (element) {
        let translatedText;
        // Handle specific keys/attributes (no awaits needed)
        if (key === 'pageTitle') { // Handles <title> tag
          translatedText = getTranslation('pageTitle');
          element.textContent = translatedText;
        } else if (key === 'pageTitleH1') { // <<< Add this block to handle H1
          translatedText = getTranslation('pageTitle'); // Use the same translation key
          element.textContent = translatedText;
        } else if (key === 'settingsButtonTitle') { // <<< Separate block for settings button title
          translatedText = getTranslation('titleSettingsButton');
          element.title = translatedText;
        } else if (key === 'infoButtonTitle') {
          translatedText = getTranslation('titleInfoButton');
          element.title = translatedText;
        } else if (key === 'enterText' || key === 'statAreaPlaceholder') { // Use correct key 'statAreaPlaceholder'
          translatedText = getTranslation(key === 'enterText' ? 'enterText' : 'placeholderStatArea'); // Map key correctly
          element.placeholder = translatedText;
        } else if (key === 'progressTranslatedLabel') {
          translatedText = getTranslation('translated');
          element.textContent = translatedText;
        } else if (key === 'progressEtaLabel') {
          translatedText = getTranslation('eta');
          element.textContent = translatedText;
        } else if (key === 'progressEtaValue') {
          const calculatingText = getTranslation('statusCalculating');
          // Only set initial "Calculating..." text if the value is currently empty or also "Calculating..." or the fallback key
          if (!element.textContent || element.textContent === calculatingText || element.textContent === '[statusCalculating]') {
            element.textContent = calculatingText;
          }
        } else if (key === 'firefoxWarningBody') {
          const bodyText = getTranslation('firefoxWarningBody');
          element.textContent = bodyText;
        } else if (key.endsWith('RateLabel')) {
          translatedText = getTranslation('labelRate');
          element.textContent = translatedText;
        } else if (key.endsWith('PitchLabel')) {
          translatedText = getTranslation('labelPitch');
          element.textContent = translatedText;
        } else if (key.endsWith('VoiceLabel') && key !== 'headerVoiceLabel') {
            translatedText = getTranslation('labelVoice');
            element.textContent = translatedText;
        } else if (key === 'uiLanguageText') {
          translatedText = getTranslation('uiLanguage');
          element.textContent = translatedText + ':';
        } else {
          // Default: Set textContent
          let translationKey = key;
          if (key === 'slLabel') translationKey = 'sourceLabel';
          else if (key === 'tl1Label') translationKey = 'targetLabel1';
          else if (key === 'tl2Label') translationKey = 'targetLabel2';
          else if (key === 'tl3Label') translationKey = 'targetLabel3';
          else if (key === 'tl4Label') translationKey = 'targetLabel4';
          else if (key === 'threadsLabel') translationKey = 'labelThreads';
          else if (key === 'mergeByLabel') translationKey = 'labelMergeBy';
          // Add other specific mappings if needed

          translatedText = getTranslation(translationKey);
          // Ensure textContent is set only if translation is found
          if (translatedText !== undefined && translatedText !== null) {
            element.textContent = translatedText;
          } else {
            console.warn(`Translation not found for key: ${translationKey} (mapped from ${key})`);
            // Optionally set a default or leave it as is
            // element.textContent = `[${translationKey}]`; // Or keep existing content
          }
        }
      } else {
        // console.warn(`UI element not found for key: ${key}`);
      }
    }
  }
    // Update slider text values (now synchronous)
    document.querySelectorAll('.mergefiles').forEach(slider => {
      const valueSpan = slider.closest('.slider-container')?.querySelector('.merge-value');
      if (valueSpan) {
        const value = slider.value;
        const allText = getTranslation('textAll');
        const pcsText = getTranslation('textPieces');
        valueSpan.textContent = value == 100 ? allText : `${value} ${pcsText}`;
      }
    });

    // --- Add visible text to language action buttons ---
    document.querySelectorAll('.add-lang-button').forEach(button => {
        button.title = ''; // Remove tooltip as text is now visible
        let textSpan = button.querySelector('.button-text-span');
        if (!textSpan) {
            textSpan = document.createElement('span');
            textSpan.className = 'button-text-span';
            button.appendChild(textSpan);
        }
        textSpan.textContent = getTranslation('buttonAddLanguage');
    });
    document.querySelectorAll('.remove-lang-button').forEach(button => {
        button.title = ''; // Remove tooltip
        let textSpan = button.querySelector('.button-text-span');
        if (!textSpan) {
            textSpan = document.createElement('span');
            textSpan.className = 'button-text-span';
            button.appendChild(textSpan);
        }
        textSpan.textContent = getTranslation('buttonRemoveLanguage');
    });
}

// Function to rebuild language and voice dropdowns (now synchronous)
// Note: This assumes createLanguageDropdown and createLanguageSelector will also be made synchronous
function rebuildLanguageDropdowns() {
  const containers = [
    { id: 'sl-container', langId: 'sl' },
    { id: 'tl1-container', langId: 'tl1' },
    { id: 'tl2-container', langId: 'tl2' },
    { id: 'tl3-container', langId: 'tl3' },
    { id: 'tl4-container', langId: 'tl4' },
  ];
  const uiLangContainer = document.getElementById('language-selector-container');

  // Store current values before rebuilding
  const currentValues = {};
  containers.forEach(c => {
    const select = document.getElementById(c.langId);
    if (select) {
      currentValues[c.langId] = select.value;
    }
  });


  // Helper function to process each language row
  const processRow = (containerId, langId) => {
      const rowContainer = document.getElementById(containerId);
      if (!rowContainer || (containerId.startsWith('tl') && rowContainer.classList.contains('hide'))) {
          // If the container doesn't exist or it's a hidden target language, skip
          // but we still might need to clear the voice dropdown if it exists from a previous state
          const voiceSelect = document.getElementById(`${langId}-voice`);
          if (voiceSelect && typeof updateVoiceDropdown === 'function') {
              updateVoiceDropdown(voiceSelect, null);
          }
          return;
    }

      const wrapper = rowContainer.querySelector('.language-and-voice-container');
      if (!wrapper) return;

      const newLangSelect = createLanguageDropdown(langId);
      const oldLangSelect = wrapper.querySelector(`select#${langId}`);
      const voiceLabel = wrapper.querySelector(`#${langId}-voice-label`);

      if (oldLangSelect) {
          oldLangSelect.replaceWith(newLangSelect);
      } else if (voiceLabel) {
          // Insert the new language select before its corresponding voice label
          wrapper.insertBefore(newLangSelect, voiceLabel);
      }

      // Restore previous value if it exists
      if (currentValues[langId]) {
          newLangSelect.value = currentValues[langId];
      }

      // Update the corresponding voice dropdown
      const voiceSelect = document.getElementById(`${langId}-voice`);
      if (voiceSelect && typeof updateVoiceDropdown === 'function') {
          updateVoiceDropdown(voiceSelect, newLangSelect.value);
      }
  };


  // Process all language rows
  containers.forEach(c => processRow(c.id, c.langId));

  // Update UI language selector (no await)
  if (uiLangContainer) {
    // createLanguageSelector is synchronous
    const newUiLangSelect = createLanguageSelector();
    const oldUiLangSelect = uiLangContainer.querySelector('select#ui-language-selector');
    if (oldUiLangSelect) oldUiLangSelect.replaceWith(newUiLangSelect); else uiLangContainer.appendChild(newUiLangSelect);
    newUiLangSelect.value = currentLanguage;
  }
}


// Main UI update function - now synchronous
// Depends on: translateUIElements, rebuildLanguageDropdowns (defined above)
// Depends on: attachEventListeners (event_listeners.js)
function updateUI() {
  // 1. Translate static text elements (synchronous)
  translateUIElements();

  // 2. Rebuild language/voice dropdowns and restore selections (synchronous)
  rebuildLanguageDropdowns();

  // 3. Re-attach event listeners (synchronous)
  // Depends on: attachEventListeners (event_listeners.js)
  attachEventListeners();
}


// Shows a target language container and updates UI (now synchronous)
// Depends on: updateUI (defined above)
function showTargetLang(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const langSelectElement = container.querySelector('select[id^="tl"]');
  const selectedLanguage = langSelectElement ? langSelectElement.value : null;

  container.classList.remove('hide');

  if (containerId === 'tl1-container') {
    document.getElementById('add-first-target-button')?.classList.add('hide');
  }

  // Call synchronous updateUI
  updateUI();

  // Re-apply the language value *after* updateUI has finished
  const newLangSelectElement = document.getElementById(containerId)?.querySelector('select[id^="tl"]');
  if (newLangSelectElement && selectedLanguage) {
    newLangSelectElement.value = selectedLanguage;
    // Trigger voice update manually again
    const voiceSelectId = newLangSelectElement.id + '-voice';
    const voiceSelectElement = document.getElementById(voiceSelectId);
    if (voiceSelectElement && typeof updateVoiceDropdown === 'function') {
      // updateVoiceDropdown is synchronous
      updateVoiceDropdown(voiceSelectElement, newLangSelectElement.value);
    }
  }
}

// Hides a target language container and clears associated dropdowns (already synchronous)
// Depends on: updateVoiceDropdown (voice-dropdown-menu.js - TO BE MADE SYNC)
function hideTargetLang(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const langSelectElement = container.querySelector('select[id^="tl"]');
  if (langSelectElement) {
    langSelectElement.value = '';
  }

  const voiceSelectId = langSelectElement ? langSelectElement.id + '-voice' : null;
  if (voiceSelectId) {
    const voiceSelectElement = document.getElementById(voiceSelectId);
    if (voiceSelectElement && typeof updateVoiceDropdown === 'function') {
      // updateVoiceDropdown is synchronous
      updateVoiceDropdown(voiceSelectElement, null);
    }
  }

  container.classList.add('hide');

  if (containerId === 'tl1-container') {
    document.getElementById('add-first-target-button')?.classList.remove('hide');
  }
}

// Function to update the title/label above the progress bar
function updateProgressTitle(titleKey) {
  const progressTitleElement = document.getElementById('progress-title'); // Assuming an element with this ID exists or will be added
  if (progressTitleElement) {
      progressTitleElement.textContent = fetchTranslation(titleKey, currentLanguage);
      progressTitleElement.classList.remove('hide');
  } else {
      // Fallback: Log if element not found
      console.warn("Progress title element ('progress-title') not found. Cannot update title.");
      // As a fallback, maybe update the progress-info area?
      const progressInfo = document.getElementById('progress-info');
      if (progressInfo) {
           progressInfo.innerHTML = `<strong>${fetchTranslation(titleKey, currentLanguage)}</strong><br>` + progressInfo.innerHTML;
      }
  }
}

// Displays a batch of translated sentences in the output area (already synchronous regarding UI translations)
// Depends on: translations (global from ui_translations.js), currentLanguage (global from main.js)
function displayTranslatedBatch(batch, translationsData, sourceLang, targetLangs) {
  const bookContainer = document.getElementById('output');
    if (!bookContainer) return; // Exit if container not found

  for (let i = 0; i < batch.length; i++) {
        const paragraphContainer = document.createElement('div');
        // paragraphContainer.style.display = "flex"; // Use CSS class instead
        // paragraphContainer.style.justifyContent = "space-between";
        // paragraphContainer.style.gap = "10px";
        // paragraphContainer.style.marginBottom = "10px";
        paragraphContainer.className = 'paragraph'; // Use class from styles

        const sourceDiv = document.createElement('div');
        sourceDiv.className = 'source';
        sourceDiv.textContent = batch[i];
        paragraphContainer.appendChild(sourceDiv);

        // Check RTL for source
    if (['ar', 'he', 'fa', 'ur', 'ks', 'ps', 'ug', 'ckb', 'pa', 'sd'].includes(sourceLang)) {
            sourceDiv.classList.add("rtl");
    }

    for (const targetLang of targetLangs) {
            const targetDiv = document.createElement('div');
            targetDiv.className = 'lang-column'; // Use class from styles
      if (translationsData[targetLang] && translationsData[targetLang][i] !== undefined) {
                targetDiv.textContent = translationsData[targetLang][i];
      } else {
        const errorMsg = fetchTranslation('translationError', currentLanguage);
                targetDiv.textContent = errorMsg;
                targetDiv.style.color = 'red'; // Indicate error visually
        console.warn(`Missing translation for sentence index ${i} in target language ${targetLang}`);
      }

            // Check RTL for target
      if (['ar', 'he', 'fa', 'ur', 'ks', 'ps', 'ug', 'ckb', 'pa', 'sd'].includes(targetLang)) {
                targetDiv.classList.add("rtl");
      }
            paragraphContainer.appendChild(targetDiv);
        }

        bookContainer.appendChild(paragraphContainer);
  } // End outer for loop
} // End displayTranslatedBatch function

// Ensure there are no missing closing braces or syntax errors introduced.
// The last line should be the closing brace of displayTranslatedBatch
