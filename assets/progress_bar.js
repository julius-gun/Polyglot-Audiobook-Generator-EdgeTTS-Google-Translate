// Contains logic for updating the translation progress bar and ETA display.

// Depends on:
// - Globals: currentLanguage (main.js), translations (ui_translations.js)
// - Functions: formatTime (ui_helpers.js)

function updateProgress(translated, total, startTime) {
    const progressBar = document.getElementById('progress-bar');
    const progressInfo = document.getElementById('progress-info');
    const percent = total === 0 ? 0 : Math.round((translated / total) * 100);

  // Ensure elements exist before trying to modify them
  if (progressBar) {
    progressBar.style.width = percent + '%';
    progressBar.textContent = percent + '%';
  } else {
      console.warn("Progress bar element ('progress-bar') not found.");
  }
  
  if (progressInfo) {
    const elapsedTime = Date.now() - startTime;
    const estimatedTotalTime = (translated === 0 || total === 0) ? 0 : (elapsedTime * (total / translated)); // Avoid division by zero
    const estimatedTimeRemaining = Math.max(0, estimatedTotalTime - elapsedTime); // Prevent negative time
  
    // Defensive check: Ensure translations[currentLanguage] exists before accessing properties
    const currentLangTranslations = translations[currentLanguage] || translations['en']; // Fallback to English if not loaded
      const translatedText = currentLangTranslations.translated || 'Translated'; // Fallback text
      const etaText = currentLangTranslations.eta || 'ETA'; // Fallback text
    const calculatingText = currentLangTranslations.calculating || 'Calculating...'; // Add fallback
  
      // formatTime is defined in ui_helpers.js
    const etaString = (translated === 0 || total === 0 || !isFinite(estimatedTimeRemaining)) ? calculatingText : formatTime(estimatedTimeRemaining);
  
  
    progressInfo.innerHTML = `
            <span>${translatedText}: ${translated} / ${total}</span> |
            <span>${etaText}: ${etaString}</span>
        `;
  } else {
      console.warn("Progress info element ('progress-info') not found.");
  }
  }
  
// Note: If audio generation requires a separate progress update function (e.g., updateAudioProgress),
// it might also belong in this file or a dedicated audio_progress.js file.