// Contains functions for UI manipulation, event handling, and UI helpers

// Helper function to create a formatted option element
// Depends on: maxCodeLength (global from main.js), languageData (global from language_data.js)
function createLanguageOptionElement(langInfo) {
  const option = document.createElement('option');
  option.value = langInfo.Code;
  const code = langInfo.Code;
  const padding = '\u00A0'.repeat(maxCodeLength - code.length); // Use non-breaking spaces
  // Format: <code><padding> <flag> <EnglishName> (<NativeName>)
  option.textContent = `${code}${padding}\u00A0\u00A0${langInfo.Flag}\u00A0\u00A0${langInfo.EnglishName} (${langInfo.NativeName})`;
  return option;
}

// Depends on: createLanguageOptionElement, fetchTranslation (from translation_api.js),
// translations (global from ui_translations.js), currentLanguage (global from main.js),
// maxCodeLength (global from main.js), languageData (global from language_data.js),
// prioritizedLanguages (global from config.js)
async function createLanguageDropdown(id) {
  const select = document.createElement('select');
  select.id = id;
  const isSourceLanguage = id === 'sl';


  // Separate prioritized and other languages from languageData
  const prioritizedOptions = [];
  const otherOptions = [];

  // Sort languageData by Code for the main list
  const sortedLanguageData = [...languageData].sort((a, b) => a.Code.localeCompare(b.Code));

  sortedLanguageData.forEach(langInfo => {
    const optionElement = createLanguageOptionElement(langInfo);
    if (prioritizedLanguages.includes(langInfo.Code)) {
      prioritizedOptions.push(optionElement);
    }
    otherOptions.push(optionElement.cloneNode(true)); // Clone for the 'all' list
  });

  // Create optgroup for prioritized languages
  if (prioritizedOptions.length > 0) {
    const prioritizedGroup = document.createElement('optgroup');
    prioritizedGroup.label = await fetchTranslation(translations['en'].prioritizedLabel, currentLanguage);
    prioritizedOptions.forEach(option => prioritizedGroup.appendChild(option));
    select.appendChild(prioritizedGroup);
  }

  // Create optgroup for all other languages (sorted by code)
  const othersGroup = document.createElement('optgroup');
  othersGroup.label = await fetchTranslation(translations['en'].allLanguagesLabel, currentLanguage);
  otherOptions.forEach(option => othersGroup.appendChild(option));
  select.appendChild(othersGroup);

  // ADDED: Set default selection for source language if it's the 'sl' dropdown
  // If 'en' exists and is prioritized, select it. Otherwise, select the first prioritized,
  // otherwise select the very first option in the dropdown.
  if (isSourceLanguage && select.options.length > 0) {
      let defaultSelected = false;
      // Try selecting 'en' if it's in prioritized
      const enOption = select.querySelector('optgroup[label="--- Prioritized ---"] option[value="en"]');
      if (enOption) {
          enOption.selected = true;
          defaultSelected = true;
      }

      // If 'en' wasn't selected, try the first prioritized option
      if (!defaultSelected && prioritizedOptions.length > 0) {
          const firstPrioritizedValue = prioritizedOptions[0].value;
          const firstPrioritizedOption = select.querySelector(`option[value="${firstPrioritizedValue}"]`);
          if (firstPrioritizedOption) {
              firstPrioritizedOption.selected = true;
              defaultSelected = true;
          }
      }

      // If still nothing selected, select the very first option overall
      if (!defaultSelected) {
          select.options[0].selected = true;
      }
  }


  return select;
}

// Depends on: updateUI, currentLanguage (global from main.js)
function setLanguage(lang) {
  currentLanguage = lang;
  // Store preference
  try {
    localStorage.setItem('uiLanguage', lang);
  } catch (e) {
    console.warn("Could not save UI language preference to localStorage:", e);
  }
  updateUI();
}

// Depends on: fetchTranslation (from translation_api.js), translations (global from ui_translations.js),
// createLanguageDropdown, createLanguageSelector, attachEventListeners, currentLanguage (global from main.js),
// updateVoiceDropdown (from voice-dropdown-menu.js)
async function updateUI() {
  const uiElements = {
    pageTitle: document.querySelector('h1'),
    sourceLabel: document.querySelector('#sl-container label'),
    targetLabel1: document.querySelector('#tl1-container label'),
    targetLabel2: document.querySelector('#tl2-container label'),
    targetLabel3: document.querySelector('#tl3-container label'),
    targetLabel4: document.querySelector('#tl4-container label'),
    enterText: document.querySelector('#source-text'),
    generateButton: document.querySelector('#generate-button'), // Corrected selector ID
    translatedSpan: document.querySelector('#progress-info span:first-child'),
    etaSpan: document.querySelector('#progress-info span:last-child'),
    uiLanguageLabel: document.querySelector('#ui-language-label span:last-child'),
    openBookViewButton: document.querySelector('#open-book-view-button'),
    saveEpubButton: document.querySelector('#save-epub-button'),
    reloadPageButton: document.querySelector('#reload-page-button'),
    translationFinishedMessage: document.querySelector('#translation-finished-message'),
    enterSourceTextLabel: document.querySelector('h3'), // New label
  };

  for (const key in uiElements) {
    // Check if the key exists in the base English translations
    if (uiElements.hasOwnProperty(key) && translations['en'][key]) {
      const element = uiElements[key];
      if (element) {
        const englishText = translations['en'][key];
        // Fetch translation for the UI element text itself
        const translatedText = await fetchTranslation(englishText, currentLanguage);

        if (key === 'enterText') {
          element.placeholder = translatedText;
        } else if (key === 'translatedSpan') {
          // Special handling for progress info - needs translated "Translated" word
          const translatedWord = await fetchTranslation(translations['en'].translated, currentLanguage);
          const currentProgressText = element.textContent; // Get current numbers
          const numbersMatch = currentProgressText.match(/(\d+)\s*\/\s*(\d+)/);
          const currentTranslated = numbersMatch ? numbersMatch[1] : '0';
          const currentTotal = numbersMatch ? numbersMatch[2] : '0';
          element.textContent = `${translatedWord}: ${currentTranslated} / ${currentTotal}`;
        } else if (key === 'etaSpan') {
          // Special handling for progress info - needs translated "ETA" word
          const translatedWord = await fetchTranslation(translations['en'].eta, currentLanguage);
          const currentEtaText = element.textContent; // Get current time
          const timeMatch = currentEtaText.split(': ')[1]; // Get the part after ": "
          const currentTime = timeMatch ? timeMatch : 'Calculating...';
          element.textContent = `${translatedWord}: ${currentTime}`;
        } else if (key === 'uiLanguageLabel') {
          const translatedWord = await fetchTranslation(translations['en'].uiLanguage, currentLanguage);
          element.textContent = `${translatedWord}:`;
        } else {
          // For buttons, labels, titles, etc.
          element.textContent = translatedText;
        }
      }
    }
  }

  // --- Re-render language dropdowns using the new functions ---
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
  const currentUiLangValue = uiLangContainer.querySelector('select#ui-language-selector')?.value;

  // Replace existing selects or create if they don't exist
  const newSlSelect = await createLanguageDropdown('sl');
  const oldSlSelect = slContainer.querySelector('select#sl');
  if (oldSlSelect) oldSlSelect.replaceWith(newSlSelect); else slContainer.insertBefore(newSlSelect, slContainer.querySelector('#sl-voice'));
  if (currentSlValue) newSlSelect.value = currentSlValue;
  // Update SL voice dropdown based on the (potentially restored) SL language value
  const slVoiceSelect = document.getElementById('sl-voice');
  if (slVoiceSelect && typeof updateVoiceDropdown === 'function') {
      updateVoiceDropdown(slVoiceSelect, newSlSelect.value);
  }

  // --- Target Language 1 ---
  const newTl1Select = await createLanguageDropdown('tl1');
  const oldTl1Select = tl1Container.querySelector('select#tl1');
  if (oldTl1Select) oldTl1Select.replaceWith(newTl1Select); else tl1Container.insertBefore(newTl1Select, tl1Container.querySelector('#tl1-voice'));

  // Set value: Use previous value if available, otherwise default to UI language
  if (currentTl1Value) {
      newTl1Select.value = currentTl1Value;
  } else if (currentLanguage && newTl1Select.querySelector(`option[value="${currentLanguage}"]`)) {
      // Default tl1 to the current UI language if no previous value exists and it's a valid option
      newTl1Select.value = currentLanguage;
  }
  // If neither condition is met, the browser default (usually the first option) will remain selected.

  // Update TL1 voice dropdown (existing code)
  const tl1VoiceSelect = document.getElementById('tl1-voice');
  if (tl1VoiceSelect && typeof updateVoiceDropdown === 'function') {
      updateVoiceDropdown(tl1VoiceSelect, newTl1Select.value);
  }

  // --- Target Language 2 (if visible) ---
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

  // --- Target Language 3 (if visible) ---
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

  // --- Target Language 4 (if visible) ---
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

  // --- Update UI language selector ---
  const newUiLangSelect = await createLanguageSelector();
  const oldUiLangSelect = uiLangContainer.querySelector('select#ui-language-selector');
  if (oldUiLangSelect) oldUiLangSelect.replaceWith(newUiLangSelect); else uiLangContainer.appendChild(newUiLangSelect);
  // Set the value *after* replacing/appending
  newUiLangSelect.value = currentLanguage; // Ensure the current UI language is selected


  // Re-attach event listeners (important after replacing elements)
  attachEventListeners(); // Encapsulate listener attachment
}

// Depends on: createLanguageOptionElement, setLanguage, languageData (global from language_data.js),
// prioritizedLanguages (global from config.js), currentLanguage (global from main.js),
// fetchTranslation (from translation_api.js), translations (global from ui_translations.js) // Added dependencies
async function createLanguageSelector() {
  const select = document.createElement('select');
  select.id = 'ui-language-selector';
  select.classList.add('ui-language-select'); // Add class for styling

  // Separate prioritized and other languages from languageData
  const prioritizedOptions = [];
  const otherOptions = [];

  // Sort languageData by Code for the main list
  const sortedLanguageData = [...languageData].sort((a, b) => a.Code.localeCompare(b.Code));

  sortedLanguageData.forEach(langInfo => {
    // Use the helper function to create the option element
    const optionElement = createLanguageOptionElement(langInfo);
    if (prioritizedLanguages.includes(langInfo.Code)) {
      prioritizedOptions.push(optionElement);
    }
    otherOptions.push(optionElement.cloneNode(true)); // Clone for the 'all' list
  });

  // Create optgroup for prioritized languages
  if (prioritizedOptions.length > 0) {
    const prioritizedGroup = document.createElement('optgroup');
    prioritizedGroup.label = await fetchTranslation(translations['en'].prioritizedLabel, currentLanguage);
    prioritizedOptions.forEach(option => prioritizedGroup.appendChild(option));
    select.appendChild(prioritizedGroup);
  }

  // Create optgroup for all other languages (sorted by code)
  const othersGroup = document.createElement('optgroup');
  othersGroup.label = await fetchTranslation(translations['en'].allLanguagesLabel, currentLanguage);
  otherOptions.forEach(option => othersGroup.appendChild(option));
  select.appendChild(othersGroup);

  select.value = currentLanguage; // Set initial value
  select.addEventListener('change', (event) => {
    setLanguage(event.target.value);
  });

  return select;
}

// Helper function to attach event listeners
// Depends on: generateBilingualBook (global from main.js), toggleTheme, openBookView,
// saveEpub (from epub_generator.js), reloadPage, showTargetLang, hideTargetLang,
// updateVoiceDropdown (from voice-dropdown-menu.js)
function attachEventListeners() {
  // --- Button Listeners ---
  const generateButton = document.getElementById('generate-button');
  if (generateButton) generateButton.addEventListener('click', generateBilingualBook);


  const openBookViewButton = document.getElementById('open-book-view-button');
  if (openBookViewButton) openBookViewButton.addEventListener('click', openBookView);

  const saveEpubButton = document.getElementById('save-epub-button');
  if (saveEpubButton) saveEpubButton.addEventListener('click', saveEpub);

  const reloadPageButton = document.getElementById('reload-page-button');
  if (reloadPageButton) reloadPageButton.addEventListener('click', reloadPage);

  // --- Add/Remove Language Button Listeners ---
  document.querySelectorAll('.add-lang-button').forEach(button => {
    const targetContainerId = button.getAttribute('onclick')?.match(/'(tl\d+-container)'/)?.[1];
    if (targetContainerId) {
      // Ensure onclick doesn't conflict with event listener
      button.onclick = null; // Remove inline handler
      button.removeEventListener('click', showTargetLangHandler); // Remove previous listener if any
      button.addEventListener('click', showTargetLangHandler); // Add listener
      button.dataset.targetContainerId = targetContainerId; // Store target ID
    }
  });
  document.querySelectorAll('.remove-lang-button').forEach(button => {
    const targetContainerId = button.getAttribute('onclick')?.match(/'(tl\d+-container)'/)?.[1];
    if (targetContainerId) {
      // Ensure onclick doesn't conflict with event listener
      button.onclick = null; // Remove inline handler
      button.removeEventListener('click', hideTargetLangHandler); // Remove previous listener if any
      button.addEventListener('click', hideTargetLangHandler); // Add listener
      button.dataset.targetContainerId = targetContainerId; // Store target ID
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

  // UI language selector listener is attached within createLanguageSelector
}

// --- Event Handlers ---

// Handler for language dropdown changes
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

// Handler for add language button clicks
function showTargetLangHandler(event) {
    const targetContainerId = event.currentTarget.dataset.targetContainerId;
    if (targetContainerId) {
        showTargetLang(targetContainerId);
    }
}

// Handler for remove language button clicks
function hideTargetLangHandler(event) {
    const targetContainerId = event.currentTarget.dataset.targetContainerId;
    if (targetContainerId) {
        hideTargetLang(targetContainerId);
    }
}


// Depends on: updateUI, attachEventListeners
// Modified showTargetLang to ensure voice dropdown is updated correctly
function showTargetLang(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return; // Safety check

  // Store the currently selected language *before* showing and potentially replacing the select
  const langSelectElement = container.querySelector('select[id^="tl"]'); // More specific selector
  const selectedLanguage = langSelectElement ? langSelectElement.value : null;

  container.classList.remove('hide');

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

// Modified hideTargetLang to clear the voice dropdown
function hideTargetLang(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return; // Safety check

  // Clear the value of the language select being hidden
  const langSelectElement = container.querySelector('select[id^="tl"]');
  if (langSelectElement) {
    langSelectElement.value = ''; // Or set to a default if applicable
  }

  // Clear the corresponding voice dropdown
  const voiceSelectId = langSelectElement ? langSelectElement.id + '-voice' : null;
  if (voiceSelectId) {
      const voiceSelectElement = document.getElementById(voiceSelectId);
      if (voiceSelectElement && typeof updateVoiceDropdown === 'function') {
          updateVoiceDropdown(voiceSelectElement, null); // Pass null to clear/show placeholder
      }
  }

  container.classList.add('hide');
  // No need to call updateUI here unless hiding affects other elements' layout significantly
  // Event listeners will be re-attached if another action calls updateUI later.
}

function toggleTheme() {
  const body = document.body;
  body.classList.toggle('bw');
}

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
      }


      if (['ar', 'he', 'fa', 'ur', 'ks', 'ps', 'ug', 'ckb', 'pa', 'sd'].includes(targetLang)) {
        targetPara.className += " rtl";
      }
      paragraph.appendChild(targetPara);
    }

    bookContainer.appendChild(paragraph);
  }
}

// Depends on: translations (global from ui_translations.js), currentLanguage (global from main.js), formatTime
function updateProgress(translated, total, startTime) {
  const progressBar = document.getElementById('progress-bar');
  const progressInfo = document.getElementById('progress-info');
  const percent = total === 0 ? 0 : Math.round((translated / total) * 100);
  progressBar.style.width = percent + '%';
  progressBar.textContent = percent + '%';

  const elapsedTime = Date.now() - startTime;
  const estimatedTotalTime = total === 0 ? 0 : (elapsedTime * (total / translated));
  const estimatedTimeRemaining = Math.max(0, estimatedTotalTime - elapsedTime); // Prevent negative time

  // Defensive check: Ensure translations[currentLanguage] exists before accessing properties
  const currentLangTranslations = translations[currentLanguage] || translations['en']; // Fallback to English if not loaded
  const translatedText = currentLangTranslations.translated;
  const etaText = currentLangTranslations.eta;

  progressInfo.innerHTML = `
          <span>${translatedText}: ${translated} / ${total}</span> |
          <span>${etaText}: ${formatTime(estimatedTimeRemaining)}</span>
      `;
}

function formatTime(milliseconds) {
  let seconds = Math.floor(milliseconds / 1000);
  let minutes = Math.floor(seconds / 60);
  let hours = Math.floor(minutes / 60);

  seconds = seconds % 60;
  minutes = minutes % 60;

  let timeString = '';
  if (hours > 0) {
    timeString += `${hours}h `;
  }
  if (minutes > 0 || hours > 0) {
    timeString += `${minutes}m `;
  }
  timeString += `${seconds}s`;

  return timeString.trim();
}

function openBookView() {
  const outputContent = document.getElementById('output').innerHTML;
  const themeClass = document.body.className; // Get current theme class (e.g., 'bw')

  // Define specific CSS for the book view window
  const bookViewStyles = `
      /* Basic body styling */
      body {
        padding: 20px;
        font-family: Arial, sans-serif;
        line-height: 1.6; /* Improve readability */
      }
  
      /* Theme styles (copied and adapted from styles.css) */
      body.bw {
        color: rgb(0, 0, 0);
        background-color: rgb(255, 255, 255);
      }
      body:not(.bw) { /* Default theme */
        color: rgb(53, 39, 0);
        background-color: rgb(255, 234, 203);
      }
      body.bw .paragraph {
          border-bottom-color: #ccc; /* Lighter border for BW theme */
      }
      body:not(.bw) .paragraph {
          border-bottom-color: #e0cba8; /* Theme-appropriate border */
      }
  
  
      /* Paragraph container */
      .paragraph {
        display: flex;
        /* Use gap for spacing between columns */
        gap: 15px; /* Adjust gap as needed */
        margin-bottom: 1em;
        border-bottom: 1px solid #eee; /* Add a light separator line */
        padding-bottom: 1em;
      }
  
      /* Base style for all columns */
      .source, .lang-column {
        /* Distribute space, allow shrinking, but base width is key */
        flex-grow: 1;
        flex-shrink: 1;
        /* Assign a basis percentage. e.g., for 1 source + 2 targets (3 cols) ~33% */
        /* This might need dynamic adjustment if the number of columns varies widely, */
        /* but a fixed percentage often works well enough for up to 4-5 columns. */
        flex-basis: 18%; /* Example: Good starting point for up to 5 columns */
        padding: 5px;
        /* Crucial for preventing overflow and ensuring wrapping */
        overflow-wrap: break-word;
        word-wrap: break-word; /* Legacy fallback */
        word-break: break-word; /* Force break */
        /* Optional: Add border for debugging column boundaries */
        /* border: 1px dotted gray; */
      }
  
      /* Right-to-left text alignment */
      .rtl {
        text-align: right;
        direction: rtl; /* Ensure proper RTL rendering */
      }
  
      /* Style for the horizontal rule if needed */
      hr {
        margin-top: 10px;
        margin-bottom: 20px;
        border: 0;
        border-top: 1px solid #ccc;
      }
      body.bw hr {
          border-top-color: #aaa;
      }
      body:not(.bw) hr {
          border-top-color: #b5722a;
      }
    `;

  const bookViewWindow = window.open('', '_blank');
  if (bookViewWindow) {
    bookViewWindow.document.open();
    bookViewWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            ${bookViewStyles}
          </style>
        </head>
        <body class="${themeClass}">
          ${outputContent}
        </body>
        </html>
      `);
    bookViewWindow.document.close();
  } else {
    // Use the translation system for the alert if possible, otherwise fallback
    const alertMsg = translations[currentLanguage]?.popupBlocked || translations['en'].popupBlocked || 'Could not open book view window. Please check your popup blocker settings.';
    alert(alertMsg);
  }
}

function reloadPage() {
  window.location.reload();
}

function toggleInfo() {
  const infoElement = document.querySelector("#info");
  if (infoElement) { // Check if element exists
    infoElement.classList.toggle("hide");
  }
}

function copy() {
  // Get the text field
  var text = "Hello World"; // Example text, likely needs modification

  // Copy the text inside the text field
  navigator.clipboard.writeText(text);
}