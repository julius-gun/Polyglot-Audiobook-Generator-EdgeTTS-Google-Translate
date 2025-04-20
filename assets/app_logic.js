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
//   - fetchTranslation (translation_api.js) // Added dependency

// Handler function to decide which generation process to start
async function handleGenerateButtonClick() {
    console.log("Generate button clicked - deciding mode...");
    const sourceText = document.getElementById('source-text').value;

    if (!sourceText || sourceText.trim() === "") {
        // Use translated alert via fetchTranslation
        alert(fetchTranslation('alertEnterSourceText', currentLanguage));
        return;
    }

    // Check if any target language containers are visible
    const tl1Visible = !document.getElementById('tl1-container')?.classList.contains('hide');
    const tl2Visible = !document.getElementById('tl2-container')?.classList.contains('hide');
    const tl3Visible = !document.getElementById('tl3-container')?.classList.contains('hide');
    const tl4Visible = !document.getElementById('tl4-container')?.classList.contains('hide');

    if (tl1Visible || tl2Visible || tl3Visible || tl4Visible) {
        console.log("Mode: Bilingual Generation");
        // At least one target language is active, run bilingual generation
        await generateBilingualBook();
    } else {
        console.log("Mode: Single Language Audiobook Generation");
        // No target languages active, run single language audio generation
        await generateSingleLanguageAudiobook();
    }
}




