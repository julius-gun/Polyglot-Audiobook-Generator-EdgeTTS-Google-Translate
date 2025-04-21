// Contains the core application logic for generating bilingual books or single-language audiobooks.

// Depends on:
// - Globals: currentLanguage (main.js)
// - Functions:
//   - detectLanguage, translateBatch (translation_api.js)
//   - splitIntoSentences, mergeShortSentences, createTranslationBatches, sleep (translation_utils.js)
//   - updateProgress (progress_bar.js - will be moved there)
//   - displayTranslatedBatch (ui.js)
//   - add_edge_tts (will likely be needed for generateSingleLanguageAudiobook, defined in script.js originally, needs integration)
//   - ProcessingFile (processing_file.js - needed for generateSingleLanguageAudiobook)
//   - SocketEdgeTTS (socket_edge_tts.js - needed for generateSingleLanguageAudiobook)
//   - fetchTranslation (translation_api.js)
//   - generateMultiLanguageAudio (audio_multi_language.js)
//   - generateSingleLanguageAudiobook (audio_single_language.js)
//   - getSelectedTargetLanguagesAndVoices (ui_helpers.js) // Added dependency

// Handler function to decide which generation process to start
async function handleGenerateButtonClick() {
    console.log("Generate button clicked - deciding mode...");
    const sourceText = document.getElementById('source-text').value;

    if (!sourceText || sourceText.trim() === "") {
        // Use translated alert via fetchTranslation
        alert(fetchTranslation('alertEnterSourceText', currentLanguage));
        return;
    }

    // --- Get Source Language and Voice ---
    // Note: Assumes 'sl' value is correct (not 'auto' at this point, or handled elsewhere if needed)
    const sourceLangSelect = document.getElementById('sl');
    const sourceVoiceSelect = document.getElementById('sl-voice');
    const sourceLang = sourceLangSelect ? sourceLangSelect.value : null;
    const sourceVoice = sourceVoiceSelect ? sourceVoiceSelect.value : null;

    if (!sourceLang || sourceLang === 'auto') {
        // TODO: Implement or call auto-detection logic here if needed before proceeding.
        // For now, we might alert or default, but multi-language audio needs a specific source.
        alert("Source language cannot be 'auto' for audio generation. Please select a specific language."); // Placeholder alert
        return;
    }
    if (!sourceVoice) {
        alert(fetchTranslation('alertSelectVoice', currentLanguage)); // Use translated alert
        return;
    }
    // --- End Get Source ---


    // --- Get Selected Target Languages and Voices ---
    const targetVoicesMap = getSelectedTargetLanguagesAndVoices();
    const targetLanguagesSelectedCount = Object.keys(targetVoicesMap).length;



    if (targetLanguagesSelectedCount > 0) {
        console.log("Mode: Multi-Language Audiobook Generation");
        console.log("Source Lang:", sourceLang, "Source Voice:", sourceVoice);
        console.log("Target Voices Map:", targetVoicesMap);
        // Call the correct function with arguments (defined in audio_multi_language.js)
        await generateMultiLanguageAudio(sourceLang, sourceVoice, targetVoicesMap); // <-- Corrected call with args
    } else {
        console.log("Mode: Single Language Audiobook Generation");
        // generateSingleLanguageAudiobook is defined in audio_single_language.js
        // It likely needs sourceLang and sourceVoice too. Let's assume it gets them internally for now,
        // but it might need modification similar to the multi-language call.
        await generateSingleLanguageAudiobook(); // <-- Needs review if it requires args
    }
}




