// main.js - Entry point and orchestration

// --- Global Variables ---
let currentLanguage = 'en'; // Default language
const uiTranslationsCache = {}; // Cache for UI translations (Note: fetchTranslation now uses cookies, this might be redundant)
// languageData is now in language_data.js
// prioritizedLanguages is now in config.js
// translations is now in ui_translations.js
// voicesData is now in voices-data.js

// Calculate language codes and max length after languageData is loaded
let languageCodes = [];
let maxCodeLength = 0;

// --- Initialization ---

// Modify DOMContentLoaded to set initial UI language and populate dropdowns
document.addEventListener('DOMContentLoaded', async () => {
  // Calculate globals dependent on languageData
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
  // updateUI is now defined in ui.js
  await updateUI(); // This will now handle initial population and translation

  // --- Populate Voice Dropdowns ---
  // REMOVED: populateVoiceDropdowns(); // This is now handled within updateUI

  // Attach event listeners after the initial UI is built
  // attachEventListeners is now defined in ui.js
  attachEventListeners();
});


// --- Core Application Logic ---

// Depends on: detectLanguage (translation_api.js), splitIntoSentences (translation_utils.js),
// mergeShortSentences (translation_utils.js), createTranslationBatches (translation_utils.js),
// updateProgress (ui.js), translateBatch (translation_api.js), displayTranslatedBatch (ui.js),
// sleep (translation_utils.js)
async function generateBilingualBook() {
  console.log("Generate button clicked"); // ADDED: Debug log
  const sourceText = document.getElementById('source-text').value;
  let sourceLang = document.getElementById('sl').value;
  // Get selected voices
  const sourceVoice = document.getElementById('sl-voice').value; // Get source voice

  if (sourceLang === 'auto') {
    sourceLang = await detectLanguage(sourceText) || 'en'; // Default to English if detection fails
    // Note: If sourceLang was 'auto', sourceVoice might not be relevant or might need special handling depending on TTS capabilities.
    // For now, we just capture the selected voice, assuming the user selected one appropriate for potential detected languages or a multilingual voice.
  }
  const targetLangs = [];
  const targetVoices = []; // Array to store target voices
  const maxLanguages = 4;
  // Collect target languages AND voices from visible dropdowns
  for (let i = 1; i <= maxLanguages; i++) {
    const container = document.getElementById(`tl${i}-container`);
    if (!container.classList.contains('hide')) {
      const langSelect = document.getElementById(`tl${i}`);
      const voiceSelect = document.getElementById(`tl${i}-voice`); // Get voice select
      if (langSelect && langSelect.value) {
        targetLangs.push(langSelect.value);
        // Add the corresponding voice, ensuring the voice select exists
        targetVoices.push(voiceSelect ? voiceSelect.value : null); // Store null if voice select not found (shouldn't happen)
      }
    }
  }

  // --- ADDED: Log selected languages and voices for debugging ---
  console.log("Source Language:", sourceLang);
  console.log("Source Voice:", sourceVoice);
  console.log("Target Languages:", targetLangs);
  console.log("Target Voices:", targetVoices);
  // --- END ADDED ---


  const bookContainer = document.getElementById('output');
  bookContainer.innerHTML = '';

  // Show progress bar
  document.getElementById('progress-container').style.display = 'block';
  document.getElementById('progress-info').style.display = 'block'; // Ensure progress info is visible

  const sentences = splitIntoSentences(sourceText);
  const mergedSentences = mergeShortSentences(sentences); // Merge short sentences
  const batches = createTranslationBatches(mergedSentences, 600);  // 600 char limit
  const totalSentences = mergedSentences.length;
  let translatedSentencesCount = 0;
  let startTime = Date.now();

  // Initialize progress bar
  updateProgress(0, totalSentences, startTime);

  // Translate batches concurrently
  const translationPromises = batches.map(batch =>
    translateBatch(batch, sourceLang, targetLangs, currentLanguage)
  );

  // Use Promise.all to wait for all batches, but process each as it completes
  for (const promise of translationPromises) {
    const { batch: translatedBatch, translations: batchTranslations } = await promise; // Renamed local variable
    displayTranslatedBatch(translatedBatch, batchTranslations, sourceLang, targetLangs);

    translatedSentencesCount += translatedBatch.length;
    updateProgress(translatedSentencesCount, totalSentences, startTime);
    await sleep(100, 300); // Random delay
  }

  // --- MODIFICATION START ---
  // Comment out or remove the lines that delete the '.del' element
  // const elementToDelete = document.querySelector('.del');
  // if (elementToDelete) {
  //   elementToDelete.remove();
  // }

  // Optionally keep or remove the info element
  const infoElement = document.querySelector('#info');
  if (infoElement) {
    // infoElement.remove(); // Keep this line if you still want to remove the info box
    // Or hide it instead:
    // infoElement.classList.add('hide');
  }

  // Comment out or remove this line as it's likely not needed anymore
  // text = document.body.innerHTML.replaceAll(" ", "");
  // --- MODIFICATION END ---


  document.getElementById('translation-finished-message').classList.remove('hide');
  // Remove 'hide' class from each button individually
  document.getElementById('open-book-view-button').classList.remove('hide');
  document.getElementById('save-epub-button').classList.remove('hide');
  document.getElementById('reload-page-button').classList.remove('hide');

}