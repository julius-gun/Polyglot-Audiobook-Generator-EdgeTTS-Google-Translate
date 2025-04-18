// Contains functions for creating and populating language selection dropdowns.

// Depends on:
// - Globals: maxCodeLength, currentLanguage (main.js), languageData (language_data.js),
//            prioritizedLanguages (config.js), translations (ui_translations.js)
// - Functions: fetchTranslation (translation_api.js), setLanguage (ui.js)

// Helper function to create a formatted option element
function createLanguageOptionElement(langInfo) {
    const option = document.createElement('option');
    option.value = langInfo.Code;
    const code = langInfo.Code;
  // maxCodeLength is a global calculated in initialization.js
    const padding = '\u00A0'.repeat(maxCodeLength - code.length); // Use non-breaking spaces
    // Format: <code><padding> <flag> <EnglishName> (<NativeName>)
    option.textContent = `${code}${padding}\u00A0\u00A0${langInfo.Flag}\u00A0\u00A0${langInfo.EnglishName} (${langInfo.NativeName})`;
    return option;
  }
  
// Creates a language dropdown (for source or target languages)
  async function createLanguageDropdown(id) {
    const select = document.createElement('select');
    select.id = id;
    const isSourceLanguage = id === 'sl';
    const isTargetLanguage1 = id === 'tl1'; // Added check for TL1
  
  
    // Separate prioritized and other languages from languageData
    const prioritizedOptions = [];
    const otherOptions = [];
  
    // Sort languageData by Code for the main list
  // languageData is global from language_data.js
    const sortedLanguageData = [...languageData].sort((a, b) => a.Code.localeCompare(b.Code));
  
    sortedLanguageData.forEach(langInfo => {
      const optionElement = createLanguageOptionElement(langInfo);
    // prioritizedLanguages is global from config.js
      if (prioritizedLanguages.includes(langInfo.Code)) {
        prioritizedOptions.push(optionElement);
      }
      otherOptions.push(optionElement.cloneNode(true)); // Clone for the 'all' list
    });
  
    // Create optgroup for prioritized languages
    if (prioritizedOptions.length > 0) {
      const prioritizedGroup = document.createElement('optgroup');
    // fetchTranslation is from translation_api.js, translations is global from ui_translations.js, currentLanguage is global from main.js
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
      const enOption = select.querySelector('optgroup[label="' + await fetchTranslation(translations['en'].prioritizedLabel, currentLanguage) + '"] option[value="en"]');
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
      if (!defaultSelected && select.options.length > 0) {
        // Ensure we don't select a disabled option if one exists
        for (let i = 0; i < select.options.length; i++) {
          if (!select.options[i].disabled) {
            select.options[i].selected = true;
            break;
          }
        }
      }
    } else if (isTargetLanguage1 && select.options.length > 0) {
      // Default TL1 to the current UI language if possible, otherwise first non-disabled option
      const uiLangOption = select.querySelector(`option[value="${currentLanguage}"]`);
      if (uiLangOption && !uiLangOption.disabled) {
        uiLangOption.selected = true;
      } else {
        // Select the first non-disabled option
        for (let i = 0; i < select.options.length; i++) {
          if (!select.options[i].disabled) {
            select.options[i].selected = true;
            break;
          }
        }
      }
    }
  
  
    return select;
  }
  
// Creates the UI language selector dropdown
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
  // setLanguage is defined in ui.js
  select.addEventListener('change', (event) => {
    setLanguage(event.target.value);
  });

  return select;
}