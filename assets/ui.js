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
    uiLanguageText: document.getElementById('ui-language-text'), // Span inside label
    headerLanguageLabel: document.getElementById('header-language-label'),
    headerVoiceLabel: document.getElementById('header-voice-label'),
    // Source Language
    slLabel: document.getElementById('sl-label'),
    slRateLabel: document.getElementById('sl-rate-label'),
    slPitchLabel: document.getElementById('sl-pitch-label'),
    // Target Languages
    tl1Label: document.getElementById('tl1-label'),
    tl1RateLabel: document.getElementById('tl1-rate-label'),
    tl1PitchLabel: document.getElementById('tl1-pitch-label'),
    tl2Label: document.getElementById('tl2-label'),
    tl2RateLabel: document.getElementById('tl2-rate-label'),
    tl2PitchLabel: document.getElementById('tl2-pitch-label'),
    tl3Label: document.getElementById('tl3-label'),
    tl3RateLabel: document.getElementById('tl3-rate-label'),
    tl3PitchLabel: document.getElementById('tl3-pitch-label'),
    tl4Label: document.getElementById('tl4-label'),
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
          if (key === 'settingsButtonTitle') {
            translatedText = getTranslation('titleSettingsButton');
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
          } else if (key === 'slRateLabel' || key === 'tl1RateLabel' || key === 'tl2RateLabel' || key === 'tl3RateLabel' || key === 'tl4RateLabel') {
            translatedText = getTranslation('labelRate');
            element.textContent = translatedText;
          } else if (key === 'slPitchLabel' || key === 'tl1PitchLabel' || key === 'tl2PitchLabel' || key === 'tl3PitchLabel' || key === 'tl4PitchLabel') {
            translatedText = getTranslation('labelPitch');
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
            element.textContent = translatedText;
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
  }
}

// Function to rebuild language and voice dropdowns (now synchronous)
// Note: This assumes createLanguageDropdown and createLanguageSelector will also be made synchronous
function rebuildLanguageDropdowns() {
  // Depends on: createLanguageDropdown, createLanguageSelector (language_dropdown.js - TO BE MADE SYNC)
  // Depends on: updateVoiceDropdown (voice-dropdown-menu.js - TO BE MADE SYNC)
  // Depends on: currentLanguage (global)

  const slContainer = document.getElementById('sl-container');
  const tl1Container = document.getElementById('tl1-container');
  const tl2Container = document.getElementById('tl2-container');
  const tl3Container = document.getElementById('tl3-container');
  const tl4Container = document.getElementById('tl4-container');
  const uiLangContainer = document.getElementById('language-selector-container');

  // Store current values
  const currentSlValue = slContainer?.querySelector('select#sl')?.value;
  const currentTl1Value = tl1Container?.querySelector('select#tl1')?.value;
  const currentTl2Value = tl2Container?.querySelector('select#tl2')?.value;
  const currentTl3Value = tl3Container?.querySelector('select#tl3')?.value;
  const currentTl4Value = tl4Container?.querySelector('select#tl4')?.value;

  // Replace existing selects or create if they don't exist (no awaits)

  if (slContainer) {
    // createLanguageDropdown will be made synchronous later
    const newSlSelect = createLanguageDropdown('sl');
    const oldSlSelect = slContainer.querySelector('select#sl');
    if (oldSlSelect) oldSlSelect.replaceWith(newSlSelect); else slContainer.insertBefore(newSlSelect, slContainer.querySelector('#sl-voice'));
    if (currentSlValue) newSlSelect.value = currentSlValue;
    const slVoiceSelect = document.getElementById('sl-voice');
    if (slVoiceSelect && typeof updateVoiceDropdown === 'function') {
      // updateVoiceDropdown will be made synchronous later
      updateVoiceDropdown(slVoiceSelect, newSlSelect.value);
    }
  }

  if (tl1Container) {
    const newTl1Select = createLanguageDropdown('tl1');
    const oldTl1Select = tl1Container.querySelector('select#tl1');
    if (oldTl1Select) oldTl1Select.replaceWith(newTl1Select); else tl1Container.insertBefore(newTl1Select, tl1Container.querySelector('#tl1-voice'));
    if (currentTl1Value) newTl1Select.value = currentTl1Value;
    const tl1VoiceSelect = document.getElementById('tl1-voice');
    if (tl1VoiceSelect && typeof updateVoiceDropdown === 'function') {
      updateVoiceDropdown(tl1VoiceSelect, newTl1Select.value);
    }
  }

  if (tl2Container) {
    const tl2VoiceSelect = document.getElementById('tl2-voice');
    if (!tl2Container.classList.contains('hide')) {
      const newTl2Select = createLanguageDropdown('tl2');
      const oldTl2Select = tl2Container.querySelector('select#tl2');
      if (oldTl2Select) oldTl2Select.replaceWith(newTl2Select); else tl2Container.insertBefore(newTl2Select, tl2Container.querySelector('#tl2-voice'));
      if (currentTl2Value) newTl2Select.value = currentTl2Value;
      if (tl2VoiceSelect && typeof updateVoiceDropdown === 'function') {
        updateVoiceDropdown(tl2VoiceSelect, newTl2Select.value);
      }
    } else if (tl2VoiceSelect && typeof updateVoiceDropdown === 'function') {
      updateVoiceDropdown(tl2VoiceSelect, null); // Clear if hidden
    }
  }

  if (tl3Container) {
    const tl3VoiceSelect = document.getElementById('tl3-voice');
    if (!tl3Container.classList.contains('hide')) {
      const newTl3Select = createLanguageDropdown('tl3');
      const oldTl3Select = tl3Container.querySelector('select#tl3');
      if (oldTl3Select) oldTl3Select.replaceWith(newTl3Select); else tl3Container.insertBefore(newTl3Select, tl3Container.querySelector('#tl3-voice'));
      if (currentTl3Value) newTl3Select.value = currentTl3Value;
      if (tl3VoiceSelect && typeof updateVoiceDropdown === 'function') {
        updateVoiceDropdown(tl3VoiceSelect, newTl3Select.value);
      }
    } else if (tl3VoiceSelect && typeof updateVoiceDropdown === 'function') {
      updateVoiceDropdown(tl3VoiceSelect, null);
    }
  }

  if (tl4Container) {
    const tl4VoiceSelect = document.getElementById('tl4-voice');
    if (!tl4Container.classList.contains('hide')) {
      const newTl4Select = createLanguageDropdown('tl4');
      const oldTl4Select = tl4Container.querySelector('select#tl4');
      if (oldTl4Select) oldTl4Select.replaceWith(newTl4Select); else tl4Container.insertBefore(newTl4Select, tl4Container.querySelector('#tl4-voice'));
      if (currentTl4Value) newTl4Select.value = currentTl4Value;
      if (tl4VoiceSelect && typeof updateVoiceDropdown === 'function') {
        updateVoiceDropdown(tl4VoiceSelect, newTl4Select.value);
      }
    } else if (tl4VoiceSelect && typeof updateVoiceDropdown === 'function') {
      updateVoiceDropdown(tl4VoiceSelect, null);
    }
  }

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

// Displays a batch of translated sentences in the output area (already synchronous regarding UI translations)
// Depends on: translations (global from ui_translations.js), currentLanguage (global from main.js)
function displayTranslatedBatch(batch, translationsData, sourceLang, targetLangs) {
  const bookContainer = document.getElementById('output');

  for (let i = 0; i < batch.length; i++) {
    const paragraph = document.createElement('div');
    paragraph.style.display = "flex";
    paragraph.style.justifyContent = "space-between";
    paragraph.style.gap = "10px";
    paragraph.style.marginBottom = "10px";
    paragraph.className = 'paragraph';

    const sourcePara = document.createElement('div');
    sourcePara.className = 'source';
    sourcePara.textContent = batch[i];
    paragraph.appendChild(sourcePara);

    if (['ar', 'he', 'fa', 'ur', 'ks', 'ps', 'ug', 'ckb', 'pa', 'sd'].includes(sourceLang)) {
      sourcePara.className += " rtl";
    }

    for (const targetLang of targetLangs) {
      const targetPara = document.createElement('div');
      targetPara.className = 'lang-column';
      if (translationsData[targetLang] && translationsData[targetLang][i] !== undefined) {
        targetPara.textContent = translationsData[targetLang][i];
      } else {
        // Use synchronous fetchTranslation to get the error message
        const errorMsg = fetchTranslation('translationError', currentLanguage);
        targetPara.textContent = errorMsg;
        console.warn(`Missing translation for sentence index ${i} in target language ${targetLang}`);
      }

      if (['ar', 'he', 'fa', 'ur', 'ks', 'ps', 'ug', 'ckb', 'pa', 'sd'].includes(targetLang)) {
        targetPara.className += " rtl";
      }
      paragraph.appendChild(targetPara);
    } // End inner for loop

    bookContainer.appendChild(paragraph);
  } // End outer for loop
} // End displayTranslatedBatch function

// Ensure there are no missing closing braces or syntax errors introduced.
// The last line should be the closing brace of displayTranslatedBatch