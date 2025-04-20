// Contains functions for UI manipulation, event handling, and UI helpers

// Helper function to create a formatted option element

// Depends on: updateUI, currentLanguage (global from main.js)
function setLanguage(lang) {
  currentLanguage = lang;
  // Store preference
  try {
    localStorage.setItem('uiLanguage', lang);
  } catch (e) {
    console.warn("Could not save UI language preference to localStorage:", e);
  }
  updateUI(); // Trigger the update process
}

//Function to translate static UI elements
async function translateUIElements() {
  const uiElements = {
    // Header & General
    pageTitle: document.getElementById('page-title'),
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

  // Helper to get translation, falling back to English
  const getTranslation = async (key, fallbackKey = null) => {
    // Use fallbackKey if provided and the primary key doesn't exist in English
    const primaryKeyExists = translations.en.hasOwnProperty(key);
    const effectiveKey = primaryKeyExists ? key : (fallbackKey && translations.en.hasOwnProperty(fallbackKey) ? fallbackKey : key);
    const englishText = translations.en[effectiveKey];

    if (englishText === undefined) { // Check for undefined specifically
        console.warn(`Translation key "${effectiveKey}" not found in en translations.`);
        return `[${effectiveKey}]`; // Return key if not found in English
    }
    // fetchTranslation is defined in translation_api.js
    return await fetchTranslation(englishText, currentLanguage);
  };

  for (const key in uiElements) {
    if (uiElements.hasOwnProperty(key)) {
      const element = uiElements[key];
      if (element) {
        let translatedText;

        // Handle specific keys/attributes
        if (key === 'settingsButtonTitle') {
          translatedText = await getTranslation('titleSettingsButton');
          element.title = translatedText;
        } else if (key === 'enterText' || key === 'statAreaPlaceholder') {
          translatedText = await getTranslation(key);
          element.placeholder = translatedText;
        } else if (key === 'progressTranslatedLabel') {
          translatedText = await getTranslation('translated');
          element.textContent = translatedText;
        } else if (key === 'progressEtaLabel') {
          translatedText = await getTranslation('eta');
          element.textContent = translatedText;
        } else if (key === 'progressEtaValue') {
          // Only set initial "Calculating..." text if the value is currently empty or also "Calculating..."
          const calculatingText = await getTranslation('statusCalculating');
          if (!element.textContent || element.textContent === calculatingText) {
             element.textContent = calculatingText;
          }
        } else if (key === 'firefoxWarningBody') {
          // Special handling to keep the structure
          const bodyText = await getTranslation('firefoxWarningBody');
          element.textContent = bodyText; // Set only the body text here
        } else if (key === 'slRateLabel' || key === 'tl1RateLabel' || key === 'tl2RateLabel' || key === 'tl3RateLabel' || key === 'tl4RateLabel') {
          translatedText = await getTranslation('labelRate');
          element.textContent = translatedText;
        } else if (key === 'slPitchLabel' || key === 'tl1PitchLabel' || key === 'tl2PitchLabel' || key === 'tl3PitchLabel' || key === 'tl4PitchLabel') {
          translatedText = await getTranslation('labelPitch');
          element.textContent = translatedText;
        // **** START CHANGE ****
        } else if (key === 'uiLanguageText') { // <<< ADD THIS ELSE IF BLOCK
          // Use the correct translation key 'uiLanguage' for the element mapped by 'uiLanguageText'
          translatedText = await getTranslation('uiLanguage');
          element.textContent = translatedText + ':'; // Add the colon back
        // **** END CHANGE ****
        } else {
          // Default: Set textContent for labels, buttons, headers, etc.
          // Use specific keys where needed (e.g., sourceLabel for slLabel element)
          let translationKey = key;
          if (key === 'slLabel') translationKey = 'sourceLabel';
          else if (key === 'tl1Label') translationKey = 'targetLabel1';
          else if (key === 'tl2Label') translationKey = 'targetLabel2';
          else if (key === 'tl3Label') translationKey = 'targetLabel3';
          else if (key === 'tl4Label') translationKey = 'targetLabel4';
          else if (key === 'threadsLabel') translationKey = 'labelThreads';
          else if (key === 'mergeByLabel') translationKey = 'labelMergeBy';
          // Add other specific mappings if element ID doesn't match translation key directly

          translatedText = await getTranslation(translationKey);
          element.textContent = translatedText;
        }
      } else {
         // console.warn(`UI element not found for key: ${key}`); // Optional warning
      }
    }
  }

  // Update slider text values separately as they depend on current value + translation
  document.querySelectorAll('.mergefiles').forEach(async slider => {
      const valueSpan = slider.closest('.slider-container')?.querySelector('.merge-value');
      if (valueSpan) {
          const value = slider.value;
          const allText = await getTranslation('textAll');
          const pcsText = await getTranslation('textPieces');
          valueSpan.textContent = value == 100 ? allText : `${value} ${pcsText}`;
      }
  });
}


// NEW: Function to rebuild language and voice dropdowns
async function rebuildLanguageDropdowns() {
  // Depends on: createLanguageDropdown, createLanguageSelector (language_dropdown.js)
  // Depends on: updateVoiceDropdown (voice-dropdown-menu.js)
  // Depends on: currentLanguage (global)

  const slContainer = document.getElementById('sl-container');
  const tl1Container = document.getElementById('tl1-container');
  const tl2Container = document.getElementById('tl2-container');
  const tl3Container = document.getElementById('tl3-container');
  const tl4Container = document.getElementById('tl4-container');
  const uiLangContainer = document.getElementById('language-selector-container');

  // Store current values before replacing elements
  const currentSlValue = slContainer.querySelector('select#sl')?.value;
  const currentTl1Value = tl1Container.querySelector('select#tl1')?.value;
  const currentTl2Value = tl2Container.querySelector('select#tl2')?.value;
  const currentTl3Value = tl3Container.querySelector('select#tl3')?.value;
  const currentTl4Value = tl4Container.querySelector('select#tl4')?.value;

  // Replace existing selects or create if they don't exist

  if (slContainer) {
    const newSlSelect = await createLanguageDropdown('sl');
    const oldSlSelect = slContainer.querySelector('select#sl');
    if (oldSlSelect) oldSlSelect.replaceWith(newSlSelect); else slContainer.insertBefore(newSlSelect, slContainer.querySelector('#sl-voice'));
    if (currentSlValue) newSlSelect.value = currentSlValue;
    // Update SL voice dropdown based on the (potentially restored) SL language value
    const slVoiceSelect = document.getElementById('sl-voice');
    if (slVoiceSelect && typeof updateVoiceDropdown === 'function') {
      updateVoiceDropdown(slVoiceSelect, newSlSelect.value);
    }
  }

  // --- Target Language 1 ---
  if (tl1Container) {
    const newTl1Select = await createLanguageDropdown('tl1');
    const oldTl1Select = tl1Container.querySelector('select#tl1');
    if (oldTl1Select) oldTl1Select.replaceWith(newTl1Select); else tl1Container.insertBefore(newTl1Select, tl1Container.querySelector('#tl1-voice'));

    // Set value: Use previous value if available, otherwise default (handled in createLanguageDropdown)
    if (currentTl1Value) {
      newTl1Select.value = currentTl1Value;
    }
    // Update TL1 voice dropdown (existing code)
    const tl1VoiceSelect = document.getElementById('tl1-voice');
    if (tl1VoiceSelect && typeof updateVoiceDropdown === 'function') {
      updateVoiceDropdown(tl1VoiceSelect, newTl1Select.value);
    }
  }

  // --- Target Language 2 ---
  if (tl2Container) {
    // Only rebuild if visible, but always ensure voice dropdown is correct
    const tl2VoiceSelect = document.getElementById('tl2-voice');
    if (!tl2Container.classList.contains('hide')) {
      const newTl2Select = await createLanguageDropdown('tl2');
      const oldTl2Select = tl2Container.querySelector('select#tl2');
      if (oldTl2Select) oldTl2Select.replaceWith(newTl2Select); else tl2Container.insertBefore(newTl2Select, tl2Container.querySelector('#tl2-voice'));
      if (currentTl2Value) newTl2Select.value = currentTl2Value;
      // Update TL2 voice dropdown
      const tl2VoiceSelect = document.getElementById('tl2-voice');
      if (tl2VoiceSelect && typeof updateVoiceDropdown === 'function') {
        updateVoiceDropdown(tl2VoiceSelect, newTl2Select.value);
      }
    } else {
      // Ensure voice dropdown is cleared if container is hidden
      const tl2VoiceSelect = document.getElementById('tl2-voice');
      if (tl2VoiceSelect && typeof updateVoiceDropdown === 'function') {
        updateVoiceDropdown(tl2VoiceSelect, null); // Pass null to clear
      }
    }
  }

  // --- Target Language 3 ---
  if (tl3Container) {
    const tl3VoiceSelect = document.getElementById('tl3-voice');
    if (!tl3Container.classList.contains('hide')) {
      const newTl3Select = await createLanguageDropdown('tl3');
      const oldTl3Select = tl3Container.querySelector('select#tl3');
      if (oldTl3Select) oldTl3Select.replaceWith(newTl3Select); else tl3Container.insertBefore(newTl3Select, tl3Container.querySelector('#tl3-voice'));
      if (currentTl3Value) newTl3Select.value = currentTl3Value;
      // Update TL3 voice dropdown
      const tl3VoiceSelect = document.getElementById('tl3-voice');
      if (tl3VoiceSelect && typeof updateVoiceDropdown === 'function') {
        updateVoiceDropdown(tl3VoiceSelect, newTl3Select.value);
      }
    } else {
      const tl3VoiceSelect = document.getElementById('tl3-voice');
      if (tl3VoiceSelect && typeof updateVoiceDropdown === 'function') {
        updateVoiceDropdown(tl3VoiceSelect, null);
      }
    }
  }

  // --- Target Language 4 ---
  if (tl4Container) {
    const tl4VoiceSelect = document.getElementById('tl4-voice');
    if (!tl4Container.classList.contains('hide')) {
      const newTl4Select = await createLanguageDropdown('tl4');
      const oldTl4Select = tl4Container.querySelector('select#tl4');
      if (oldTl4Select) oldTl4Select.replaceWith(newTl4Select); else tl4Container.insertBefore(newTl4Select, tl4Container.querySelector('#tl4-voice'));
      if (currentTl4Value) newTl4Select.value = currentTl4Value;
      // Update TL4 voice dropdown
      const tl4VoiceSelect = document.getElementById('tl4-voice');
      if (tl4VoiceSelect && typeof updateVoiceDropdown === 'function') {
        updateVoiceDropdown(tl4VoiceSelect, newTl4Select.value);
      }
    } else {
      const tl4VoiceSelect = document.getElementById('tl4-voice');
      if (tl4VoiceSelect && typeof updateVoiceDropdown === 'function') {
        updateVoiceDropdown(tl4VoiceSelect, null);
      }
    }
  }

  // --- Update UI language selector ---
  if (uiLangContainer) {
    const newUiLangSelect = await createLanguageSelector();
    const oldUiLangSelect = uiLangContainer.querySelector('select#ui-language-selector');
    if (oldUiLangSelect) oldUiLangSelect.replaceWith(newUiLangSelect); else uiLangContainer.appendChild(newUiLangSelect);
    // Set the value *after* replacing/appending
    newUiLangSelect.value = currentLanguage; // Ensure the current UI language is selected
  }
}


// Main UI update function - orchestrates translation and dropdown rebuilding
// Depends on: translateUIElements, rebuildLanguageDropdowns (defined above)
// Depends on: attachEventListeners (event_listeners.js)
async function updateUI() {
  // 1. Translate static text elements
  await translateUIElements();

  // 2. Rebuild language/voice dropdowns and restore selections
  await rebuildLanguageDropdowns();

  // 3. Re-attach event listeners (important after replacing elements)
  // Depends on: attachEventListeners (event_listeners.js)
  attachEventListeners(); // Encapsulate listener attachment
}


// Shows a target language container and updates UI
// Depends on: updateUI (defined above)
function showTargetLang(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return; // Safety check

  // Store the currently selected language *before* showing and potentially replacing the select
  const langSelectElement = container.querySelector('select[id^="tl"]'); // More specific selector
  const selectedLanguage = langSelectElement ? langSelectElement.value : null;

  container.classList.remove('hide');

  // If showing TL1, hide the initial add button
  if (containerId === 'tl1-container') {
    document.getElementById('add-first-target-button')?.classList.add('hide');
  }

  // Crucially, call updateUI *after* showing the container
  // so it can correctly create/replace the select element if needed.
  // updateUI will now handle updating the voice dropdown based on the selected language.
  updateUI().then(() => {
    // Re-apply the language value *after* updateUI has finished and potentially replaced the select
    const newLangSelectElement = document.getElementById(containerId)?.querySelector('select[id^="tl"]');
    if (newLangSelectElement && selectedLanguage) {
      newLangSelectElement.value = selectedLanguage;
      // Trigger the voice update manually again in case the value restoration didn't trigger a change event
      // (though updateUI should have handled it)
      const voiceSelectId = newLangSelectElement.id + '-voice';
      const voiceSelectElement = document.getElementById(voiceSelectId);
      if (voiceSelectElement && typeof updateVoiceDropdown === 'function') {
        updateVoiceDropdown(voiceSelectElement, newLangSelectElement.value);
      }
    }
    // No need to call attachEventListeners here, as updateUI already does it.
  });
}

// Hides a target language container and clears associated dropdowns
// Depends on: updateVoiceDropdown (voice-dropdown-menu.js)
function hideTargetLang(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return; // Safety check

  // Clear the value of the language select being hidden
  const langSelectElement = container.querySelector('select[id^="tl"]');
  if (langSelectElement) {
    langSelectElement.value = ''; // Or set to a default if applicable
  }

  // Clear the corresponding voice dropdown
  // Depends on: updateVoiceDropdown (voice-dropdown-menu.js)
  const voiceSelectId = langSelectElement ? langSelectElement.id + '-voice' : null;
  if (voiceSelectId) {
    const voiceSelectElement = document.getElementById(voiceSelectId);
    if (voiceSelectElement && typeof updateVoiceDropdown === 'function') {
      updateVoiceDropdown(voiceSelectElement, null); // Pass null to clear/show placeholder
    }
  }

  container.classList.add('hide');

  // If hiding TL1, re-show the initial add button
  if (containerId === 'tl1-container') {
    document.getElementById('add-first-target-button')?.classList.remove('hide');
  }

  // No need to call updateUI here unless hiding affects other elements' layout significantly
  // Event listeners will be re-attached if another action calls updateUI later.
}

// Displays a batch of translated sentences in the output area
// Depends on: translations (global from ui_translations.js), currentLanguage (global from main.js)
function displayTranslatedBatch(batch, translationsData, sourceLang, targetLangs) { // Renamed 'translations' param
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
      // Check if the translated sentence exists and is not undefined
      if (translationsData[targetLang] && translationsData[targetLang][i] !== undefined) {
        targetPara.textContent = translationsData[targetLang][i];
      } else {
        // translations object is defined in ui_translations.js, currentLanguage is global here
        const errorMsg = translations[currentLanguage]?.translationError || translations['en'].translationError; //Fallback to english if currentLanguage is not loaded yet.
        targetPara.textContent = errorMsg;
        console.warn(`Missing translation for sentence index ${i} in target language ${targetLang}`);
      }


      if (['ar', 'he', 'fa', 'ur', 'ks', 'ps', 'ug', 'ckb', 'pa', 'sd'].includes(targetLang)) {
        targetPara.className += " rtl";
      }
      paragraph.appendChild(targetPara);
    }

    bookContainer.appendChild(paragraph);
  }
}